// ============================================================================
// PANTAU BELAJAR — APP-GURU.JS (v9.0 — PERIODE OTOMATIS, 360° CHARTS & AI GEMINI)
// ============================================================================
const GOOGLE_OAUTH_CLIENT_ID = '565864753824-3ahjeunj19r6am2fgg2n1fv721kqfp77.apps.googleusercontent.com';

let currentUser = null;
let adminMode = 'teachers';
let classesCache = [];
let ampuanCache = [];
let activeClassId = null;
let activeAmpuanId = null;
let isSharedClassLocked = false;

// Manajemen Periode Akademik Otomatis
let periodsCache = [];
let currentDatePeriodName = '';
let activePeriodName = '';

let studentsCache = [];
let allStudentsGlobal = [];
let assessmentsCache = [];
let scoresCache = [];
let attLogsCache = [];
let attRecapCache = [];
let finalGradesCache = [];
let materialsCache = [];
let materialReadsCache = [];
let materialReadsTableAvailable = true;
let openMaterialReadersIds = new Set();
let announcementsCache = [];
let announcementCommentsCache = [];
let selectedStudentIds = new Set();
let deleteTargetIds = [];
let groupPresetsCache = [];
let modalGroupMap = {};
let binaanIdsCache = new Set();
let activeWaliStudentId = null;
let globalSearchQuery = '';
let chartInstances = {};
let activeGuruTab = 'dashboard';
let guruRealtimeChannel = null;
let guruRealtimeRefreshTimer = null;
let attendanceSessionsCache = [];
let attendanceSessionsTableAvailable = true;
let guruQrCountdownTimer = null;
let quizBuilderAssId = null;
let quizBuilderDraft = { duration_minutes: 20, shuffle: false, show_review: true, questions: [] };

function escapeHtmlSafe(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// ==================== LAZY LOADER LIBRARY BERAT & MODAL KONFIRMASI ====================
const _externalScriptPromises = {};
function ensureExternalScript(url) {
    if (_externalScriptPromises[url]) return _externalScriptPromises[url];
    const existing = document.querySelector(`script[src="${url}"]`);
    if (existing && existing.dataset.loaded === 'true') {
        return Promise.resolve();
    }
    _externalScriptPromises[url] = new Promise((resolve, reject) => {
        const s = document.createElement('script');
        s.src = url;
        s.async = true;
        s.onload = () => {
            s.dataset.loaded = 'true';
            resolve();
        };
        s.onerror = () => {
            delete _externalScriptPromises[url];
            reject(new Error(`Gagal memuat modul eksternal: ${url}`));
        };
        document.head.appendChild(s);
    });
    return _externalScriptPromises[url];
}

async function ensureXlsxLoaded() {
    if (typeof window.XLSX !== 'undefined') return true;
    showToast('⏳ Memuat modul Excel...', 'info');
    try {
        await ensureExternalScript('https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js');
        return typeof window.XLSX !== 'undefined';
    } catch (err) {
        console.error(err);
        showToast('Gagal memuat modul Excel. Periksa koneksi internet Anda.', 'error');
        return false;
    }
}

async function ensureJsPdfLoaded() {
    if (window.jspdf && window.jspdf.jsPDF && window.jspdf.jsPDF.API && typeof window.jspdf.jsPDF.API.autoTable === 'function') {
        return true;
    }
    showToast('⏳ Memuat modul cetak PDF...', 'info');
    try {
        if (!window.jspdf || !window.jspdf.jsPDF) {
            await ensureExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js');
        }
        if (!(window.jspdf?.jsPDF?.API && typeof window.jspdf.jsPDF.API.autoTable === 'function')) {
            await ensureExternalScript('https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.5.31/jspdf.plugin.autotable.min.js');
        }
        return Boolean(window.jspdf && window.jspdf.jsPDF);
    } catch (err) {
        console.error(err);
        showToast('Gagal memuat modul PDF. Periksa koneksi internet Anda.', 'error');
        return false;
    }
}

async function ensureQrCodeLoaded() {
    if (typeof window.QRCode !== 'undefined') return true;
    try {
        await ensureExternalScript('https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js');
        return typeof window.QRCode !== 'undefined';
    } catch (err) {
        console.error(err);
        return false;
    }
}

function showAppConfirm(message, options = {}) {
    const modal = document.getElementById('modal-app-confirm');
    const titleEl = document.getElementById('app-confirm-title');
    const msgEl = document.getElementById('app-confirm-message');
    const iconEl = document.getElementById('app-confirm-icon');
    const btnOk = document.getElementById('btn-app-confirm-ok');
    const btnCancel = document.getElementById('btn-app-confirm-cancel');

    if (!modal || !btnOk || !btnCancel) {
        return Promise.resolve(false);
    }

    const tone = options.tone || 'danger';
    if (titleEl) titleEl.innerText = options.title || 'Konfirmasi Tindakan';
    if (msgEl) msgEl.innerText = message || 'Apakah Anda yakin ingin melanjutkan?';
    btnOk.innerText = options.confirmText || 'Ya, Lanjutkan';
    btnCancel.innerText = options.cancelText || 'Batal';

    if (iconEl) {
        if (tone === 'primary') {
            iconEl.className = 'w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-950/70 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 text-base';
            iconEl.innerHTML = '<i class="fa-solid fa-circle-question"></i>';
        } else {
            iconEl.className = 'w-10 h-10 rounded-xl bg-rose-100 dark:bg-rose-950/70 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 text-base';
            iconEl.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
        }
    }

    btnOk.className = tone === 'primary'
        ? 'px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition'
        : 'px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold shadow-sm transition';

    modal.classList.remove('hidden');

    return new Promise((resolve) => {
        const cleanup = (result) => {
            modal.classList.add('hidden');
            btnOk.removeEventListener('click', onOk);
            btnCancel.removeEventListener('click', onCancel);
            modal.removeEventListener('click', onBackdrop);
            document.removeEventListener('keydown', onKeydown);
            resolve(result);
        };
        const onOk = () => cleanup(true);
        const onCancel = () => cleanup(false);
        const onBackdrop = (ev) => {
            if (ev.target === modal) cleanup(false);
        };
        const onKeydown = (ev) => {
            if (ev.key === 'Escape') cleanup(false);
        };

        btnOk.addEventListener('click', onOk);
        btnCancel.addEventListener('click', onCancel);
        modal.addEventListener('click', onBackdrop);
        document.addEventListener('keydown', onKeydown);
    });
}

function toggleMobileWorkspacePanel(forceClose = false) {
    const panel = document.getElementById('guru-workspace-controls');
    const chevron = document.getElementById('mobile-ws-chevron');
    if (!panel) return;
    if (forceClose) {
        panel.classList.add('hidden');
        if (chevron) chevron.classList.remove('rotate-180');
        return;
    }
    const isNowHidden = panel.classList.toggle('hidden');
    if (chevron) chevron.classList.toggle('rotate-180', !isNowHidden);
}

// Cache Global & State Modal 360° Guru Wali
let waliMetricsCache = {};
let waliGlobalSettings = [];
let waliGlobalUsers = [];
let waliGlobalAssessments = [];
let waliGlobalScores = [];
let waliGlobalAttLogs = [];
let waliGlobalAttRecap = [];
let waliActiveHistoricalGrades = [];
let waliCurrentAIAnalysisText = '';
let waliCurrentTimelineData = null;
let waliCurrentSWData = null;
let waliActiveLogsCache = [];

// ==================== 1. INISIALISASI, TEMA & AUTENTIKASI ====================
window.addEventListener('DOMContentLoaded', async () => {
    // Dengarkan perubahan tema perangkat secara otomatis jika user belum memilih manual
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('sipantau_theme')) {
            document.documentElement.classList.toggle('dark', e.matches);
            refreshVisibleChartsTheme();
        }
    });

    const saved = localStorage.getItem('sipantau_user');
    if (saved) {
        try {
            currentUser = JSON.parse(saved);
            const { data: freshUser } = await db.from('app_users').select('*').eq('id', currentUser.id).single();
            if (freshUser) {
                currentUser = freshUser;
                localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
            }
            await routeByRole();
        } catch (e) {
            localStorage.removeItem('sipantau_user');
            showSection('view-login');
        }
    } else {
        showSection('view-login');
    }

    setTimeout(() => {
        updateGDriveConnectionUI();
        updateGeminiKeyUI();
        handleGoogleOAuthCallback();
    }, 300);
});

function toggleAppTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('sipantau_theme', isDark ? 'dark' : 'light');
    refreshVisibleChartsTheme();
}

function getChartThemeColors() {
    const isDark = document.documentElement.classList.contains('dark');
    return {
        isDark,
        text: isDark ? '#cbd5e1' : '#475569',
        heading: isDark ? '#f8fafc' : '#0f172a',
        grid: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.22)',
        tooltipBg: isDark ? '#1e293b' : '#0f172a'
    };
}

function refreshVisibleChartsTheme() {
    if (!document.getElementById('gcontent-dashboard')?.classList.contains('hidden')) renderDashboard();
    if (!document.getElementById('gcontent-rekap')?.classList.contains('hidden')) renderRekapTab();
    if (!document.getElementById('modal-wali-360')?.classList.contains('hidden') && activeWaliStudentId) {
        renderWali360Visuals(activeWaliStudentId);
    }
}

function showSection(id) {
    ['view-login', 'view-admin', 'view-guru'].forEach(sec => {
        const el = document.getElementById(sec);
        if (el) el.classList.toggle('hidden', sec !== id);
    });
}

async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value;

    const { data, error } = await db.from('app_users')
        .select('*')
        .eq('username', u)
        .eq('password', p)
        .single();

    if (error || !data) {
        return showToast('Username atau password salah!', 'error');
    }

    currentUser = data;
    localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
    showToast(`Selamat datang, ${currentUser.nama_lengkap}!`);
    await routeByRole();
}

async function routeByRole() {
    if (!currentUser) return showSection('view-login');

    if (currentUser.role === 'admin') {
        showSection('view-admin');
        document.getElementById('admin-nav-switcher')?.classList.remove('hidden');
        document.getElementById('admin-nav-switcher')?.classList.add('flex');
        await loadAdminUsers();
    } else {
        showSection('view-guru');
        setupTopbarUser();
        await initGuruWorkspace();
    }
}

function setupTopbarUser() {
    const badge = document.getElementById('user-badge');
    if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
    }
    const fullName = currentUser.nama_lengkap || currentUser.username || 'Guru';
    const initials = fullName.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('topbar-avatar').innerText = initials;
    document.getElementById('user-display-name').innerText = fullName;
    document.getElementById('user-role-subtitle').innerText = currentUser.role === 'admin' ? 'Administrator' : 'Guru & Pembimbing';
    updateGDriveConnectionUI();
    updateGeminiKeyUI();
}

function logout() {
    if (guruRealtimeChannel && typeof db.removeChannel === 'function') {
        db.removeChannel(guruRealtimeChannel);
        guruRealtimeChannel = null;
    }
    if (guruQrCountdownTimer) {
        clearInterval(guruQrCountdownTimer);
        guruQrCountdownTimer = null;
    }
    if (guruChatAbortController) {
        guruChatAbortController.abort();
        guruChatAbortController = null;
    }
    guruChatHistory = [];
    guruChatReplyStore = {};
    guruChatInitialized = false;
    toggleGuruAiChat(false);
    localStorage.removeItem('sipantau_user');
    currentUser = null;
    showSection('view-login');
}

function openPasswordModal() { document.getElementById('modal-password').classList.remove('hidden'); }
function closePasswordModal() { document.getElementById('modal-password').classList.add('hidden'); }

async function handleChangePassword(e) {
    e.preventDefault();
    const oldP = document.getElementById('cp-old').value;
    const newP = document.getElementById('cp-new').value;
    const confP = document.getElementById('cp-confirm').value;

    if (oldP !== currentUser.password) return showToast('Password lama tidak sesuai!', 'error');
    if (newP !== confP) return showToast('Konfirmasi password baru tidak cocok!', 'error');

    const { error } = await db.from('app_users').update({ password: newP }).eq('id', currentUser.id);
    if (error) return showToast('Gagal mengubah password: ' + error.message, 'error');

    currentUser.password = newP;
    localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
    closePasswordModal();
    e.target.reset();
    showToast('✅ Password berhasil diperbarui!');
}

// ==================== 1B. ENGINE PERIODE AKADEMIK OTOMATIS ====================
function detectPeriodFromDate(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1; // 1 - 12
    const semester = month <= 6 ? 'Genap' : 'Ganjil';
    return {
        nama_periode: `Semester ${semester} ${year}`,
        semester,
        tahun: year,
        tanggal_mulai: month <= 6 ? `${year}-01-01` : `${year}-07-01`,
        tanggal_selesai: month <= 6 ? `${year}-06-30` : `${year}-12-31`
    };
}

async function initAcademicPeriods() {
    const todayInfo = detectPeriodFromDate(new Date());
    currentDatePeriodName = todayInfo.nama_periode;

    // Pastikan periode hari ini otomatis terdaftar di database
    await db.from('academic_periods').upsert([todayInfo], { onConflict: 'nama_periode' });

    const { data } = await db.from('academic_periods')
        .select('*')
        .order('tahun', { ascending: false })
        .order('semester', { ascending: true });

    periodsCache = data || [todayInfo];
    if (!activePeriodName) activePeriodName = currentDatePeriodName;

    const sel = document.getElementById('guru-active-period');
    if (sel) {
        sel.innerHTML = periodsCache.map(p => {
            const isNow = p.nama_periode === currentDatePeriodName;
            const shortLabel = String(p.nama_periode || '').replace(/^Semester\s+/i, '');
            return `<option value="${p.nama_periode}">${shortLabel}${isNow ? '' : ' (Arsip)'}</option>`;
        }).join('');
        sel.value = activePeriodName;
    }

    updateArchivePeriodBanner();
}

function updateArchivePeriodBanner() {
    const banner = document.getElementById('archive-period-banner');
    const lbl = document.getElementById('archive-period-label');
    if (!banner) return;
    const isArchive = activePeriodName && activePeriodName !== currentDatePeriodName;
    banner.classList.toggle('hidden', !isArchive);
    if (lbl) lbl.innerText = activePeriodName;
}

async function onGuruPeriodChange() {
    const sel = document.getElementById('guru-active-period');
    activePeriodName = sel?.value || currentDatePeriodName;
    updateArchivePeriodBanner();
    await loadWorkspaceData();
    if (!document.getElementById('gcontent-wali')?.classList.contains('hidden')) {
        await loadGuruWaliTab();
    }
}

async function resetToCurrentDatePeriod() {
    activePeriodName = currentDatePeriodName;
    const sel = document.getElementById('guru-active-period');
    if (sel) sel.value = activePeriodName;
    updateArchivePeriodBanner();
    await loadWorkspaceData();
    if (!document.getElementById('gcontent-wali')?.classList.contains('hidden')) {
        await loadGuruWaliTab();
    }
}

// ==================== 2. PANEL ADMINISTRATOR ====================
async function switchAdminMode(mode) {
    adminMode = mode;
    if (mode === 'teachers') {
        showSection('view-admin');
        document.getElementById('adm-tab-teachers').className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-600 text-white';
        document.getElementById('adm-tab-students').className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600 dark:text-slate-300';
        await loadAdminUsers();
    } else {
        showSection('view-guru');
        setupTopbarUser();
        await initAcademicPeriods();
        document.getElementById('admin-student-mode-banner').classList.remove('hidden');
        isSharedClassLocked = false;
        updateStudentLockUI();
        await loadAllClasses();
        const clsSel = document.getElementById('guru-active-class');
        clsSel.innerHTML = classesCache.map(c => `<option value="${c.id}">${c.nama_kelas}</option>`).join('');
        if (classesCache.length) {
            activeClassId = classesCache[0].id;
            clsSel.value = activeClassId;
            await loadWorkspaceData();
        }
        switchGuruTab('kelas');
    }
}

async function loadAdminUsers() {
    const { data } = await db.from('app_users').select('*').order('id');
    const tbody = document.getElementById('adm-user-list');
    if (!tbody) return;
    tbody.innerHTML = (data || []).map(u => `
        <tr>
            <td class="p-3 font-bold text-slate-900 dark:text-white">${u.nama_lengkap || '-'}</td>
            <td class="p-3 font-mono text-xs">${u.username}</td>
            <td class="p-3 text-xs space-x-1">
                ${u.gdrive_email ? `<span class="text-emerald-600 font-bold">☁️ Drive</span>` : ''}
                ${u.gemini_api_key ? `<span class="text-indigo-600 font-bold">✨ AI Mandiri</span>` : ''}
                ${!u.gdrive_email && !u.gemini_api_key ? '<span class="text-slate-400">Standar</span>' : ''}
            </td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${u.role}</span></td>
            <td class="p-3 text-right space-x-1">
                <button onclick="openEditTeacherModal(${u.id}, '${(u.nama_lengkap || '').replace(/'/g, "\\'")}', '${u.username}')" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold">Edit</button>
                <button onclick="resetTeacherPassword(${u.id})" class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">Reset PW</button>
                ${u.role !== 'admin' ? `<button onclick="deleteTeacher(${u.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold">Hapus</button>` : ''}
            </td>
        </tr>
    `).join('');
}

async function addTeacher(e) {
    e.preventDefault();
    const nama_lengkap = document.getElementById('adm-nama').value.trim();
    const username = document.getElementById('adm-user').value.trim().toLowerCase();
    const { error } = await db.from('app_users').insert([{ nama_lengkap, username, password: '123', role: 'guru' }]);
    if (error) return showToast('Gagal menambah guru: ' + error.message, 'error');
    e.target.reset();
    showToast('✅ Akun guru dibuat (Password default: 123)');
    await loadAdminUsers();
}

function openEditTeacherModal(id, nama, username) {
    document.getElementById('edit-tch-id').value = id;
    document.getElementById('edit-tch-nama').value = nama;
    document.getElementById('edit-tch-user').value = username;
    document.getElementById('modal-edit-teacher').classList.remove('hidden');
}
function closeEditTeacherModal() { document.getElementById('modal-edit-teacher').classList.add('hidden'); }

async function handleUpdateTeacher(e) {
    e.preventDefault();
    const id = document.getElementById('edit-tch-id').value;
    const nama_lengkap = document.getElementById('edit-tch-nama').value.trim();
    const username = document.getElementById('edit-tch-user').value.trim();
    const { error } = await db.from('app_users').update({ nama_lengkap, username }).eq('id', id);
    if (error) return showToast('Gagal update: ' + error.message, 'error');
    closeEditTeacherModal();
    showToast('✅ Data guru diperbarui');
    await loadAdminUsers();
}

async function resetTeacherPassword(id) {
    const ok = await showAppConfirm('Password guru akan direset kembali menjadi "123". Lanjutkan?', {
        title: 'Reset Password Guru',
        confirmText: 'Ya, Reset',
        tone: 'primary'
    });
    if (!ok) return;
    await db.from('app_users').update({ password: '123' }).eq('id', id);
    showToast('✅ Password direset ke: 123');
}

async function deleteTeacher(id) {
    const ok = await showAppConfirm('Hapus akun guru ini secara permanen? Data yang terhubung mungkin terpengaruh.', {
        title: 'Hapus Akun Guru',
        confirmText: 'Hapus Permanen',
        tone: 'danger'
    });
    if (!ok) return;
    await db.from('app_users').delete().eq('id', id);
    showToast('Akun guru dihapus.');
    await loadAdminUsers();
}

async function resetStudentPasswordToNISN(studentId, nisn, nama) {
    const ok = await showAppConfirm(`Reset password LMS siswa "${nama}" kembali ke NISN (${nisn})?`, {
        title: 'Reset Password Siswa',
        confirmText: 'Ya, Reset ke NISN',
        tone: 'primary'
    });
    if (!ok) return;
    const { error } = await db.from('students').update({ password: String(nisn) }).eq('id', studentId);
    if (error) return showToast('Gagal mereset password siswa: ' + error.message, 'error');
    showToast(`✅ Password "${nama}" berhasil direset ke NISN: ${nisn}`);
}

// ==================== 3. WORKSPACE GURU ====================
async function initGuruWorkspace() {
    document.getElementById('admin-student-mode-banner').classList.add('hidden');
    await initAcademicPeriods();
    await loadAllClasses();
    await loadTeacherAmpuan();
    const today = new Date().toISOString().split('T')[0];
    const datePicker = document.getElementById('abs-date-picker');
    if (datePicker && !datePicker.value) datePicker.value = today;
    switchGuruTab('dashboard');
}

async function loadAllClasses() {
    const { data } = await db.from('classes').select('*').order('nama_kelas');
    classesCache = data || [];
}

async function loadTeacherAmpuan() {
    const { data } = await db.from('teacher_settings')
        .select('*, classes(nama_kelas)')
        .eq('teacher_id', currentUser.id)
        .order('id');
    ampuanCache = data || [];

    const clsSel = document.getElementById('guru-active-class');
    const uniqueClassIds = [...new Set(ampuanCache.map(a => Number(a.class_id)))];
    const availableClasses = classesCache.filter(c => uniqueClassIds.includes(Number(c.id)));

    clsSel.innerHTML = availableClasses.length
        ? availableClasses.map(c => `<option value="${c.id}">${c.nama_kelas}</option>`).join('')
        : `<option value="">-- Belum Ada Kelas --</option>`;

    if (availableClasses.length > 0) {
        if (!activeClassId || !uniqueClassIds.includes(Number(activeClassId))) {
            activeClassId = availableClasses[0].id;
        }
        clsSel.value = activeClassId;
    } else {
        activeClassId = null;
    }

    renderTeacherAmpuanCards();
    await onGuruClassDropdownChange();
}

function renderTeacherAmpuanCards() {
    const container = document.getElementById('teacher-ampuan-cards');
    if (!container) return;
    container.innerHTML = ampuanCache.map(a => {
        const isActive = Number(a.id) === Number(activeAmpuanId);
        return `
            <button type="button" onclick="selectAmpuanShortcut(${a.class_id}, ${a.id})"
                class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold border shrink-0 transition ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:bg-blue-50'}">
                ${a.classes?.nama_kelas || 'Kelas'} • ${a.mapel}
            </button>
        `;
    }).join('');
}

async function selectAmpuanShortcut(classId, ampuanId) {
    activeClassId = Number(classId);
    activeAmpuanId = Number(ampuanId);
    document.getElementById('guru-active-class').value = activeClassId;
    toggleMobileWorkspacePanel(true);
    await onGuruClassDropdownChange(true);
}

async function onGuruClassDropdownChange(keepAmpuan = false) {
    const clsVal = document.getElementById('guru-active-class').value;
    activeClassId = clsVal ? Number(clsVal) : null;

    if (adminMode === 'students' && currentUser.role === 'admin') {
        await checkSharedClassLock();
        await loadWorkspaceData();
        return;
    }

    const mapelSel = document.getElementById('guru-active-mapel');
    const classAmpuans = ampuanCache.filter(a => Number(a.class_id) === Number(activeClassId));

    mapelSel.innerHTML = classAmpuans.length
        ? classAmpuans.map(a => `<option value="${a.id}">${a.mapel}</option>`).join('')
        : `<option value="">-- Belum Ada Mapel --</option>`;

    if (classAmpuans.length > 0) {
        if (!keepAmpuan || !classAmpuans.some(a => Number(a.id) === Number(activeAmpuanId))) {
            activeAmpuanId = classAmpuans[0].id;
        }
        mapelSel.value = activeAmpuanId;
    } else {
        activeAmpuanId = null;
    }

    await checkSharedClassLock();
    await onGuruMapelDropdownChange();
}

async function checkSharedClassLock() {
    isSharedClassLocked = false;
    const banner = document.getElementById('shared-class-lock-banner');
    const infoSpan = document.getElementById('shared-class-teachers-info');

    if (!activeClassId || currentUser?.role === 'admin') {
        if (banner) banner.classList.add('hidden');
        updateStudentLockUI();
        return;
    }

    const { data: allSettingsInClass } = await db
        .from('teacher_settings')
        .select('teacher_id, mapel, app_users(nama_lengkap)')
        .eq('class_id', activeClassId);

    const uniqueTeacherIds = [...new Set((allSettingsInClass || []).map(r => Number(r.teacher_id)))];
    if (uniqueTeacherIds.length > 1) {
        isSharedClassLocked = true;
        const listGuru = (allSettingsInClass || [])
            .map(r => `${r.app_users?.nama_lengkap || 'Guru'} (${r.mapel})`)
            .join(', ');
        if (infoSpan) {
            infoSpan.innerText = `Kelas ini diampu bersama oleh ${uniqueTeacherIds.length} guru (${listGuru}). Penambahan, pengeditan, maupun penghapusan data siswa dikunci otomatis. Hubungi Administrator jika terdapat perubahan siswa.`;
        }
        if (banner) banner.classList.remove('hidden');
    } else {
        if (banner) banner.classList.add('hidden');
    }

    updateStudentLockUI();
}

function updateStudentLockUI() {
    const boxManual = document.getElementById('box-add-student-manual');
    const boxImport = document.getElementById('box-import-student-excel');
    const bulkBar = document.getElementById('stu-bulk-actions-bar');
    const thCheck = document.getElementById('th-stu-check');

    if (boxManual) boxManual.classList.toggle('hidden', isSharedClassLocked);
    if (boxImport) boxImport.classList.toggle('hidden', isSharedClassLocked);
    if (bulkBar) bulkBar.classList.toggle('hidden', isSharedClassLocked);
    if (thCheck) thCheck.classList.toggle('hidden', isSharedClassLocked);
}

async function onGuruMapelDropdownChange() {
    const ampVal = document.getElementById('guru-active-mapel').value;
    activeAmpuanId = ampVal ? Number(ampVal) : null;
    renderTeacherAmpuanCards();

    const activeAmp = getActiveAmpuan();
    const clsObj = classesCache.find(c => Number(c.id) === Number(activeClassId));
    const wsText = activeAmp
        ? `${clsObj?.nama_kelas || ''} — ${activeAmp.mapel}`
        : (clsObj?.nama_kelas || 'Belum Dipilih');
    const kkmText = `KKM: ${activeAmp?.kkm || 75}`;

    const wsLabel = document.getElementById('workspace-label');
    if (wsLabel) wsLabel.innerText = wsText;
    const wsKkm = document.getElementById('workspace-kkm-label');
    if (wsKkm) wsKkm.innerText = kkmText;
    const wsLabelMob = document.getElementById('workspace-label-mobile');
    if (wsLabelMob) wsLabelMob.innerText = wsText;
    const wsKkmMob = document.getElementById('workspace-kkm-mobile');
    if (wsKkmMob) wsKkmMob.innerText = kkmText;

    populateSettingsForm();
    await loadWorkspaceData();
}

function getActiveAmpuan() {
    return ampuanCache.find(a => Number(a.id) === Number(activeAmpuanId)) || null;
}

function openAddAmpuanModal() {
    const sel = document.getElementById('amp-kelas');
    sel.innerHTML = classesCache.map(c => `<option value="${c.id}">${c.nama_kelas}</option>`).join('');
    document.getElementById('modal-add-ampuan').classList.remove('hidden');
}
function closeAddAmpuanModal() { document.getElementById('modal-add-ampuan').classList.add('hidden'); }

async function handleAddAmpuan(e) {
    e.preventDefault();
    const class_id = Number(document.getElementById('amp-kelas').value);
    const mapel = document.getElementById('amp-mapel').value.trim();
    const kkm = Number(document.getElementById('amp-kkm').value) || 75;

    const { data, error } = await db.from('teacher_settings').insert([{
        teacher_id: currentUser.id,
        class_id,
        mapel,
        kkm,
        w_absen: 10,
        w_tugas: 30,
        w_bab: 30,
        w_uas: 30,
        p_hadir: 100,
        p_sakit: 80,
        p_izin: 80,
        p_alpa: 0,
        kelompok_template: []
    }]).select().single();

    if (error) return showToast('Gagal menambah ampuan: ' + error.message, 'error');
    closeAddAmpuanModal();
    e.target.reset();
    activeClassId = class_id;
    activeAmpuanId = data.id;
    showToast('✅ Kelas & Mata Pelajaran ditambahkan!');
    await loadTeacherAmpuan();
}

async function deleteCurrentAmpuan() {
    const amp = getActiveAmpuan();
    if (!amp) return;
    const ok = await showAppConfirm(`Hapus mata pelajaran "${amp.mapel}" dari daftar ampuan kelas ini?`, {
        title: 'Hapus Mata Pelajaran Ampuan',
        confirmText: 'Hapus Mapel',
        tone: 'danger'
    });
    if (!ok) return;
    await db.from('teacher_settings').delete().eq('id', amp.id);
    activeAmpuanId = null;
    showToast('Mata pelajaran dihapus dari daftar ampuan.');
    await loadTeacherAmpuan();
}

// ==================== 4. NAVIGASI TAB & MUAT DATA PER PERIODE ====================
function toggleMobileSidebar(forceClose = false) {
    const sb = document.getElementById('main-sidebar');
    if (!sb) return;
    if (forceClose) sb.classList.add('hidden');
    else sb.classList.toggle('hidden');
}

function switchGuruTab(tab) {
    activeGuruTab = tab;
    const tabs = ['dashboard', 'materi', 'nilai', 'absen', 'pengumuman', 'rekap', 'kelas', 'wali', 'bobot'];
    tabs.forEach(t => {
        document.getElementById(`gcontent-${t}`)?.classList.toggle('hidden', t !== tab);
        const btn = document.getElementById(`gtab-${t}`);
        if (btn) {
            btn.className = t === tab
                ? 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 transition'
                : 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
        }
    });

    // Sinkronisasi highlight Bottom Navigation Bar Mobile
    const primaryMobileTabs = ['dashboard', 'nilai', 'absen', 'materi'];
    primaryMobileTabs.forEach(t => {
        const mBtn = document.getElementById(`gmnav-${t}`);
        if (!mBtn) return;
        const isActive = tab === t;
        mBtn.classList.toggle('text-blue-600', isActive);
        mBtn.classList.toggle('dark:text-blue-400', isActive);
        mBtn.classList.toggle('font-extrabold', isActive);
        mBtn.classList.toggle('text-slate-500', !isActive);
        mBtn.classList.toggle('dark:text-slate-400', !isActive);
        mBtn.classList.toggle('font-bold', !isActive);
    });
    const moreBtn = document.getElementById('gmnav-more');
    if (moreBtn) {
        const isMoreActive = !primaryMobileTabs.includes(tab);
        moreBtn.classList.toggle('text-blue-600', isMoreActive);
        moreBtn.classList.toggle('dark:text-blue-400', isMoreActive);
        moreBtn.classList.toggle('font-extrabold', isMoreActive);
        moreBtn.classList.toggle('text-slate-500', !isMoreActive);
        moreBtn.classList.toggle('dark:text-slate-400', !isMoreActive);
        moreBtn.classList.toggle('font-bold', !isMoreActive);
    }

    if (tab === 'pengumuman' && currentUser?.id && activeClassId) {
        localStorage.setItem(`sipantau_guru_last_seen_ann_${currentUser.id}_${activeClassId}`, new Date().toISOString());
        updateGuruSidebarBadges();
    }

    if (tab === 'dashboard') renderDashboard();
    if (tab === 'materi') renderGuruMaterialsTab();
    if (tab === 'kelas') renderStudentsTable();
    if (tab === 'absen') {
        loadRecordedDates();
        loadDailyAttendanceForDate();
        renderAttendanceRecapTable();
    }
    if (tab === 'nilai') renderAssessmentsDropdown();
    if (tab === 'pengumuman') renderGuruAnnouncementsTab();
    if (tab === 'rekap') renderRekapTab();
    if (tab === 'wali') loadGuruWaliTab();
    if (tab === 'bobot') {
        populateSettingsForm();
        updateGDriveConnectionUI();
        updateGeminiKeyUI();
    }
}

function copyStudentPortalLink() {
    let url = window.location.origin + window.location.pathname;
    url = url.replace(/index\.html$/, '') + 'siswa.html';
    navigator.clipboard.writeText(url);
    showToast('🔗 Link LMS Siswa disalin: ' + url);
}

function onGlobalSearchInput(val) {
    globalSearchQuery = val.trim().toLowerCase();
    renderDashboard();
    renderStudentsTable();
}

function matchesActivePeriod(recordPeriode) {
    const target = activePeriodName || currentDatePeriodName;
    if (!recordPeriode) return target === 'Semester Ganjil 2026';
    return recordPeriode === target;
}

async function loadWorkspaceData() {
    if (!activeClassId) {
        studentsCache = [];
        assessmentsCache = [];
        scoresCache = [];
        attLogsCache = [];
        attRecapCache = [];
        finalGradesCache = [];
        materialsCache = [];
        materialReadsCache = [];
        openMaterialReadersIds.clear();
        attendanceSessionsCache = [];
        announcementsCache = [];
        announcementCommentsCache = [];
        renderDashboard();
        renderGuruQrSessionPanel();
        loadRecordedDates();
        loadDailyAttendanceForDate();
        renderAttendanceRecapTable();
        updateGuruChatContextBadge();
        return;
    }

    const activeAmp = getActiveAmpuan();
    const mapelName = activeAmp?.mapel || '';

    const [stuRes, assRes, attLogsRes, fgRes, matRes, annRes] = await Promise.all([
        db.from('students').select('*').eq('class_id', activeClassId).order('nama'),
        db.from('assessments').select('*').eq('class_id', activeClassId).eq('mapel', mapelName).order('id'),
        db.from('attendance_logs').select('*').eq('class_id', activeClassId),
        mapelName ? db.from('final_grades').select('*').eq('class_id', activeClassId).eq('mapel', mapelName) : Promise.resolve({ data: [] }),
        mapelName ? db.from('materials').select('*').eq('class_id', activeClassId).eq('mapel', mapelName).order('created_at', { ascending: false }) : Promise.resolve({ data: [] }),
        mapelName ? db.from('announcements').select('*').eq('class_id', activeClassId).eq('mapel', mapelName).order('created_at', { ascending: false }) : Promise.resolve({ data: [] })
    ]);

    studentsCache = stuRes.data || [];
    assessmentsCache = (assRes.data || []).filter(a => matchesActivePeriod(a.periode));
    attLogsCache = (attLogsRes.data || []).filter(l => (!l.mapel || l.mapel === mapelName) && matchesActivePeriod(l.periode));
    finalGradesCache = (fgRes.data || []).filter(f => matchesActivePeriod(f.periode));
    materialsCache = (matRes.data || []).filter(m => matchesActivePeriod(m.periode));
    announcementsCache = (annRes.data || []).filter(an => matchesActivePeriod(an.periode));

    const annIds = announcementsCache.map(a => a.id);
    if (annIds.length > 0) {
        const comRes = await db.from('announcement_comments').select('*').in('announcement_id', annIds).order('created_at');
        announcementCommentsCache = comRes.data || [];
    } else {
        announcementCommentsCache = [];
    }

    const stuIds = studentsCache.map(s => s.id);
    if (stuIds.length > 0 && mapelName) {
        const recapRes = await db.from('attendance').select('*').in('student_id', stuIds).eq('mapel', mapelName);
        attRecapCache = (recapRes.data || []).filter(r => matchesActivePeriod(r.periode));
    } else {
        attRecapCache = [];
    }

    const assIds = assessmentsCache.map(a => a.id);
    if (assIds.length > 0) {
        const scRes = await db.from('scores').select('*').in('assessment_id', assIds);
        scoresCache = scRes.data || [];
    } else {
        scoresCache = [];
    }

    if (materialsCache.length > 0) {
        const matIds = materialsCache.map(m => m.id);
        const mrRes = await db.from('material_reads').select('*').in('material_id', matIds);
        if (mrRes.error) {
            materialReadsTableAvailable = false;
            materialReadsCache = [];
        } else {
            materialReadsTableAvailable = true;
            materialReadsCache = mrRes.data || [];
        }
    } else {
        materialReadsCache = [];
    }

    if (mapelName) {
        const sessRes = await db.from('attendance_sessions')
            .select('*')
            .eq('class_id', activeClassId)
            .eq('mapel', mapelName)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(5);
        if (sessRes.error) {
            attendanceSessionsTableAvailable = false;
            attendanceSessionsCache = [];
        } else {
            attendanceSessionsTableAvailable = true;
            attendanceSessionsCache = (sessRes.data || []).filter(s => matchesActivePeriod(s.periode));
        }
    } else {
        attendanceSessionsCache = [];
    }

    renderDashboard();
    renderGuruMaterialsTab();
    renderStudentsTable();
    renderAssessmentsDropdown();
    renderGuruAnnouncementsTab();
    renderRekapTab();
    loadRecordedDates();
    loadDailyAttendanceForDate();
    renderGuruQrSessionPanel();
    renderAttendanceRecapTable();
    updateGuruSidebarBadges();
    updateGuruChatContextBadge();
    setupGuruRealtime();
}

function updateGuruSidebarBadges() {
    const assIdsSet = new Set(assessmentsCache.map(a => Number(a.id)));
    const needReviewCount = scoresCache.filter(sc =>
        assIdsSet.has(Number(sc.assessment_id)) &&
        (sc.status_pengajuan === 'pending' || ((sc.status_kumpul === true || sc.status_pengajuan === 'approved') && (sc.nilai === null || sc.nilai === undefined || sc.nilai === '')))
    ).length;

    const nilaiBadge = document.getElementById('badge-guru-nilai');
    if (nilaiBadge) {
        nilaiBadge.innerText = needReviewCount > 99 ? '99+' : String(needReviewCount);
        nilaiBadge.classList.toggle('hidden', needReviewCount === 0);
    }
    const mobileNilaiBadge = document.getElementById('mbadge-guru-nilai');
    if (mobileNilaiBadge) {
        mobileNilaiBadge.innerText = needReviewCount > 99 ? '99+' : String(needReviewCount);
        mobileNilaiBadge.classList.toggle('hidden', needReviewCount === 0);
    }

    if (activeGuruTab === 'pengumuman' && currentUser?.id && activeClassId) {
        localStorage.setItem(`sipantau_guru_last_seen_ann_${currentUser.id}_${activeClassId}`, new Date().toISOString());
    }
    const key = `sipantau_guru_last_seen_ann_${currentUser?.id}_${activeClassId}`;
    const lastSeenIso = localStorage.getItem(key) || '1970-01-01T00:00:00.000Z';
    const unreadComments = announcementCommentsCache.filter(c =>
        c.author_role === 'siswa' && new Date(c.created_at).toISOString() > lastSeenIso
    ).length;

    const annBadge = document.getElementById('badge-guru-pengumuman');
    if (annBadge) {
        annBadge.innerText = unreadComments > 99 ? '99+' : String(unreadComments);
        annBadge.classList.toggle('hidden', unreadComments === 0);
    }
    const mobileMoreDot = document.getElementById('mbadge-guru-more');
    if (mobileMoreDot) {
        mobileMoreDot.classList.toggle('hidden', unreadComments === 0);
    }
}

function setupGuruRealtime() {
    if (guruRealtimeChannel || typeof db.channel !== 'function' || !currentUser) return;

    const scheduleRefresh = (toastMsg) => {
        if (toastMsg) showToast(toastMsg, 'info');
        clearTimeout(guruRealtimeRefreshTimer);
        guruRealtimeRefreshTimer = setTimeout(() => {
            if (currentUser && activeClassId) loadWorkspaceData();
        }, 500);
    };

    let channelBuilder = db.channel(`guru-live-${currentUser.id}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scores' }, (payload) => {
            const row = payload.new;
            if (!row) return;
            const isActiveClassTask = assessmentsCache.some(a => Number(a.id) === Number(row.assessment_id));
            if (isActiveClassTask) {
                const isNewSubmission = row.status_pengajuan === 'pending' || row.status_kumpul === true;
                scheduleRefresh(isNewSubmission ? '🔔 Pembaruan pengumpulan tugas siswa!' : null);
            }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_comments' }, (payload) => {
            const row = payload.new;
            if (!row || row.author_role !== 'siswa') return;
            const isClassAnnouncement = announcementsCache.some(an => Number(an.id) === Number(row.announcement_id));
            if (isClassAnnouncement) {
                scheduleRefresh(`💬 Komentar baru dari ${row.author_name || 'siswa'} di diskusi kelas!`);
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs' }, (payload) => {
            const row = payload.new || payload.old;
            if (!row) return;
            const activeAmp = getActiveAmpuan();
            if (Number(row.class_id) === Number(activeClassId) && (!row.mapel || row.mapel === activeAmp?.mapel)) {
                scheduleRefresh(payload.eventType === 'INSERT' && row.status === 'H' ? '⚡ Siswa baru saja check-in kehadiran!' : null);
            }
        });

    if (materialReadsTableAvailable) {
        channelBuilder = channelBuilder.on('postgres_changes', { event: '*', schema: 'public', table: 'material_reads' }, (payload) => {
            const row = payload.new || payload.old;
            if (!row) return;
            if (materialsCache.some(m => Number(m.id) === Number(row.material_id))) {
                scheduleRefresh(null);
            }
        });
    }

    if (attendanceSessionsTableAvailable) {
        channelBuilder = channelBuilder.on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions' }, (payload) => {
            const row = payload.new || payload.old;
            if (!row) return;
            if (Number(row.class_id) === Number(activeClassId)) {
                scheduleRefresh(null);
            }
        });
    }

    guruRealtimeChannel = channelBuilder.subscribe();
}

// ==================== HELPER UPLOAD MULTI-FILE GURU KE GOOGLE DRIVE ====================
async function uploadTeacherFilesToDrive(fileList, subFolderLabel, onStatus) {
    const files = [...(fileList || [])];
    if (!files.length) return [];

    if (!currentUser?.gdrive_email) {
        throw new Error('Hubungkan Google Drive Anda terlebih dahulu di menu Pengaturan agar dapat mengunggah lampiran file.');
    }

    const activeAmp = getActiveAmpuan();
    const clsObj = classesCache.find(c => Number(c.id) === Number(activeClassId));
    const className = clsObj?.nama_kelas || 'Kelas';
    const mapelName = activeAmp?.mapel || 'Umum';
    const uploaded = [];

    for (let idx = 0; idx < files.length; idx++) {
        const file = files[idx];
        if (onStatus) onStatus(`⏳ Mengunggah lampiran ${idx + 1} dari ${files.length}: ${file.name}...`);

        const { data: initData, error: initErr } = await db.functions.invoke('gdrive-bridge', {
            body: {
                action: 'init_upload',
                teacher_id: currentUser.id,
                class_name: className,
                mapel: mapelName,
                task_title: subFolderLabel,
                file_name: file.name,
                mime_type: file.type || 'application/octet-stream'
            }
        });

        if (initErr || !initData?.success || !initData?.uploadUrl) {
            throw new Error(initData?.error || initErr?.message || `Gagal menyiapkan Google Drive untuk ${file.name}`);
        }

        const driveRes = await new Promise((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('PUT', initData.uploadUrl, true);
            xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
            xhr.onload = () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
                } else {
                    reject(new Error(`Google Drive menolak file (HTTP ${xhr.status})`));
                }
            };
            xhr.onerror = () => reject(new Error('Koneksi terputus saat mengunggah file ke Drive.'));
            xhr.send(file);
        });

        const url = driveRes.webViewLink || (driveRes.id ? `https://drive.google.com/file/d/${driveRes.id}/view` : null);
        if (url) uploaded.push({ name: file.name, url });
    }

    return uploaded;
}

// ==================== 4B. MANAJEMEN MATERI PEMBELAJARAN ====================
async function createMaterial(e) {
    e.preventDefault();
    const amp = getActiveAmpuan();
    if (!activeClassId || !amp) return showToast('Pilih kelas dan mata pelajaran terlebih dahulu!', 'error');

    const judul = document.getElementById('mat-judul').value.trim();
    const deskripsi = document.getElementById('mat-deskripsi').value.trim() || null;
    const link_eksternal = document.getElementById('mat-link').value.trim() || null;
    const tampil_publik = document.getElementById('mat-publik').value === 'true';
    const fileInput = document.getElementById('mat-files');
    const files = [...(fileInput?.files || [])];

    const btn = document.getElementById('btn-submit-material');
    const statusBox = document.getElementById('mat-upload-status');
    btn.disabled = true;

    try {
        let uploadedFiles = [];
        if (files.length > 0) {
            statusBox.classList.remove('hidden');
            uploadedFiles = await uploadTeacherFilesToDrive(files, `Materi_${judul.slice(0, 30)}`, (msg) => {
                statusBox.innerText = msg;
            });
        }

        const { error } = await db.from('materials').insert([{
            teacher_id: currentUser.id,
            class_id: activeClassId,
            mapel: amp.mapel,
            periode: activePeriodName || currentDatePeriodName,
            judul,
            deskripsi,
            link_eksternal,
            file_attachments: uploadedFiles.length > 0 ? JSON.stringify(uploadedFiles) : null,
            tampil_publik
        }]);

        if (error) throw new Error(error.message);

        e.target.reset();
        showToast('✅ Materi pembelajaran berhasil dipublikasikan!');
        await loadWorkspaceData();
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
    } finally {
        btn.disabled = false;
        statusBox.classList.add('hidden');
    }
}

function toggleMaterialReadersList(materialId) {
    const id = Number(materialId);
    if (openMaterialReadersIds.has(id)) openMaterialReadersIds.delete(id);
    else openMaterialReadersIds.add(id);
    renderGuruMaterialsTab();
}

function renderGuruMaterialsTab() {
    const container = document.getElementById('guru-materials-list');
    if (!container) return;

    if (!materialsCache.length) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-6">Belum ada materi pembelajaran di kelas, mapel, & periode ini.</p>`;
        return;
    }

    const totalStu = studentsCache.length;
    const stuIdSet = new Set(studentsCache.map(s => Number(s.id)));

    const setupNoticeHtml = !materialReadsTableAvailable
        ? `<div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">
            ℹ️ Pelacakan progres baca siswa lintas perangkat memerlukan tabel <code class="font-mono font-bold">material_reads</code> di Supabase SQL Editor. Saat ini jumlah pembaca ditampilkan 0.
           </div>`
        : '';

    container.innerHTML = setupNoticeHtml + materialsCache.map(m => {
        const files = parseStudentSubmittedFiles(m.file_attachments);
        const dateStr = new Date(m.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const readsForMat = materialReadsCache.filter(r => Number(r.material_id) === Number(m.id) && stuIdSet.has(Number(r.student_id)));
        const readMap = new Map(readsForMat.map(r => [Number(r.student_id), r]));
        const readCount = readMap.size;
        const pct = totalStu > 0 ? Math.round((readCount / totalStu) * 100) : 0;
        const isExpanded = openMaterialReadersIds.has(Number(m.id));

        const readStudents = studentsCache.filter(s => readMap.has(Number(s.id)));
        const unreadStudents = studentsCache.filter(s => !readMap.has(Number(s.id)));

        return `
            <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${m.tampil_publik ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}">
                            ${m.tampil_publik ? '🌐 Publik di Siswa' : '🔒 Draf Privat'}
                        </span>
                        <span class="text-[11px] text-slate-400">${dateStr}</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <button type="button" onclick="toggleMaterialReadersList(${m.id})" class="px-2.5 py-1 rounded-lg bg-indigo-50 dark:bg-indigo-950/60 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold hover:bg-indigo-100">
                            👁️ Pembaca (${readCount}/${totalStu})
                        </button>
                        <button type="button" onclick="toggleMaterialVisibility(${m.id}, ${!m.tampil_publik})" class="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-100">
                            ${m.tampil_publik ? 'Sembunyikan' : 'Publikasikan'}
                        </button>
                        <button type="button" onclick="deleteMaterial(${m.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 text-xs font-bold">Hapus</button>
                    </div>
                </div>
                <h4 class="font-extrabold text-sm text-slate-900 dark:text-white">${escapeHtmlSafe(m.judul)}</h4>
                ${m.deskripsi ? `<p class="text-xs text-slate-600 dark:text-slate-300 whitespace-pre-line bg-white dark:bg-slate-900 p-3 rounded-xl border border-slate-200/70 dark:border-slate-700">${escapeHtmlSafe(m.deskripsi)}</p>` : ''}
                <div class="flex flex-wrap gap-1.5 pt-1">
                    ${m.link_eksternal ? `<a href="${m.link_eksternal}" target="_blank" class="px-3 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold">🔗 Link Referensi ↗</a>` : ''}
                    ${files.map((f, i) => `<a href="${f.url}" target="_blank" class="px-3 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-[11px] font-extrabold">📄 Modul ${i + 1}: ${escapeHtmlSafe(f.name)} ↗</a>`).join('')}
                </div>
                <div class="pt-1.5 space-y-1.5">
                    <div class="flex items-center justify-between text-[11px] font-bold">
                        <span class="text-slate-500 dark:text-slate-400">Progres Baca Siswa</span>
                        <span class="${pct >= 75 ? 'text-emerald-600' : pct >= 40 ? 'text-blue-600' : 'text-amber-600'}">${readCount} dari ${totalStu} siswa (${pct}%)</span>
                    </div>
                    <div class="w-full h-1.5 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full bg-indigo-600 transition-all duration-300" style="width: ${pct}%"></div>
                    </div>
                </div>
                ${isExpanded ? `
                    <div class="mt-2 p-3 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 grid grid-cols-1 md:grid-cols-2 gap-3 text-[11px]">
                        <div class="space-y-1.5">
                            <div class="font-extrabold text-emerald-700 dark:text-emerald-400">✅ Sudah Membaca (${readStudents.length})</div>
                            <div class="flex flex-wrap gap-1.5">
                                ${readStudents.length ? readStudents.map(s => {
                                    const rec = readMap.get(Number(s.id));
                                    const tStr = rec?.read_at ? new Date(rec.read_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short' }) : '';
                                    return `<span class="px-2 py-0.5 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold">${escapeHtmlSafe(s.nama)}${tStr ? ` (${tStr})` : ''}</span>`;
                                }).join('') : `<span class="text-slate-400 italic">Belum ada yang menandai selesai.</span>`}
                            </div>
                        </div>
                        <div class="space-y-1.5">
                            <div class="font-extrabold text-slate-600 dark:text-slate-300">⏳ Belum Membaca (${unreadStudents.length})</div>
                            <div class="flex flex-wrap gap-1.5">
                                ${unreadStudents.length ? unreadStudents.map(s => `<span class="px-2 py-0.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700">${escapeHtmlSafe(s.nama)}</span>`).join('') : `<span class="text-emerald-600 font-bold">Semua siswa sudah membaca! 🎉</span>`}
                            </div>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;
    }).join('');
}

async function toggleMaterialVisibility(id, nextState) {
    await db.from('materials').update({ tampil_publik: nextState }).eq('id', id);
    showToast(nextState ? '🌐 Materi ditampilkan di LMS Siswa' : '🔒 Materi disembunyikan');
    await loadWorkspaceData();
}

async function deleteMaterial(id) {
    const ok = await showAppConfirm('Hapus materi pembelajaran ini secara permanen?', {
        title: 'Hapus Materi',
        confirmText: 'Hapus Materi',
        tone: 'danger'
    });
    if (!ok) return;
    await db.from('materials').delete().eq('id', id);
    showToast('Materi dihapus.');
    await loadWorkspaceData();
}

// ==================== 4C. PENGUMUMAN & DISKUSI KELAS ====================
async function createAnnouncement(e) {
    e.preventDefault();
    const amp = getActiveAmpuan();
    if (!activeClassId || !amp) return showToast('Pilih kelas dan mata pelajaran terlebih dahulu!', 'error');

    const judul = document.getElementById('ann-judul').value.trim();
    const isi = document.getElementById('ann-isi').value.trim();

    const { error } = await db.from('announcements').insert([{
        teacher_id: currentUser.id,
        class_id: activeClassId,
        mapel: amp.mapel,
        periode: activePeriodName || currentDatePeriodName,
        judul,
        isi
    }]);

    if (error) return showToast('Gagal mengirim pengumuman: ' + error.message, 'error');
    e.target.reset();
    showToast('📣 Pengumuman berhasil dikirim ke kelas!');
    await loadWorkspaceData();
}

function renderGuruAnnouncementsTab() {
    const container = document.getElementById('guru-announcements-list');
    if (!container) return;

    if (!announcementsCache.length) {
        container.innerHTML = `<div class="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-slate-800 text-center text-xs text-slate-400 italic">Belum ada pengumuman atau forum diskusi pada kelas, mapel, & periode ini.</div>`;
        return;
    }

    container.innerHTML = announcementsCache.map(an => {
        const comments = announcementCommentsCache.filter(c => Number(c.announcement_id) === Number(an.id));
        const dateStr = new Date(an.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
            <div class="bg-white dark:bg-slate-900 p-5 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm space-y-3">
                <div class="flex items-center justify-between gap-2">
                    <span class="text-[11px] text-slate-400 font-bold">Diposting: ${dateStr}</span>
                    <button type="button" onclick="deleteAnnouncement(${an.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 text-xs font-bold">🗑️ Hapus</button>
                </div>
                <h4 class="font-extrabold text-base text-slate-900 dark:text-white">${an.judul}</h4>
                <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line bg-slate-50 dark:bg-slate-800/60 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">${an.isi}</p>

                <div class="pt-2 space-y-2">
                    <span class="text-[11px] font-extrabold text-slate-500">💬 Balasan & Diskusi (${comments.length})</span>
                    <div class="space-y-1.5 max-h-48 overflow-y-auto">
                        ${comments.map(c => `
                            <div class="p-2.5 rounded-xl text-xs ${c.author_role === 'guru' ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800' : 'bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700'}">
                                <div class="flex justify-between">
                                    <b class="${c.author_role === 'guru' ? 'text-blue-800 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}">${c.author_name} ${c.author_role === 'guru' ? '(Guru)' : ''}</b>
                                    <span class="text-[10px] text-slate-400">${new Date(c.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p class="text-slate-700 dark:text-slate-300 mt-0.5">${c.komentar}</p>
                            </div>
                        `).join('')}
                    </div>
                    <form onsubmit="postTeacherComment(event, ${an.id})" class="flex gap-2 pt-1">
                        <input type="text" id="tch-comment-inp-${an.id}" required placeholder="Tulis balasan guru..." class="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl px-3 py-2 text-xs">
                        <button type="submit" class="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-extrabold shrink-0">Balas</button>
                    </form>
                </div>
            </div>
        `;
    }).join('');
}

async function postTeacherComment(e, announcementId) {
    e.preventDefault();
    const inp = document.getElementById(`tch-comment-inp-${announcementId}`);
    const text = inp?.value.trim();
    if (!text) return;

    await db.from('announcement_comments').insert([{
        announcement_id: announcementId,
        author_name: currentUser.nama_lengkap || 'Guru',
        author_role: 'guru',
        komentar: text
    }]);
    inp.value = '';
    await loadWorkspaceData();
}

async function deleteAnnouncement(id) {
    const ok = await showAppConfirm('Hapus pengumuman ini beserta seluruh balasan diskusinya?', {
        title: 'Hapus Pengumuman',
        confirmText: 'Hapus',
        tone: 'danger'
    });
    if (!ok) return;
    await db.from('announcements').delete().eq('id', id);
    showToast('Pengumuman dihapus.');
    await loadWorkspaceData();
}

// ==================== 5. PERHITUNGAN NILAI (MENGABAIKAN NILAI KOSONG) ====================
function normalizeKategori(rawKat) {
    const k = String(rawKat || '').toLowerCase();
    if (k === 'ujian_bab' || k.includes('bab')) return 'ujian_bab';
    if (k === 'ujian_semester' || k.includes('semester') || k.includes('uas') || k.includes('pas')) return 'ujian_semester';
    return 'tugas';
}

function getKategoriLabel(rawKat) {
    const norm = normalizeKategori(rawKat);
    if (norm === 'ujian_bab') return 'Ujian Akhir Bab';
    if (norm === 'ujian_semester') return 'Ujian Semester';
    return 'Tugas';
}

function hasFilledScore(sc) {
    return sc && sc.nilai !== null && sc.nilai !== undefined && String(sc.nilai).trim() !== '';
}

function computeStudentMetrics(studentId) {
    const amp = getActiveAmpuan() || { kkm: 75, w_absen: 10, w_tugas: 30, w_bab: 30, w_uas: 30, p_hadir: 100, p_sakit: 80, p_izin: 80, p_alpa: 0 };

    const logs = attLogsCache.filter(l => Number(l.student_id) === Number(studentId));
    const manual = attRecapCache.find(r => Number(r.student_id) === Number(studentId));

    let h = 0, s = 0, i = 0, a = 0;
    if (logs.length > 0) {
        logs.forEach(l => {
            if (l.status === 'H') h++; else if (l.status === 'S') s++; else if (l.status === 'I') i++; else if (l.status === 'A') a++;
        });
    } else if (manual) {
        h = Number(manual.hadir || 0); s = Number(manual.sakit || 0); i = Number(manual.izin || 0); a = Number(manual.alpa || 0);
    }

    const totalPertemuan = h + s + i + a;
    const attScore = totalPertemuan > 0
        ? ((h * (amp.p_hadir ?? 100) + s * (amp.p_sakit ?? 80) + i * (amp.p_izin ?? 80) + a * (amp.p_alpa ?? 0)) / totalPertemuan)
        : 100;
    const attRate = totalPertemuan > 0 ? (h / totalPertemuan) * 100 : 100;

    const calcCatAvg = (targetNorm) => {
        const list = assessmentsCache.filter(as => normalizeKategori(as.kategori) === targetNorm);
        let sum = 0;
        let gradedCount = 0;
        list.forEach(as => {
            const sc = scoresCache.find(x => Number(x.assessment_id) === Number(as.id) && Number(x.student_id) === Number(studentId));
            if (hasFilledScore(sc)) {
                sum += Number(sc.nilai);
                gradedCount++;
            }
        });
        return { avg: gradedCount > 0 ? (sum / gradedCount) : 0, hasData: gradedCount > 0 };
    };

    const resTugas = calcCatAvg('tugas');
    const resBab = calcCatAvg('ujian_bab');
    const resSmt = calcCatAvg('ujian_semester');

    let activeWeightSum = 0;
    let weightedTotal = 0;

    if (totalPertemuan > 0 && Number(amp.w_absen) > 0) {
        weightedTotal += attScore * Number(amp.w_absen);
        activeWeightSum += Number(amp.w_absen);
    }
    if (resTugas.hasData && Number(amp.w_tugas) > 0) {
        weightedTotal += resTugas.avg * Number(amp.w_tugas);
        activeWeightSum += Number(amp.w_tugas);
    }
    if (resBab.hasData && Number(amp.w_bab) > 0) {
        weightedTotal += resBab.avg * Number(amp.w_bab);
        activeWeightSum += Number(amp.w_bab);
    }
    if (resSmt.hasData && Number(amp.w_uas) > 0) {
        weightedTotal += resSmt.avg * Number(amp.w_uas);
        activeWeightSum += Number(amp.w_uas);
    }

    const autoFinalScore = activeWeightSum > 0 ? (weightedTotal / activeWeightSum) : 0;

    const fgRecord = finalGradesCache.find(f => Number(f.student_id) === Number(studentId));
    const hasManual = fgRecord && fgRecord.nilai_manual !== null && fgRecord.nilai_manual !== undefined && fgRecord.nilai_manual !== '';
    const finalScore = hasManual ? Number(fgRecord.nilai_manual) : autoFinalScore;

    const totalTasks = assessmentsCache.length;
    const doneTasks = assessmentsCache.filter(as => {
        const sc = scoresCache.find(x => Number(x.assessment_id) === Number(as.id) && Number(x.student_id) === Number(studentId));
        return sc?.status_kumpul === true || sc?.status_pengajuan === 'approved';
    }).length;

    return {
        h, s, i, a,
        attScore,
        attRate,
        avgTugas: resTugas.avg,
        avgBab: resBab.avg,
        avgSmt: resSmt.avg,
        autoFinalScore,
        manualScore: hasManual ? Number(fgRecord.nilai_manual) : null,
        finalScore,
        isPublished: Boolean(fgRecord?.is_published),
        doneTasks,
        totalTasks,
        hasAnyGrade: activeWeightSum > 0 || hasManual,
        kkm: Number(amp.kkm || 75)
    };
}

function renderDashboard() {
    const tbody = document.getElementById('dash-student-tbody');
    if (!tbody) return;

    const filtered = studentsCache.filter(s =>
        !globalSearchQuery || s.nama.toLowerCase().includes(globalSearchQuery) || String(s.nisn).includes(globalSearchQuery)
    );

    let sumAtt = 0, sumTaskPct = 0, sumFinal = 0, gradedStudentCount = 0, attentionCount = 0;
    let totH = 0, totS = 0, totI = 0, totA = 0;

    tbody.innerHTML = filtered.map(s => {
        const m = computeStudentMetrics(s.id);
        sumAtt += m.attRate;
        const tPct = m.totalTasks > 0 ? (m.doneTasks / m.totalTasks) * 100 : 100;
        sumTaskPct += tPct;
        if (m.hasAnyGrade) {
            sumFinal += m.finalScore;
            gradedStudentCount++;
        }
        totH += m.h; totS += m.s; totI += m.i; totA += m.a;

        const isAttention = (m.hasAnyGrade && m.finalScore < m.kkm) || (m.totalTasks > 0 && m.doneTasks < m.totalTasks);
        if (isAttention) attentionCount++;

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3">
                    <div class="font-bold text-slate-900 dark:text-white">${s.nama}</div>
                    <div class="text-[10px] font-mono text-slate-400">${s.nisn}</div>
                </td>
                <td class="p-3 text-center font-bold">${m.attRate.toFixed(0)}%</td>
                <td class="p-3 text-center font-bold">${m.doneTasks} / ${m.totalTasks}</td>
                <td class="p-3 text-center font-extrabold text-blue-700 dark:text-blue-400">${m.hasAnyGrade ? m.finalScore.toFixed(1) : '-'}</td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${!m.hasAnyGrade ? 'bg-slate-100 dark:bg-slate-800 text-slate-500' : m.finalScore >= m.kkm ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                        ${!m.hasAnyGrade ? 'Belum Dinilai' : m.finalScore >= m.kkm ? 'Tuntas' : 'Perlu Bimbingan'}
                    </span>
                </td>
                <td class="p-3 text-center">
                    <button onclick="switchGuruTab('nilai')" class="text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline">Nilai →</button>
                </td>
            </tr>
        `;
    }).join('');

    const n = filtered.length || 1;
    document.getElementById('dash-stat-attendance').innerText = `${(studentsCache.length ? sumAtt / n : 100).toFixed(1)}%`;
    document.getElementById('dash-stat-att-detail').innerHTML = `<span>H:${totH}</span><span>S:${totS}</span><span>I:${totI}</span><span>A:${totA}</span>`;

    const avgTaskPct = studentsCache.length ? sumTaskPct / n : 0;
    document.getElementById('dash-stat-tasks').innerText = `${avgTaskPct.toFixed(1)}%`;
    document.getElementById('dash-bar-tasks').style.width = `${avgTaskPct}%`;
    document.getElementById('dash-stat-tasks-detail').innerHTML = `<span>${assessmentsCache.length} Penilaian</span><span>${studentsCache.length} Siswa</span>`;

    document.getElementById('dash-stat-avg').innerText = gradedStudentCount > 0 ? (sumFinal / gradedStudentCount).toFixed(1) : '0.0';
    document.getElementById('dash-stat-attention').innerText = `${attentionCount} Siswa`;

    renderDashboardDeadlines();
    renderDashboardCharts(totH, totS, totI, totA);
}

function renderDashboardDeadlines() {
    const box = document.getElementById('dash-deadline-agenda');
    if (!box) return;

    const withDeadline = assessmentsCache
        .filter(a => Boolean(a.deadline))
        .map(a => ({ ...a, dl: new Date(a.deadline) }))
        .sort((a, b) => a.dl.getTime() - b.dl.getTime());

    if (!withDeadline.length) {
        box.innerHTML = `<p class="text-xs text-slate-400 italic col-span-full py-2">Belum ada tugas/ujian dengan batas waktu (deadline) di kelas & mapel ini.</p>`;
        return;
    }

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const totalStudents = studentsCache.length;

    box.innerHTML = withDeadline.slice(0, 6).map(a => {
        const dlStart = new Date(a.dl.getFullYear(), a.dl.getMonth(), a.dl.getDate()).getTime();
        const diffDays = Math.round((dlStart - todayStart) / 86400000);
        const isOverdue = a.dl.getTime() < now.getTime();

        let badgeText = `📅 ${diffDays}h lagi`;
        let badgeCls = 'bg-blue-100 text-blue-700';
        if (isOverdue) {
            badgeText = '⚠️ Berakhir';
            badgeCls = 'bg-rose-100 text-rose-700';
        } else if (diffDays === 0) {
            badgeText = '🔥 Hari Ini';
            badgeCls = 'bg-amber-100 text-amber-800';
        } else if (diffDays === 1) {
            badgeText = '⏳ Besok';
            badgeCls = 'bg-amber-100 text-amber-800';
        }

        const doneCount = scoresCache.filter(sc =>
            Number(sc.assessment_id) === Number(a.id) && (sc.status_kumpul === true || sc.status_pengajuan === 'approved')
        ).length;
        const pct = totalStudents > 0 ? Math.round((doneCount / totalStudents) * 100) : 0;

        return `
            <button type="button" onclick="openAssessmentFromDashboard(${a.id})" class="text-left p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/60 hover:border-blue-400 transition space-y-2">
                <div class="flex items-center justify-between gap-2">
                    <span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200">${getKategoriLabel(a.kategori)}</span>
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${badgeCls}">${badgeText}</span>
                </div>
                <div class="font-extrabold text-xs text-slate-900 dark:text-white truncate">${a.judul}</div>
                <div class="text-[10px] text-slate-500 dark:text-slate-400">⏰ ${a.dl.toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</div>
                <div class="space-y-1">
                    <div class="flex justify-between text-[10px] font-bold text-slate-500 dark:text-slate-400">
                        <span>Terkumpul</span>
                        <span>${doneCount} / ${totalStudents} siswa (${pct}%)</span>
                    </div>
                    <div class="w-full bg-slate-200 dark:bg-slate-700 h-1.5 rounded-full overflow-hidden">
                        <div class="bg-blue-600 h-full" style="width:${pct}%"></div>
                    </div>
                </div>
            </button>
        `;
    }).join('');
}

function openAssessmentFromDashboard(assessmentId) {
    switchGuruTab('nilai');
    const sel = document.getElementById('active-assessment');
    if (sel) {
        sel.value = String(assessmentId);
        loadAssessmentScores();
    }
}

function renderDashboardCharts(h, s, i, a) {
    const theme = getChartThemeColors();

    destroyChart('chartDashDonutAtt');
    const c1 = document.getElementById('chartDashDonutAtt');
    if (c1) {
        const tot = h + s + i + a;
        const hasData = tot > 0;
        const pctData = hasData
            ? [Number(((h / tot) * 100).toFixed(1)), Number(((s / tot) * 100).toFixed(1)), Number(((i / tot) * 100).toFixed(1)), Number(((a / tot) * 100).toFixed(1))]
            : [100];

        chartInstances['chartDashDonutAtt'] = new Chart(c1, {
            type: 'doughnut',
            data: {
                labels: hasData ? ['Hadir', 'Sakit', 'Izin', 'Alpa'] : ['Belum Ada Data'],
                datasets: [{ data: pctData, backgroundColor: hasData ? ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e'] : [theme.isDark ? '#1e293b' : '#e2e8f0'], borderWidth: 0 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false, cutout: '68%',
                plugins: {
                    legend: { position: 'right', labels: { color: theme.text, boxWidth: 10, font: { size: 10 } } },
                    tooltip: { backgroundColor: theme.tooltipBg, callbacks: { label: (ctx) => hasData ? ` ${ctx.label}: ${ctx.parsed}%` : ' Belum ada data' } }
                }
            }
        });
    }

    destroyChart('chartDashWeeklyTrend');
    const c2 = document.getElementById('chartDashWeeklyTrend');
    if (c2) {
        const dates = [...new Set(attLogsCache.map(l => l.tanggal))].sort();
        const rates = dates.map(d => {
            const dayLogs = attLogsCache.filter(l => l.tanggal === d);
            const hadir = dayLogs.filter(l => l.status === 'H').length;
            return dayLogs.length ? Number(((hadir / dayLogs.length) * 100).toFixed(1)) : 0;
        });
        chartInstances['chartDashWeeklyTrend'] = new Chart(c2, {
            type: 'line',
            data: {
                labels: dates.length ? dates.map(d => d.slice(5)) : ['Belum Ada'],
                datasets: [{ label: 'Kehadiran (%)', data: dates.length ? rates : [100], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.12)', fill: true, tension: 0.35 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: theme.text, font: { size: 10 } }, grid: { color: theme.grid } },
                    y: { min: 0, max: 100, ticks: { color: theme.text, font: { size: 10 } }, grid: { color: theme.grid } }
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: theme.tooltipBg,
                        callbacks: {
                            title: (items) => dates[items[0].dataIndex] ? `Tanggal: ${dates[items[0].dataIndex]}` : 'Belum Ada Data',
                            label: (ctx) => ` Kehadiran: ${ctx.parsed.y}%`
                        }
                    }
                }
            }
        });
    }

    destroyChart('chartDashTaskBar');
    const c3 = document.getElementById('chartDashTaskBar');
    if (c3) {
        const categories = [
            { key: 'tugas', label: 'Tugas' },
            { key: 'ujian_bab', label: 'Ujian Akhir Bab' },
            { key: 'ujian_semester', label: 'Ujian Semester' }
        ];
        const catRates = categories.map(cat => {
            const listAss = assessmentsCache.filter(as => normalizeKategori(as.kategori) === cat.key);
            if (!listAss.length || !studentsCache.length) return 0;
            const totalExpected = listAss.length * studentsCache.length;
            let totalDone = 0;
            listAss.forEach(as => {
                totalDone += scoresCache.filter(sc => Number(sc.assessment_id) === Number(as.id) && (sc.status_kumpul === true || sc.status_pengajuan === 'approved')).length;
            });
            return Number(((totalDone / totalExpected) * 100).toFixed(1));
        });

        chartInstances['chartDashTaskBar'] = new Chart(c3, {
            type: 'bar',
            data: {
                labels: categories.map(c => c.label),
                datasets: [{ label: 'Ketuntasan (%)', data: catRates, backgroundColor: ['#3b82f6', '#8b5cf6', '#10b981'], borderRadius: 6 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: theme.text, font: { size: 10 } }, grid: { display: false } },
                    y: { min: 0, max: 100, ticks: { color: theme.text, font: { size: 10 } }, grid: { color: theme.grid } }
                },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: theme.tooltipBg, callbacks: { label: (ctx) => ` Terkumpul: ${ctx.parsed.y}%` } } }
            }
        });
    }
}

function destroyChart(key) {
    if (chartInstances[key]) { chartInstances[key].destroy(); delete chartInstances[key]; }
}

function renderOffscreenChartDataUrl(width, height, configBuilder) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    const whiteBgPlugin = {
        id: 'pdfWhiteBackground',
        beforeDraw(chart) {
            const c = chart.ctx;
            c.save();
            c.fillStyle = '#ffffff';
            c.fillRect(0, 0, chart.width, chart.height);
            c.restore();
        }
    };

    const chartConfig = configBuilder();
    chartConfig.options = Object.assign({}, chartConfig.options, {
        responsive: false,
        maintainAspectRatio: false,
        animation: false,
        devicePixelRatio: 2
    });
    chartConfig.plugins = [whiteBgPlugin, ...(chartConfig.plugins || [])];

    const tempChart = new Chart(ctx, chartConfig);
    tempChart.update('none');
    const dataUrl = canvas.toDataURL('image/png', 1.0);
    tempChart.destroy();
    return dataUrl;
}

function pdfSanitizeText(str) {
    return String(str ?? '')
        .replace(/[^\x20-\x7E\xA0-\xFF]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

async function exportDashboardSummaryPDF() {
    if (!activeClassId) {
        return showToast('Pilih kelas dan mata pelajaran terlebih dahulu.', 'error');
    }
    if (!(await ensureJsPdfLoaded())) return;

    const btn = document.getElementById('btn-export-dashboard-pdf');
    const prevBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Menyusun PDF...</span>`;
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 40));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const marginX = 14;
        const contentW = pageW - marginX * 2;

        const amp = getActiveAmpuan();
        const cls = classesCache.find(c => Number(c.id) === Number(activeClassId));
        const kelasName = pdfSanitizeText(cls?.nama_kelas || 'Kelas');
        const mapelName = pdfSanitizeText(amp?.mapel || 'Mata Pelajaran');
        const guruName = pdfSanitizeText(currentUser?.nama_lengkap || 'Guru Pengampu');
        const periodLabel = pdfSanitizeText(activePeriodName || currentDatePeriodName || '-');
        const kkmVal = Number(amp?.kkm || 75);
        const printedAt = new Date().toLocaleString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        // 1. Hitung seluruh metrik dashboard (mengikuti filter pencarian bila aktif)
        const activeStudents = studentsCache.filter(s =>
            !globalSearchQuery || s.nama.toLowerCase().includes(globalSearchQuery) || String(s.nisn).includes(globalSearchQuery)
        );
        const totalStudents = activeStudents.length;

        let sumAtt = 0, sumTaskPct = 0, sumFinal = 0, gradedStudentCount = 0, attentionCount = 0;
        let totH = 0, totS = 0, totI = 0, totA = 0;
        let countTuntas = 0, countBimbingan = 0, countBelumDinilai = 0;

        const studentRowsData = activeStudents.map((s, idx) => {
            const m = computeStudentMetrics(s.id);
            sumAtt += m.attRate;
            const tPct = m.totalTasks > 0 ? (m.doneTasks / m.totalTasks) * 100 : 100;
            sumTaskPct += tPct;
            if (m.hasAnyGrade) {
                sumFinal += m.finalScore;
                gradedStudentCount++;
                if (m.finalScore >= m.kkm) countTuntas++;
                else countBimbingan++;
            } else {
                countBelumDinilai++;
            }
            totH += m.h; totS += m.s; totI += m.i; totA += m.a;

            const isAttention = (m.hasAnyGrade && m.finalScore < m.kkm) || (m.totalTasks > 0 && m.doneTasks < m.totalTasks);
            if (isAttention) attentionCount++;

            const statusLabel = !m.hasAnyGrade ? 'Belum Dinilai' : (m.finalScore >= m.kkm ? 'Tuntas' : 'Perlu Bimbingan');
            return {
                no: idx + 1,
                nisn: pdfSanitizeText(s.nisn || '-'),
                nama: pdfSanitizeText(s.nama || '-'),
                h: m.h, s: m.s, i: m.i, a: m.a,
                attRate: m.attRate,
                doneTasks: m.doneTasks,
                totalTasks: m.totalTasks,
                hasAnyGrade: m.hasAnyGrade,
                finalScore: m.finalScore,
                status: statusLabel
            };
        });

        const denom = totalStudents || 1;
        const avgAttPct = totalStudents ? (sumAtt / denom) : 100;
        const avgTaskPct = totalStudents ? (sumTaskPct / denom) : 0;
        const avgFinalScore = gradedStudentCount > 0 ? (sumFinal / gradedStudentCount) : 0;
        const attentionPct = totalStudents > 0 ? Math.round((attentionCount / totalStudents) * 100) : 0;

        // 2. Render 3 Chart.js offscreen beresolusi tinggi (mode terang agar tajam di kertas)
        const totAttLogs = totH + totS + totI + totA;
        const hasAttData = totAttLogs > 0;
        const attPcts = hasAttData
            ? [
                Number(((totH / totAttLogs) * 100).toFixed(1)),
                Number(((totS / totAttLogs) * 100).toFixed(1)),
                Number(((totI / totAttLogs) * 100).toFixed(1)),
                Number(((totA / totAttLogs) * 100).toFixed(1))
            ]
            : [100];

        const donutImg = renderOffscreenChartDataUrl(520, 290, () => ({
            type: 'doughnut',
            data: {
                labels: hasAttData
                    ? [
                        `Hadir (${attPcts[0]}%)`,
                        `Sakit (${attPcts[1]}%)`,
                        `Izin (${attPcts[2]}%)`,
                        `Alpa (${attPcts[3]}%)`
                    ]
                    : ['Belum Ada Data'],
                datasets: [{
                    data: attPcts,
                    backgroundColor: hasAttData ? ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e'] : ['#e2e8f0'],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                cutout: '64%',
                layout: { padding: { top: 8, bottom: 8, left: 8, right: 12 } },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: {
                            color: '#1e293b',
                            boxWidth: 14,
                            padding: 14,
                            font: { family: 'Helvetica, Arial, sans-serif', size: 13, weight: 'bold' }
                        }
                    }
                }
            },
            plugins: [{
                id: 'donutCenterText',
                afterDraw(chart) {
                    const meta = chart.getDatasetMeta(0);
                    if (!meta || !meta.data || !meta.data[0]) return;
                    const { x, y } = meta.data[0];
                    const c = chart.ctx;
                    c.save();
                    c.textAlign = 'center';
                    c.textBaseline = 'middle';
                    c.fillStyle = '#0f172a';
                    c.font = 'bold 22px Helvetica, Arial, sans-serif';
                    c.fillText(hasAttData ? `${attPcts[0]}%` : '-', x, y - 7);
                    c.fillStyle = '#64748b';
                    c.font = 'bold 11px Helvetica, Arial, sans-serif';
                    c.fillText(hasAttData ? 'Hadir' : 'Kosong', x, y + 14);
                    c.restore();
                }
            }]
        }));

        const categories = [
            { key: 'tugas', label: 'Tugas' },
            { key: 'ujian_bab', label: 'Ujian Bab' },
            { key: 'ujian_semester', label: 'Ujian Smt' }
        ];
        const catRates = categories.map(cat => {
            const listAss = assessmentsCache.filter(as => normalizeKategori(as.kategori) === cat.key);
            if (!listAss.length || !studentsCache.length) return 0;
            const totalExpected = listAss.length * studentsCache.length;
            let totalDone = 0;
            listAss.forEach(as => {
                totalDone += scoresCache.filter(sc =>
                    Number(sc.assessment_id) === Number(as.id) && (sc.status_kumpul === true || sc.status_pengajuan === 'approved')
                ).length;
            });
            return Number(((totalDone / totalExpected) * 100).toFixed(1));
        });

        const taskBarImg = renderOffscreenChartDataUrl(520, 290, () => ({
            type: 'bar',
            data: {
                labels: categories.map(c => c.label),
                datasets: [{
                    label: 'Ketuntasan (%)',
                    data: catRates,
                    backgroundColor: ['#2563eb', '#7c3aed', '#10b981'],
                    borderRadius: 8,
                    maxBarThickness: 56
                }]
            },
            options: {
                layout: { padding: { top: 24, bottom: 6, left: 6, right: 12 } },
                scales: {
                    x: {
                        ticks: { color: '#334155', font: { size: 12, weight: 'bold' } },
                        grid: { display: false }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { color: '#475569', stepSize: 25, font: { size: 11 }, callback: v => `${v}%` },
                        grid: { color: '#e2e8f0' }
                    }
                },
                plugins: { legend: { display: false } }
            },
            plugins: [{
                id: 'barValueLabels',
                afterDatasetsDraw(chart) {
                    const c = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    c.save();
                    c.fillStyle = '#0f172a';
                    c.font = 'bold 12px Helvetica, Arial, sans-serif';
                    c.textAlign = 'center';
                    c.textBaseline = 'bottom';
                    meta.data.forEach((bar, index) => {
                        const val = chart.data.datasets[0].data[index];
                        c.fillText(`${val}%`, bar.x, bar.y - 5);
                    });
                    c.restore();
                }
            }]
        }));

        const dates = [...new Set(attLogsCache.map(l => l.tanggal))].sort();
        const trendRates = dates.map(d => {
            const dayLogs = attLogsCache.filter(l => l.tanggal === d);
            const hadir = dayLogs.filter(l => l.status === 'H').length;
            return dayLogs.length ? Number(((hadir / dayLogs.length) * 100).toFixed(1)) : 0;
        });

        const trendImg = renderOffscreenChartDataUrl(960, 260, () => ({
            type: 'line',
            data: {
                labels: dates.length ? dates.map(d => d.slice(5)) : ['Belum Ada Data'],
                datasets: [{
                    label: 'Kehadiran (%)',
                    data: dates.length ? trendRates : [0],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.14)',
                    borderWidth: 3,
                    pointBackgroundColor: '#1d4ed8',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: dates.length > 20 ? 3 : 5,
                    fill: true,
                    tension: 0.32
                }]
            },
            options: {
                layout: { padding: { top: 24, bottom: 8, left: 10, right: 16 } },
                scales: {
                    x: {
                        ticks: { color: '#334155', font: { size: 12, weight: 'bold' }, maxRotation: 0, autoSkip: true, maxTicksLimit: 14 },
                        grid: { color: '#f1f5f9' }
                    },
                    y: {
                        min: 0,
                        max: 100,
                        ticks: { color: '#475569', stepSize: 25, font: { size: 12 }, callback: v => `${v}%` },
                        grid: { color: '#e2e8f0' }
                    }
                },
                plugins: { legend: { display: false } }
            },
            plugins: [{
                id: 'lineValueLabels',
                afterDatasetsDraw(chart) {
                    if (!dates.length || dates.length > 14) return;
                    const c = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    c.save();
                    c.fillStyle = '#1e3a8a';
                    c.font = 'bold 11px Helvetica, Arial, sans-serif';
                    c.textAlign = 'center';
                    c.textBaseline = 'bottom';
                    meta.data.forEach((pt, index) => {
                        const val = chart.data.datasets[0].data[index];
                        c.fillText(`${val}%`, pt.x, pt.y - 7);
                    });
                    c.restore();
                }
            }]
        }));

        // ==================== HALAMAN 1: HEADER, KPI CARDS & VISUALISASI GRAFIK ====================
        // Header Banner
        doc.setFillColor(30, 64, 175); // blue-800
        doc.rect(0, 0, pageW, 34, 'F');
        doc.setFillColor(59, 130, 246); // blue-500 accent strip
        doc.rect(0, 34, pageW, 1.8, 'F');

        doc.setTextColor(191, 219, 254);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.text('PANTAUBELAJAR  |  LMS & SISTEM MONITORING AKADEMIK', marginX, 11);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(15);
        doc.text('LAPORAN RINGKASAN DASHBOARD GURU', marginX, 19);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.5);
        doc.setTextColor(219, 234, 254);
        doc.text(`Kelas: ${kelasName}   |   Mapel: ${mapelName}   |   KKM: ${kkmVal}`, marginX, 27);

        // Right metadata block in header
        doc.setFontSize(8.5);
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.text(`Periode: ${periodLabel}`, pageW - marginX, 12, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(219, 234, 254);
        doc.text(`Guru: ${guruName}`, pageW - marginX, 18.5, { align: 'right' });
        doc.text(`Dicetak: ${printedAt}`, pageW - marginX, 25, { align: 'right' });

        let curY = 42;

        if (globalSearchQuery) {
            doc.setFillColor(254, 243, 199);
            doc.setDrawColor(245, 158, 11);
            doc.roundedRect(marginX, curY, contentW, 7.5, 2, 2, 'FD');
            doc.setTextColor(146, 64, 14);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8);
            doc.text(`Catatan Filter Aktif: Menampilkan ${totalStudents} siswa sesuai kata kunci "${pdfSanitizeText(globalSearchQuery)}".`, marginX + 3, curY + 4.9);
            curY += 10.5;
        }

        // ---- 4 KPI SUMMARY CARDS ----
        const cardGap = 3.5;
        const cardW = (contentW - cardGap * 3) / 4;
        const cardH = 26;

        const drawKpiCard = (index, accentRgb, title, bigVal, valRgb, renderFooterFn) => {
            const x = marginX + index * (cardW + cardGap);
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.35);
            doc.roundedRect(x, curY, cardW, cardH, 2.5, 2.5, 'FD');

            // Top accent stripe
            doc.setFillColor(...accentRgb);
            doc.roundedRect(x, curY, cardW, 2.2, 1.5, 1.5, 'F');
            doc.rect(x, curY + 1.1, cardW, 1.1, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(title, x + 3.2, curY + 7.2);

            doc.setFontSize(14.5);
            doc.setTextColor(...valRgb);
            doc.text(bigVal, x + 3.2, curY + 14.8);

            renderFooterFn(x + 3.2, curY + 17.5, cardW - 6.4);
        };

        // Card 1: Kehadiran Kelas
        drawKpiCard(0, [16, 185, 129], 'KEHADIRAN KELAS', `${avgAttPct.toFixed(1)}%`, [15, 23, 42], (fx, fy, fw) => {
            // Mini stacked attendance bar
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(fx, fy, fw, 2, 1, 1, 'F');
            if (totAttLogs > 0) {
                const segs = [
                    { v: totH, c: [16, 185, 129] },
                    { v: totS, c: [245, 158, 11] },
                    { v: totI, c: [59, 130, 246] },
                    { v: totA, c: [244, 63, 94] }
                ];
                let sx = fx;
                segs.forEach(sg => {
                    const sw = (sg.v / totAttLogs) * fw;
                    if (sw > 0.2) {
                        doc.setFillColor(...sg.c);
                        doc.rect(sx, fy, sw, 2, 'F');
                        sx += sw;
                    }
                });
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(100, 116, 139);
            doc.text(`H:${totH}  S:${totS}  I:${totI}  A:${totA}`, fx, fy + 5.6);
        });

        // Card 2: Ketuntasan Tugas
        drawKpiCard(1, [37, 99, 235], 'KETUNTASAN TUGAS', `${avgTaskPct.toFixed(1)}%`, [37, 99, 235], (fx, fy, fw) => {
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(fx, fy, fw, 2, 1, 1, 'F');
            const fillW = Math.max(0, Math.min(fw, (avgTaskPct / 100) * fw));
            if (fillW > 0.3) {
                doc.setFillColor(37, 99, 235);
                doc.roundedRect(fx, fy, fillW, 2, 1, 1, 'F');
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(100, 116, 139);
            doc.text(`${assessmentsCache.length} Penilaian  |  ${totalStudents} Siswa`, fx, fy + 5.6);
        });

        // Card 3: Rata-rata Nilai Akhir
        const avgColor = gradedStudentCount > 0 && avgFinalScore >= kkmVal ? [5, 150, 105] : [217, 119, 6];
        drawKpiCard(2, [5, 150, 105], 'RATA-RATA NILAI AKHIR', gradedStudentCount > 0 ? avgFinalScore.toFixed(1) : '0.0', avgColor, (fx, fy) => {
            const kkmBadge = gradedStudentCount === 0 ? 'Belum ada nilai' : (avgFinalScore >= kkmVal ? `Di atas KKM (${kkmVal})` : `Di bawah KKM (${kkmVal})`);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(...avgColor);
            doc.text(kkmBadge, fx, fy + 1.8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`${gradedStudentCount}/${totalStudents} siswa dinilai`, fx, fy + 5.6);
        });

        // Card 4: Perlu Perhatian
        drawKpiCard(3, [245, 158, 11], 'PERLU PERHATIAN', `${attentionCount} Siswa`, [217, 119, 6], (fx, fy) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(180, 83, 9);
            doc.text(`${attentionPct}% dari total siswa`, fx, fy + 1.8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('Di bawah KKM / tunggak tugas', fx, fy + 5.6);
        });

        curY += cardH + 6;

        // ---- VISUALISASI GRAFIK (2 KARTU ATAS + 1 KARTU TREN PENUH) ----
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text('VISUALISASI STATISTIK KEHADIRAN & KETUNTASAN TUGAS', marginX, curY);
        curY += 3.5;

        const halfW = (contentW - 4) / 2;
        const chartBoxH = 56;

        // Chart Box 1: Proporsi Kehadiran (Doughnut)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, curY, halfW, chartBoxH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('Proporsi Kehadiran Kelas (%)', marginX + 3.5, curY + 5.8);
        doc.addImage(donutImg, 'PNG', marginX + 2, curY + 7.5, halfW - 4, chartBoxH - 9.5, undefined, 'FAST');

        // Chart Box 2: Ketuntasan Per Kategori (Bar)
        const rightBoxX = marginX + halfW + 4;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(rightBoxX, curY, halfW, chartBoxH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('Ketuntasan Tugas Per Kategori (%)', rightBoxX + 3.5, curY + 5.8);
        doc.addImage(taskBarImg, 'PNG', rightBoxX + 2, curY + 7.5, halfW - 4, chartBoxH - 9.5, undefined, 'FAST');

        curY += chartBoxH + 4.5;

        // Chart Box 3: Tren Kehadiran Per Pertemuan (Full Width Line Chart)
        const trendBoxH = 52;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, curY, contentW, trendBoxH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text(`Tren Kehadiran Per Pertemuan (${dates.length} Pertemuan Tercatat)`, marginX + 3.5, curY + 5.8);
        doc.addImage(trendImg, 'PNG', marginX + 2.5, curY + 7.5, contentW - 5, trendBoxH - 9.5, undefined, 'FAST');

        curY += trendBoxH + 5;

        // ---- VISUAL BAR DISTRIBUSI STATUS CAPAIAN SISWA ----
        const distBoxH = 22;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, curY, contentW, distBoxH, 2.5, 2.5, 'FD');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.5);
        doc.setTextColor(30, 41, 59);
        doc.text('Distribusi Status Ketuntasan Siswa', marginX + 3.5, curY + 5.8);

        const barX = marginX + 3.5;
        const barY = curY + 8.5;
        const barW = contentW - 7;
        const barH = 4.5;
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(barX, barY, barW, barH, 1.5, 1.5, 'F');

        if (totalStudents > 0) {
            const distSegs = [
                { count: countTuntas, color: [16, 185, 129] },
                { count: countBimbingan, color: [245, 158, 11] },
                { count: countBelumDinilai, color: [148, 163, 184] }
            ];
            let dx = barX;
            distSegs.forEach(seg => {
                const segW = (seg.count / totalStudents) * barW;
                if (segW > 0.3) {
                    doc.setFillColor(...seg.color);
                    doc.rect(dx, barY, segW, barH, 'F');
                    dx += segW;
                }
            });
        }

        const legendY = curY + 18;
        const drawDistLegend = (lx, rgb, label) => {
            doc.setFillColor(...rgb);
            doc.circle(lx + 1.5, legendY - 1, 1.3, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(51, 65, 85);
            doc.text(label, lx + 4.2, legendY);
        };
        const pctTuntas = totalStudents ? Math.round((countTuntas / totalStudents) * 100) : 0;
        const pctBimb = totalStudents ? Math.round((countBimbingan / totalStudents) * 100) : 0;
        const pctBelum = totalStudents ? Math.round((countBelumDinilai / totalStudents) * 100) : 0;

        drawDistLegend(marginX + 3.5, [16, 185, 129], `Tuntas (>= KKM ${kkmVal}): ${countTuntas} siswa (${pctTuntas}%)`);
        drawDistLegend(marginX + 68, [245, 158, 11], `Perlu Bimbingan: ${countBimbingan} siswa (${pctBimb}%)`);
        drawDistLegend(marginX + 132, [148, 163, 184], `Belum Dinilai: ${countBelumDinilai} (${pctBelum}%)`);

        curY += distBoxH + 6;

        // ---- RINGKASAN PENILAIAN & AGENDA TENGGAT ----
        if (curY > pageH - 55) {
            doc.addPage();
            curY = 16;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`RINGKASAN KETUNTASAN PENILAIAN & TENGGAT (${assessmentsCache.length} Penilaian)`, marginX, curY);
        curY += 3;

        if (assessmentsCache.length > 0) {
            const totalClassStu = studentsCache.length;
            const assRows = assessmentsCache.map((a, idx) => {
                const doneCount = scoresCache.filter(sc =>
                    Number(sc.assessment_id) === Number(a.id) && (sc.status_kumpul === true || sc.status_pengajuan === 'approved')
                ).length;
                const pct = totalClassStu > 0 ? Math.round((doneCount / totalClassStu) * 100) : 0;
                const gradedScores = scoresCache
                    .filter(sc => Number(sc.assessment_id) === Number(a.id) && hasFilledScore(sc))
                    .map(sc => Number(sc.nilai));
                const avgAss = gradedScores.length
                    ? (gradedScores.reduce((acc, v) => acc + v, 0) / gradedScores.length).toFixed(1)
                    : '-';
                const dlText = a.deadline
                    ? new Date(a.deadline).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' })
                    : 'Tanpa tenggat';

                return {
                    pct,
                    row: [
                        idx + 1,
                        pdfSanitizeText(a.judul || '-'),
                        pdfSanitizeText(getKategoriLabel(a.kategori)),
                        dlText,
                        `${doneCount}/${totalClassStu}`,
                        `${pct}%`,
                        avgAss
                    ]
                };
            });

            doc.autoTable({
                startY: curY,
                margin: { left: marginX, right: marginX, bottom: 18 },
                head: [['No', 'Judul Penilaian', 'Kategori', 'Tenggat', 'Kumpul', 'Progres', 'Rata2']],
                body: assRows.map(r => r.row),
                theme: 'grid',
                headStyles: { fillColor: [30, 64, 175], textColor: 255, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 7.8, cellPadding: 2.3, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 9 },
                    1: { cellWidth: 55 },
                    2: { cellWidth: 28 },
                    3: { cellWidth: 26, halign: 'center' },
                    4: { cellWidth: 18, halign: 'center' },
                    5: { cellWidth: 30, halign: 'right' },
                    6: { cellWidth: 16, halign: 'center', fontStyle: 'bold' }
                },
                didDrawCell(data) {
                    if (data.section === 'body' && data.column.index === 5) {
                        const pct = assRows[data.row.index]?.pct || 0;
                        const cell = data.cell;
                        const barX2 = cell.x + 2;
                        const barY2 = cell.y + cell.height / 2 - 1.3;
                        const barW2 = Math.max(8, cell.width - 13.5);
                        doc.setFillColor(226, 232, 240);
                        doc.roundedRect(barX2, barY2, barW2, 2.6, 1, 1, 'F');
                        if (pct > 0) {
                            const rgb = pct >= 80 ? [16, 185, 129] : pct >= 50 ? [37, 99, 235] : [245, 158, 11];
                            doc.setFillColor(...rgb);
                            doc.roundedRect(barX2, barY2, (pct / 100) * barW2, 2.6, 1, 1, 'F');
                        }
                    }
                }
            });
            curY = (doc.lastAutoTable?.finalY || curY + 20) + 7;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text('Belum ada tugas atau ujian yang tercatat pada kelas & mata pelajaran ini.', marginX, curY + 4);
            curY += 11;
        }

        // ==================== TABEL RINGKASAN CAPAIAN SISWA ====================
        if (curY > pageH - 55) {
            doc.addPage();
            curY = 16;
        }

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(15, 23, 42);
        doc.text(`RINGKASAN CAPAIAN SISWA (${totalStudents} Siswa)`, marginX, curY);
        curY += 3;

        if (studentRowsData.length > 0) {
            doc.autoTable({
                startY: curY,
                margin: { left: marginX, right: marginX, bottom: 18 },
                head: [['No', 'NISN', 'Nama Siswa', 'H/S/I/A', 'Hadir', 'Tugas', 'Nilai', 'Status']],
                body: studentRowsData.map(r => [
                    r.no,
                    r.nisn,
                    r.nama,
                    `${r.h}/${r.s}/${r.i}/${r.a}`,
                    `${r.attRate.toFixed(0)}%`,
                    `${r.doneTasks}/${r.totalTasks}`,
                    r.hasAnyGrade ? r.finalScore.toFixed(1) : '-',
                    r.status
                ]),
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 8, fontStyle: 'bold' },
                styles: { fontSize: 7.8, cellPadding: 2.3, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 9 },
                    1: { cellWidth: 25, fontStyle: 'normal' },
                    2: { cellWidth: 50, fontStyle: 'bold' },
                    3: { halign: 'center', cellWidth: 20 },
                    4: { halign: 'center', cellWidth: 15, fontStyle: 'bold' },
                    5: { halign: 'center', cellWidth: 16 },
                    6: { halign: 'center', cellWidth: 16, fontStyle: 'bold', textColor: [29, 78, 216] },
                    7: { halign: 'center', cellWidth: 31, fontStyle: 'bold' }
                },
                didParseCell(data) {
                    if (data.section === 'body' && data.column.index === 7) {
                        const val = data.cell.raw;
                        if (val === 'Tuntas') {
                            data.cell.styles.fillColor = [209, 250, 229];
                            data.cell.styles.textColor = [6, 95, 70];
                        } else if (val === 'Perlu Bimbingan') {
                            data.cell.styles.fillColor = [254, 243, 199];
                            data.cell.styles.textColor = [146, 64, 14];
                        } else {
                            data.cell.styles.fillColor = [241, 245, 249];
                            data.cell.styles.textColor = [100, 116, 139];
                        }
                    }
                }
            });
            curY = (doc.lastAutoTable?.finalY || curY + 20) + 10;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text('Belum ada data siswa pada kelas ini.', marginX, curY + 4);
            curY += 12;
        }

        // ---- BLOK PENGESAHAN GURU ----
        if (curY > pageH - 36) {
            doc.addPage();
            curY = 22;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Dicetak melalui PantauBelajar pada ${printedAt}`, marginX, curY + 4);
        doc.text('Mengetahui,', pageW - marginX - 55, curY + 2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Guru Pengampu,', pageW - marginX - 55, curY + 7);
        doc.setDrawColor(148, 163, 184);
        doc.line(pageW - marginX - 55, curY + 23, pageW - marginX, curY + 23);
        doc.text(guruName, pageW - marginX - 55, curY + 27.5);

        // ---- FOOTER NOMOR HALAMAN DI SETIAP HALAMAN ----
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`PantauBelajar  |  Ringkasan Dashboard ${kelasName} - ${mapelName} (${periodLabel})`, marginX, pageH - 7.5);
            doc.text(`Halaman ${p} dari ${totalPages}`, pageW - marginX, pageH - 7.5, { align: 'right' });
        }

        const safeCls = kelasName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Kelas';
        const safeMapel = mapelName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Mapel';
        const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Periode';
        doc.save(`Ringkasan_Dashboard_${safeCls}_${safeMapel}_${safePeriod}.pdf`);

        showToast('📄 Ringkasan Dashboard PDF lengkap dengan grafik berhasil diunduh!');
    } catch (err) {
        console.error('Export Dashboard PDF Error:', err);
        showToast('Gagal mengekspor PDF dashboard: ' + (err?.message || err), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = prevBtnHtml;
        }
    }
}

// ==================== 6. MANAJEMEN KELAS & SISWA ====================
async function createClass(e) {
    e.preventDefault();
    const nama_kelas = document.getElementById('new-class-name').value.trim();
    const { data, error } = await db.from('classes').insert([{ nama_kelas }]).select().single();
    if (error) return showToast('Gagal membuat kelas: ' + error.message, 'error');
    e.target.reset();
    await loadAllClasses();
    showToast(`✅ Kelas "${nama_kelas}" berhasil dibuat!`);
    if (adminMode === 'students') { activeClassId = data.id; await loadWorkspaceData(); }
}

async function addStudentManual(e) {
    e.preventDefault();
    if (isSharedClassLocked) return showToast('🔒 Kelas bersama terkunci. Hubungi Admin untuk menambah siswa.', 'error');
    if (!activeClassId) return showToast('Pilih kelas terlebih dahulu!', 'error');
    const nisn = document.getElementById('stu-nisn').value.trim();
    const nama = document.getElementById('stu-nama').value.trim();
    const { error } = await db.from('students').insert([{ class_id: activeClassId, nisn, nama, password: nisn }]);
    if (error) return showToast('Gagal menambah siswa: ' + error.message, 'error');
    e.target.reset();
    showToast('✅ Siswa ditambahkan (Password default: NISN)');
    await loadWorkspaceData();
}

async function downloadTemplateSiswa() {
    if (!(await ensureXlsxLoaded())) return;
    const ws = XLSX.utils.aoa_to_sheet([['NISN', 'Nama Lengkap'], ['0081234561', 'Andi Pratama'], ['0081234562', 'Siti Rahmawati']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');
    XLSX.writeFile(wb, 'Template_Import_Siswa.xlsx');
}

async function importStudentsExcel() {
    if (isSharedClassLocked) return showToast('🔒 Kelas bersama terkunci. Hubungi Admin untuk mengimpor siswa.', 'error');
    if (!activeClassId) return showToast('Pilih kelas terlebih dahulu!', 'error');
    const fileInput = document.getElementById('excel-students');
    const file = fileInput?.files?.[0];
    if (!file) return showToast('Pilih file Excel (.xlsx) terlebih dahulu!', 'error');
    if (!(await ensureXlsxLoaded())) return;

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const payload = rows.map(r => {
            const nisnVal = String(r['NISN'] || r['nisn'] || '').trim();
            return { class_id: activeClassId, nisn: nisnVal, nama: String(r['Nama Lengkap'] || r['Nama'] || r['nama'] || '').trim(), password: nisnVal };
        }).filter(x => x.nama);

        if (!payload.length) return showToast('Data siswa kosong di file Excel!', 'error');
        const { error } = await db.from('students').insert(payload);
        if (error) return showToast('Gagal import: ' + error.message, 'error');
        fileInput.value = '';
        showToast(`✅ ${payload.length} siswa berhasil diimpor!`);
        await loadWorkspaceData();
    };
    reader.readAsArrayBuffer(file);
}

function renderStudentsTable() {
    const tbody = document.getElementById('stu-tbody');
    if (!tbody) return;
    document.getElementById('stu-count-badge').innerText = `${studentsCache.length} Siswa`;

    const isAdmin = currentUser?.role === 'admin';
    const filtered = studentsCache.filter(s =>
        !globalSearchQuery || s.nama.toLowerCase().includes(globalSearchQuery) || String(s.nisn).includes(globalSearchQuery)
    );

    tbody.innerHTML = filtered.map((s, idx) => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
            ${isSharedClassLocked ? '' : `<td class="p-3 text-center"><input type="checkbox" ${selectedStudentIds.has(s.id) ? 'checked' : ''} onchange="toggleSingleStudentSelect(${s.id}, this.checked)" class="w-4 h-4 accent-blue-600"></td>`}
            <td class="p-3 text-center text-slate-400">${idx + 1}</td>
            <td class="p-3 font-mono text-xs">${s.nisn}</td>
            <td class="p-3 font-bold text-slate-900 dark:text-white">${s.nama}</td>
            <td class="p-3 text-center space-x-1">
                ${isSharedClassLocked
                    ? `<span class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-500 text-[11px] font-bold">🔒 Terkunci</span>`
                    : `<button onclick="openEditStudentModal(${s.id})" class="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-xs font-bold">Edit</button>
                       ${isAdmin ? `<button onclick="resetStudentPasswordToNISN(${s.id}, '${s.nisn}', '${s.nama.replace(/'/g, "\\'")}')" class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">Reset PW</button>` : ''}
                       <button onclick="initiateSingleStudentDelete(${s.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 text-xs font-bold">Hapus</button>`
                }
            </td>
        </tr>
    `).join('');
    updateBulkDeleteButtons();
}

function toggleSingleStudentSelect(id, checked) {
    if (checked) selectedStudentIds.add(id); else selectedStudentIds.delete(id);
    updateBulkDeleteButtons();
}
function toggleSelectAllStudents(checked) {
    selectedStudentIds.clear();
    if (checked) studentsCache.forEach(s => selectedStudentIds.add(s.id));
    renderStudentsTable();
}
function updateBulkDeleteButtons() {
    const cnt = selectedStudentIds.size;
    if (document.getElementById('selected-students-badge')) document.getElementById('selected-students-badge').innerText = `${cnt} dipilih`;
    if (document.getElementById('btn-selected-count')) document.getElementById('btn-selected-count').innerText = cnt;
    if (document.getElementById('btn-bulk-promote')) document.getElementById('btn-bulk-promote').disabled = studentsCache.length === 0 || isSharedClassLocked;
    if (document.getElementById('btn-bulk-delete-selected')) document.getElementById('btn-bulk-delete-selected').disabled = cnt === 0;
    if (document.getElementById('btn-bulk-delete-all')) document.getElementById('btn-bulk-delete-all').disabled = studentsCache.length === 0;
}

function openBulkPromoteModal() {
    if (isSharedClassLocked) return showToast('🔒 Kelas bersama terkunci. Hubungi Admin untuk memindahkan siswa.', 'error');
    if (!studentsCache.length) return showToast('Belum ada siswa di kelas ini.', 'error');

    const scopeSel = document.getElementById('promote-scope');
    if (scopeSel) {
        scopeSel.innerHTML = `
            <option value="selected" ${selectedStudentIds.size === 0 ? 'disabled' : ''}>Siswa Terpilih (${selectedStudentIds.size} siswa)</option>
            <option value="all">Seluruh Siswa di Kelas Aktif (${studentsCache.length} siswa)</option>
        `;
        scopeSel.value = selectedStudentIds.size > 0 ? 'selected' : 'all';
    }

    const targetSel = document.getElementById('promote-target-class');
    const otherClasses = classesCache.filter(c => Number(c.id) !== Number(activeClassId));
    if (targetSel) {
        targetSel.innerHTML = otherClasses.map(c => `<option value="${c.id}">${c.nama_kelas}</option>`).join('') +
            `<option value="__NEW__">+ Buat Kelas Tujuan Baru...</option>`;
        if (!otherClasses.length) targetSel.value = '__NEW__';
    }
    onPromoteTargetClassChange();
    document.getElementById('modal-bulk-promote').classList.remove('hidden');
}

function closeBulkPromoteModal() {
    document.getElementById('modal-bulk-promote').classList.add('hidden');
}

function onPromoteTargetClassChange() {
    const val = document.getElementById('promote-target-class')?.value;
    const wrap = document.getElementById('promote-new-class-wrap');
    const inp = document.getElementById('promote-new-class-name');
    const isNew = val === '__NEW__';
    if (wrap) wrap.classList.toggle('hidden', !isNew);
    if (inp) {
        inp.required = isNew;
        if (!isNew) inp.value = '';
    }
}

async function executeBulkPromote(e) {
    e.preventDefault();
    if (isSharedClassLocked) return showToast('🔒 Kelas bersama terkunci.', 'error');

    const scope = document.getElementById('promote-scope').value;
    const targetIds = scope === 'selected' ? [...selectedStudentIds] : studentsCache.map(s => s.id);
    if (!targetIds.length) return showToast('Pilih minimal 1 siswa untuk dipindahkan!', 'error');

    const btn = document.getElementById('btn-execute-promote');
    if (btn) btn.disabled = true;

    try {
        let targetClassId = document.getElementById('promote-target-class').value;
        let targetClassName = '';

        if (targetClassId === '__NEW__') {
            const newName = document.getElementById('promote-new-class-name').value.trim();
            if (!newName) throw new Error('Masukkan nama kelas tujuan baru!');
            const { data: createdCls, error: clsErr } = await db.from('classes').insert([{ nama_kelas: newName }]).select().single();
            if (clsErr) throw new Error(clsErr.message);
            targetClassId = createdCls.id;
            targetClassName = createdCls.nama_kelas;
        } else {
            targetClassId = Number(targetClassId);
            targetClassName = classesCache.find(c => Number(c.id) === targetClassId)?.nama_kelas || 'Kelas Tujuan';
        }

        const { error: updErr } = await db.from('students').update({ class_id: targetClassId }).in('id', targetIds);
        if (updErr) throw new Error(updErr.message);

        selectedStudentIds.clear();
        closeBulkPromoteModal();
        showToast(`🚀 ${targetIds.length} siswa berhasil dipindahkan ke ${targetClassName}!`);
        await loadAllClasses();
        await loadWorkspaceData();
    } catch (err) {
        showToast('❌ Gagal memindahkan siswa: ' + err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function openEditStudentModal(id) {
    if (isSharedClassLocked) return showToast('🔒 Kelas bersama terkunci.', 'error');
    const s = studentsCache.find(x => x.id === id);
    if (!s) return;
    document.getElementById('edit-stu-id').value = s.id;
    document.getElementById('edit-stu-nisn').value = s.nisn;
    document.getElementById('edit-stu-nama').value = s.nama;
    document.getElementById('edit-stu-kelas').innerHTML = classesCache.map(c => `<option value="${c.id}" ${c.id === s.class_id ? 'selected' : ''}>${c.nama_kelas}</option>`).join('');
    document.getElementById('modal-edit-student').classList.remove('hidden');
}
function closeEditStudentModal() { document.getElementById('modal-edit-student').classList.add('hidden'); }

async function handleUpdateStudent(e) {
    e.preventDefault();
    if (isSharedClassLocked) return;
    const id = Number(document.getElementById('edit-stu-id').value);
    const nisn = document.getElementById('edit-stu-nisn').value.trim();
    const nama = document.getElementById('edit-stu-nama').value.trim();
    const class_id = Number(document.getElementById('edit-stu-kelas').value);
    await db.from('students').update({ nisn, nama, class_id }).eq('id', id);
    closeEditStudentModal();
    showToast('✅ Data siswa diperbarui');
    await loadWorkspaceData();
}

function initiateSingleStudentDelete(id) { if (!isSharedClassLocked) { deleteTargetIds = [id]; openDeleteConfirmModal(); } }
function initiateBulkDeleteSelected() { if (!isSharedClassLocked) { deleteTargetIds = [...selectedStudentIds]; openDeleteConfirmModal(); } }
function initiateDeleteAllInClass() { if (!isSharedClassLocked) { deleteTargetIds = studentsCache.map(s => s.id); openDeleteConfirmModal(); } }

function openDeleteConfirmModal() {
    if (!deleteTargetIds.length) return;
    document.getElementById('del-step-1').classList.remove('hidden');
    document.getElementById('del-step-2').classList.add('hidden');
    document.getElementById('del-final-check').checked = false;
    document.getElementById('btn-execute-delete').disabled = true;
    const names = studentsCache.filter(s => deleteTargetIds.includes(s.id)).map(s => `• ${s.nisn} - ${s.nama}`);
    document.getElementById('del-step1-desc').innerText = `Anda akan menghapus ${names.length} data siswa berikut:`;
    document.getElementById('del-names-preview').innerHTML = names.join('<br>');
    document.getElementById('modal-delete-confirm').classList.remove('hidden');
}
function closeDeleteConfirmModal() { document.getElementById('modal-delete-confirm').classList.add('hidden'); }
function proceedToDeleteStep2() {
    document.getElementById('del-step-1').classList.add('hidden');
    document.getElementById('del-step-2').classList.remove('hidden');
    document.getElementById('del-step2-desc').innerText = `Total ${deleteTargetIds.length} siswa beserta nilai & presensinya akan dihapus.`;
}
function toggleFinalDeleteButton() { document.getElementById('btn-execute-delete').disabled = !document.getElementById('del-final-check').checked; }
async function executeConfirmedStudentDelete() {
    if (isSharedClassLocked) return;
    await db.from('students').delete().in('id', deleteTargetIds);
    selectedStudentIds.clear();
    closeDeleteConfirmModal();
    showToast(`🗑️ ${deleteTargetIds.length} siswa telah dihapus.`);
    await loadWorkspaceData();
}

// ==================== 7. KEHADIRAN & PRESENSI ====================
function generateAttendanceToken(len = 6) {
    const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
    let out = '';
    for (let i = 0; i < len; i++) {
        out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
}

function getActiveGuruSession() {
    const now = Date.now();
    return attendanceSessionsCache.find(s => s.is_active === true && new Date(s.expires_at).getTime() > now) || null;
}

function formatCountdownMs(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function copyGuruCheckinText(text, label) {
    if (!text) return;
    navigator.clipboard.writeText(text)
        .then(() => showToast(`✅ ${label} disalin ke clipboard!`))
        .catch(() => showToast(`Salin manual: ${text}`, 'info'));
}

async function startGuruQrSession() {
    const amp = getActiveAmpuan();
    if (!activeClassId || !amp) return showToast('Pilih kelas dan mata pelajaran terlebih dahulu!', 'error');

    const dateInp = document.getElementById('abs-date-picker');
    let dateVal = dateInp?.value;
    if (!dateVal) {
        const now = new Date();
        dateVal = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        if (dateInp) dateInp.value = dateVal;
    }

    const durationMins = Math.max(1, Number(document.getElementById('qr-session-duration')?.value || 10));
    const targetPeriod = activePeriodName || currentDatePeriodName;
    const token = generateAttendanceToken(6);
    const expiresAt = new Date(Date.now() + durationMins * 60000).toISOString();

    const deactRes = await db.from('attendance_sessions')
        .update({ is_active: false })
        .eq('class_id', activeClassId)
        .eq('mapel', amp.mapel)
        .eq('is_active', true);

    if (deactRes.error && /attendance_sessions|does not exist|schema cache/i.test(deactRes.error.message || '')) {
        attendanceSessionsTableAvailable = false;
        renderGuruQrSessionPanel();
        return showToast('⚠️ Tabel attendance_sessions belum dibuat di Supabase SQL Editor.', 'error');
    }

    const { data, error } = await db.from('attendance_sessions')
        .insert([{
            teacher_id: currentUser.id,
            class_id: activeClassId,
            mapel: amp.mapel,
            periode: targetPeriod,
            tanggal: dateVal,
            token,
            expires_at: expiresAt,
            is_active: true
        }])
        .select('*');

    if (error) {
        if (/attendance_sessions|does not exist|schema cache/i.test(error.message || '')) {
            attendanceSessionsTableAvailable = false;
            renderGuruQrSessionPanel();
            return showToast('⚠️ Tabel attendance_sessions belum dibuat di Supabase SQL Editor.', 'error');
        }
        return showToast('❌ Gagal membuka sesi QR: ' + error.message, 'error');
    }

    attendanceSessionsTableAvailable = true;
    attendanceSessionsCache = data || [];
    showToast(`⚡ Sesi Presensi Token ${token} dibuka (${durationMins} menit)!`);
    renderGuruQrSessionPanel();
    loadDailyAttendanceForDate();
}

async function closeGuruQrSession(sessionId) {
    if (!sessionId) return;
    const { error } = await db.from('attendance_sessions').update({ is_active: false }).eq('id', sessionId);
    if (error) return showToast('Gagal menutup sesi: ' + error.message, 'error');
    attendanceSessionsCache = [];
    if (guruQrCountdownTimer) {
        clearInterval(guruQrCountdownTimer);
        guruQrCountdownTimer = null;
    }
    showToast('🔒 Sesi Presensi QR / Token ditutup.');
    renderGuruQrSessionPanel();
}

function renderGuruQrSessionPanel() {
    const panel = document.getElementById('guru-qr-session-panel');
    if (!panel) return;

    if (guruQrCountdownTimer) {
        clearInterval(guruQrCountdownTimer);
        guruQrCountdownTimer = null;
    }

    if (!attendanceSessionsTableAvailable) {
        panel.classList.remove('hidden');
        panel.innerHTML = `
            <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-xs text-amber-800 dark:text-amber-300">
                ℹ️ Fitur <b>Presensi Cepat QR / Token Sesi</b> membutuhkan tabel <code class="font-mono font-bold">attendance_sessions</code> di Supabase. Jalankan skrip SQL Tahap 4 di Supabase SQL Editor untuk mengaktifkannya.
            </div>
        `;
        return;
    }

    const sess = getActiveGuruSession();
    if (!sess) {
        panel.classList.add('hidden');
        panel.innerHTML = '';
        return;
    }

    const baseUrl = window.location.origin + window.location.pathname.replace(/[^/]*$/, 'siswa.html');
    const checkinUrl = `${baseUrl}?checkin=${encodeURIComponent(sess.token)}`;
    const stuIdSet = new Set(studentsCache.map(s => Number(s.id)));
    const checkedLogs = attLogsCache.filter(l =>
        l.tanggal === sess.tanggal && l.status === 'H' && stuIdSet.has(Number(l.student_id))
    );
    const checkedUniqueIds = new Set(checkedLogs.map(l => Number(l.student_id)));
    const totalStu = studentsCache.length;
    const checkedCount = checkedUniqueIds.size;
    const pct = totalStu > 0 ? Math.round((checkedCount / totalStu) * 100) : 0;

    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="p-4 rounded-2xl border border-indigo-200 dark:border-indigo-800 bg-indigo-50/40 dark:bg-indigo-950/30 flex flex-col md:flex-row items-center gap-4">
            <div class="shrink-0 flex flex-col items-center gap-1.5">
                <div id="guru-qr-code-box" class="bg-white p-2.5 rounded-xl border border-slate-200 shadow-sm min-w-[132px] min-h-[132px] flex items-center justify-center"></div>
                <span class="text-[10px] font-bold text-slate-500 dark:text-slate-400">Scan QR via Kamera HP</span>
            </div>
            <div class="flex-1 w-full min-w-0 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 animate-pulse">🟢 Sesi Aktif</span>
                        <span class="text-xs font-bold text-slate-600 dark:text-slate-300">Tanggal: ${escapeHtmlSafe(sess.tanggal)}</span>
                    </div>
                    <div class="px-3 py-1 rounded-xl bg-amber-100 dark:bg-amber-950/70 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-extrabold font-mono">
                        ⏳ <span id="guru-qr-countdown">--:--</span>
                    </div>
                </div>

                <div class="flex flex-wrap items-center gap-3">
                    <div class="px-4 py-2 rounded-xl bg-white dark:bg-slate-900 border-2 border-dashed border-indigo-300 dark:border-indigo-700">
                        <span class="text-[10px] font-bold uppercase text-slate-400 block">Kode Token Sesi</span>
                        <span class="text-2xl sm:text-3xl font-black tracking-[0.2em] font-mono text-indigo-700 dark:text-indigo-300">${escapeHtmlSafe(sess.token)}</span>
                    </div>
                    <div class="flex flex-wrap gap-2">
                        <button type="button" onclick="copyGuruCheckinText('${escapeHtmlSafe(sess.token)}', 'Token presensi')" class="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold hover:bg-slate-50">
                            📋 Salin Token
                        </button>
                        <button type="button" onclick="copyGuruCheckinText('${escapeHtmlSafe(checkinUrl)}', 'Link QR check-in')" class="px-3 py-2 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-bold hover:bg-blue-100">
                            🔗 Salin Link Check-in
                        </button>
                        <button type="button" onclick="closeGuruQrSession(${sess.id})" class="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 dark:text-rose-400 border border-rose-200 dark:border-rose-900 text-xs font-extrabold hover:bg-rose-100">
                            🔒 Tutup Sesi
                        </button>
                    </div>
                </div>

                <div class="space-y-1">
                    <div class="flex items-center justify-between text-xs font-bold">
                        <span class="text-slate-600 dark:text-slate-300">Check-in Hadir Tercatat (${escapeHtmlSafe(sess.tanggal)})</span>
                        <span class="text-emerald-700 dark:text-emerald-400">${checkedCount} / ${totalStu} Siswa (${pct}%)</span>
                    </div>
                    <div class="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-full overflow-hidden">
                        <div class="h-full bg-emerald-500 transition-all duration-300" style="width: ${pct}%"></div>
                    </div>
                </div>
            </div>
        </div>
    `;

    const qrBox = document.getElementById('guru-qr-code-box');
    if (qrBox) {
        const renderQrIntoBox = () => {
            const currentBox = document.getElementById('guru-qr-code-box');
            if (!currentBox) return;
            currentBox.innerHTML = '';
            new QRCode(currentBox, {
                text: checkinUrl,
                width: 124,
                height: 124,
                colorDark: '#0f172a',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        };
        if (typeof QRCode !== 'undefined') {
            renderQrIntoBox();
        } else {
            qrBox.innerHTML = `<div class="text-center p-2"><span class="text-[10px] font-bold text-slate-400 block">MEMUAT QR...</span><span class="font-mono font-black text-base text-indigo-700">${escapeHtmlSafe(sess.token)}</span></div>`;
            ensureQrCodeLoaded().then((loaded) => {
                if (loaded) renderQrIntoBox();
                else {
                    const currentBox = document.getElementById('guru-qr-code-box');
                    if (currentBox) currentBox.innerHTML = `<div class="text-center p-2"><span class="text-[10px] font-bold text-slate-400 block">TOKEN</span><span class="font-mono font-black text-lg text-indigo-700">${escapeHtmlSafe(sess.token)}</span></div>`;
                }
            });
        }
    }

    const updateTick = () => {
        const el = document.getElementById('guru-qr-countdown');
        if (!el) return;
        const diff = new Date(sess.expires_at).getTime() - Date.now();
        if (diff <= 0) {
            el.innerText = '00:00 (Berakhir)';
            clearInterval(guruQrCountdownTimer);
            guruQrCountdownTimer = null;
            setTimeout(() => renderGuruQrSessionPanel(), 1200);
            return;
        }
        el.innerText = formatCountdownMs(diff);
    };
    updateTick();
    guruQrCountdownTimer = setInterval(updateTick, 1000);
}

function loadRecordedDates() {
    const dates = [...new Set(attLogsCache.map(l => l.tanggal))].sort().reverse();
    const sel = document.getElementById('abs-recorded-dates');
    const chips = document.getElementById('abs-date-chips');
    if (sel) sel.innerHTML = `<option value="">-- Riwayat Tanggal (${dates.length}) --</option>` + dates.map(d => `<option value="${d}">${d}</option>`).join('');
    if (chips) {
        chips.innerHTML = dates.length
            ? dates.map(d => `<button type="button" onclick="selectRecordedDate('${d}')" class="px-2.5 py-1 rounded-lg bg-blue-50 dark:bg-blue-950/60 hover:bg-blue-100 text-blue-700 dark:text-blue-300 text-[11px] font-bold border border-blue-200 dark:border-blue-800">${d}</button>`).join('')
            : `<span class="text-xs text-slate-400 italic">Belum ada pertemuan tercatat pada periode ini.</span>`;
    }
}

function selectRecordedDate(dateStr) {
    if (!dateStr) return;
    document.getElementById('abs-date-picker').value = dateStr;
    loadDailyAttendanceForDate();
}

function loadDailyAttendanceForDate() {
    const dateVal = document.getElementById('abs-date-picker')?.value;
    const tbody = document.getElementById('daily-absen-tbody');
    if (!tbody || !dateVal) return;

    let h = 0, si = 0, a = 0;
    tbody.innerHTML = studentsCache.map((s, idx) => {
        const log = attLogsCache.find(l => Number(l.student_id) === Number(s.id) && l.tanggal === dateVal);
        const st = log?.status || 'H';
        if (st === 'H') h++; else if (st === 'S' || st === 'I') si++; else if (st === 'A') a++;

        return `
            <tr data-stu-id="${s.id}">
                <td class="p-2.5 text-center text-slate-400">${idx + 1}</td>
                <td class="p-2.5 font-mono text-xs">${s.nisn}</td>
                <td class="p-2.5 font-bold text-slate-900 dark:text-white">${s.nama}</td>
                <td class="p-2.5 text-center">
                    <div class="inline-flex rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden text-xs font-extrabold">
                        ${['H', 'S', 'I', 'A'].map(opt => `
                            <label class="cursor-pointer px-3 py-1.5 ${st === opt ? (opt === 'H' ? 'bg-emerald-600 text-white' : opt === 'A' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white') : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50'}">
                                <input type="radio" name="att_${s.id}" value="${opt}" ${st === opt ? 'checked' : ''} onchange="refreshDailyAttStats()" class="hidden">
                                ${opt}
                            </label>
                        `).join('')}
                    </div>
                </td>
            </tr>
        `;
    }).join('');

    const tot = studentsCache.length || 1;
    document.getElementById('prs-stat-rate').innerText = `${studentsCache.length ? ((h / tot) * 100).toFixed(1) : 100}%`;
    document.getElementById('prs-stat-hadir').innerText = h;
    document.getElementById('prs-stat-sakitizin').innerText = si;
    document.getElementById('prs-stat-alpa').innerText = a;
}

function refreshDailyAttStats() {
    let h = 0, si = 0, a = 0;
    studentsCache.forEach(s => {
        const checked = document.querySelector(`input[name="att_${s.id}"]:checked`);
        const val = checked?.value || 'H';
        if (val === 'H') h++; else if (val === 'S' || val === 'I') si++; else if (val === 'A') a++;

        document.querySelectorAll(`input[name="att_${s.id}"]`).forEach(inp => {
            const lbl = inp.parentElement;
            lbl.className = inp.checked
                ? `cursor-pointer px-3 py-1.5 ${inp.value === 'H' ? 'bg-emerald-600 text-white' : inp.value === 'A' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`
                : 'cursor-pointer px-3 py-1.5 bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50';
        });
    });
    const tot = studentsCache.length || 1;
    document.getElementById('prs-stat-rate').innerText = `${studentsCache.length ? ((h / tot) * 100).toFixed(1) : 100}%`;
    document.getElementById('prs-stat-hadir').innerText = h;
    document.getElementById('prs-stat-sakitizin').innerText = si;
    document.getElementById('prs-stat-alpa').innerText = a;
}

function markAllPresentDaily() {
    studentsCache.forEach(s => {
        const radio = document.querySelector(`input[name="att_${s.id}"][value="H"]`);
        if (radio) radio.checked = true;
    });
    refreshDailyAttStats();
}

async function saveDailyAttendance() {
    const dateVal = document.getElementById('abs-date-picker').value;
    const amp = getActiveAmpuan();
    const targetPeriod = activePeriodName || currentDatePeriodName;
    if (!activeClassId || !dateVal || !amp) return showToast('Pilih kelas dan tanggal pertemuan!', 'error');

    await db.from('attendance_logs').delete().eq('class_id', activeClassId).eq('tanggal', dateVal).eq('mapel', amp.mapel);
    const payload = studentsCache.map(s => ({
        teacher_id: currentUser.id,
        class_id: activeClassId,
        student_id: s.id,
        mapel: amp.mapel,
        periode: targetPeriod,
        tanggal: dateVal,
        status: document.querySelector(`input[name="att_${s.id}"]:checked`)?.value || 'H'
    }));

    const { error } = await db.from('attendance_logs').insert(payload);
    if (error) return showToast('Gagal menyimpan absensi: ' + error.message, 'error');

    showToast(`✅ Absensi tanggal ${dateVal} (${targetPeriod}) tersimpan!`);
    await loadWorkspaceData();
}

async function deleteDailyAttendanceDate() {
    const dateVal = document.getElementById('abs-date-picker').value;
    const amp = getActiveAmpuan();
    if (!dateVal || !amp) return;
    const ok = await showAppConfirm(`Hapus catatan absensi untuk tanggal ${dateVal}?`, {
        title: 'Hapus Catatan Absensi',
        confirmText: 'Hapus Tanggal',
        tone: 'danger'
    });
    if (!ok) return;
    await db.from('attendance_logs').delete().eq('class_id', activeClassId).eq('tanggal', dateVal).eq('mapel', amp.mapel);
    showToast('Catatan tanggal dihapus.');
    await loadWorkspaceData();
}

async function exportDailyAttendanceExcel() {
    if (!(await ensureXlsxLoaded())) return;
    const dates = [...new Set(attLogsCache.map(l => l.tanggal))].sort();
    const header = ['No', 'NISN', 'Nama Siswa', ...dates, 'Hadir', 'Sakit', 'Izin', 'Alpa'];
    const rows = studentsCache.map((s, idx) => {
        const m = computeStudentMetrics(s.id);
        const dayCols = dates.map(d => attLogsCache.find(l => Number(l.student_id) === Number(s.id) && l.tanggal === d)?.status || '-');
        return [idx + 1, s.nisn, s.nama, ...dayCols, m.h, m.s, m.i, m.a];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matriks_Kehadiran');
    XLSX.writeFile(wb, `Matriks_Kehadiran_${activePeriodName}.xlsx`);
}

function renderAttendanceRecapTable() {
    const tbody = document.getElementById('absen-tbody');
    if (!tbody) return;
    tbody.innerHTML = studentsCache.map(s => {
        const m = computeStudentMetrics(s.id);
        return `
            <tr data-recap-stu="${s.id}">
                <td class="p-2.5 font-mono text-xs">${s.nisn}</td>
                <td class="p-2.5 font-bold">${s.nama}</td>
                <td class="p-2.5 text-center"><input type="number" class="recap-h w-14 border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1 text-center" value="${m.h}"></td>
                <td class="p-2.5 text-center"><input type="number" class="recap-s w-14 border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1 text-center" value="${m.s}"></td>
                <td class="p-2.5 text-center"><input type="number" class="recap-i w-14 border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1 text-center" value="${m.i}"></td>
                <td class="p-2.5 text-center"><input type="number" class="recap-a w-14 border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1 text-center" value="${m.a}"></td>
                <td class="p-2.5 text-center font-extrabold text-blue-700 dark:text-blue-400">${m.attScore.toFixed(1)}</td>
            </tr>
        `;
    }).join('');
}

async function saveAttendanceManual() {
    const amp = getActiveAmpuan();
    const targetPeriod = activePeriodName || currentDatePeriodName;
    if (!activeClassId || !amp) return;
    const stuIds = studentsCache.map(s => s.id);
    if (stuIds.length) {
        await db.from('attendance').delete().in('student_id', stuIds).eq('mapel', amp.mapel).eq('periode', targetPeriod);
    }
    const payload = [...document.querySelectorAll('#absen-tbody tr')].map(tr => ({
        teacher_id: currentUser.id,
        student_id: Number(tr.dataset.recapStu),
        mapel: amp.mapel,
        periode: targetPeriod,
        hadir: Number(tr.querySelector('.recap-h').value || 0),
        sakit: Number(tr.querySelector('.recap-s').value || 0),
        izin: Number(tr.querySelector('.recap-i').value || 0),
        alpa: Number(tr.querySelector('.recap-a').value || 0)
    }));
    await db.from('attendance').insert(payload);
    showToast('✅ Rekap kehadiran manual disimpan!');
    await loadWorkspaceData();
}

async function downloadTemplateAbsen() {
    if (!(await ensureXlsxLoaded())) return;
    const ws = XLSX.utils.aoa_to_sheet([['NISN', 'Nama', 'Hadir', 'Sakit', 'Izin', 'Alpa']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Absen');
    XLSX.writeFile(wb, 'Template_Rekap_Absensi.xlsx');
}

async function importAbsenExcel() {
    const file = document.getElementById('excel-absen')?.files?.[0];
    if (!file) return showToast('Pilih file Excel terlebih dahulu!', 'error');
    if (!(await ensureXlsxLoaded())) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        rows.forEach(r => {
            const stu = studentsCache.find(s => String(s.nisn) === String(r['NISN'] || '').trim());
            if (stu) {
                const tr = document.querySelector(`tr[data-recap-stu="${stu.id}"]`);
                if (tr) {
                    tr.querySelector('.recap-h').value = r['Hadir'] || 0;
                    tr.querySelector('.recap-s').value = r['Sakit'] || 0;
                    tr.querySelector('.recap-i').value = r['Izin'] || 0;
                    tr.querySelector('.recap-a').value = r['Alpa'] || 0;
                }
            }
        });
        await saveAttendanceManual();
    };
    reader.readAsArrayBuffer(file);
}

// ==================== 8. TUGAS, UJIAN & KELOMPOK ====================
async function createAssessment(e) {
    e.preventDefault();
    const amp = getActiveAmpuan();
    if (!activeClassId || !amp) return showToast('Pilih kelas dan mapel terlebih dahulu!', 'error');

    const judul = document.getElementById('ass-judul').value.trim();
    const deskripsi = document.getElementById('ass-deskripsi')?.value.trim() || null;
    const deadlineRaw = document.getElementById('ass-deadline')?.value || '';
    const deadline = deadlineRaw ? new Date(deadlineRaw).toISOString() : null;
    const teacherFiles = [...(document.getElementById('ass-teacher-files')?.files || [])];

    const btn = document.getElementById('btn-create-ass');
    if (btn) btn.disabled = true;

    try {
        let uploadedTeacherFiles = [];
        if (teacherFiles.length > 0) {
            showToast('⏳ Mengunggah file soal/panduan ke Google Drive Anda...');
            uploadedTeacherFiles = await uploadTeacherFilesToDrive(teacherFiles, `Soal_${judul.slice(0, 30)}`);
        }

        const payload = {
            class_id: activeClassId,
            teacher_id: currentUser.id,
            mapel: amp.mapel,
            periode: activePeriodName || currentDatePeriodName,
            judul,
            deskripsi,
            deadline,
            lampiran_guru: uploadedTeacherFiles.length > 0 ? JSON.stringify(uploadedTeacherFiles) : null,
            kategori: document.getElementById('ass-kategori').value,
            tipe_kerja: document.getElementById('ass-tipe').value,
            tampil_publik: document.getElementById('ass-publik').value === 'true',
            link_pengumpulan: document.getElementById('ass-link').value.trim() || null
        };

        const { error } = await db.from('assessments').insert([payload]);
        if (error) throw new Error(error.message);

        e.target.reset();
        showToast('✅ Tugas / Ujian baru ditambahkan!');
        await loadWorkspaceData();
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function parseQuizDataSafe(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return null; }
}

function renderAssessmentsDropdown() {
    const sel = document.getElementById('active-assessment');
    if (!sel) return;
    document.getElementById('tgs-stat-total').innerText = assessmentsCache.length;

    const prevSelected = sel.value;
    sel.innerHTML = assessmentsCache.length
        ? assessmentsCache.map(a => {
            const qd = parseQuizDataSafe(a.quiz_data);
            const hasQuiz = qd && Array.isArray(qd.questions) && qd.questions.length > 0;
            return `<option value="${a.id}">${hasQuiz ? '🧩 ' : ''}${a.judul} (${getKategoriLabel(a.kategori)})</option>`;
        }).join('')
        : `<option value="">-- Belum Ada Tugas / Ujian --</option>`;

    if (prevSelected && assessmentsCache.some(a => String(a.id) === String(prevSelected))) {
        sel.value = prevSelected;
    }

    loadAssessmentScores();
}

function parseStudentSubmittedFiles(raw) {
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
    } catch {
        if (String(raw).startsWith('http')) return [{ name: 'File 1', url: raw }];
    }
    return [];
}

function loadAssessmentScores() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    const ass = assessmentsCache.find(a => Number(a.id) === assId);
    const tbody = document.getElementById('scores-tbody');
    const thead = tbody?.parentElement?.querySelector('thead');
    const editor = document.getElementById('ass-link-editor');
    const grpBanner = document.getElementById('group-mode-banner');

    if (!ass || !tbody) {
        if (editor) editor.classList.add('hidden');
        if (grpBanner) grpBanner.classList.add('hidden');
        if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Pilih atau buat penilaian baru di atas.</td></tr>`;
        return;
    }

    editor.classList.remove('hidden');
    document.getElementById('edit-ass-judul').value = ass.judul;
    document.getElementById('edit-ass-kategori').value = normalizeKategori(ass.kategori);
    document.getElementById('edit-ass-tipe').value = ass.tipe_kerja || 'individu';
    document.getElementById('edit-ass-deskripsi').value = ass.deskripsi || '';
    document.getElementById('edit-ass-link').value = ass.link_pengumpulan || '';

    const editFilesInp = document.getElementById('edit-ass-teacher-files');
    if (editFilesInp) editFilesInp.value = '';

    const dlInp = document.getElementById('edit-ass-deadline');
    if (dlInp) {
        if (ass.deadline) {
            const dt = new Date(ass.deadline);
            const localIso = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
            dlInp.value = localIso;
        } else {
            dlInp.value = '';
        }
    }

    const tchFilesBox = document.getElementById('edit-ass-teacher-files-list');
    if (tchFilesBox) {
        const tFiles = parseStudentSubmittedFiles(ass.lampiran_guru);
        tchFilesBox.innerHTML = tFiles.length
            ? `<span class="text-[11px] font-bold text-slate-500 mr-1">Lampiran Terpasang:</span>` +
              tFiles.map((tf, idx) => `
                <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-800 border border-amber-200 text-[11px] font-bold">
                    <a href="${tf.url}" target="_blank" class="hover:underline">📄 ${tf.name} ↗</a>
                    <button type="button" onclick="removeTeacherAssessmentFile(${ass.id}, ${idx})" title="Hapus lampiran ini" class="text-rose-600 hover:text-rose-800 font-extrabold ml-1">✕</button>
                </span>
              `).join('')
            : '';
    }

    const btnPub = document.getElementById('btn-toggle-public');
    btnPub.innerText = ass.tampil_publik ? '🌐 Publik' : '🔒 Privat';
    btnPub.className = ass.tampil_publik
        ? 'px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700'
        : 'px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-600';

    const testLink = document.getElementById('btn-test-ass-link');
    if (ass.link_pengumpulan) { testLink.href = ass.link_pengumpulan; testLink.classList.remove('hidden'); }
    else { testLink.classList.add('hidden'); }

    const qBadge = document.getElementById('edit-ass-quiz-badge');
    const quizData = parseQuizDataSafe(ass.quiz_data);
    if (qBadge) {
        if (quizData && Array.isArray(quizData.questions) && quizData.questions.length > 0) {
            const dur = Number(quizData.duration_minutes || 0);
            qBadge.innerText = `${quizData.questions.length} Soal${dur ? ` • ${dur}m` : ''}`;
            qBadge.classList.remove('hidden');
        } else {
            qBadge.classList.add('hidden');
        }
    }

    const isGroup = ass.tipe_kerja === 'kelompok';
    grpBanner.classList.toggle('hidden', !isGroup);
    if (isGroup) loadGroupPresetsDropdown();

    thead.innerHTML = `
        <tr class="bg-slate-50 dark:bg-slate-800/70 text-slate-600 dark:text-slate-300 border-b dark:border-slate-800">
            <th class="p-3 text-center w-10">No</th>
            <th class="p-3">Nama Siswa</th>
            ${isGroup ? '<th class="p-3 w-36">Kelompok</th>' : ''}
            <th class="p-3 text-center">File / Link Siswa</th>
            <th class="p-3 text-center w-16 sm:w-36"><span class="sm:hidden">Status</span><span class="hidden sm:inline">Status Tugas</span></th>
            <th class="p-3 min-w-[190px]">Catatan / Revisi Guru</th>
            <th class="p-3 text-center w-24">Nilai (0-100)</th>
        </tr>
    `;

    let submitted = 0, ungraded = 0, sumScore = 0, gradedCount = 0;

    const getStatusUiMeta = (val) => {
        if (val === 'approved') {
            return {
                symbol: '✅',
                label: 'Sudah / Tuntas',
                colorCls: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300'
            };
        }
        if (val === 'rejected') {
            return {
                symbol: '❌',
                label: 'Perlu Revisi',
                colorCls: 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300'
            };
        }
        if (val === 'pending') {
            return {
                symbol: '⏳',
                label: 'Pending',
                colorCls: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300'
            };
        }
        return {
            symbol: '—',
            label: 'Belum',
            colorCls: 'border-slate-300 bg-white text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300'
        };
    };

    tbody.innerHTML = studentsCache.map((s, idx) => {
        const sc = scoresCache.find(x => Number(x.assessment_id) === assId && Number(x.student_id) === Number(s.id)) || {};
        const isDone = sc.status_kumpul === true || sc.status_pengajuan === 'approved';
        const isPending = sc.status_pengajuan === 'pending' && !isDone;
        const isRejected = sc.status_pengajuan === 'rejected';
        const statusVal = isRejected ? 'rejected' : (isDone ? 'approved' : (isPending ? 'pending' : 'none'));
        const val = sc.nilai !== null && sc.nilai !== undefined ? sc.nilai : '';
        const feedbackVal = escapeHtmlSafe(sc.catatan_guru || '');

        if (isDone) submitted++;
        if (isDone && val === '') ungraded++;
        if (val !== '') { sumScore += Number(val); gradedCount++; }

        const parsedFiles = parseStudentSubmittedFiles(sc.link_tugas_siswa);
        const hasQuizDetail = Boolean(parseQuizDataSafe(sc.quiz_answers));
        const fileLinkHtml = (parsedFiles.length > 0 || hasQuizDetail)
            ? `<div class="flex flex-wrap items-center justify-center gap-1">
                ${parsedFiles.map((f, fIdx) => {
                    if (f.type === 'quiz_result') {
                        return `<span class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold">
                            🧩 ${escapeHtmlSafe(f.name || 'Kuis Selesai')}
                        </span>`;
                    }
                    const isLink = f.type === 'link' || String(f.name || '').startsWith('Link:');
                    return isLink
                        ? `<a href="${f.url}" target="_blank" title="${escapeHtmlSafe(f.name)} (${escapeHtmlSafe(f.url)})" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold">
                            🔗 Link ${fIdx + 1} ↗
                           </a>`
                        : `<a href="${f.url}" target="_blank" title="${escapeHtmlSafe(f.name)}" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-extrabold">
                            📂 File ${fIdx + 1} ↗
                           </a>`;
                }).join('')}
                ${hasQuizDetail ? `<button type="button" onclick="openStudentQuizDetailModal(${assId}, ${s.id})" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-bold">👁️ Rincian</button>` : ''}
               </div>`
            : `<span class="text-[11px] text-slate-400">-</span>`;

        const stMeta = getStatusUiMeta(statusVal);

        return `
            <tr data-score-stu="${s.id}" class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-2.5 text-center text-slate-400">${idx + 1}</td>
                <td class="p-2.5">
                    <div class="font-bold text-slate-900 dark:text-white">${escapeHtmlSafe(s.nama)}</div>
                    <div class="text-[10px] font-mono text-slate-400">${escapeHtmlSafe(s.nisn)}</div>
                </td>
                ${isGroup ? `<td class="p-2.5"><input type="text" list="datalist-kelompok-options" value="${escapeHtmlSafe(sc.nama_kelompok || '')}" oninput="syncGroupRowChange(${s.id})" class="sc-kelompok w-full border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1.5 text-xs font-bold"></td>` : ''}
                <td class="p-2.5 text-center">${fileLinkHtml}</td>
                <td class="p-2.5 text-center">
                    <div class="sc-status-wrap relative inline-flex sm:flex items-center justify-center sm:w-full" title="${stMeta.label}">
                        <span class="sc-status-mobile sm:hidden inline-flex items-center justify-center gap-1 min-w-[52px] px-2 py-1.5 rounded-lg border text-xs font-extrabold leading-none pointer-events-none select-none ${stMeta.colorCls}">
                            <span class="sc-status-symbol">${stMeta.symbol}</span>
                            <i class="fa-solid fa-chevron-down text-[9px] opacity-70"></i>
                        </span>
                        <select onchange="onScoreStatusChange(this, ${s.id})" aria-label="Status Tugas" class="sc-status absolute inset-0 w-full h-full opacity-0 sm:static sm:opacity-100 sm:min-w-[132px] border rounded-lg px-2 py-1.5 text-[11px] font-extrabold outline-none cursor-pointer ${stMeta.colorCls}">
                            <option value="none" ${statusVal === 'none' ? 'selected' : ''}>— Belum</option>
                            <option value="pending" ${statusVal === 'pending' ? 'selected' : ''}>⏳ Pending</option>
                            <option value="approved" ${statusVal === 'approved' ? 'selected' : ''}>✅ Sudah / Tuntas</option>
                            <option value="rejected" ${statusVal === 'rejected' ? 'selected' : ''}>❌ Perlu Revisi</option>
                        </select>
                    </div>
                </td>
                <td class="p-2.5">
                    <input type="text" value="${feedbackVal}" placeholder="Catatan / alasan revisi..." oninput="syncGroupRowChange(${s.id})" class="sc-catatan w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg px-2.5 py-1.5 text-xs outline-none focus:ring-2 focus:ring-blue-500">
                </td>
                <td class="p-2.5 text-center">
                    <input type="number" min="0" max="100" step="0.1" value="${val}" placeholder="-" oninput="syncGroupRowChange(${s.id})" class="sc-nilai w-20 border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1.5 text-center font-extrabold text-blue-800 dark:text-blue-300">
                </td>
            </tr>
        `;
    }).join('');

    const tot = studentsCache.length || 1;
    document.getElementById('tgs-stat-submit').innerText = `${studentsCache.length ? Math.round((submitted / tot) * 100) : 0}%`;
    document.getElementById('tgs-stat-ungraded').innerText = ungraded;
    document.getElementById('tgs-stat-avg').innerText = gradedCount ? (sumScore / gradedCount).toFixed(1) : '0.0';
}

function applyScoreStatusSelectStyle(sel) {
    if (!sel) return;
    const baseSelect = 'sc-status absolute inset-0 w-full h-full opacity-0 sm:static sm:opacity-100 sm:min-w-[132px] border rounded-lg px-2 py-1.5 text-[11px] font-extrabold outline-none cursor-pointer ';
    const baseMobile = 'sc-status-mobile sm:hidden inline-flex items-center justify-center gap-1 min-w-[52px] px-2 py-1.5 rounded-lg border text-xs font-extrabold leading-none pointer-events-none select-none ';
    const v = sel.value;

    let symbol = '—';
    let label = 'Belum';
    let colorCls = 'border-slate-300 bg-white text-slate-600 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-300';

    if (v === 'approved') {
        symbol = '✅';
        label = 'Sudah / Tuntas';
        colorCls = 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/60 dark:border-emerald-800 dark:text-emerald-300';
    } else if (v === 'rejected') {
        symbol = '❌';
        label = 'Perlu Revisi';
        colorCls = 'border-rose-300 bg-rose-50 text-rose-700 dark:bg-rose-950/60 dark:border-rose-800 dark:text-rose-300';
    } else if (v === 'pending') {
        symbol = '⏳';
        label = 'Pending';
        colorCls = 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-950/60 dark:border-amber-800 dark:text-amber-300';
    }

    sel.className = baseSelect + colorCls;
    const wrap = sel.closest('.sc-status-wrap');
    if (wrap) {
        wrap.title = label;
        const mobPill = wrap.querySelector('.sc-status-mobile');
        if (mobPill) mobPill.className = baseMobile + colorCls;
        const mobSym = wrap.querySelector('.sc-status-symbol');
        if (mobSym) mobSym.innerText = symbol;
    }
}

function onScoreStatusChange(sel, stuId) {
    applyScoreStatusSelectStyle(sel);
    syncGroupRowChange(stuId);
}

function syncGroupRowChange(changedStuId) {
    const assId = Number(document.getElementById('active-assessment')?.value);
    const ass = assessmentsCache.find(a => Number(a.id) === assId);
    if (!ass || ass.tipe_kerja !== 'kelompok') return;

    const sourceTr = document.querySelector(`tr[data-score-stu="${changedStuId}"]`);
    if (!sourceTr) return;
    const grpName = sourceTr.querySelector('.sc-kelompok')?.value.trim();
    if (!grpName) return;

    const statusVal = sourceTr.querySelector('.sc-status')?.value || 'none';
    const nilai = sourceTr.querySelector('.sc-nilai')?.value ?? '';
    const catatan = sourceTr.querySelector('.sc-catatan')?.value ?? '';

    document.querySelectorAll('#scores-tbody tr').forEach(tr => {
        const g = tr.querySelector('.sc-kelompok')?.value.trim();
        if (g && g.toLowerCase() === grpName.toLowerCase()) {
            const stSel = tr.querySelector('.sc-status');
            if (stSel) {
                stSel.value = statusVal;
                applyScoreStatusSelectStyle(stSel);
            }
            const nilInp = tr.querySelector('.sc-nilai');
            if (nilInp) nilInp.value = nilai;
            const catInp = tr.querySelector('.sc-catatan');
            if (catInp) catInp.value = catatan;
        }
    });
}

async function saveAssessmentScores() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    if (!assId) return;

    const rows = [...document.querySelectorAll('#scores-tbody tr[data-score-stu]')];
    let missingCatatanCol = false;

    for (const tr of rows) {
        const stuId = Number(tr.dataset.scoreStu);
        const statusVal = tr.querySelector('.sc-status')?.value || 'none';
        const kumpul = statusVal === 'approved';
        const rawVal = tr.querySelector('.sc-nilai')?.value ?? '';
        const nilai = rawVal !== '' ? Number(rawVal) : null;
        const nama_kelompok = tr.querySelector('.sc-kelompok')?.value.trim() || null;
        const catatan_guru = tr.querySelector('.sc-catatan')?.value.trim() || null;

        const existing = scoresCache.find(x => Number(x.assessment_id) === assId && Number(x.student_id) === stuId);
        const basePayload = {
            status_kumpul: kumpul,
            status_pengajuan: statusVal,
            nilai,
            nama_kelompok
        };
        const fullPayload = missingCatatanCol ? basePayload : { ...basePayload, catatan_guru };

        if (existing) {
            const { error } = await db.from('scores').update(fullPayload).eq('id', existing.id);
            if (error && !missingCatatanCol && String(error.message || '').toLowerCase().includes('catatan_guru')) {
                missingCatatanCol = true;
                await db.from('scores').update(basePayload).eq('id', existing.id);
            }
        } else {
            const insertFull = missingCatatanCol
                ? { assessment_id: assId, student_id: stuId, ...basePayload }
                : { assessment_id: assId, student_id: stuId, ...basePayload, catatan_guru };
            const { error } = await db.from('scores').insert([insertFull]);
            if (error && !missingCatatanCol && String(error.message || '').toLowerCase().includes('catatan_guru')) {
                missingCatatanCol = true;
                await db.from('scores').insert([{ assessment_id: assId, student_id: stuId, ...basePayload }]);
            }
        }
    }

    if (missingCatatanCol) {
        showToast('⚠️ Nilai & status revisi tersimpan, namun kolom catatan_guru belum dibuat di Supabase.', 'info');
    } else {
        showToast('✅ Nilai, status tugas, dan catatan guru tersimpan!');
    }
    await loadWorkspaceData();
    document.getElementById('active-assessment').value = assId;
    loadAssessmentScores();
}

async function updateAssessmentLink() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    const ass = assessmentsCache.find(a => Number(a.id) === assId);
    if (!assId || !ass) return;

    const btn = document.getElementById('btn-update-ass');
    if (btn) btn.disabled = true;

    try {
        const judul = document.getElementById('edit-ass-judul').value.trim();
        const dlRaw = document.getElementById('edit-ass-deadline')?.value || '';
        const newFiles = [...(document.getElementById('edit-ass-teacher-files')?.files || [])];

        let existingFiles = parseStudentSubmittedFiles(ass.lampiran_guru);
        if (newFiles.length > 0) {
            showToast('⏳ Mengunggah file soal tambahan ke Google Drive...');
            const uploaded = await uploadTeacherFilesToDrive(newFiles, `Soal_${judul.slice(0, 30)}`);
            existingFiles = [...existingFiles, ...uploaded];
        }

        const { error } = await db.from('assessments').update({
            judul,
            kategori: document.getElementById('edit-ass-kategori').value,
            tipe_kerja: document.getElementById('edit-ass-tipe').value,
            deskripsi: document.getElementById('edit-ass-deskripsi').value.trim() || null,
            deadline: dlRaw ? new Date(dlRaw).toISOString() : null,
            link_pengumpulan: document.getElementById('edit-ass-link').value.trim() || null,
            lampiran_guru: existingFiles.length > 0 ? JSON.stringify(existingFiles) : null
        }).eq('id', assId);

        if (error) throw new Error(error.message);

        showToast('✅ Detail & lampiran tugas berhasil diperbarui!');
        await loadWorkspaceData();
        document.getElementById('active-assessment').value = assId;
        loadAssessmentScores();
    } catch (err) {
        showToast('❌ ' + err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function removeTeacherAssessmentFile(assId, fileIndex) {
    const ass = assessmentsCache.find(a => Number(a.id) === Number(assId));
    if (!ass) return;
    const ok = await showAppConfirm('Hapus lampiran file soal ini dari tugas?', {
        title: 'Hapus Lampiran Soal',
        confirmText: 'Hapus File',
        tone: 'danger'
    });
    if (!ok) return;

    const files = parseStudentSubmittedFiles(ass.lampiran_guru);
    files.splice(fileIndex, 1);

    const { error } = await db.from('assessments')
        .update({ lampiran_guru: files.length > 0 ? JSON.stringify(files) : null })
        .eq('id', assId);

    if (error) return showToast('Gagal menghapus lampiran: ' + error.message, 'error');

    showToast('🗑️ Lampiran file dihapus dari tugas.');
    await loadWorkspaceData();
    document.getElementById('active-assessment').value = assId;
    loadAssessmentScores();
}

async function toggleAssessmentPublicVisibility() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    const ass = assessmentsCache.find(a => Number(a.id) === assId);
    if (!ass) return;
    await db.from('assessments').update({ tampil_publik: !ass.tampil_publik }).eq('id', assId);
    showToast(!ass.tampil_publik ? '🌐 Tugas ditampilkan di LMS Siswa' : '🔒 Tugas disembunyikan');
    await loadWorkspaceData();
    document.getElementById('active-assessment').value = assId;
    loadAssessmentScores();
}

async function deleteCurrentAssessment() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    if (!assId) return;
    const ok = await showAppConfirm('Hapus penilaian ini beserta seluruh nilai dan kiriman siswa di dalamnya?', {
        title: 'Hapus Penilaian',
        confirmText: 'Hapus Permanen',
        tone: 'danger'
    });
    if (!ok) return;
    await db.from('assessments').delete().eq('id', assId);
    showToast('Penilaian dihapus.');
    await loadWorkspaceData();
}

// ==================== 8B. PENYUSUN KUIS ONLINE (PG & ISIAN SINGKAT) ====================
function openQuizBuilderModal() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    const ass = assessmentsCache.find(a => Number(a.id) === assId);
    if (!ass) return showToast('Pilih atau buat tugas/ujian terlebih dahulu!', 'error');

    quizBuilderAssId = assId;
    const existing = parseQuizDataSafe(ass.quiz_data);
    quizBuilderDraft = existing && Array.isArray(existing.questions)
        ? JSON.parse(JSON.stringify(existing))
        : {
            duration_minutes: 20,
            shuffle: false,
            show_review: true,
            questions: [
                { id: 'q_' + Date.now(), type: 'pg', prompt: '', points: 1, options: ['', '', '', ''], correct_index: 0 }
            ]
        };

    document.getElementById('qb-subtitle').innerText = `${ass.judul} (${getKategoriLabel(ass.kategori)})`;
    document.getElementById('qb-duration').value = Number(quizBuilderDraft.duration_minutes ?? 20);
    document.getElementById('qb-shuffle').checked = Boolean(quizBuilderDraft.shuffle);
    document.getElementById('qb-show-review').checked = quizBuilderDraft.show_review !== false;

    renderQuizBuilderQuestions();
    document.getElementById('modal-quiz-builder').classList.remove('hidden');
}

function closeQuizBuilderModal() {
    document.getElementById('modal-quiz-builder').classList.add('hidden');
    quizBuilderAssId = null;
}

function syncQuizDraftFromDOM() {
    quizBuilderDraft.duration_minutes = Math.max(0, Number(document.getElementById('qb-duration')?.value || 0));
    quizBuilderDraft.shuffle = Boolean(document.getElementById('qb-shuffle')?.checked);
    quizBuilderDraft.show_review = Boolean(document.getElementById('qb-show-review')?.checked);

    const cards = [...document.querySelectorAll('#qb-questions-list [data-qb-idx]')];
    cards.forEach(card => {
        const idx = Number(card.dataset.qbIdx);
        const q = quizBuilderDraft.questions[idx];
        if (!q) return;
        q.prompt = card.querySelector('.qb-prompt')?.value || '';
        q.points = Math.max(1, Number(card.querySelector('.qb-points')?.value || 1));
        if (q.type === 'pg') {
            q.options = [0, 1, 2, 3].map(optIdx => card.querySelector(`.qb-opt-${optIdx}`)?.value || '');
            const checkedRadio = card.querySelector(`input[name="qb_correct_${idx}"]:checked`);
            q.correct_index = checkedRadio ? Number(checkedRadio.value) : 0;
        } else {
            const rawAns = card.querySelector('.qb-short-ans')?.value || '';
            q.accepted_answers = rawAns.split(',').map(s => s.trim()).filter(Boolean);
        }
    });
}

function addQuizQuestion(type) {
    syncQuizDraftFromDOM();
    if (type === 'short') {
        quizBuilderDraft.questions.push({
            id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            type: 'short',
            prompt: '',
            points: 1,
            accepted_answers: []
        });
    } else {
        quizBuilderDraft.questions.push({
            id: 'q_' + Date.now() + '_' + Math.floor(Math.random() * 1000),
            type: 'pg',
            prompt: '',
            points: 1,
            options: ['', '', '', ''],
            correct_index: 0
        });
    }
    renderQuizBuilderQuestions();
}

function removeQuizQuestion(idx) {
    syncQuizDraftFromDOM();
    quizBuilderDraft.questions.splice(idx, 1);
    renderQuizBuilderQuestions();
}

function renderQuizBuilderQuestions() {
    const box = document.getElementById('qb-questions-list');
    if (!box) return;
    if (!quizBuilderDraft.questions.length) {
        box.innerHTML = `<p class="text-center text-slate-400 italic py-6">Belum ada soal. Klik tombol tambah Pilihan Ganda atau Isian Singkat di bawah.</p>`;
        return;
    }

    const letters = ['A', 'B', 'C', 'D'];
    box.innerHTML = quizBuilderDraft.questions.map((q, idx) => {
        const isPG = q.type !== 'short';
        return `
            <div data-qb-idx="${idx}" class="p-3.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/50 space-y-2.5">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2">
                        <span class="px-2 py-0.5 rounded-lg bg-slate-900 dark:bg-blue-600 text-white font-extrabold text-[11px]">Soal #${idx + 1}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${isPG ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700'}">
                            ${isPG ? 'Pilihan Ganda' : 'Isian Singkat'}
                        </span>
                    </div>
                    <div class="flex items-center gap-2">
                        <label class="text-[11px] font-bold text-slate-500">Poin:</label>
                        <input type="number" min="1" max="100" value="${q.points || 1}" class="qb-points w-14 border dark:border-slate-700 bg-white dark:bg-slate-800 rounded-lg p-1 text-center font-bold">
                        <button type="button" onclick="removeQuizQuestion(${idx})" class="px-2 py-1 rounded-lg bg-rose-50 dark:bg-rose-950/60 text-rose-600 font-bold">Hapus</button>
                    </div>
                </div>
                <textarea rows="2" placeholder="Tulis pertanyaan soal nomor ${idx + 1}..." class="qb-prompt w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl p-2.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500">${escapeHtmlSafe(q.prompt || '')}</textarea>
                ${isPG ? `
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        ${[0, 1, 2, 3].map(optIdx => `
                            <label class="flex items-center gap-2 p-2 rounded-xl border ${Number(q.correct_index) === optIdx ? 'border-emerald-400 bg-emerald-50/60 dark:bg-emerald-950/40' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900'}">
                                <input type="radio" name="qb_correct_${idx}" value="${optIdx}" ${Number(q.correct_index) === optIdx ? 'checked' : ''} class="accent-emerald-600 shrink-0" title="Tandai sebagai kunci benar">
                                <span class="font-extrabold text-slate-500 w-4">${letters[optIdx]}.</span>
                                <input type="text" value="${escapeHtmlSafe((q.options || [])[optIdx] || '')}" placeholder="Pilihan ${letters[optIdx]}..." class="qb-opt-${optIdx} flex-1 bg-transparent outline-none text-xs">
                            </label>
                        `).join('')}
                    </div>
                    <p class="text-[10px] text-slate-400">Pilih lingkaran radio di sebelah kiri opsi untuk menentukan kunci jawaban benar.</p>
                ` : `
                    <div>
                        <label class="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">Kunci Jawaban Benar (pisahkan alternatif dengan koma, tidak peka huruf besar/kecil):</label>
                        <input type="text" value="${escapeHtmlSafe((q.accepted_answers || []).join(', '))}" placeholder="Contoh: jakarta, dki jakarta" class="qb-short-ans w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 rounded-xl p-2 text-xs outline-none focus:ring-2 focus:ring-emerald-500">
                    </div>
                `}
            </div>
        `;
    }).join('');
}

async function saveQuizBuilder() {
    if (!quizBuilderAssId) return;
    syncQuizDraftFromDOM();

    if (!quizBuilderDraft.questions.length) {
        return showToast('Tambahkan minimal 1 soal atau klik Kosongkan Kuis.', 'error');
    }

    for (let i = 0; i < quizBuilderDraft.questions.length; i++) {
        const q = quizBuilderDraft.questions[i];
        if (!q.prompt.trim()) {
            return showToast(`Pertanyaan Soal #${i + 1} tidak boleh kosong!`, 'error');
        }
        if (q.type === 'pg') {
            const filledOpts = (q.options || []).filter(o => o.trim() !== '');
            if (filledOpts.length < 2) {
                return showToast(`Soal #${i + 1} (PG) minimal memiliki 2 pilihan jawaban terisi!`, 'error');
            }
            if (!(q.options[q.correct_index] || '').trim()) {
                return showToast(`Kunci jawaban benar Soal #${i + 1} tidak boleh kosong!`, 'error');
            }
        } else if (!q.accepted_answers || !q.accepted_answers.length) {
            return showToast(`Isi kunci jawaban untuk Soal #${i + 1} (Isian Singkat)!`, 'error');
        }
    }

    const btn = document.getElementById('btn-save-quiz-builder');
    if (btn) btn.disabled = true;

    try {
        const targetAssId = quizBuilderAssId;
        const { error } = await db.from('assessments')
            .update({ quiz_data: quizBuilderDraft })
            .eq('id', targetAssId);

        if (error) {
            if (/quiz_data|does not exist|schema cache/i.test(error.message || '')) {
                showToast('⚠️ Kolom quiz_data belum dibuat di tabel assessments Supabase. Jalankan skrip SQL Tahap 5.', 'error');
            } else {
                showToast('❌ Gagal menyimpan kuis: ' + error.message, 'error');
            }
            return;
        }

        closeQuizBuilderModal();
        showToast(`✅ Kuis Online (${quizBuilderDraft.questions.length} soal) berhasil disimpan!`);
        await loadWorkspaceData();
        document.getElementById('active-assessment').value = targetAssId;
        loadAssessmentScores();
    } finally {
        if (btn) btn.disabled = false;
    }
}

async function disableQuizOnAssessment() {
    if (!quizBuilderAssId) return;
    const targetAssId = quizBuilderAssId;
    const { error } = await db.from('assessments')
        .update({ quiz_data: null })
        .eq('id', targetAssId);
    if (error && !/quiz_data|does not exist/i.test(error.message || '')) {
        return showToast('Gagal mengosongkan kuis: ' + error.message, 'error');
    }
    closeQuizBuilderModal();
    showToast('🗑️ Mode Kuis Online dinonaktifkan pada tugas ini.');
    await loadWorkspaceData();
    document.getElementById('active-assessment').value = targetAssId;
    loadAssessmentScores();
}

function openStudentQuizDetailModal(assId, stuId) {
    const ass = assessmentsCache.find(a => Number(a.id) === Number(assId));
    const stu = studentsCache.find(s => Number(s.id) === Number(stuId));
    const sc = scoresCache.find(x => Number(x.assessment_id) === Number(assId) && Number(x.student_id) === Number(stuId));
    const attempt = parseQuizDataSafe(sc?.quiz_answers);
    const quizData = parseQuizDataSafe(ass?.quiz_data);
    if (!attempt || !quizData) return showToast('Detail jawaban kuis belum tersedia.', 'info');

    document.getElementById('qsd-subtitle').innerText = `${stu?.nama || 'Siswa'} • ${ass.judul} • Skor: ${sc.nilai ?? attempt.score}`;
    const letters = ['A', 'B', 'C', 'D'];
    document.getElementById('qsd-body').innerHTML = (attempt.items || []).map((it, idx) => {
        const q = (quizData.questions || []).find(qq => String(qq.id) === String(it.q_id)) || {};
        const userAnsText = q.type === 'short'
            ? (it.user_answer || '(Kosong)')
            : (it.user_answer !== null && it.user_answer !== undefined ? `${letters[Number(it.user_answer)]}. ${(q.options || [])[Number(it.user_answer)] || ''}` : '(Kosong)');
        const keyText = q.type === 'short'
            ? (q.accepted_answers || []).join(' / ')
            : `${letters[Number(q.correct_index)]}. ${(q.options || [])[Number(q.correct_index)] || ''}`;
        return `
            <div class="p-3 rounded-xl border ${it.is_correct ? 'border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-rose-200 bg-rose-50/50 dark:bg-rose-950/30'} space-y-1">
                <div class="flex items-center justify-between gap-2 font-extrabold">
                    <span>Soal #${idx + 1}</span>
                    <span class="${it.is_correct ? 'text-emerald-700' : 'text-rose-600'}">${it.is_correct ? `✅ Benar (+${it.points_earned})` : '❌ Salah (0)'}</span>
                </div>
                <div class="text-slate-800 dark:text-slate-200 font-semibold">${escapeHtmlSafe(q.prompt || '-')}</div>
                <div class="text-[11px] text-slate-600 dark:text-slate-300">Jawaban Siswa: <b>${escapeHtmlSafe(userAnsText)}</b></div>
                ${!it.is_correct ? `<div class="text-[11px] text-emerald-700 dark:text-emerald-400">Kunci Benar: <b>${escapeHtmlSafe(keyText)}</b></div>` : ''}
            </div>
        `;
    }).join('');
    document.getElementById('modal-quiz-student-detail').classList.remove('hidden');
}

// Preset Kelompok
function loadGroupPresetsDropdown() {
    const amp = getActiveAmpuan();
    const raw = amp?.kelompok_template;
    groupPresetsCache = Array.isArray(raw) ? raw : [];
    const sel = document.getElementById('select-group-preset');
    if (sel) sel.innerHTML = `<option value="">-- Pilih Preset Kelompok --</option>` + groupPresetsCache.map((p, idx) => `<option value="${idx}">${p.nama_preset}</option>`).join('');
}

function applySelectedGroupPreset() {
    const idx = document.getElementById('select-group-preset').value;
    if (idx === '') return showToast('Pilih preset kelompok terlebih dahulu!', 'error');
    const preset = groupPresetsCache[Number(idx)];
    if (!preset) return;
    const mapping = preset.mapping || {};
    document.querySelectorAll('#scores-tbody tr[data-score-stu]').forEach(tr => {
        const inp = tr.querySelector('.sc-kelompok');
        if (inp && mapping[tr.dataset.scoreStu]) inp.value = mapping[tr.dataset.scoreStu];
    });
    showToast(`✅ Preset "${preset.nama_preset}" diterapkan!`);
}

async function saveCurrentTableAsGroupPreset() {
    const amp = getActiveAmpuan();
    if (!amp) return;
    const nama = prompt('Masukkan nama preset kelompok:');
    if (!nama) return;
    const mapping = {};
    document.querySelectorAll('#scores-tbody tr[data-score-stu]').forEach(tr => {
        const g = tr.querySelector('.sc-kelompok')?.value.trim();
        if (g) mapping[tr.dataset.scoreStu] = g;
    });
    const updatedList = [...groupPresetsCache, { nama_preset: nama, mapping }];
    await db.from('teacher_settings').update({ kelompok_template: updatedList }).eq('id', amp.id);
    amp.kelompok_template = updatedList;
    showToast('✅ Preset kelompok disimpan!');
    loadGroupPresetsDropdown();
}

function openGroupManagerModal() {
    document.getElementById('modal-group-manager').classList.remove('hidden');
    const sel = document.getElementById('gm-preset-select');
    sel.innerHTML = `<option value="">-- Preset Baru --</option>` + groupPresetsCache.map((p, idx) => `<option value="${idx}">${p.nama_preset}</option>`).join('');
    modalGroupMap = {};
    renderGroupManagerRows();
}
function closeGroupManagerModal() { document.getElementById('modal-group-manager').classList.add('hidden'); }
function loadPresetIntoModal() {
    const idx = document.getElementById('gm-preset-select').value;
    const p = idx !== '' ? groupPresetsCache[Number(idx)] : null;
    document.getElementById('gm-preset-name').value = p ? p.nama_preset : '';
    modalGroupMap = p ? { ...(p.mapping || {}) } : {};
    renderGroupManagerRows();
}
async function deleteCurrentGroupPreset() {
    const idx = document.getElementById('gm-preset-select').value;
    const amp = getActiveAmpuan();
    if (idx === '' || !amp) return;
    const ok = await showAppConfirm('Hapus preset kelompok ini dari daftar tersimpan?', {
        title: 'Hapus Preset Kelompok',
        confirmText: 'Hapus Preset',
        tone: 'danger'
    });
    if (!ok) return;
    const updatedList = groupPresetsCache.filter((_, i) => i !== Number(idx));
    await db.from('teacher_settings').update({ kelompok_template: updatedList }).eq('id', amp.id);
    amp.kelompok_template = updatedList;
    loadGroupPresetsDropdown();
    document.getElementById('gm-preset-select').value = '';
    document.getElementById('gm-preset-name').value = '';
    modalGroupMap = {};
    renderGroupManagerRows();
}
function autoGenerateGroups(mode) {
    const count = Math.max(2, Number(document.getElementById('gm-auto-count').value || 5));
    let list = [...studentsCache];
    if (mode === 'random') list.sort(() => Math.random() - 0.5);
    modalGroupMap = {};
    list.forEach((s, idx) => { modalGroupMap[s.id] = `Kelompok ${(idx % count) + 1}`; });
    renderGroupManagerRows();
}
function clearAllModalGroups() { modalGroupMap = {}; renderGroupManagerRows(); }
function renderGroupManagerRows() {
    const tbody = document.getElementById('gm-students-tbody');
    tbody.innerHTML = studentsCache.map((s, idx) => `
        <tr>
            <td class="p-2 text-center">${idx + 1}</td>
            <td class="p-2 font-mono">${s.nisn}</td>
            <td class="p-2 font-bold">${s.nama}</td>
            <td class="p-2"><input type="text" value="${modalGroupMap[s.id] || ''}" oninput="modalGroupMap[${s.id}] = this.value" class="w-full border dark:border-slate-700 bg-white dark:bg-slate-800 rounded p-1"></td>
        </tr>
    `).join('');
}
async function saveGroupPresetFromModal(andApply) {
    const amp = getActiveAmpuan();
    if (!amp) return;
    const name = document.getElementById('gm-preset-name').value.trim() || 'Kelompok Kelas';
    const idx = document.getElementById('gm-preset-select').value;
    let updatedList = [...groupPresetsCache];
    if (idx !== '') updatedList[Number(idx)] = { nama_preset: name, mapping: modalGroupMap };
    else updatedList.push({ nama_preset: name, mapping: modalGroupMap });

    await db.from('teacher_settings').update({ kelompok_template: updatedList }).eq('id', amp.id);
    amp.kelompok_template = updatedList;
    loadGroupPresetsDropdown();
    if (andApply) {
        document.querySelectorAll('#scores-tbody tr[data-score-stu]').forEach(tr => {
            const inp = tr.querySelector('.sc-kelompok');
            if (inp) inp.value = modalGroupMap[tr.dataset.scoreStu] || '';
        });
    }
    closeGroupManagerModal();
    showToast('✅ Pengaturan kelompok disimpan!');
}

// ==================== 9. REKAPITULASI, NILAI MANUAL & PUBLIKASI LMS ====================
function renderRekapTab() {
    const tbody = document.getElementById('rekap-tbody');
    if (!tbody) return;
    const theme = getChartThemeColors();

    const anyPublished = finalGradesCache.some(f => f.is_published === true);
    const pubLabel = document.getElementById('rekap-pub-label');
    if (pubLabel) {
        pubLabel.innerText = anyPublished ? '🌐 Sudah Dipublikasikan ke LMS Siswa' : '🔒 Belum Dipublikasikan (Disembunyikan dari Siswa)';
        pubLabel.className = anyPublished ? 'text-emerald-700 dark:text-emerald-400 font-extrabold' : 'text-slate-600 dark:text-slate-400 font-bold';
    }

    let tuntas = 0, belum = 0;
    let sumAbs = 0, sumTgs = 0, sumBab = 0, sumSmt = 0;

    tbody.innerHTML = studentsCache.map((s, idx) => {
        const m = computeStudentMetrics(s.id);
        sumAbs += m.attScore; sumTgs += m.avgTugas; sumBab += m.avgBab; sumSmt += m.avgSmt;
        const ok = m.finalScore >= m.kkm;
        if (ok) tuntas++; else belum++;
        const manualValStr = m.manualScore !== null ? m.manualScore : '';

        return `
            <tr data-rekap-final-stu="${s.id}" data-auto-val="${m.autoFinalScore.toFixed(1)}" data-kkm-val="${m.kkm}">
                <td class="p-2.5 text-center">${idx + 1}</td>
                <td class="p-2.5 font-mono text-xs">${s.nisn}</td>
                <td class="p-2.5 font-bold">${s.nama}</td>
                <td class="p-2.5 text-center">${m.attScore.toFixed(1)}</td>
                <td class="p-2.5 text-center">${m.avgTugas.toFixed(1)}</td>
                <td class="p-2.5 text-center">${m.avgBab.toFixed(1)}</td>
                <td class="p-2.5 text-center">${m.avgSmt.toFixed(1)}</td>
                <td class="p-2.5 text-center bg-slate-100/80 dark:bg-slate-800 font-semibold text-slate-600 dark:text-slate-300">${m.autoFinalScore.toFixed(1)}</td>
                <td class="p-2.5 text-center bg-amber-50/60 dark:bg-amber-950/40">
                    <input type="number" min="0" max="100" step="0.1" value="${manualValStr}" placeholder="Otomatis"
                        oninput="onManualFinalGradeInput(this)"
                        class="inp-manual-final w-20 border border-amber-300 dark:border-amber-700 bg-white dark:bg-slate-800 rounded-lg p-1 text-center font-extrabold text-amber-900 dark:text-amber-200 text-xs">
                </td>
                <td class="p-2.5 text-center font-extrabold bg-blue-50/60 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300 cell-final-lms">${m.finalScore.toFixed(1)}</td>
                <td class="p-2.5 text-center cell-status-kkm">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${ok ? 'TUNTAS' : 'REMEDIAL'}</span>
                </td>
                <td class="p-2.5 text-center"><button onclick="printStudentRaporPDF(${s.id})" class="text-xs font-bold text-rose-600 hover:underline">PDF</button></td>
            </tr>
        `;
    }).join('');

    const n = studentsCache.length || 1;
    destroyChart('chartRekapComponents');
    const c1 = document.getElementById('chartRekapComponents');
    if (c1) {
        chartInstances['chartRekapComponents'] = new Chart(c1, {
            type: 'bar',
            data: {
                labels: ['Absen', 'Tugas', 'Ujian Akhir Bab', 'Ujian Semester'],
                datasets: [{ label: 'Rata-rata', data: [sumAbs / n, sumTgs / n, sumBab / n, sumSmt / n], backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'], borderRadius: 6 }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: theme.text }, grid: { display: false } },
                    y: { min: 0, max: 100, ticks: { color: theme.text }, grid: { color: theme.grid } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    destroyChart('chartRekapKKM');
    const c2 = document.getElementById('chartRekapKKM');
    if (c2) {
        chartInstances['chartRekapKKM'] = new Chart(c2, {
            type: 'doughnut',
            data: { labels: ['Tuntas KKM', 'Belum Tuntas'], datasets: [{ data: [tuntas, belum], backgroundColor: ['#10b981', '#f43f5e'], borderWidth: 0 }] },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%', plugins: { legend: { labels: { color: theme.text } } } }
        });
    }
}

function onManualFinalGradeInput(inp) {
    const tr = inp.closest('tr');
    if (!tr) return;
    const autoVal = Number(tr.dataset.autoVal || 0);
    const kkm = Number(tr.dataset.kkmVal || 75);
    const finalVal = inp.value !== '' ? Number(inp.value) : autoVal;
    tr.querySelector('.cell-final-lms').innerText = finalVal.toFixed(1);
    const ok = finalVal >= kkm;
    tr.querySelector('.cell-status-kkm').innerHTML = `<span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${ok ? 'TUNTAS' : 'REMEDIAL'}</span>`;
}

async function publishFinalGradesToLMS(publishState) {
    const amp = getActiveAmpuan();
    const targetPeriod = activePeriodName || currentDatePeriodName;
    if (!activeClassId || !amp) return showToast('Pilih kelas dan mata pelajaran terlebih dahulu!', 'error');

    const rows = [...document.querySelectorAll('#rekap-tbody tr[data-rekap-final-stu]')];
    if (!rows.length) return showToast('Belum ada data siswa di kelas ini.', 'error');

    const payload = rows.map(tr => {
        const student_id = Number(tr.dataset.rekapFinalStu);
        const autoVal = Number(tr.dataset.autoVal || 0);
        const rawManual = tr.querySelector('.inp-manual-final')?.value;
        const nilai_manual = rawManual !== '' ? Number(rawManual) : null;

        return {
            class_id: activeClassId, student_id, teacher_id: currentUser.id,
            mapel: amp.mapel, periode: targetPeriod, nilai_otomatis: autoVal, nilai_manual,
            kkm: Number(amp.kkm || 75), is_published: publishState, updated_at: new Date().toISOString()
        };
    });

    const { error } = await db.from('final_grades').upsert(payload, { onConflict: 'class_id,student_id,mapel,periode' });
    if (error) return showToast('Gagal menyimpan/publikasi nilai: ' + error.message, 'error');

    showToast(publishState ? `🌐 Nilai akhir ${amp.mapel} (${targetPeriod}) berhasil dipublikasikan!` : `🔒 Publikasi nilai ${amp.mapel} ditarik.`);
    await loadWorkspaceData();
}

async function exportRekapExcel() {
    if (!(await ensureXlsxLoaded())) return;
    const rows = studentsCache.map((s, idx) => {
        const m = computeStudentMetrics(s.id);
        return {
            No: idx + 1, NISN: s.nisn, Nama: s.nama, Periode: activePeriodName,
            Absen: Number(m.attScore.toFixed(1)), Tugas: Number(m.avgTugas.toFixed(1)),
            Ujian_Bab: Number(m.avgBab.toFixed(1)), Semester: Number(m.avgSmt.toFixed(1)),
            Otomatis: Number(m.autoFinalScore.toFixed(1)), Manual: m.manualScore !== null ? m.manualScore : '',
            Final_LMS: Number(m.finalScore.toFixed(1)), Status: m.finalScore >= m.kkm ? 'TUNTAS' : 'REMEDIAL'
        };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Nilai');
    XLSX.writeFile(wb, `Rekap_Nilai_${activePeriodName}.xlsx`);
}

async function printClassRekapPDF() {
    if (!(await ensureJsPdfLoaded())) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const amp = getActiveAmpuan();
    const cls = classesCache.find(c => Number(c.id) === Number(activeClassId));
    doc.setFontSize(13);
    doc.text(`REKAPITULASI NILAI — ${cls?.nama_kelas || ''} (${amp?.mapel || ''})`, 14, 15);
    doc.setFontSize(10);
    doc.text(`Periode: ${activePeriodName}`, 14, 21);
    doc.autoTable({
        startY: 26,
        head: [['No', 'NISN', 'Nama Siswa', 'Absen', 'Tugas', 'Bab', 'Smt', 'Akhir', 'Status']],
        body: studentsCache.map((s, idx) => {
            const m = computeStudentMetrics(s.id);
            return [idx + 1, s.nisn, s.nama, m.attScore.toFixed(1), m.avgTugas.toFixed(1), m.avgBab.toFixed(1), m.avgSmt.toFixed(1), m.finalScore.toFixed(1), m.finalScore >= m.kkm ? 'TUNTAS' : 'REMEDIAL'];
        })
    });
    doc.save(`Rekap_Nilai_${activePeriodName}.pdf`);
}

function appendStudentRaporPage(doc, s, cls, amp) {
    const m = computeStudentMetrics(s.id);
    const statusText = m.finalScore >= m.kkm ? 'TUNTAS' : 'REMEDIAL';

    doc.setFontSize(14);
    doc.text('LAPORAN CAPAIAN BELAJAR SISWA', 14, 18);
    doc.setFontSize(10);
    doc.text(`Nama Siswa : ${s.nama} (${s.nisn})`, 14, 27);
    doc.text(`Kelas / Mapel : ${cls?.nama_kelas || '-'} / ${amp?.mapel || '-'}`, 14, 33);
    doc.text(`Guru Pengampu : ${currentUser?.nama_lengkap || '-'}`, 14, 39);
    doc.text(`Periode Akademik : ${activePeriodName || currentDatePeriodName}`, 14, 45);

    doc.autoTable({
        startY: 52,
        head: [['Komponen Penilaian', 'Bobot (%)', 'Capaian Nilai', 'Keterangan']],
        body: [
            ['Kehadiran', `${amp?.w_absen ?? 10}%`, m.attScore.toFixed(1), `H:${m.h} S:${m.s} I:${m.i} A:${m.a} (${m.attRate.toFixed(0)}%)`],
            ['Tugas', `${amp?.w_tugas ?? 30}%`, m.avgTugas.toFixed(1), `${m.doneTasks}/${m.totalTasks} penilaian selesai`],
            ['Ujian Akhir Bab', `${amp?.w_bab ?? 30}%`, m.avgBab.toFixed(1), '-'],
            ['Ujian Semester', `${amp?.w_uas ?? 30}%`, m.avgSmt.toFixed(1), '-'],
            ['Nilai Akhir Otomatis', '100%', m.autoFinalScore.toFixed(1), m.manualScore !== null ? `Nilai Manual: ${m.manualScore.toFixed(1)}` : 'Mengikuti perhitungan otomatis'],
            ['Nilai Akhir Resmi (KKM ' + m.kkm + ')', '-', m.finalScore.toFixed(1), statusText]
        ]
    });

    const finalY = (doc.lastAutoTable?.finalY || 120) + 14;
    doc.setFontSize(9.5);
    doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}`, 14, finalY);
    doc.text(`Guru Pengampu,`, 145, finalY);
    doc.text(`${currentUser?.nama_lengkap || '____________________'}`, 145, finalY + 18);
}

async function printStudentRaporPDF(studentId) {
    const s = studentsCache.find(x => Number(x.id) === Number(studentId));
    if (!s) return;
    if (!(await ensureJsPdfLoaded())) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const cls = classesCache.find(c => Number(c.id) === Number(activeClassId));
    const amp = getActiveAmpuan();
    appendStudentRaporPage(doc, s, cls, amp);
    doc.save(`Rapor_${s.nama.replace(/\s+/g, '_')}.pdf`);
}

async function printAllStudentsRaporPDF() {
    if (!studentsCache.length) return showToast('Belum ada data siswa di kelas ini.', 'error');
    if (!(await ensureJsPdfLoaded())) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const cls = classesCache.find(c => Number(c.id) === Number(activeClassId));
    const amp = getActiveAmpuan();

    studentsCache.forEach((s, idx) => {
        if (idx > 0) doc.addPage();
        appendStudentRaporPage(doc, s, cls, amp);
    });

    const clsName = (cls?.nama_kelas || 'Kelas').replace(/\s+/g, '_');
    const mapelName = (amp?.mapel || 'Mapel').replace(/\s+/g, '_');
    doc.save(`Rapor_Kolektif_${clsName}_${mapelName}.pdf`);
    showToast(`📚 Rapor PDF untuk ${studentsCache.length} siswa berhasil diunduh!`);
}

// ==================== 10. GURU WALI (PA 360° LINTAS MAPEL, HISTORI & AI GEMINI) ====================
async function loadGuruWaliTab() {
    const tbody = document.getElementById('wali-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">⏳ Memuat data akademik lintas mata pelajaran siswa binaan...</td></tr>`;

    const [allStuRes, binRes, setRes, usrRes, assRes] = await Promise.all([
        db.from('students').select('*, classes(nama_kelas)').order('nama'),
        db.from('wali_binaan').select('student_id').eq('teacher_id', currentUser.id),
        db.from('teacher_settings').select('*'),
        db.from('app_users').select('id, nama_lengkap'),
        db.from('assessments').select('*')
    ]);

    allStudentsGlobal = allStuRes.data || [];
    binaanIdsCache = new Set((binRes.data || []).map(x => Number(x.student_id)));
    waliGlobalSettings = setRes.data || [];
    waliGlobalUsers = usrRes.data || [];
    waliGlobalAssessments = (assRes.data || []).filter(a => matchesActivePeriod(a.periode));

    const binaanIds = [...binaanIdsCache];
    if (binaanIds.length > 0) {
        const [scRes, logRes, recRes] = await Promise.all([
            db.from('scores').select('*').in('student_id', binaanIds),
            db.from('attendance_logs').select('*').in('student_id', binaanIds),
            db.from('attendance').select('*').in('student_id', binaanIds)
        ]);
        waliGlobalScores = scRes.data || [];
        waliGlobalAttLogs = (logRes.data || []).filter(l => matchesActivePeriod(l.periode));
        waliGlobalAttRecap = (recRes.data || []).filter(r => matchesActivePeriod(r.periode));
    } else {
        waliGlobalScores = []; waliGlobalAttLogs = []; waliGlobalAttRecap = [];
    }

    computeAllWaliStudentMetrics();
    renderGuruWaliRows();
}

function computeAllWaliStudentMetrics() {
    waliMetricsCache = {};
    const binaanStudents = allStudentsGlobal.filter(s => binaanIdsCache.has(Number(s.id)));

    binaanStudents.forEach(stu => {
        const sid = Number(stu.id);
        const cid = Number(stu.class_id);
        const classSettings = waliGlobalSettings.filter(st => Number(st.class_id) === cid);
        const stuScores = waliGlobalScores.filter(sc => Number(sc.student_id) === sid);
        const stuLogs = waliGlobalAttLogs.filter(lg => Number(lg.student_id) === sid);
        const stuRecaps = waliGlobalAttRecap.filter(rc => Number(rc.student_id) === sid);

        let h = 0, s = 0, i = 0, a = 0;
        const absenceDates = [];
        if (stuLogs.length > 0) {
            stuLogs.forEach(lg => {
                if (lg.status === 'H') h++;
                else if (lg.status === 'S') { s++; absenceDates.push(`${lg.tanggal} (Sakit - ${lg.mapel || ''})`); }
                else if (lg.status === 'I') { i++; absenceDates.push(`${lg.tanggal} (Izin - ${lg.mapel || ''})`); }
                else if (lg.status === 'A') { a++; absenceDates.push(`${lg.tanggal} (Alpa - ${lg.mapel || ''})`); }
            });
        } else if (stuRecaps.length > 0) {
            stuRecaps.forEach(rc => { h += Number(rc.hadir || 0); s += Number(rc.sakit || 0); i += Number(rc.izin || 0); a += Number(rc.alpa || 0); });
        }
        const totalPert = h + s + i + a;
        const attRate = totalPert > 0 ? (h / totalPert) * 100 : 100;

        const subjectDetails = [];
        const pendingTasks = [];
        let sumSubjectFinal = 0;
        let gradedSubjectsCount = 0;
        let belowKkmCount = 0;
        let totalAssCount = 0;
        let totalDoneCount = 0;

        classSettings.forEach(st => {
            const teacherObj = waliGlobalUsers.find(u => Number(u.id) === Number(st.teacher_id));
            const mapelAss = waliGlobalAssessments.filter(as => Number(as.class_id) === cid && String(as.mapel || '').toLowerCase() === String(st.mapel || '').toLowerCase());
            const mLogs = stuLogs.filter(lg => !lg.mapel || lg.mapel === st.mapel);
            const mRec = stuRecaps.find(rc => rc.mapel === st.mapel);
            let mh = 0, ms = 0, mi = 0, ma = 0;
            if (mLogs.length > 0) {
                mLogs.forEach(lg => { if (lg.status === 'H') mh++; else if (lg.status === 'S') ms++; else if (lg.status === 'I') mi++; else if (lg.status === 'A') ma++; });
            } else if (mRec) {
                mh = Number(mRec.hadir || 0); ms = Number(mRec.sakit || 0); mi = Number(mRec.izin || 0); ma = Number(mRec.alpa || 0);
            }
            const mTot = mh + ms + mi + ma;
            const mAttScore = mTot > 0 ? ((mh * (st.p_hadir ?? 100) + ms * (st.p_sakit ?? 80) + mi * (st.p_izin ?? 80) + ma * (st.p_alpa ?? 0)) / mTot) : 100;

            const calcCat = (catKey) => {
                const list = mapelAss.filter(as => normalizeKategori(as.kategori) === catKey);
                let tot = 0;
                let countGraded = 0;
                list.forEach(as => {
                    const sc = stuScores.find(x => Number(x.assessment_id) === Number(as.id));
                    if (hasFilledScore(sc)) {
                        tot += Number(sc.nilai);
                        countGraded++;
                    }
                });
                return { avg: countGraded > 0 ? (tot / countGraded) : 0, hasData: countGraded > 0 };
            };

            const resTgs = calcCat('tugas');
            const resBab = calcCat('ujian_bab');
            const resSmt = calcCat('ujian_semester');

            let activeW = 0, weightedSum = 0;
            if (mTot > 0 && Number(st.w_absen) > 0) { weightedSum += mAttScore * Number(st.w_absen); activeW += Number(st.w_absen); }
            if (resTgs.hasData && Number(st.w_tugas) > 0) { weightedSum += resTgs.avg * Number(st.w_tugas); activeW += Number(st.w_tugas); }
            if (resBab.hasData && Number(st.w_bab) > 0) { weightedSum += resBab.avg * Number(st.w_bab); activeW += Number(st.w_bab); }
            if (resSmt.hasData && Number(st.w_uas) > 0) { weightedSum += resSmt.avg * Number(st.w_uas); activeW += Number(st.w_uas); }

            const finalVal = activeW > 0 ? (weightedSum / activeW) : 0;

            let doneInMapel = 0;
            mapelAss.forEach(as => {
                const sc = stuScores.find(x => Number(x.assessment_id) === Number(as.id));
                const isDone = sc?.status_kumpul === true || sc?.status_pengajuan === 'approved';
                if (isDone) doneInMapel++;
                else pendingTasks.push({ mapel: st.mapel, judul: as.judul, kategori: getKategoriLabel(as.kategori) });
            });

            totalAssCount += mapelAss.length;
            totalDoneCount += doneInMapel;

            const kkm = Number(st.kkm || 75);
            if (activeW > 0) {
                if (finalVal < kkm) belowKkmCount++;
                sumSubjectFinal += finalVal;
                gradedSubjectsCount++;
            }

            subjectDetails.push({
                mapel: st.mapel, guru: teacherObj?.nama_lengkap || '-',
                attPct: mTot > 0 ? Math.round((mh / mTot) * 100) : 100,
                doneCount: doneInMapel, totalCount: mapelAss.length,
                nTugas: resTgs.avg, nBab: resBab.avg, nSmt: resSmt.avg,
                finalVal, hasData: activeW > 0, kkm, tuntas: finalVal >= kkm
            });
        });

        const avgFinalAllSubjects = gradedSubjectsCount > 0 ? (sumSubjectFinal / gradedSubjectsCount) : 0;
        const taskCompletionRate = totalAssCount > 0 ? (totalDoneCount / totalAssCount) * 100 : 100;

        let ews = 'aman';
        if (a >= 3 || attRate < 80 || pendingTasks.length >= 3 || belowKkmCount >= 2) ews = 'kritis';
        else if (a >= 1 || attRate < 90 || pendingTasks.length >= 1 || belowKkmCount >= 1) ews = 'waspada';

        waliMetricsCache[sid] = {
            h, s, i, a, attRate, taskCompletionRate, absenceDates,
            pendingTasks, subjectDetails, avgFinalAllSubjects,
            hasAnySubjectData: gradedSubjectsCount > 0, ews
        };
    });
}

function renderGuruWaliRows() {
    const tbody = document.getElementById('wali-tbody');
    if (!tbody) return;
    const q = (document.getElementById('wali-search-input')?.value || '').toLowerCase();
    const filterEws = document.getElementById('wali-filter-ews')?.value || 'all';

    const allBinaan = allStudentsGlobal.filter(s => binaanIdsCache.has(Number(s.id)));
    let cntAman = 0, cntWaspada = 0, cntKritis = 0;
    allBinaan.forEach(s => {
        const m = waliMetricsCache[Number(s.id)];
        if (m?.ews === 'kritis') cntKritis++;
        else if (m?.ews === 'waspada') cntWaspada++;
        else cntAman++;
    });

    document.getElementById('wali-stat-total').innerText = `${allBinaan.length} Siswa`;
    document.getElementById('wali-stat-aman').innerText = `${cntAman} Siswa`;
    document.getElementById('wali-stat-waspada').innerText = `${cntWaspada} Siswa`;
    document.getElementById('wali-stat-kritis').innerText = `${cntKritis} Siswa`;

    const filtered = allBinaan.filter(s => {
        const m = waliMetricsCache[Number(s.id)] || { ews: 'aman' };
        return (!q || s.nama.toLowerCase().includes(q) || (s.classes?.nama_kelas || '').toLowerCase().includes(q)) && (filterEws === 'all' || m.ews === filterEws);
    });

    tbody.innerHTML = filtered.length ? filtered.map((s, idx) => {
        const m = waliMetricsCache[Number(s.id)] || { attRate: 100, pendingTasks: [], avgFinalAllSubjects: 0, hasAnySubjectData: false, ews: 'aman', h: 0, s: 0, i: 0, a: 0 };
        let ewsBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700">🟢 Aman</span>`;
        if (m.ews === 'kritis') ewsBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700">🔴 Kritis</span>`;
        else if (m.ews === 'waspada') ewsBadge = `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-700">🟡 Waspada</span>`;

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3 text-center">${idx + 1}</td>
                <td class="p-3"><div class="font-bold text-slate-900 dark:text-white">${s.nama}</div><div class="text-[10px] text-slate-500">${s.classes?.nama_kelas || '-'} • ${s.nisn}</div></td>
                <td class="p-3 text-center"><div class="font-extrabold ${m.attRate >= 90 ? 'text-emerald-600' : m.attRate >= 80 ? 'text-amber-600' : 'text-rose-600'}">${m.attRate.toFixed(0)}%</div><div class="text-[10px] text-slate-400">H:${m.h} S:${m.s} I:${m.i} A:${m.a}</div></td>
                <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[11px] font-extrabold ${m.pendingTasks.length > 0 ? 'bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-800' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'}">${m.pendingTasks.length} Tugas</span></td>
                <td class="p-3 text-center font-extrabold text-blue-700 dark:text-blue-400">${m.hasAnySubjectData ? m.avgFinalAllSubjects.toFixed(1) : '-'}</td>
                <td class="p-3 text-center">${ewsBadge}</td>
                <td class="p-3 text-center"><button onclick="openWali360Modal(${s.id})" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs shadow-sm">✨ Bedah 360° & AI</button></td>
                <td class="p-3 text-center"><button onclick="openWali360Modal(${s.id})" class="px-2.5 py-1.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 font-bold text-xs">Jurnal</button></td>
            </tr>
        `;
    }).join('') : `<tr><td colspan="8" class="p-6 text-center text-slate-400 italic">Tidak ada siswa binaan yang sesuai filter.</td></tr>`;
}

function openManageBinaanModal() {
    const sel = document.getElementById('wali-pick-class');
    sel.innerHTML = `<option value="all">Semua Kelas</option>` + classesCache.map(c => `<option value="${c.id}">${c.nama_kelas}</option>`).join('');
    document.getElementById('modal-wali-manage').classList.remove('hidden');
    renderBinaanPickerList();
}
function renderBinaanPickerList() {
    const cls = document.getElementById('wali-pick-class').value;
    const q = (document.getElementById('wali-pick-search').value || '').toLowerCase();
    const list = allStudentsGlobal.filter(s => (cls === 'all' || String(s.class_id) === String(cls)) && (!q || s.nama.toLowerCase().includes(q) || String(s.nisn).includes(q)));
    document.getElementById('wali-picked-count-badge').innerText = `${binaanIdsCache.size} Siswa Dipilih`;
    document.getElementById('wali-picker-tbody').innerHTML = list.map(s => `
        <tr>
            <td class="p-2 text-center"><input type="checkbox" ${binaanIdsCache.has(Number(s.id)) ? 'checked' : ''} onchange="toggleBinaanCheck(${s.id}, this.checked)"></td>
            <td class="p-2 font-bold">${s.nama}</td>
            <td class="p-2 font-mono">${s.nisn}</td>
            <td class="p-2 text-center">${s.classes?.nama_kelas || '-'}</td>
        </tr>
    `).join('');
}
function toggleBinaanCheck(id, checked) {
    if (checked) binaanIdsCache.add(Number(id)); else binaanIdsCache.delete(Number(id));
    document.getElementById('wali-picked-count-badge').innerText = `${binaanIdsCache.size} Siswa Dipilih`;
}
async function saveWaliBinaanSelection() {
    await db.from('wali_binaan').delete().eq('teacher_id', currentUser.id);
    const payload = [...binaanIdsCache].map(sid => ({ teacher_id: currentUser.id, student_id: sid }));
    if (payload.length) await db.from('wali_binaan').insert(payload);
    document.getElementById('modal-wali-manage').classList.add('hidden');
    showToast('✅ Daftar siswa binaan tersimpan!');
    await loadGuruWaliTab();
}

// ==================== MODAL BEDAH 360°, HISTORI SEMESTER, RADAR & AI ====================
function switchWali360SubTab(subTab) {
    const tabs = ['overview', 'mapel', 'sw'];
    tabs.forEach(t => {
        document.getElementById(`w360-content-${t}`)?.classList.toggle('hidden', t !== subTab);
        const btn = document.getElementById(`w360-tab-${t}`);
        if (btn) {
            btn.className = t === subTab
                ? 'px-3.5 py-2 rounded-xl text-xs font-extrabold bg-blue-600 text-white shadow-sm shrink-0 transition'
                : 'px-3.5 py-2 rounded-xl text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-200 shrink-0 transition';
        }
    });
    if (activeWaliStudentId) renderWali360Visuals(activeWaliStudentId);
}

async function openWali360Modal(studentId) {
    activeWaliStudentId = Number(studentId);
    const s = allStudentsGlobal.find(x => Number(x.id) === activeWaliStudentId);
    if (!s) return;

    const initials = (s.nama || 'SW').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();
    document.getElementById('w360-avatar').innerText = initials;
    document.getElementById('w360-nama').innerText = s.nama;
    document.getElementById('w360-kelas').innerText = s.classes?.nama_kelas || '-';
    document.getElementById('w360-nisn').innerText = s.nisn;
    document.getElementById('w360-active-period-badge').innerText = activePeriodName || currentDatePeriodName;

    const todayStr = new Date().toISOString().split('T')[0];
    const logDateInp = document.getElementById('w360-log-date');
    if (logDateInp && !logDateInp.value) logDateInp.value = todayStr;

    document.getElementById('modal-wali-360').classList.remove('hidden');
    switchWali360SubTab('overview');

    await loadWaliHistoricalGrades(activeWaliStudentId);
    renderWali360Visuals(activeWaliStudentId);
    await loadWaliCachedAIAnalysis(activeWaliStudentId);
    await loadWaliLogsList(activeWaliStudentId);
}

function closeWali360Modal() {
    document.getElementById('modal-wali-360').classList.add('hidden');
    activeWaliStudentId = null;
}

async function loadWaliHistoricalGrades(studentId) {
    const { data } = await db.from('wali_historical_grades')
        .select('*')
        .eq('student_id', studentId)
        .order('urutan_semester', { ascending: true })
        .order('mapel', { ascending: true });

    waliActiveHistoricalGrades = data || [];
    renderWaliHistoricalTable();
}

function renderWaliHistoricalTable() {
    const tbody = document.getElementById('w360-hist-tbody');
    if (!tbody) return;
    if (!waliActiveHistoricalGrades.length) {
        tbody.innerHTML = `<tr><td colspan="5" class="p-3 text-center text-slate-400 italic">Belum ada riwayat nilai semester sebelumnya yang ditambahkan.</td></tr>`;
        return;
    }
    tbody.innerHTML = waliActiveHistoricalGrades.map(h => `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/60">
            <td class="p-2 font-bold text-slate-800 dark:text-slate-200">${h.periode}</td>
            <td class="p-2 font-semibold">${h.mapel}</td>
            <td class="p-2 text-center font-extrabold ${Number(h.nilai_akhir) >= Number(h.kkm || 75) ? 'text-emerald-600' : 'text-rose-600'}">${Number(h.nilai_akhir).toFixed(1)}</td>
            <td class="p-2 text-center text-slate-400">${h.kkm || 75}</td>
            <td class="p-2 text-right">
                <button type="button" onclick="deleteWaliHistoricalGrade(${h.id})" class="text-rose-600 hover:underline font-bold text-[11px]">Hapus</button>
            </td>
        </tr>
    `).join('');
}

async function addWaliHistoricalGrade(e) {
    e.preventDefault();
    if (!activeWaliStudentId) return;
    const sem = document.getElementById('w360-hist-semester').value;
    const tahun = Number(document.getElementById('w360-hist-tahun').value);
    const mapel = document.getElementById('w360-hist-mapel').value.trim();
    const nilai_akhir = Number(document.getElementById('w360-hist-nilai').value);
    const periodeLabel = `${sem} ${tahun}`;
    const urutan_semester = tahun * 10 + (sem.includes('Genap') ? 1 : 2);

    const { error } = await db.from('wali_historical_grades').upsert([{
        student_id: activeWaliStudentId,
        teacher_id: currentUser.id,
        periode: periodeLabel,
        urutan_semester,
        mapel,
        nilai_akhir,
        kkm: 75
    }], { onConflict: 'student_id,periode,mapel' });

    if (error) return showToast('Gagal menambah nilai riwayat: ' + error.message, 'error');

    document.getElementById('w360-hist-mapel').value = '';
    document.getElementById('w360-hist-nilai').value = '';
    showToast(`✅ Nilai ${mapel} (${periodeLabel}) ditambahkan!`);
    await loadWaliHistoricalGrades(activeWaliStudentId);
    renderWali360Visuals(activeWaliStudentId);
}

async function deleteWaliHistoricalGrade(id) {
    const ok = await showAppConfirm('Hapus catatan nilai riwayat semester lampau ini?', {
        title: 'Hapus Nilai Riwayat',
        confirmText: 'Hapus',
        tone: 'danger'
    });
    if (!ok) return;
    await db.from('wali_historical_grades').delete().eq('id', id);
    showToast('Catatan riwayat dihapus.');
    await loadWaliHistoricalGrades(activeWaliStudentId);
    renderWali360Visuals(activeWaliStudentId);
}

function classifySubjectRumpun(mapelName) {
    const n = String(mapelName || '').toLowerCase();
    if (/(matematika|fisika|kimia|biologi|ipa|sains|kalkulus)/.test(n)) return 'Sains & Matematika';
    if (/(informatika|tik|komputer|koding|prakarya|pkwu|desain|seni|pjok|olahraga|teknik)/.test(n)) return 'Teknologi & Praktis';
    if (/(bahasa|inggris|indonesia|arab|jepang|jerman|sastra|daerah)/.test(n)) return 'Bahasa & Linguistik';
    return 'Sosial & Humaniora';
}

function buildWaliTimelineAndSW(studentId) {
    const m = waliMetricsCache[Number(studentId)] || { h: 0, s: 0, i: 0, a: 0, attRate: 100, taskCompletionRate: 100, absenceDates: [], pendingTasks: [], subjectDetails: [], avgFinalAllSubjects: 0, hasAnySubjectData: false };
    const currentPeriod = activePeriodName || currentDatePeriodName;

    // 1. Kumpulkan seluruh periode kronologis (historis + semester aktif)
    const periodOrderMap = {};
    waliActiveHistoricalGrades.forEach(h => {
        if (h.periode !== currentPeriod) {
            periodOrderMap[h.periode] = h.urutan_semester || 1;
        }
    });
    const sortedHistPeriods = Object.keys(periodOrderMap).sort((a, b) => periodOrderMap[a] - periodOrderMap[b]);
    const allPeriods = [...sortedHistPeriods, currentPeriod];

    // 2. Kumpulkan seluruh nama mata pelajaran unik
    const allMapelNames = [...new Set([
        ...waliActiveHistoricalGrades.map(h => h.mapel),
        ...m.subjectDetails.map(sb => sb.mapel)
    ].filter(Boolean))];

    // 3. Matriks Nilai per Mapel per Periode
    const mapelSeries = {};
    allMapelNames.forEach(mpl => {
        mapelSeries[mpl] = allPeriods.map(per => {
            if (per === currentPeriod) {
                const cur = m.subjectDetails.find(x => x.mapel.toLowerCase() === mpl.toLowerCase());
                return cur && cur.hasData ? Number(cur.finalVal.toFixed(1)) : null;
            }
            const hist = waliActiveHistoricalGrades.find(x => x.periode === per && x.mapel.toLowerCase() === mpl.toLowerCase());
            return hist ? Number(Number(hist.nilai_akhir).toFixed(1)) : null;
        });
    });

    // 4. Rata-rata keseluruhan per periode
    const periodAverages = allPeriods.map((per, pIdx) => {
        const vals = allMapelNames.map(mpl => mapelSeries[mpl][pIdx]).filter(v => v !== null && !isNaN(v));
        return vals.length > 0 ? Number((vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1)) : null;
    });

    // 5. Ringkasan Kumulatif per Mapel
    const cumulativeSummary = allMapelNames.map(mpl => {
        const vals = mapelSeries[mpl].filter(v => v !== null && !isNaN(v));
        const curObj = m.subjectDetails.find(x => x.mapel.toLowerCase() === mpl.toLowerCase());
        const avg = vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : 0;
        const maxVal = vals.length ? Math.max(...vals) : 0;
        const minVal = vals.length ? Math.min(...vals) : 0;
        const currentVal = curObj && curObj.hasData ? curObj.finalVal : (vals.length ? vals[vals.length - 1] : null);
        const kkm = curObj ? curObj.kkm : 75;
        return {
            mapel: mpl,
            guru: curObj?.guru || 'Riwayat Rapor',
            avg,
            maxVal,
            minVal,
            currentVal,
            kkm,
            tuntas: currentVal !== null ? currentVal >= kkm : true
        };
    });

    // 6. Agregasi Rumpun untuk Radar Chart & Strength/Weakness
    const rumpunBuckets = {
        'Sains & Matematika': [],
        'Teknologi & Praktis': [],
        'Bahasa & Linguistik': [],
        'Sosial & Humaniora': []
    };
    cumulativeSummary.forEach(item => {
        if (item.currentVal !== null) {
            const r = classifySubjectRumpun(item.mapel);
            rumpunBuckets[r].push(item.currentVal);
        }
    });

    const getBucketAvg = (key) => {
        const arr = rumpunBuckets[key];
        return arr.length ? Number((arr.reduce((a, b) => a + b, 0) / arr.length).toFixed(1)) : 75;
    };

    const karakterScore = Number(((m.attRate * 0.6) + (m.taskCompletionRate * 0.4)).toFixed(1));
    const radarLabels = ['Sains & Matematika', 'Teknologi & Praktis', 'Bahasa & Linguistik', 'Sosial & Humaniora', 'Karakter & Disiplin'];
    const radarScores = [
        getBucketAvg('Sains & Matematika'),
        getBucketAvg('Teknologi & Praktis'),
        getBucketAvg('Bahasa & Linguistik'),
        getBucketAvg('Sosial & Humaniora'),
        karakterScore
    ];

    waliCurrentTimelineData = { allPeriods, allMapelNames, mapelSeries, periodAverages, cumulativeSummary };
    waliCurrentSWData = { radarLabels, radarScores, rumpunBuckets, karakterScore };
    return { m, timeline: waliCurrentTimelineData, sw: waliCurrentSWData };
}

function renderWali360Visuals(studentId) {
    const theme = getChartThemeColors();
    const { m, timeline, sw } = buildWaliTimelineAndSW(studentId);

    // --- CHART 1: AREA LINE CHART TREN LINTAS SEMESTER ---
    destroyChart('chartWaliSemesterTrend');
    const cTrend = document.getElementById('chartWaliSemesterTrend');
    if (cTrend) {
        const validPairs = timeline.allPeriods.map((p, idx) => ({ p, v: timeline.periodAverages[idx] })).filter(x => x.v !== null);
        const labels = validPairs.length ? validPairs.map(x => x.p) : [activePeriodName];
        const values = validPairs.length ? validPairs.map(x => x.v) : [0];

        const pill = document.getElementById('w360-trend-pill');
        if (pill && values.length >= 2) {
            const diff = values[values.length - 1] - values[0];
            pill.innerText = diff > 1 ? `📈 Naik +${diff.toFixed(1)}` : diff < -1 ? `📉 Turun ${diff.toFixed(1)}` : '➡️ Stabil';
            pill.className = `px-2 py-0.5 rounded-full text-[10px] font-extrabold ${diff > 1 ? 'bg-emerald-100 text-emerald-700' : diff < -1 ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`;
        }

        chartInstances['chartWaliSemesterTrend'] = new Chart(cTrend, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Rata-rata Nilai',
                    data: values,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.16)',
                    pointBackgroundColor: '#2563eb',
                    pointRadius: 5,
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.35
                }]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: theme.text, font: { size: 10 } }, grid: { color: theme.grid } },
                    y: { min: 50, max: 100, ticks: { color: theme.text, font: { size: 10 } }, grid: { color: theme.grid } }
                },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: theme.tooltipBg } }
            }
        });
    }

    // --- CHART 2: BAR CHART CAPAIAN SEMESTER BERJALAN + GARIS KKM ---
    destroyChart('chartWaliCurrentBar');
    const cBar = document.getElementById('chartWaliCurrentBar');
    if (cBar) {
        const curSubjects = m.subjectDetails.filter(sb => sb.hasData);
        const labels = curSubjects.length ? curSubjects.map(sb => sb.mapel) : ['Belum Ada Nilai'];
        const values = curSubjects.length ? curSubjects.map(sb => Number(sb.finalVal.toFixed(1))) : [0];
        const colors = curSubjects.length
            ? curSubjects.map(sb => sb.finalVal >= 85 ? '#6366f1' : sb.finalVal >= sb.kkm ? '#10b981' : '#f43f5e')
            : ['#cbd5e1'];

        const belowCount = curSubjects.filter(sb => sb.finalVal < sb.kkm).length;
        const belowPill = document.getElementById('w360-below-kkm-pill');
        if (belowPill) {
            belowPill.innerText = belowCount > 0 ? `⚠️ ${belowCount} Mapel < KKM` : '✅ Semua Tuntas KKM';
            belowPill.className = `px-2 py-0.5 rounded-full text-[10px] font-extrabold ${belowCount > 0 ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'}`;
        }

        chartInstances['chartWaliCurrentBar'] = new Chart(cBar, {
            type: 'bar',
            data: {
                labels,
                datasets: [
                    { label: 'Nilai Akhir', data: values, backgroundColor: colors, borderRadius: 6, barPercentage: 0.6 },
                    { type: 'line', label: 'Batas KKM (75)', data: labels.map(() => 75), borderColor: '#f59e0b', borderDash: [5, 5], borderWidth: 1.5, pointRadius: 0, fill: false }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    x: { ticks: { color: theme.text, font: { size: 10 } }, grid: { display: false } },
                    y: { min: 0, max: 100, ticks: { color: theme.text, font: { size: 10 } }, grid: { color: theme.grid } }
                },
                plugins: { legend: { display: false }, tooltip: { backgroundColor: theme.tooltipBg } }
            }
        });
    }

    // --- CHART 3: DONUT KEHADIRAN + PILLS + TUNGGAKAN ---
    destroyChart('chartWaliAttDonut');
    const cDonut = document.getElementById('chartWaliAttDonut');
    if (cDonut) {
        const tot = m.h + m.s + m.i + m.a;
        chartInstances['chartWaliAttDonut'] = new Chart(cDonut, {
            type: 'doughnut',
            data: {
                labels: tot > 0 ? ['Hadir', 'Sakit', 'Izin', 'Alpa'] : ['Belum Ada'],
                datasets: [{ data: tot > 0 ? [m.h, m.s, m.i, m.a] : [1], backgroundColor: tot > 0 ? ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e'] : ['#cbd5e1'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { display: false } } }
        });
    }

    document.getElementById('w360-att-pills').innerHTML = `
        <div class="p-1.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-200 dark:border-emerald-800"><b class="text-xs text-emerald-700 dark:text-emerald-300 block">${m.h}</b><span class="text-[9px] text-emerald-600 font-bold">Hadir</span></div>
        <div class="p-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/60 border border-amber-200 dark:border-amber-800"><b class="text-xs text-amber-700 dark:text-amber-300 block">${m.s}</b><span class="text-[9px] text-amber-600 font-bold">Sakit</span></div>
        <div class="p-1.5 rounded-xl bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800"><b class="text-xs text-blue-700 dark:text-blue-300 block">${m.i}</b><span class="text-[9px] text-blue-600 font-bold">Izin</span></div>
        <div class="p-1.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800"><b class="text-xs text-rose-700 dark:text-rose-300 block">${m.a}</b><span class="text-[9px] text-rose-600 font-bold">Alpa</span></div>
    `;

    document.getElementById('w360-absence-dates').innerHTML = m.absenceDates.length
        ? `<b>Catatan Ketidakhadiran:</b><br>` + m.absenceDates.map(d => `• ${d}`).join('<br>')
        : `<span class="text-emerald-700 dark:text-emerald-400 font-semibold">✅ Tidak ada catatan ketidakhadiran (S/I/A).</span>`;

    document.getElementById('w360-pending-badge').innerText = `${m.pendingTasks.length} Tunggakan`;
    document.getElementById('w360-pending-list').innerHTML = m.pendingTasks.length
        ? m.pendingTasks.map(t => `<div class="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-800 text-xs flex justify-between items-center"><div><b class="text-rose-800 dark:text-rose-300">${t.mapel}</b> — ${t.judul}</div><span class="text-[10px] font-bold px-2 py-0.5 rounded bg-white dark:bg-slate-800 text-rose-700 dark:text-rose-300">${t.kategori}</span></div>`).join('')
        : `<div class="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 border border-emerald-200 dark:border-emerald-800 text-xs text-emerald-700 dark:text-emerald-300 font-bold">🎉 Seluruh tugas lintas mapel telah terkumpul!</div>`;

    // --- SUB-TAB 2: MULTI-LINE TREN PER MATA PELAJARAN ---
    const filterSel = document.getElementById('w360-mapel-filter');
    if (filterSel) {
        const prevVal = filterSel.value;
        filterSel.innerHTML = `<option value="all">Semua Mata Pelajaran (${timeline.allMapelNames.length})</option>` +
            timeline.allMapelNames.map(mpl => `<option value="${mpl}">${mpl}</option>`).join('');
        if (timeline.allMapelNames.includes(prevVal)) filterSel.value = prevVal;
    }
    renderWaliMapelTrendChart();

    const focusBox = document.getElementById('w360-focus-badges');
    if (focusBox) {
        const remedialMapels = timeline.cumulativeSummary.filter(x => x.currentVal !== null && x.currentVal < x.kkm).map(x => x.mapel);
        const topMapels = timeline.cumulativeSummary.filter(x => x.currentVal !== null && x.currentVal >= 85).map(x => x.mapel);
        focusBox.innerHTML = [
            remedialMapels.length ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-600 text-white">Fokus Remedial: ${remedialMapels.join(', ')}</span>` : '',
            topMapels.length ? `<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-600 text-white">Pertahankan: ${topMapels.join(', ')}</span>` : ''
        ].join('');
    }

    const subjTbody = document.getElementById('w360-subjects-tbody');
    if (subjTbody) {
        subjTbody.innerHTML = timeline.cumulativeSummary.length
            ? timeline.cumulativeSummary.map(sb => `
                <tr>
                    <td class="p-2.5 font-bold text-slate-900 dark:text-white">${sb.mapel}</td>
                    <td class="p-2.5 text-slate-500">${sb.guru}</td>
                    <td class="p-2.5 text-center font-bold">${sb.avg > 0 ? sb.avg.toFixed(1) : '-'}</td>
                    <td class="p-2.5 text-center text-emerald-600 font-bold">${sb.maxVal > 0 ? sb.maxVal.toFixed(1) : '-'}</td>
                    <td class="p-2.5 text-center text-amber-600 font-bold">${sb.minVal > 0 ? sb.minVal.toFixed(1) : '-'}</td>
                    <td class="p-2.5 text-center font-extrabold text-blue-700 dark:text-blue-400">${sb.currentVal !== null ? sb.currentVal.toFixed(1) : '-'}</td>
                    <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${sb.currentVal === null ? 'bg-slate-100 text-slate-500' : sb.tuntas ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${sb.currentVal === null ? 'Belum Ada Nilai' : sb.tuntas ? 'Tuntas' : 'Remedial'}</span></td>
                </tr>
            `).join('')
            : `<tr><td colspan="7" class="p-4 text-center text-slate-400 italic">Belum ada data mata pelajaran.</td></tr>`;
    }

    // --- SUB-TAB 3: RADAR CHART & RUMPUN STRENGTH / WEAKNESS ---
    destroyChart('chartWaliRadarSW');
    const cRadar = document.getElementById('chartWaliRadarSW');
    if (cRadar) {
        chartInstances['chartWaliRadarSW'] = new Chart(cRadar, {
            type: 'radar',
            data: {
                labels: sw.radarLabels,
                datasets: [
                    {
                        label: 'Kompetensi Siswa',
                        data: sw.radarScores,
                        backgroundColor: 'rgba(59, 130, 246, 0.25)',
                        borderColor: '#2563eb',
                        pointBackgroundColor: '#2563eb',
                        borderWidth: 2
                    },
                    {
                        label: 'Batas Standar KKM (75)',
                        data: [75, 75, 75, 75, 75],
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderColor: '#f59e0b',
                        borderDash: [4, 4],
                        pointRadius: 0,
                        borderWidth: 1.5
                    }
                ]
            },
            options: {
                responsive: true, maintainAspectRatio: false,
                scales: {
                    r: {
                        min: 40, max: 100,
                        ticks: { display: false },
                        pointLabels: { color: theme.text, font: { size: 10, weight: 'bold' } },
                        grid: { color: theme.grid },
                        angleLines: { color: theme.grid }
                    }
                },
                plugins: { legend: { position: 'bottom', labels: { color: theme.text, boxWidth: 10, font: { size: 10 } } } }
            }
        });
    }

    const rumpunBox = document.getElementById('w360-rumpun-bars');
    if (rumpunBox) {
        const items = sw.radarLabels.map((lbl, idx) => ({ lbl, score: sw.radarScores[idx] }));
        rumpunBox.innerHTML = items.map(it => {
            const tier = it.score >= 82 ? { tag: 'Tinggi (Strength)', bar: 'bg-emerald-500', txt: 'text-emerald-700 dark:text-emerald-400' }
                : it.score >= 75 ? { tag: 'Stabil', bar: 'bg-blue-500', txt: 'text-blue-700 dark:text-blue-400' }
                : { tag: 'Perlu Penguatan', bar: 'bg-rose-500', txt: 'text-rose-700 dark:text-rose-400' };
            return `
                <div class="space-y-1">
                    <div class="flex justify-between font-bold">
                        <span>${it.lbl}</span>
                        <span class="${tier.txt}">${it.score.toFixed(1)} — ${tier.tag}</span>
                    </div>
                    <div class="w-full bg-slate-100 dark:bg-slate-800 h-2.5 rounded-full overflow-hidden">
                        <div class="${tier.bar} h-full rounded-full" style="width:${Math.min(100, it.score)}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    const swBadgesBox = document.getElementById('w360-sw-badges');
    if (swBadgesBox) {
        const badges = [];
        const sortedItems = sw.radarLabels.map((lbl, idx) => ({ lbl, score: sw.radarScores[idx] })).sort((a, b) => b.score - a.score);
        if (sortedItems[0]?.score >= 80) badges.push(`<span class="px-3 py-1 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-xs font-extrabold">🏆 Unggul di ${sortedItems[0].lbl}</span>`);
        if (m.attRate >= 95 && m.pendingTasks.length === 0) badges.push(`<span class="px-3 py-1 rounded-xl bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-xs font-extrabold">⭐ Kedisiplinan & Tugas Teladan</span>`);
        const weak = sortedItems[sortedItems.length - 1];
        if (weak && weak.score < 75) badges.push(`<span class="px-3 py-1 rounded-xl bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-extrabold">📌 Pendampingan ${weak.lbl}</span>`);
        swBadgesBox.innerHTML = badges.length ? badges.join('') : `<span class="text-xs text-slate-400 italic">Tambahkan nilai mata pelajaran untuk melihat lencana kompetensi otomatis.</span>`;
    }
}

function renderWaliMapelTrendChart() {
    const cMulti = document.getElementById('chartWaliAllMapelTrend');
    if (!cMulti || !waliCurrentTimelineData) return;
    const theme = getChartThemeColors();
    const selectedMpl = document.getElementById('w360-mapel-filter')?.value || 'all';
    const palette = ['#2563eb', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#06b6d4', '#ec4899'];

    const targetMapels = selectedMpl === 'all'
        ? waliCurrentTimelineData.allMapelNames
        : waliCurrentTimelineData.allMapelNames.filter(m => m === selectedMpl);

    const datasets = targetMapels.map((mpl, idx) => ({
        label: mpl,
        data: waliCurrentTimelineData.mapelSeries[mpl],
        borderColor: palette[idx % palette.length],
        backgroundColor: palette[idx % palette.length],
        borderWidth: 2.5,
        pointRadius: 4,
        spanGaps: true,
        tension: 0.25
    }));

    datasets.push({
        label: 'Batas KKM (75)',
        data: waliCurrentTimelineData.allPeriods.map(() => 75),
        borderColor: '#94a3b8',
        borderDash: [5, 5],
        borderWidth: 1.5,
        pointRadius: 0
    });

    destroyChart('chartWaliAllMapelTrend');
    chartInstances['chartWaliAllMapelTrend'] = new Chart(cMulti, {
        type: 'line',
        data: { labels: waliCurrentTimelineData.allPeriods, datasets },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: {
                x: { ticks: { color: theme.text, font: { size: 10 } }, grid: { color: theme.grid } },
                y: { min: 50, max: 100, ticks: { color: theme.text, font: { size: 10 } }, grid: { color: theme.grid } }
            },
            plugins: { legend: { position: 'top', labels: { color: theme.text, boxWidth: 10, font: { size: 10 } } }, tooltip: { backgroundColor: theme.tooltipBg } }
        }
    });
}

// ==================== 10B. ENGINE ANALISIS AI GEMINI (HEMAT TOKEN / CACHE) ====================
function buildWaliStudentSummaryPayload(studentId) {
    const s = allStudentsGlobal.find(x => Number(x.id) === Number(studentId));
    const m = waliMetricsCache[Number(studentId)] || { h: 0, s: 0, i: 0, a: 0, attRate: 100, pendingTasks: [], subjectDetails: [] };
    return {
        nama: s?.nama || 'Siswa',
        kelas: s?.classes?.nama_kelas || '-',
        periode_aktif: activePeriodName || currentDatePeriodName,
        kehadiran: {
            persentase: `${m.attRate.toFixed(0)}%`,
            hadir: m.h, sakit: m.s, izin: m.i, alpa: m.a
        },
        riwayat_semester_lalu: waliActiveHistoricalGrades.map(h => ({
            periode: h.periode, mapel: h.mapel, nilai: Number(h.nilai_akhir)
        })),
        capaian_semester_berjalan: m.subjectDetails.filter(sb => sb.hasData).map(sb => ({
            mapel: sb.mapel, nilai: Number(sb.finalVal.toFixed(1)), kkm: sb.kkm
        })),
        profil_rumpun: waliCurrentSWData ? waliCurrentSWData.radarLabels.map((lbl, idx) => ({
            dimensi: lbl, skor: waliCurrentSWData.radarScores[idx]
        })) : [],
        jumlah_tugas_tertunggak: m.pendingTasks.length,
        daftar_tunggakan: m.pendingTasks.slice(0, 6).map(t => `${t.mapel}: ${t.judul}`)
    };
}

function computeDataFingerprint(obj) {
    const str = JSON.stringify(obj);
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        hash = ((hash << 5) - hash) + str.charCodeAt(i);
        hash |= 0;
    }
    return `fp_${Math.abs(hash)}_${str.length}`;
}

function formatAIAnalysisHTML(rawText) {
    if (!rawText) return '';
    return rawText
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
        .split('\n')
        .map(line => line.trim())
        .filter(Boolean)
        .map(line => `<p>${line}</p>`)
        .join('');
}

async function loadWaliCachedAIAnalysis(studentId) {
    const outBox = document.getElementById('w360-ai-output');
    const badge = document.getElementById('w360-ai-badge');
    if (!outBox || !badge) return;

    const summary = buildWaliStudentSummaryPayload(studentId);
    const currentFp = computeDataFingerprint(summary);

    const { data: cached } = await db.from('wali_ai_analyses')
        .select('*')
        .eq('student_id', studentId)
        .maybeSingle();

    if (cached && cached.ringkasan_ai) {
        waliCurrentAIAnalysisText = cached.ringkasan_ai;
        outBox.innerHTML = formatAIAnalysisHTML(cached.ringkasan_ai);
        if (cached.data_fingerprint === currentFp) {
            badge.innerText = '✨ Tersimpan (0 Token)';
            badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 shrink-0';
        } else {
            badge.innerText = '🔄 Ada Pembaruan Data';
            badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800 shrink-0';
        }
    } else {
        waliCurrentAIAnalysisText = '';
        badge.innerText = 'Siap Analisis';
        badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-indigo-100 dark:bg-indigo-900/70 text-indigo-700 dark:text-indigo-300 shrink-0';
        outBox.innerHTML = `<p class="text-slate-400 italic">Klik tombol <b>✨ Analisis AI</b> di bawah untuk membaca tren nilai lintas semester, kekuatan (strength), dan tantangan belajar siswa ini.</p>`;
    }
}

async function runWaliAIAnalysis(forceRefresh = true) {
    if (!activeWaliStudentId) return;
    const outBox = document.getElementById('w360-ai-output');
    const badge = document.getElementById('w360-ai-badge');
    const btn = document.getElementById('btn-run-wali-ai');

    const summary = buildWaliStudentSummaryPayload(activeWaliStudentId);
    const currentFp = computeDataFingerprint(summary);

    if (!forceRefresh) {
        const { data: cached } = await db.from('wali_ai_analyses').select('*').eq('student_id', activeWaliStudentId).maybeSingle();
        if (cached && cached.data_fingerprint === currentFp) {
            waliCurrentAIAnalysisText = cached.ringkasan_ai;
            outBox.innerHTML = formatAIAnalysisHTML(cached.ringkasan_ai);
            badge.innerText = '✨ Hemat Token (0 Token)';
            return;
        }
    }

    btn.disabled = true;
    badge.innerText = '⏳ Menganalisis...';
    outBox.innerHTML = `<p class="text-indigo-600 dark:text-indigo-400 font-bold animate-pulse">🤖 Sedang menganalisis grafik perkembangan lintas semester & profil kompetensi siswa...</p>`;

    try {
        const { data, error } = await db.functions.invoke('ai-advisor', {
            body: {
                teacher_id: currentUser.id,
                student_summary: summary
            }
        });

        if (error || !data?.success) {
            throw new Error(data?.error || error?.message || 'Gagal terhubung ke layanan AI.');
        }

        waliCurrentAIAnalysisText = data.analysis;
        outBox.innerHTML = formatAIAnalysisHTML(data.analysis);
        badge.innerText = data.key_source === 'personal' ? '✨ AI Mandiri Aktif' : '✨ AI Sekolah Aktif';
        badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-700 shrink-0';

        await db.from('wali_ai_analyses').upsert({
            student_id: activeWaliStudentId,
            periode: activePeriodName || currentDatePeriodName,
            data_fingerprint: currentFp,
            ringkasan_ai: data.analysis,
            model_used: data.model || 'gemini-3.5-flash-lite',
            updated_at: new Date().toISOString()
        });

        showToast('✅ Analisis AI selesai & disimpan ke cache!');
    } catch (err) {
        badge.innerText = '⚠️ Perlu API Key';
        badge.className = 'px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-700 shrink-0';
        outBox.innerHTML = `<p class="text-rose-600 font-bold">⚠️ ${err.message}</p><p class="text-[11px] text-slate-500">Anda dapat menempelkan API Key gratis di menu <b>Pengaturan</b> atau menekan tombol <b>Buka Prompt di Gemini Web</b> di bawah.</p>`;
    } finally {
        btn.disabled = false;
    }
}

async function saveWaliAIToJournal() {
    if (!activeWaliStudentId || !waliCurrentAIAnalysisText) {
        return showToast('Jalankan Analisis AI terlebih dahulu sebelum menyimpan ke jurnal!', 'error');
    }
    const todayStr = new Date().toISOString().split('T')[0];
    const cleanSummary = waliCurrentAIAnalysisText.replace(/\*\*/g, '');
    const { error } = await db.from('wali_logs').insert([{
        teacher_id: currentUser.id,
        student_id: activeWaliStudentId,
        tanggal: todayStr,
        topik: `Evaluasi Perkembangan Belajar (${activePeriodName})`,
        catatan: cleanSummary,
        tindak_lanjut: 'Pemantauan berkala oleh Guru Wali'
    }]);
    if (error) return showToast('Gagal menyimpan ke jurnal: ' + error.message, 'error');
    showToast('✅ Hasil analisis AI berhasil dicatat ke Jurnal Bimbingan!');
    await loadWaliLogsList(activeWaliStudentId);
}

function openWaliGeminiWebFallback() {
    if (!activeWaliStudentId) return;
    const summary = buildWaliStudentSummaryPayload(activeWaliStudentId);
    const promptText = `Analisislah perkembangan hasil belajar siswa SMA berikut secara objektif, ringkas, dan berbasis data (tren lintas semester, perbandingan per mata pelajaran, kekuatan/strength, kelemahan/weakness, serta kaitannya dengan kehadiran & tunggakan tugas):\n\n${JSON.stringify(summary, null, 2)}`;
    navigator.clipboard.writeText(promptText);
    showToast('📋 Prompt data siswa disalin! Tempel (Ctrl+V) di tab Gemini Web.');
    window.open('https://gemini.google.com/app', '_blank');
}

async function loadWaliLogsList(studentId) {
    const { data: logs } = await db.from('wali_logs').select('*').eq('student_id', studentId).order('tanggal', { ascending: false });
    waliActiveLogsCache = logs || [];
    const box = document.getElementById('w360-logs-list');
    if (!box) return;
    box.innerHTML = waliActiveLogsCache.map(l => `
        <div class="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border dark:border-slate-700 text-xs">
            <div class="font-extrabold text-slate-900 dark:text-white">${l.tanggal} — ${l.topik}</div>
            <p class="text-slate-600 dark:text-slate-300 mt-1 whitespace-pre-line">${l.catatan}</p>
            ${l.tindak_lanjut ? `<p class="text-[11px] text-blue-700 dark:text-blue-400 font-semibold mt-1">Tindak Lanjut: ${l.tindak_lanjut}</p>` : ''}
        </div>
    `).join('') || `<p class="text-xs text-slate-400 italic">Belum ada catatan bimbingan.</p>`;
}

async function addWaliCounselingLog(e) {
    e.preventDefault();
    await db.from('wali_logs').insert([{
        teacher_id: currentUser.id, student_id: activeWaliStudentId,
        tanggal: document.getElementById('w360-log-date').value,
        topik: document.getElementById('w360-log-topic').value,
        catatan: document.getElementById('w360-log-note').value,
        tindak_lanjut: document.getElementById('w360-log-tindak').value
    }]);
    e.target.reset();
    showToast('✅ Jurnal bimbingan dicatat');
    await loadWaliLogsList(activeWaliStudentId);
}

async function printWali360PDF() {
    if (!activeWaliStudentId) return;
    if (!(await ensureJsPdfLoaded())) return;

    const btn = document.getElementById('btn-print-wali-360-pdf');
    const prevBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Menyusun PDF...</span>`;
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 40));

        const s = allStudentsGlobal.find(x => Number(x.id) === Number(activeWaliStudentId));
        const built = buildWaliTimelineAndSW(activeWaliStudentId);
        const m = built.m;
        const timeline = built.timeline;
        const sw = built.sw;

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const marginX = 14;
        const contentW = pageW - marginX * 2;

        const studentName = pdfSanitizeText(s?.nama || 'Siswa Binaan');
        const studentNisn = pdfSanitizeText(s?.nisn || '-');
        const studentClass = pdfSanitizeText(s?.classes?.nama_kelas || '-');
        const guruWaliName = pdfSanitizeText(currentUser?.nama_lengkap || 'Guru Wali');
        const periodLabel = pdfSanitizeText(activePeriodName || currentDatePeriodName || '-');
        const printedAt = new Date().toLocaleString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        const ewsMeta = m.ews === 'kritis'
            ? { label: 'PRIORITAS KRITIS', bg: [225, 29, 72], lightBg: [254, 226, 226], text: [159, 18, 57] }
            : m.ews === 'waspada'
                ? { label: 'PERLU PANTAUAN', bg: [217, 119, 6], lightBg: [254, 243, 199], text: [146, 64, 14] }
                : { label: 'STATUS AMAN', bg: [5, 150, 105], lightBg: [209, 250, 229], text: [6, 95, 70] };

        const curSubjects = (m.subjectDetails || []).filter(sb => sb.hasData);
        const tuntasSubjectsCount = curSubjects.filter(sb => sb.finalVal >= sb.kkm).length;
        const totAttLogs = (m.h || 0) + (m.s || 0) + (m.i || 0) + (m.a || 0);
        const hasAttData = totAttLogs > 0;
        const attPcts = hasAttData
            ? [
                Number(((m.h / totAttLogs) * 100).toFixed(1)),
                Number(((m.s / totAttLogs) * 100).toFixed(1)),
                Number(((m.i / totAttLogs) * 100).toFixed(1)),
                Number(((m.a / totAttLogs) * 100).toFixed(1))
            ]
            : [100];

        // ---- RENDER 4 GRAFIK OFFSCREEN RESOLUSI TINGGI (PRINT-READY LIGHT MODE) ----
        // Chart 1: Tren Nilai Lintas Semester
        const validTrendPairs = timeline.allPeriods
            .map((p, idx) => ({ p: pdfSanitizeText(p), v: timeline.periodAverages[idx] }))
            .filter(x => x.v !== null && !isNaN(x.v));
        const trendLabels = validTrendPairs.length ? validTrendPairs.map(x => x.p.replace(/^Semester\s+/i, 'Smt ')) : [periodLabel.replace(/^Semester\s+/i, 'Smt ')];
        const trendValues = validTrendPairs.length ? validTrendPairs.map(x => x.v) : [0];
        let trendDeltaLabel = 'Stabil';
        if (trendValues.length >= 2) {
            const diff = trendValues[trendValues.length - 1] - trendValues[0];
            trendDeltaLabel = diff > 1 ? `Naik +${diff.toFixed(1)}` : diff < -1 ? `Turun ${diff.toFixed(1)}` : 'Stabil';
        }

        const trendChartImg = renderOffscreenChartDataUrl(520, 290, () => ({
            type: 'line',
            data: {
                labels: trendLabels,
                datasets: [
                    {
                        label: 'Rata-rata Nilai',
                        data: trendValues,
                        borderColor: '#4f46e5',
                        backgroundColor: 'rgba(79, 70, 229, 0.16)',
                        borderWidth: 3,
                        pointBackgroundColor: '#4338ca',
                        pointBorderColor: '#ffffff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        fill: true,
                        tension: 0.32
                    },
                    {
                        label: 'Batas KKM (75)',
                        data: trendLabels.map(() => 75),
                        borderColor: '#f59e0b',
                        borderDash: [6, 5],
                        borderWidth: 1.8,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                layout: { padding: { top: 24, bottom: 8, left: 6, right: 14 } },
                scales: {
                    x: { ticks: { color: '#334155', font: { size: 11, weight: 'bold' } }, grid: { color: '#f1f5f9' } },
                    y: { min: 40, max: 100, ticks: { color: '#475569', stepSize: 15, font: { size: 11 } }, grid: { color: '#e2e8f0' } }
                },
                plugins: { legend: { display: false } }
            },
            plugins: [{
                id: 'waliTrendLabels',
                afterDatasetsDraw(chart) {
                    if (!validTrendPairs.length) return;
                    const c = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    c.save();
                    c.fillStyle = '#312e81';
                    c.font = 'bold 12px Helvetica, Arial, sans-serif';
                    c.textAlign = 'center';
                    c.textBaseline = 'bottom';
                    meta.data.forEach((pt, idx) => {
                        c.fillText(`${trendValues[idx].toFixed(1)}`, pt.x, pt.y - 7);
                    });
                    c.restore();
                }
            }]
        }));

        // Chart 2: Capaian Semester Berjalan Per Mata Pelajaran + Garis KKM
        const curSubLabels = curSubjects.length
            ? curSubjects.map(sb => {
                const clean = pdfSanitizeText(sb.mapel);
                return clean.length > 13 ? clean.slice(0, 12) + '.' : clean;
            })
            : ['Belum Ada Nilai'];
        const curSubVals = curSubjects.length ? curSubjects.map(sb => Number(sb.finalVal.toFixed(1))) : [0];
        const curSubColors = curSubjects.length
            ? curSubjects.map(sb => sb.finalVal >= 85 ? '#4f46e5' : sb.finalVal >= sb.kkm ? '#10b981' : '#f43f5e')
            : ['#cbd5e1'];

        const currentBarImg = renderOffscreenChartDataUrl(520, 290, () => ({
            type: 'bar',
            data: {
                labels: curSubLabels,
                datasets: [
                    {
                        label: 'Nilai Akhir',
                        data: curSubVals,
                        backgroundColor: curSubColors,
                        borderRadius: 7,
                        maxBarThickness: 44
                    },
                    {
                        type: 'line',
                        label: 'KKM (75)',
                        data: curSubLabels.map(() => 75),
                        borderColor: '#f59e0b',
                        borderDash: [6, 5],
                        borderWidth: 2,
                        pointRadius: 0,
                        fill: false
                    }
                ]
            },
            options: {
                layout: { padding: { top: 24, bottom: 6, left: 6, right: 12 } },
                scales: {
                    x: { ticks: { color: '#334155', font: { size: 10, weight: 'bold' }, maxRotation: 25, minRotation: 0 }, grid: { display: false } },
                    y: { min: 0, max: 100, ticks: { color: '#475569', stepSize: 25, font: { size: 11 } }, grid: { color: '#e2e8f0' } }
                },
                plugins: { legend: { display: false } }
            },
            plugins: [{
                id: 'waliBarLabels',
                afterDatasetsDraw(chart) {
                    if (!curSubjects.length) return;
                    const c = chart.ctx;
                    const meta = chart.getDatasetMeta(0);
                    c.save();
                    c.fillStyle = '#0f172a';
                    c.font = 'bold 11px Helvetica, Arial, sans-serif';
                    c.textAlign = 'center';
                    c.textBaseline = 'bottom';
                    meta.data.forEach((bar, idx) => {
                        c.fillText(`${curSubVals[idx]}`, bar.x, bar.y - 4);
                    });
                    c.restore();
                }
            }]
        }));

        // Chart 3: Radar Kompetensi 5 Dimensi
        const radarShortLabels = ['Sains & Mat', 'Teknologi', 'Bahasa', 'Sosial Hum.', 'Karakter'];
        const radarImg = renderOffscreenChartDataUrl(500, 320, () => ({
            type: 'radar',
            data: {
                labels: radarShortLabels,
                datasets: [
                    {
                        label: 'Kompetensi Siswa',
                        data: sw.radarScores,
                        backgroundColor: 'rgba(79, 70, 229, 0.22)',
                        borderColor: '#4f46e5',
                        pointBackgroundColor: '#4338ca',
                        pointBorderColor: '#ffffff',
                        pointRadius: 4,
                        borderWidth: 2.5
                    },
                    {
                        label: 'Standar KKM (75)',
                        data: [75, 75, 75, 75, 75],
                        backgroundColor: 'rgba(245, 158, 11, 0.05)',
                        borderColor: '#f59e0b',
                        borderDash: [5, 5],
                        pointRadius: 0,
                        borderWidth: 1.8
                    }
                ]
            },
            options: {
                layout: { padding: { top: 8, bottom: 4, left: 10, right: 10 } },
                scales: {
                    r: {
                        min: 40,
                        max: 100,
                        ticks: { stepSize: 20, color: '#64748b', backdropColor: 'transparent', font: { size: 10 } },
                        pointLabels: { color: '#1e293b', font: { size: 12, weight: 'bold' } },
                        grid: { color: '#cbd5e1' },
                        angleLines: { color: '#cbd5e1' }
                    }
                },
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#334155', boxWidth: 12, padding: 10, font: { size: 11, weight: 'bold' } }
                    }
                }
            }
        }));

        // Chart 4: Doughnut Kehadiran Lintas Mapel
        const attDonutImg = renderOffscreenChartDataUrl(460, 240, () => ({
            type: 'doughnut',
            data: {
                labels: hasAttData
                    ? [`Hadir (${m.h})`, `Sakit (${m.s})`, `Izin (${m.i})`, `Alpa (${m.a})`]
                    : ['Belum Ada Data'],
                datasets: [{
                    data: attPcts,
                    backgroundColor: hasAttData ? ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e'] : ['#e2e8f0'],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                cutout: '64%',
                layout: { padding: { top: 6, bottom: 6, left: 6, right: 10 } },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#1e293b', boxWidth: 12, padding: 10, font: { size: 12, weight: 'bold' } }
                    }
                }
            },
            plugins: [{
                id: 'waliAttCenter',
                afterDraw(chart) {
                    const meta = chart.getDatasetMeta(0);
                    if (!meta?.data?.[0]) return;
                    const { x, y } = meta.data[0];
                    const c = chart.ctx;
                    c.save();
                    c.textAlign = 'center';
                    c.textBaseline = 'middle';
                    c.fillStyle = '#0f172a';
                    c.font = 'bold 20px Helvetica, Arial, sans-serif';
                    c.fillText(hasAttData ? `${attPcts[0]}%` : '-', x, y - 6);
                    c.fillStyle = '#64748b';
                    c.font = 'bold 10px Helvetica, Arial, sans-serif';
                    c.fillText('Hadir', x, y + 12);
                    c.restore();
                }
            }]
        }));

        // ==================== HALAMAN 1: HEADER, KPI CARDS & VISUALISASI 360 ====================
        doc.setFillColor(49, 46, 129); // indigo-900
        doc.rect(0, 0, pageW, 38, 'F');
        doc.setFillColor(99, 102, 241); // indigo-500 strip
        doc.rect(0, 38, pageW, 1.8, 'F');

        doc.setTextColor(199, 210, 254);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.text('PANTAUBELAJAR  |  PEMBIMBINGAN AKADEMIK (GURU WALI 360)', marginX, 10.5);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14.5);
        doc.text('LAPORAN PERKEMBANGAN AKADEMIK SISWA 360', marginX, 18.2);

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(224, 231, 255);
        doc.text(`${studentName}`, marginX, 25.5);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.8);
        doc.text(`NISN: ${studentNisn}   |   Kelas: ${studentClass}   |   Periode: ${periodLabel}`, marginX, 31.5);

        // Right metadata & EWS badge
        doc.setFillColor(...ewsMeta.bg);
        doc.roundedRect(pageW - marginX - 44, 7.5, 44, 7.2, 2, 2, 'F');
        doc.setTextColor(255, 255, 255);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.8);
        doc.text(ewsMeta.label, pageW - marginX - 22, 12.2, { align: 'center' });

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.2);
        doc.setTextColor(224, 231, 255);
        doc.text(`Guru Wali: ${guruWaliName}`, pageW - marginX, 22, { align: 'right' });
        doc.text(`Dicetak: ${printedAt}`, pageW - marginX, 28.2, { align: 'right' });

        let curY = 45;

        // ---- 4 KARTU KPI VISUAL ----
        const cardGap = 3.5;
        const cardW = (contentW - cardGap * 3) / 4;
        const cardH = 26;

        const drawWaliKpi = (idx, accentRgb, title, bigVal, valRgb, footerFn) => {
            const x = marginX + idx * (cardW + cardGap);
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.35);
            doc.roundedRect(x, curY, cardW, cardH, 2.5, 2.5, 'FD');
            doc.setFillColor(...accentRgb);
            doc.roundedRect(x, curY, cardW, 2.2, 1.5, 1.5, 'F');
            doc.rect(x, curY + 1.1, cardW, 1.1, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.2);
            doc.setTextColor(100, 116, 139);
            doc.text(title, x + 3, curY + 7);

            doc.setFontSize(14);
            doc.setTextColor(...valRgb);
            doc.text(bigVal, x + 3, curY + 14.5);

            footerFn(x + 3, curY + 17.3, cardW - 6);
        };

        // KPI 1: Kehadiran
        drawWaliKpi(0, [16, 185, 129], 'KEHADIRAN LINTAS MAPEL', `${(m.attRate || 0).toFixed(1)}%`, [15, 23, 42], (fx, fy, fw) => {
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(fx, fy, fw, 2, 1, 1, 'F');
            if (hasAttData) {
                const segs = [
                    { v: m.h, c: [16, 185, 129] },
                    { v: m.s, c: [245, 158, 11] },
                    { v: m.i, c: [59, 130, 246] },
                    { v: m.a, c: [244, 63, 94] }
                ];
                let sx = fx;
                segs.forEach(sg => {
                    const w2 = (sg.v / totAttLogs) * fw;
                    if (w2 > 0.2) { doc.setFillColor(...sg.c); doc.rect(sx, fy, w2, 2, 'F'); sx += w2; }
                });
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(100, 116, 139);
            doc.text(`H:${m.h}  S:${m.s}  I:${m.i}  A:${m.a}`, fx, fy + 5.5);
        });

        // KPI 2: Ketuntasan Tugas
        const taskRate = Number(m.taskCompletionRate ?? 100);
        drawWaliKpi(1, [37, 99, 235], 'KETUNTASAN TUGAS', `${taskRate.toFixed(1)}%`, [37, 99, 235], (fx, fy, fw) => {
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(fx, fy, fw, 2, 1, 1, 'F');
            const fillW = Math.max(0, Math.min(fw, (taskRate / 100) * fw));
            if (fillW > 0.3) { doc.setFillColor(37, 99, 235); doc.roundedRect(fx, fy, fillW, 2, 1, 1, 'F'); }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(m.pendingTasks.length > 0 ? 190 : 5, m.pendingTasks.length > 0 ? 18 : 150, m.pendingTasks.length > 0 ? 60 : 105);
            doc.text(m.pendingTasks.length > 0 ? `${m.pendingTasks.length} tugas tertunggak` : '0 tunggakan tugas', fx, fy + 5.5);
        });

        // KPI 3: Rata-rata Nilai Lintas Mapel
        const avgAll = m.hasAnySubjectData ? m.avgFinalAllSubjects : 0;
        const avgRgb = m.hasAnySubjectData && avgAll >= 75 ? [5, 150, 105] : [217, 119, 6];
        drawWaliKpi(2, [79, 70, 229], 'RATA-RATA LINTAS MAPEL', m.hasAnySubjectData ? avgAll.toFixed(1) : '-', avgRgb, (fx, fy) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(79, 70, 229);
            doc.text(`${tuntasSubjectsCount}/${curSubjects.length} mapel tuntas KKM`, fx, fy + 1.8);
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text(`Tren: ${trendDeltaLabel}`, fx, fy + 5.5);
        });

        // KPI 4: Karakter & Disiplin
        const karScore = Number(sw.karakterScore || 0);
        const karTier = karScore >= 85 ? 'Teladan' : karScore >= 75 ? 'Baik / Stabil' : 'Perlu Penguatan';
        drawWaliKpi(3, ewsMeta.bg, 'KARAKTER & DISIPLIN', karScore.toFixed(1), ewsMeta.text, (fx, fy, fw) => {
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(fx, fy, fw, 2, 1, 1, 'F');
            const fw2 = Math.max(0, Math.min(fw, (karScore / 100) * fw));
            if (fw2 > 0.3) { doc.setFillColor(...ewsMeta.bg); doc.roundedRect(fx, fy, fw2, 2, 1, 1, 'F'); }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(71, 85, 105);
            doc.text(`Kategori: ${karTier}`, fx, fy + 5.5);
        });

        curY += cardH + 6;

        // ---- VISUALISASI GRAFIK BARIS 1: TREN SEMESTER & CAPAIAN MAPEL ----
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.8);
        doc.setTextColor(15, 23, 42);
        doc.text('ANALISIS GRAFIK PERKEMBANGAN & CAPAIAN AKADEMIK', marginX, curY);
        curY += 3.5;

        const halfW = (contentW - 4) / 2;
        const topChartH = 56;

        // Box Kiri: Tren Nilai Lintas Semester
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, curY, halfW, topChartH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.3);
        doc.setTextColor(30, 41, 59);
        doc.text('Riwayat Nilai Lintas Semester', marginX + 3.5, curY + 5.6);
        doc.setFontSize(7.2);
        doc.setTextColor(79, 70, 229);
        doc.text(trendDeltaLabel, marginX + halfW - 3.5, curY + 5.6, { align: 'right' });
        doc.addImage(trendChartImg, 'PNG', marginX + 2, curY + 7.2, halfW - 4, topChartH - 9, undefined, 'FAST');

        // Box Kanan: Capaian Semester Berjalan
        const rightX = marginX + halfW + 4;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(rightX, curY, halfW, topChartH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.3);
        doc.setTextColor(30, 41, 59);
        doc.text('Capaian Semester Berjalan vs KKM', rightX + 3.5, curY + 5.6);
        doc.addImage(currentBarImg, 'PNG', rightX + 2, curY + 7.2, halfW - 4, topChartH - 9, undefined, 'FAST');

        curY += topChartH + 4.5;

        // ---- VISUALISASI GRAFIK BARIS 2: RADAR KOMPETENSI & PROFIL RUMPUN ----
        const midBoxH = 62;

        // Box Kiri: Radar Chart
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, curY, halfW, midBoxH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.3);
        doc.setTextColor(30, 41, 59);
        doc.text('Radar Profil Kompetensi 5 Dimensi', marginX + 3.5, curY + 5.6);
        doc.addImage(radarImg, 'PNG', marginX + 3, curY + 7, halfW - 6, midBoxH - 9, undefined, 'FAST');

        // Box Kanan: Visual Progress Bars Rumpun (Strength & Weakness)
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(rightX, curY, halfW, midBoxH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.3);
        doc.setTextColor(30, 41, 59);
        doc.text('Kekuatan & Tantangan Rumpun (Strength / Weakness)', rightX + 3.5, curY + 5.6);

        let ry = curY + 12;
        sw.radarLabels.forEach((lbl, idx) => {
            const scVal = Number(sw.radarScores[idx] || 0);
            const tier = scVal >= 82
                ? { tag: 'Tinggi', rgb: [16, 185, 129] }
                : scVal >= 75
                    ? { tag: 'Stabil', rgb: [37, 99, 235] }
                    : { tag: 'Penguatan', rgb: [244, 63, 94] };

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.4);
            doc.setTextColor(51, 65, 85);
            doc.text(pdfSanitizeText(lbl), rightX + 3.5, ry);

            doc.setTextColor(...tier.rgb);
            doc.text(`${scVal.toFixed(1)} (${tier.tag})`, rightX + halfW - 3.5, ry, { align: 'right' });

            const bX = rightX + 3.5;
            const bW = halfW - 7;
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(bX, ry + 1.4, bW, 2.8, 1.2, 1.2, 'F');
            const fillW = Math.max(0.5, Math.min(bW, (scVal / 100) * bW));
            doc.setFillColor(...tier.rgb);
            doc.roundedRect(bX, ry + 1.4, fillW, 2.8, 1.2, 1.2, 'F');
            ry += 9.5;
        });

        curY += midBoxH + 4.5;

        // ---- PANEL KEHADIRAN (DONUT) + TUNGGAKAN TUGAS ----
        const attBoxH = 48;
        if (curY + attBoxH > pageH - 18) {
            doc.addPage();
            curY = 16;
        }

        // Kiri: Proporsi Kehadiran & Tanggal Absen
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, curY, halfW, attBoxH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.3);
        doc.setTextColor(30, 41, 59);
        doc.text('Proporsi Kehadiran Lintas Mapel', marginX + 3.5, curY + 5.6);
        doc.addImage(attDonutImg, 'PNG', marginX + 2, curY + 7.2, halfW - 4, 31, undefined, 'FAST');

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.8);
        doc.setTextColor(71, 85, 105);
        const absSummary = m.absenceDates.length
            ? `Catatan S/I/A: ${pdfSanitizeText(m.absenceDates.slice(0, 3).join('; '))}${m.absenceDates.length > 3 ? ` (+${m.absenceDates.length - 3} lainnya)` : ''}`
            : 'Tidak ada catatan ketidakhadiran (Sakit / Izin / Alpa).';
        const absLines = doc.splitTextToSize(absSummary, halfW - 7);
        doc.text(absLines.slice(0, 2), marginX + 3.5, curY + 41.5);

        // Kanan: Daftar Tunggakan Tugas Lintas Mapel
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(rightX, curY, halfW, attBoxH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.3);
        doc.setTextColor(30, 41, 59);
        doc.text('Tunggakan Tugas Lintas Mapel', rightX + 3.5, curY + 5.6);

        const pendRgb = m.pendingTasks.length > 0 ? [225, 29, 72] : [5, 150, 105];
        doc.setFontSize(7.2);
        doc.setTextColor(...pendRgb);
        doc.text(`${m.pendingTasks.length} Tunggakan`, rightX + halfW - 3.5, curY + 5.6, { align: 'right' });

        if (m.pendingTasks.length > 0) {
            let py = curY + 11.5;
            m.pendingTasks.slice(0, 5).forEach((t, tIdx) => {
                doc.setFillColor(254, 242, 242);
                doc.roundedRect(rightX + 3, py - 3.3, halfW - 6, 5.8, 1.2, 1.2, 'F');
                doc.setFont('helvetica', 'bold');
                doc.setFontSize(7);
                doc.setTextColor(159, 18, 57);
                const itemText = pdfSanitizeText(`${tIdx + 1}. [${t.mapel}] ${t.judul}`);
                doc.text(itemText.length > 52 ? itemText.slice(0, 51) + '...' : itemText, rightX + 5, py + 0.5);
                py += 6.8;
            });
            if (m.pendingTasks.length > 5) {
                doc.setFont('helvetica', 'italic');
                doc.setFontSize(6.8);
                doc.setTextColor(100, 116, 139);
                doc.text(`+ ${m.pendingTasks.length - 5} tugas lainnya belum terkumpul.`, rightX + 3.5, curY + attBoxH - 2.5);
            }
        } else {
            doc.setFillColor(236, 253, 245);
            doc.setDrawColor(167, 243, 208);
            doc.roundedRect(rightX + 4, curY + 14, halfW - 8, 18, 2, 2, 'FD');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(8.5);
            doc.setTextColor(6, 95, 70);
            doc.text('Seluruh Tugas Terkumpul!', rightX + halfW / 2, curY + 21.5, { align: 'center' });
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.2);
            doc.text('Siswa tidak memiliki tunggakan tugas lintas mapel.', rightX + halfW / 2, curY + 27, { align: 'center' });
        }

        curY += attBoxH + 7;

        // ==================== TABEL REKAP NILAI KUMULATIF LINTAS MATA PELAJARAN ====================
        if (curY > pageH - 55) {
            doc.addPage();
            curY = 16;
        }
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.8);
        doc.setTextColor(15, 23, 42);
        doc.text(`REKAP CAPAIAN LINTAS MATA PELAJARAN (${timeline.cumulativeSummary.length} Mapel)`, marginX, curY);
        curY += 3;

        if (timeline.cumulativeSummary.length > 0) {
            doc.autoTable({
                startY: curY,
                margin: { left: marginX, right: marginX, bottom: 18 },
                head: [['No', 'Mata Pelajaran', 'Guru Pengampu', 'Rata2', 'Max', 'Min', 'Aktif', 'Status']],
                body: timeline.cumulativeSummary.map((sb, idx) => [
                    idx + 1,
                    pdfSanitizeText(sb.mapel),
                    pdfSanitizeText(sb.guru || '-'),
                    sb.avg > 0 ? sb.avg.toFixed(1) : '-',
                    sb.maxVal > 0 ? sb.maxVal.toFixed(1) : '-',
                    sb.minVal > 0 ? sb.minVal.toFixed(1) : '-',
                    sb.currentVal !== null ? sb.currentVal.toFixed(1) : '-',
                    sb.currentVal === null ? 'Belum Ada' : sb.tuntas ? 'Tuntas' : 'Remedial'
                ]),
                theme: 'grid',
                headStyles: { fillColor: [49, 46, 129], textColor: 255, fontSize: 7.8, fontStyle: 'bold' },
                styles: { fontSize: 7.6, cellPadding: 2.3, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { halign: 'center', cellWidth: 9 },
                    1: { cellWidth: 44, fontStyle: 'bold' },
                    2: { cellWidth: 37 },
                    3: { halign: 'center', cellWidth: 16, fontStyle: 'bold' },
                    4: { halign: 'center', cellWidth: 15, textColor: [5, 150, 105] },
                    5: { halign: 'center', cellWidth: 15, textColor: [217, 119, 6] },
                    6: { halign: 'center', cellWidth: 18, fontStyle: 'bold', textColor: [29, 78, 216] },
                    7: { halign: 'center', cellWidth: 28, fontStyle: 'bold' }
                },
                didParseCell(data) {
                    if (data.section === 'body' && data.column.index === 7) {
                        const v = data.cell.raw;
                        if (v === 'Tuntas') {
                            data.cell.styles.fillColor = [209, 250, 229];
                            data.cell.styles.textColor = [6, 95, 70];
                        } else if (v === 'Remedial') {
                            data.cell.styles.fillColor = [254, 226, 226];
                            data.cell.styles.textColor = [159, 18, 57];
                        } else {
                            data.cell.styles.fillColor = [241, 245, 249];
                            data.cell.styles.textColor = [100, 116, 139];
                        }
                    }
                }
            });
            curY = (doc.lastAutoTable?.finalY || curY + 20) + 7;
        } else {
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(8.5);
            doc.setTextColor(100, 116, 139);
            doc.text('Belum ada data mata pelajaran lintas kelas untuk siswa ini.', marginX, curY + 4);
            curY += 11;
        }

        // ==================== RINGKASAN ANALISIS AI (BILA TERSEDIA) ====================
        if (waliCurrentAIAnalysisText) {
            const cleanAi = pdfSanitizeText(waliCurrentAIAnalysisText.replace(/\*\*/g, '').replace(/\n+/g, '  |  '));
            const aiLines = doc.splitTextToSize(cleanAi, contentW - 10);
            const lineH = 4.1;
            const maxLinesFirstChunk = Math.max(4, Math.floor((pageH - 26 - curY - 12) / lineH));

            if (curY > pageH - 45) {
                doc.addPage();
                curY = 16;
            }

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.5);
            doc.setTextColor(49, 46, 129);
            doc.text('RINGKASAN ANALISIS PERKEMBANGAN BELAJAR (AI ADVISOR)', marginX, curY);
            curY += 3;

            let idxLine = 0;
            while (idxLine < aiLines.length) {
                const availH = pageH - 22 - curY;
                const fitCount = Math.max(1, Math.floor((availH - 8) / lineH));
                const chunk = aiLines.slice(idxLine, idxLine + fitCount);
                const boxH = chunk.length * lineH + 7;

                doc.setFillColor(238, 242, 255);
                doc.setDrawColor(199, 210, 254);
                doc.roundedRect(marginX, curY, contentW, boxH, 2.2, 2.2, 'FD');
                doc.setFillColor(79, 70, 229);
                doc.rect(marginX, curY + 1, 1.8, boxH - 2, 'F');

                doc.setFont('helvetica', 'normal');
                doc.setFontSize(8.2);
                doc.setTextColor(30, 41, 59);
                doc.text(chunk, marginX + 5, curY + 5.2, { lineHeightFactor: 1.35 });

                idxLine += chunk.length;
                curY += boxH + 5;
                if (idxLine < aiLines.length) {
                    doc.addPage();
                    curY = 16;
                }
            }
            void maxLinesFirstChunk;
        }

        // ==================== RIWAYAT JURNAL BIMBINGAN GURU WALI ====================
        if (waliActiveLogsCache.length > 0) {
            if (curY > pageH - 52) {
                doc.addPage();
                curY = 16;
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(9.8);
            doc.setTextColor(15, 23, 42);
            doc.text(`RIWAYAT JURNAL BIMBINGAN GURU WALI (${waliActiveLogsCache.length} Catatan)`, marginX, curY);
            curY += 3;

            doc.autoTable({
                startY: curY,
                margin: { left: marginX, right: marginX, bottom: 18 },
                head: [['Tanggal', 'Topik Bimbingan', 'Catatan Konseling', 'Tindak Lanjut']],
                body: waliActiveLogsCache.slice(0, 10).map(l => [
                    pdfSanitizeText(l.tanggal || '-'),
                    pdfSanitizeText(l.topik || '-'),
                    pdfSanitizeText(l.catatan || '-'),
                    pdfSanitizeText(l.tindak_lanjut || '-')
                ]),
                theme: 'grid',
                headStyles: { fillColor: [15, 23, 42], textColor: 255, fontSize: 7.8, fontStyle: 'bold' },
                styles: { fontSize: 7.5, cellPadding: 2.3, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
                alternateRowStyles: { fillColor: [248, 250, 252] },
                columnStyles: {
                    0: { cellWidth: 24, halign: 'center', fontStyle: 'bold' },
                    1: { cellWidth: 40, fontStyle: 'bold' },
                    2: { cellWidth: 72 },
                    3: { cellWidth: 46 }
                }
            });
            curY = (doc.lastAutoTable?.finalY || curY + 20) + 9;
        }

        // ---- BLOK PENGESAHAN GURU WALI ----
        if (curY > pageH - 36) {
            doc.addPage();
            curY = 22;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Dicetak melalui PantauBelajar pada ${printedAt}`, marginX, curY + 4);
        doc.text('Mengetahui,', pageW - marginX - 55, curY + 2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Guru Wali (PA),', pageW - marginX - 55, curY + 7);
        doc.setDrawColor(148, 163, 184);
        doc.line(pageW - marginX - 55, curY + 23, pageW - marginX, curY + 23);
        doc.text(guruWaliName, pageW - marginX - 55, curY + 27.5);

        // ---- FOOTER NOMOR HALAMAN ----
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`PantauBelajar  |  Laporan Guru Wali 360: ${studentName} (${studentClass}) - ${periodLabel}`, marginX, pageH - 7.5);
            doc.text(`Halaman ${p} dari ${totalPages}`, pageW - marginX, pageH - 7.5, { align: 'right' });
        }

        const safeName = studentName.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Siswa';
        const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Periode';
        doc.save(`Laporan_Wali_360_${safeName}_${safePeriod}.pdf`);
        showToast('📄 Laporan PDF 360° Guru Wali lengkap dengan grafik berhasil diunduh!');
    } catch (err) {
        console.error('Print Wali 360 PDF Error:', err);
        showToast('Gagal mencetak PDF 360°: ' + (err?.message || err), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = prevBtnHtml;
        }
    }
}

async function exportWaliOverviewPDF() {
    if (!(await ensureJsPdfLoaded())) return;

    const q = (document.getElementById('wali-search-input')?.value || '').toLowerCase().trim();
    const filterEws = document.getElementById('wali-filter-ews')?.value || 'all';
    const allBinaan = allStudentsGlobal.filter(s => binaanIdsCache.has(Number(s.id)));
    const list = allBinaan.filter(s => {
        const m = waliMetricsCache[Number(s.id)] || { ews: 'aman' };
        return (!q || s.nama.toLowerCase().includes(q) || (s.classes?.nama_kelas || '').toLowerCase().includes(q)) && (filterEws === 'all' || m.ews === filterEws);
    });

    if (!list.length) {
        return showToast('Belum ada data siswa binaan yang bisa diekspor.', 'error');
    }

    const btn = document.getElementById('btn-export-wali-pdf');
    const prevBtnHtml = btn ? btn.innerHTML : '';
    if (btn) {
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i><span>Menyusun PDF...</span>`;
    }

    try {
        await new Promise(resolve => setTimeout(resolve, 40));

        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
        const pageW = doc.internal.pageSize.getWidth();
        const pageH = doc.internal.pageSize.getHeight();
        const marginX = 14;
        const contentW = pageW - marginX * 2;

        const guruWaliName = pdfSanitizeText(currentUser?.nama_lengkap || 'Guru Wali');
        const periodLabel = pdfSanitizeText(activePeriodName || currentDatePeriodName || '-');
        const printedAt = new Date().toLocaleString('id-ID', {
            day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit'
        });

        let cntAman = 0, cntWaspada = 0, cntKritis = 0;
        let totH = 0, totS = 0, totI = 0, totA = 0;
        let sumAtt = 0, sumAvgNilai = 0, gradedCount = 0, totalPending = 0, stuWithPending = 0;
        const classSet = new Set();

        const rowsData = list.map((s, idx) => {
            const m = waliMetricsCache[Number(s.id)] || { h: 0, s: 0, i: 0, a: 0, attRate: 100, pendingTasks: [], avgFinalAllSubjects: 0, hasAnySubjectData: false, ews: 'aman' };
            if (m.ews === 'kritis') cntKritis++;
            else if (m.ews === 'waspada') cntWaspada++;
            else cntAman++;

            totH += m.h || 0; totS += m.s || 0; totI += m.i || 0; totA += m.a || 0;
            sumAtt += Number(m.attRate ?? 100);
            if (m.hasAnySubjectData) {
                sumAvgNilai += Number(m.avgFinalAllSubjects || 0);
                gradedCount++;
            }
            const pendCnt = (m.pendingTasks || []).length;
            totalPending += pendCnt;
            if (pendCnt > 0) stuWithPending++;
            if (s.classes?.nama_kelas) classSet.add(s.classes.nama_kelas);

            return {
                no: idx + 1,
                nisn: pdfSanitizeText(s.nisn || '-'),
                nama: pdfSanitizeText(s.nama || '-'),
                kelas: pdfSanitizeText(s.classes?.nama_kelas || '-'),
                attRate: Number(m.attRate ?? 100),
                pending: pendCnt,
                avgNilai: m.hasAnySubjectData ? Number(m.avgFinalAllSubjects || 0) : null,
                ews: m.ews || 'aman'
            };
        });

        const n = rowsData.length;
        const avgAttAll = n ? (sumAtt / n) : 100;
        const avgNilaiAll = gradedCount ? (sumAvgNilai / gradedCount) : 0;
        const totLogs = totH + totS + totI + totA;

        // ---- RENDER 2 GRAFIK OFFSCREEN RESOLUSI TINGGI ----
        // Chart 1: Distribusi Status EWS (Doughnut)
        const ewsDonutImg = renderOffscreenChartDataUrl(500, 290, () => ({
            type: 'doughnut',
            data: {
                labels: [
                    `Aman (${cntAman})`,
                    `Waspada (${cntWaspada})`,
                    `Kritis (${cntKritis})`
                ],
                datasets: [{
                    data: [cntAman, cntWaspada, cntKritis],
                    backgroundColor: ['#10b981', '#f59e0b', '#f43f5e'],
                    borderColor: '#ffffff',
                    borderWidth: 2
                }]
            },
            options: {
                cutout: '64%',
                layout: { padding: { top: 8, bottom: 8, left: 6, right: 12 } },
                plugins: {
                    legend: {
                        position: 'right',
                        labels: { color: '#1e293b', boxWidth: 14, padding: 14, font: { size: 13, weight: 'bold' } }
                    }
                }
            },
            plugins: [{
                id: 'ewsCenterCount',
                afterDraw(chart) {
                    const meta = chart.getDatasetMeta(0);
                    if (!meta?.data?.[0]) return;
                    const { x, y } = meta.data[0];
                    const c = chart.ctx;
                    c.save();
                    c.textAlign = 'center';
                    c.textBaseline = 'middle';
                    c.fillStyle = '#0f172a';
                    c.font = 'bold 24px Helvetica, Arial, sans-serif';
                    c.fillText(`${n}`, x, y - 7);
                    c.fillStyle = '#64748b';
                    c.font = 'bold 11px Helvetica, Arial, sans-serif';
                    c.fillText('Binaan', x, y + 14);
                    c.restore();
                }
            }]
        }));

        // Chart 2: Distribusi Capaian Nilai & Kehadiran Siswa Binaan
        let perfChartTitle = 'Perbandingan Kehadiran & Nilai Binaan';
        let perfChartImg = '';
        if (n <= 10) {
            const pLabels = rowsData.map(r => {
                const first = r.nama.split(' ')[0];
                return first.length > 10 ? first.slice(0, 9) + '.' : first;
            });
            perfChartImg = renderOffscreenChartDataUrl(520, 290, () => ({
                type: 'bar',
                data: {
                    labels: pLabels,
                    datasets: [
                        { label: 'Kehadiran (%)', data: rowsData.map(r => Number(r.attRate.toFixed(0))), backgroundColor: '#10b981', borderRadius: 5 },
                        { label: 'Rata2 Nilai', data: rowsData.map(r => r.avgNilai !== null ? Number(r.avgNilai.toFixed(1)) : 0), backgroundColor: '#4f46e5', borderRadius: 5 }
                    ]
                },
                options: {
                    layout: { padding: { top: 14, bottom: 6, left: 4, right: 10 } },
                    scales: {
                        x: { ticks: { color: '#334155', font: { size: 10, weight: 'bold' } }, grid: { display: false } },
                        y: { min: 0, max: 100, ticks: { color: '#475569', stepSize: 25, font: { size: 10 } }, grid: { color: '#e2e8f0' } }
                    },
                    plugins: {
                        legend: { position: 'top', labels: { color: '#334155', boxWidth: 10, font: { size: 10, weight: 'bold' } } }
                    }
                }
            }));
        } else {
            perfChartTitle = 'Distribusi Rentang Nilai Rata-rata Binaan';
            const buckets = [
                { label: '< 75 (Remedial)', count: rowsData.filter(r => r.avgNilai !== null && r.avgNilai < 75).length, color: '#f43f5e' },
                { label: '75 - 84 (Baik)', count: rowsData.filter(r => r.avgNilai !== null && r.avgNilai >= 75 && r.avgNilai < 85).length, color: '#3b82f6' },
                { label: '85 - 100 (Unggul)', count: rowsData.filter(r => r.avgNilai !== null && r.avgNilai >= 85).length, color: '#10b981' },
                { label: 'Belum Dinilai', count: rowsData.filter(r => r.avgNilai === null).length, color: '#94a3b8' }
            ];
            perfChartImg = renderOffscreenChartDataUrl(520, 290, () => ({
                type: 'bar',
                data: {
                    labels: buckets.map(b => b.label),
                    datasets: [{
                        label: 'Jumlah Siswa',
                        data: buckets.map(b => b.count),
                        backgroundColor: buckets.map(b => b.color),
                        borderRadius: 7,
                        maxBarThickness: 50
                    }]
                },
                options: {
                    layout: { padding: { top: 22, bottom: 6, left: 6, right: 10 } },
                    scales: {
                        x: { ticks: { color: '#334155', font: { size: 10, weight: 'bold' } }, grid: { display: false } },
                        y: { beginAtZero: true, ticks: { color: '#475569', precision: 0, font: { size: 10 } }, grid: { color: '#e2e8f0' } }
                    },
                    plugins: { legend: { display: false } }
                },
                plugins: [{
                    id: 'waliBucketLabels',
                    afterDatasetsDraw(chart) {
                        const c = chart.ctx;
                        const meta = chart.getDatasetMeta(0);
                        c.save();
                        c.fillStyle = '#0f172a';
                        c.font = 'bold 12px Helvetica, Arial, sans-serif';
                        c.textAlign = 'center';
                        c.textBaseline = 'bottom';
                        meta.data.forEach((bar, idx) => {
                            c.fillText(`${buckets[idx].count}`, bar.x, bar.y - 4);
                        });
                        c.restore();
                    }
                }]
            }));
        }

        // ==================== HEADER BANNER ====================
        doc.setFillColor(49, 46, 129);
        doc.rect(0, 0, pageW, 34, 'F');
        doc.setFillColor(99, 102, 241);
        doc.rect(0, 34, pageW, 1.8, 'F');

        doc.setTextColor(199, 210, 254);
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.text('PANTAUBELAJAR  |  PEMBIMBINGAN AKADEMIK (GURU WALI)', marginX, 11);

        doc.setTextColor(255, 255, 255);
        doc.setFontSize(14.5);
        doc.text('LAPORAN RINGKASAN SISWA BINAAN GURU WALI', marginX, 19);

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(9.2);
        doc.setTextColor(224, 231, 255);
        doc.text(`Guru Wali: ${guruWaliName}   |   Total Binaan: ${n} Siswa (${classSet.size || 1} Kelas)`, marginX, 27);

        doc.setFontSize(8.3);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(255, 255, 255);
        doc.text(`Periode: ${periodLabel}`, pageW - marginX, 12.5, { align: 'right' });
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(224, 231, 255);
        doc.text(`Dicetak: ${printedAt}`, pageW - marginX, 19.5, { align: 'right' });

        let curY = 42;

        if (q || filterEws !== 'all') {
            doc.setFillColor(254, 243, 199);
            doc.setDrawColor(245, 158, 11);
            doc.roundedRect(marginX, curY, contentW, 7.2, 2, 2, 'FD');
            doc.setTextColor(146, 64, 14);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.8);
            const filterDesc = [
                filterEws !== 'all' ? `Status EWS: ${filterEws.toUpperCase()}` : '',
                q ? `Pencarian: "${pdfSanitizeText(q)}"` : ''
            ].filter(Boolean).join('  |  ');
            doc.text(`Filter Aktif: ${filterDesc} (Menampilkan ${n} dari ${allBinaan.length} siswa binaan)`, marginX + 3, curY + 4.7);
            curY += 10;
        }

        // ---- 4 KARTU KPI KOLEKTIF ----
        const cardGap = 3.5;
        const cardW = (contentW - cardGap * 3) / 4;
        const cardH = 25;

        const drawOverviewKpi = (idx, accentRgb, title, bigVal, valRgb, footerFn) => {
            const x = marginX + idx * (cardW + cardGap);
            doc.setFillColor(255, 255, 255);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.35);
            doc.roundedRect(x, curY, cardW, cardH, 2.5, 2.5, 'FD');
            doc.setFillColor(...accentRgb);
            doc.roundedRect(x, curY, cardW, 2.2, 1.5, 1.5, 'F');
            doc.rect(x, curY + 1.1, cardW, 1.1, 'F');

            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.2);
            doc.setTextColor(100, 116, 139);
            doc.text(title, x + 3, curY + 7);

            doc.setFontSize(14);
            doc.setTextColor(...valRgb);
            doc.text(bigVal, x + 3, curY + 14.5);

            footerFn(x + 3, curY + 17.2, cardW - 6);
        };

        drawOverviewKpi(0, [79, 70, 229], 'TOTAL SISWA BINAAN', `${n} Siswa`, [15, 23, 42], (fx, fy) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(5, 150, 105);
            doc.text(`Aman:${cntAman}  Waspada:${cntWaspada}  Kritis:${cntKritis}`, fx, fy + 4);
        });

        drawOverviewKpi(1, [16, 185, 129], 'RATA-RATA KEHADIRAN', `${avgAttAll.toFixed(1)}%`, [5, 150, 105], (fx, fy, fw) => {
            doc.setFillColor(226, 232, 240);
            doc.roundedRect(fx, fy, fw, 2, 1, 1, 'F');
            if (totLogs > 0) {
                const segs = [
                    { v: totH, c: [16, 185, 129] },
                    { v: totS, c: [245, 158, 11] },
                    { v: totI, c: [59, 130, 246] },
                    { v: totA, c: [244, 63, 94] }
                ];
                let sx = fx;
                segs.forEach(sg => {
                    const w2 = (sg.v / totLogs) * fw;
                    if (w2 > 0.2) { doc.setFillColor(...sg.c); doc.rect(sx, fy, w2, 2, 'F'); sx += w2; }
                });
            }
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(100, 116, 139);
            doc.text(`H:${totH}  S:${totS}  I:${totI}  A:${totA}`, fx, fy + 5.4);
        });

        drawOverviewKpi(2, [37, 99, 235], 'RATA-RATA NILAI MAPEL', gradedCount > 0 ? avgNilaiAll.toFixed(1) : '-', [37, 99, 235], (fx, fy) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(71, 85, 105);
            doc.text(`${gradedCount}/${n} siswa memiliki nilai`, fx, fy + 4);
        });

        drawOverviewKpi(3, [225, 29, 72], 'TOTAL TUNGGAKAN TUGAS', `${totalPending} Tugas`, totalPending > 0 ? [190, 18, 60] : [5, 150, 105], (fx, fy) => {
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(6.8);
            doc.setTextColor(100, 116, 139);
            doc.text(totalPending > 0 ? `Pada ${stuWithPending} siswa binaan` : 'Semua binaan tuntas tugas', fx, fy + 4);
        });

        curY += cardH + 6;

        // ---- 2 GRAFIK VISUAL SIDE-BY-SIDE ----
        const halfW = (contentW - 4) / 2;
        const chartH = 56;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.8);
        doc.setTextColor(15, 23, 42);
        doc.text('VISUALISASI STATUS EARLY WARNING SYSTEM (EWS) & PERFORMA', marginX, curY);
        curY += 3.5;

        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, curY, halfW, chartH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.3);
        doc.setTextColor(30, 41, 59);
        doc.text('Distribusi Status EWS Binaan', marginX + 3.5, curY + 5.6);
        doc.addImage(ewsDonutImg, 'PNG', marginX + 2, curY + 7.2, halfW - 4, chartH - 9, undefined, 'FAST');

        const rightX = marginX + halfW + 4;
        doc.setFillColor(255, 255, 255);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(rightX, curY, halfW, chartH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.3);
        doc.setTextColor(30, 41, 59);
        doc.text(perfChartTitle, rightX + 3.5, curY + 5.6);
        doc.addImage(perfChartImg, 'PNG', rightX + 2, curY + 7.2, halfW - 4, chartH - 9, undefined, 'FAST');

        curY += chartH + 5;

        // ---- BAR VISUAL DISTRIBUSI EWS ----
        const barBoxH = 21;
        doc.setFillColor(248, 250, 252);
        doc.setDrawColor(226, 232, 240);
        doc.roundedRect(marginX, curY, contentW, barBoxH, 2.5, 2.5, 'FD');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8.2);
        doc.setTextColor(30, 41, 59);
        doc.text('Proporsi Kategori Pantauan EWS', marginX + 3.5, curY + 5.6);

        const bx = marginX + 3.5;
        const by = curY + 8.2;
        const bw = contentW - 7;
        doc.setFillColor(226, 232, 240);
        doc.roundedRect(bx, by, bw, 4.2, 1.5, 1.5, 'F');
        let sx = bx;
        [
            { v: cntAman, c: [16, 185, 129] },
            { v: cntWaspada, c: [245, 158, 11] },
            { v: cntKritis, c: [244, 63, 94] }
        ].forEach(sg => {
            const w2 = n ? (sg.v / n) * bw : 0;
            if (w2 > 0.3) { doc.setFillColor(...sg.c); doc.rect(sx, by, w2, 4.2, 'F'); sx += w2; }
        });

        const ly = curY + 17.5;
        const drawLeg = (lx, rgb, txt) => {
            doc.setFillColor(...rgb);
            doc.circle(lx + 1.5, ly - 1, 1.3, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(51, 65, 85);
            doc.text(txt, lx + 4.2, ly);
        };
        drawLeg(marginX + 3.5, [16, 185, 129], `Status Aman: ${cntAman} siswa (${Math.round((cntAman / n) * 100)}%)`);
        drawLeg(marginX + 66, [245, 158, 11], `Perlu Pantauan: ${cntWaspada} siswa (${Math.round((cntWaspada / n) * 100)}%)`);
        drawLeg(marginX + 130, [244, 63, 94], `Prioritas Kritis: ${cntKritis} siswa (${Math.round((cntKritis / n) * 100)}%)`);

        curY += barBoxH + 6;

        // ---- TABEL LENGKAP SISWA BINAAN ----
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(9.8);
        doc.setTextColor(15, 23, 42);
        doc.text(`DAFTAR MONITORING SISWA BINAAN (${n} Siswa)`, marginX, curY);
        curY += 3;

        doc.autoTable({
            startY: curY,
            margin: { left: marginX, right: marginX, bottom: 18 },
            head: [['No', 'NISN', 'Nama Siswa', 'Kelas', 'Kehadiran', 'Tunggakan', 'Rata2', 'Status EWS']],
            body: rowsData.map(r => [
                r.no,
                r.nisn,
                r.nama,
                r.kelas,
                `${r.attRate.toFixed(0)}%`,
                `${r.pending} Tugas`,
                r.avgNilai !== null ? r.avgNilai.toFixed(1) : '-',
                r.ews === 'kritis' ? 'KRITIS' : r.ews === 'waspada' ? 'WASPADA' : 'AMAN'
            ]),
            theme: 'grid',
            headStyles: { fillColor: [49, 46, 129], textColor: 255, fontSize: 7.8, fontStyle: 'bold' },
            styles: { fontSize: 7.6, cellPadding: 2.3, textColor: [30, 41, 59], lineColor: [226, 232, 240] },
            alternateRowStyles: { fillColor: [248, 250, 252] },
            columnStyles: {
                0: { halign: 'center', cellWidth: 9 },
                1: { cellWidth: 24 },
                2: { cellWidth: 42, fontStyle: 'bold' },
                3: { halign: 'center', cellWidth: 20 },
                4: { halign: 'right', cellWidth: 28, fontStyle: 'bold' },
                5: { halign: 'center', cellWidth: 17 },
                6: { halign: 'center', cellWidth: 16, fontStyle: 'bold', textColor: [29, 78, 216] },
                7: { halign: 'center', cellWidth: 26, fontStyle: 'bold' }
            },
            didParseCell(data) {
                if (data.section === 'body' && data.column.index === 7) {
                    const v = data.cell.raw;
                    if (v === 'AMAN') {
                        data.cell.styles.fillColor = [209, 250, 229];
                        data.cell.styles.textColor = [6, 95, 70];
                    } else if (v === 'WASPADA') {
                        data.cell.styles.fillColor = [254, 243, 199];
                        data.cell.styles.textColor = [146, 64, 14];
                    } else {
                        data.cell.styles.fillColor = [254, 226, 226];
                        data.cell.styles.textColor = [159, 18, 57];
                    }
                }
            },
            didDrawCell(data) {
                if (data.section === 'body' && data.column.index === 4) {
                    const pct = rowsData[data.row.index]?.attRate || 0;
                    const cell = data.cell;
                    const bx2 = cell.x + 2;
                    const by2 = cell.y + cell.height / 2 - 1.3;
                    const bw2 = Math.max(7, cell.width - 13);
                    doc.setFillColor(226, 232, 240);
                    doc.roundedRect(bx2, by2, bw2, 2.6, 1, 1, 'F');
                    if (pct > 0) {
                        const rgb = pct >= 90 ? [16, 185, 129] : pct >= 80 ? [245, 158, 11] : [244, 63, 94];
                        doc.setFillColor(...rgb);
                        doc.roundedRect(bx2, by2, (Math.min(100, pct) / 100) * bw2, 2.6, 1, 1, 'F');
                    }
                }
            }
        });

        curY = (doc.lastAutoTable?.finalY || curY + 20) + 10;

        // ---- BLOK PENGESAHAN GURU WALI ----
        if (curY > pageH - 36) {
            doc.addPage();
            curY = 22;
        }
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.setTextColor(71, 85, 105);
        doc.text(`Dicetak melalui PantauBelajar pada ${printedAt}`, marginX, curY + 4);
        doc.text('Mengetahui,', pageW - marginX - 55, curY + 2);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text('Guru Wali (PA),', pageW - marginX - 55, curY + 7);
        doc.setDrawColor(148, 163, 184);
        doc.line(pageW - marginX - 55, curY + 23, pageW - marginX, curY + 23);
        doc.text(guruWaliName, pageW - marginX - 55, curY + 27.5);

        // ---- FOOTER NOMOR HALAMAN ----
        const totalPages = doc.internal.getNumberOfPages();
        for (let p = 1; p <= totalPages; p++) {
            doc.setPage(p);
            doc.setDrawColor(226, 232, 240);
            doc.setLineWidth(0.3);
            doc.line(marginX, pageH - 12, pageW - marginX, pageH - 12);
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(7.5);
            doc.setTextColor(100, 116, 139);
            doc.text(`PantauBelajar  |  Ringkasan Siswa Binaan Guru Wali (${guruWaliName}) - ${periodLabel}`, marginX, pageH - 7.5);
            doc.text(`Halaman ${p} dari ${totalPages}`, pageW - marginX, pageH - 7.5, { align: 'right' });
        }

        const safePeriod = periodLabel.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '') || 'Periode';
        doc.save(`Ringkasan_Guru_Wali_${safePeriod}.pdf`);
        showToast('📄 Laporan Ringkasan PDF Guru Wali lengkap dengan grafik berhasil diunduh!');
    } catch (err) {
        console.error('Export Wali Overview PDF Error:', err);
        showToast('Gagal mengekspor PDF Guru Wali: ' + (err?.message || err), 'error');
    } finally {
        if (btn) {
            btn.disabled = false;
            btn.innerHTML = prevBtnHtml;
        }
    }
}

async function exportWaliBinaanExcel() {
    if (!(await ensureXlsxLoaded())) return;
    const list = allStudentsGlobal.filter(s => binaanIdsCache.has(Number(s.id)));
    const rows = list.map((s, i) => {
        const m = waliMetricsCache[Number(s.id)] || { attRate: 100, pendingTasks: [], avgFinalAllSubjects: 0, ews: 'aman' };
        return { No: i + 1, NISN: s.nisn, Nama: s.nama, Kelas: s.classes?.nama_kelas || '-', Periode: activePeriodName, Kehadiran_Pct: Number(m.attRate.toFixed(1)), Tunggakan_Tugas: m.pendingTasks.length, Rata2_Nilai: Number(m.avgFinalAllSubjects.toFixed(1)), Status_EWS: m.ews.toUpperCase() };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Siswa_Binaan');
    XLSX.writeFile(wb, `Laporan_Siswa_Binaan_${activePeriodName}.xlsx`);
}

// ==================== 11. PENGATURAN BOBOT, KKM & API KEY GEMINI MANDIRI ====================
function populateSettingsForm() {
    const amp = getActiveAmpuan();
    if (!amp) return;
    document.getElementById('set-mapel').value = amp.mapel || '';
    document.getElementById('set-kkm').value = amp.kkm ?? 75;
    document.getElementById('set-wabsen').value = amp.w_absen ?? 10;
    document.getElementById('set-wtugas').value = amp.w_tugas ?? 30;
    document.getElementById('set-wbab').value = amp.w_bab ?? 30;
    document.getElementById('set-wuas').value = amp.w_uas ?? 30;
    document.getElementById('set-phadir').value = amp.p_hadir ?? 100;
    document.getElementById('set-psakit').value = amp.p_sakit ?? 80;
    document.getElementById('set-pizin').value = amp.p_izin ?? 80;
    document.getElementById('set-palpa').value = amp.p_alpa ?? 0;
}

async function saveSettings(e) {
    e.preventDefault();
    const amp = getActiveAmpuan();
    if (!amp) return;
    await db.from('teacher_settings').update({
        mapel: document.getElementById('set-mapel').value.trim(),
        kkm: Number(document.getElementById('set-kkm').value),
        w_absen: Number(document.getElementById('set-wabsen').value),
        w_tugas: Number(document.getElementById('set-wtugas').value),
        w_bab: Number(document.getElementById('set-wbab').value),
        w_uas: Number(document.getElementById('set-wuas').value),
        p_hadir: Number(document.getElementById('set-phadir').value),
        p_sakit: Number(document.getElementById('set-psakit').value),
        p_izin: Number(document.getElementById('set-pizin').value),
        p_alpa: Number(document.getElementById('set-palpa').value)
    }).eq('id', amp.id);
    showToast('✅ Pengaturan berhasil disimpan!');
    await loadTeacherAmpuan();
}

function updateGeminiKeyUI() {
    const badgeEl = document.getElementById('gemini-key-status-badge');
    const inpEl = document.getElementById('gemini-api-key-input');
    const btnWrap = document.getElementById('gemini-key-action-buttons');
    if (!badgeEl || !btnWrap || !currentUser) return;

    const hasKey = Boolean(currentUser.gemini_api_key && currentUser.gemini_api_key.trim() !== '');
    if (hasKey) {
        const masked = currentUser.gemini_api_key.slice(0, 6) + '••••••••••••••••••••';
        if (inpEl) inpEl.placeholder = `Kunci Aktif: ${masked} (tempel kunci baru untuk mengganti)`;
        badgeEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">✅ AI Mandiri Aktif</span>`;
        btnWrap.innerHTML = `
            <a href="https://aistudio.google.com/apikey" target="_blank" class="px-3 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold inline-flex items-center gap-1">🔑 AI Studio ↗</a>
            <button type="button" id="btn-save-gemini-key" onclick="saveAndTestTeacherGeminiKey()" class="px-3.5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold">Perbarui Kunci</button>
            <button type="button" onclick="removeTeacherGeminiKey()" class="px-3 py-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/60 text-rose-600 border border-rose-200 dark:border-rose-800 font-bold">Hapus</button>
        `;
    } else {
        if (inpEl) inpEl.placeholder = 'Tempel API Key Gemini Anda (contoh: AIzaSy...)';
        badgeEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">⚪ Belum Diatur</span>`;
        btnWrap.innerHTML = `
            <a href="https://aistudio.google.com/apikey" target="_blank" class="px-3.5 py-2.5 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-800 dark:text-slate-200 font-bold inline-flex items-center gap-1.5">🔑 Dapatkan API Key ↗</a>
            <button type="button" id="btn-save-gemini-key" onclick="saveAndTestTeacherGeminiKey()" class="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold shadow-sm">Simpan & Uji Koneksi</button>
        `;
    }
    if (typeof refreshGuruChatConnectionState === 'function') refreshGuruChatConnectionState();
}

async function saveAndTestTeacherGeminiKey() {
    const inp = document.getElementById('gemini-api-key-input');
    const btn = document.getElementById('btn-save-gemini-key');
    const rawKey = inp?.value.trim() || '';
    if (!rawKey) return showToast('Silakan tempel API Key Gemini terlebih dahulu!', 'error');

    if (btn) { btn.disabled = true; btn.innerText = '⏳ Menguji koneksi...'; }
    try {
        const { data, error } = await db.functions.invoke('ai-advisor', {
            body: { action: 'save_and_test_key', teacher_id: currentUser.id, api_key: rawKey }
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'API Key tidak valid.');

        currentUser.gemini_api_key = rawKey;
        localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
        inp.value = '';
        updateGeminiKeyUI();
        showToast(`✅ API Key Gemini valid & aktif (Model: ${data.model})!`);
    } catch (err) {
        showToast('❌ Gagal verifikasi API Key: ' + err.message, 'error');
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = 'Simpan & Uji Koneksi'; }
    }
}

async function removeTeacherGeminiKey() {
    const ok = await showAppConfirm('Hapus API Key Gemini pribadi dari akun Anda?', {
        title: 'Hapus API Key Gemini',
        confirmText: 'Hapus Kunci',
        tone: 'danger'
    });
    if (!ok) return;
    await db.functions.invoke('ai-advisor', {
        body: { action: 'remove_key', teacher_id: currentUser.id }
    });
    currentUser.gemini_api_key = null;
    localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
    updateGeminiKeyUI();
    showToast('API Key Gemini pribadi dihapus.');
}

// ==================== 12. INTEGRASI OAUTH GOOGLE DRIVE GURU ====================
function getGoogleRedirectUri() {
    let base = window.location.origin + window.location.pathname;
    if (base.endsWith('/')) base += 'index.html';
    return base;
}

function connectGoogleDrive() {
    if (!currentUser) return showToast('Silakan login terlebih dahulu!', 'error');
    const redirectUri = getGoogleRedirectUri();
    const scope = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/userinfo.email';
    window.location.href = `https://accounts.google.com/o/oauth2/v2/auth?client_id=${encodeURIComponent(GOOGLE_OAUTH_CLIENT_ID)}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=${encodeURIComponent(scope)}&access_type=offline&prompt=consent&state=${encodeURIComponent(String(currentUser.id))}`;
}

async function handleGoogleOAuthCallback() {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('code');
    const stateTeacherId = params.get('state');
    if (!code || !stateTeacherId) return;

    window.history.replaceState({}, document.title, getGoogleRedirectUri());
    showToast('⏳ Menghubungkan akun Google Drive Anda...');

    try {
        const { data, error } = await db.functions.invoke('gdrive-bridge', {
            body: { action: 'exchange_code', code, redirect_uri: getGoogleRedirectUri(), teacher_id: Number(stateTeacherId) }
        });
        if (error || !data?.success) throw new Error(data?.error || error?.message || 'Gagal verifikasi akun Google.');

        if (currentUser && String(currentUser.id) === String(stateTeacherId)) {
            currentUser.gdrive_email = data.email;
            localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
        }
        updateGDriveConnectionUI();
        switchGuruTab('bobot');
        showToast(`✅ Google Drive (${data.email}) berhasil terhubung!`);
    } catch (err) {
        showToast('❌ Gagal menghubungkan Google Drive: ' + err.message, 'error');
    }
}

async function disconnectGoogleDrive() {
    if (!currentUser) return;
    const ok = await showAppConfirm('Putuskan koneksi Google Drive dari akun guru Anda? Pengunggahan file siswa tidak akan masuk ke Drive sampai dihubungkan kembali.', {
        title: 'Putuskan Google Drive',
        confirmText: 'Putuskan Koneksi',
        tone: 'danger'
    });
    if (!ok) return;
    const { data, error } = await db.functions.invoke('gdrive-bridge', { body: { action: 'disconnect', teacher_id: currentUser.id } });
    if (error || !data?.success) return showToast('Gagal memutuskan koneksi: ' + (data?.error || error?.message), 'error');
    currentUser.gdrive_email = null;
    localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
    updateGDriveConnectionUI();
    showToast('Koneksi Google Drive telah diputuskan.');
}

function updateGDriveConnectionUI() {
    const badgeEl = document.getElementById('gdrive-status-badge');
    const btnContainer = document.getElementById('gdrive-action-buttons');
    if (!badgeEl || !btnContainer || !currentUser) return;

    if (currentUser.gdrive_email) {
        badgeEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">✅ Terhubung: ${currentUser.gdrive_email}</span>`;
        btnContainer.innerHTML = `<button type="button" onclick="connectGoogleDrive()" class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 text-xs font-bold transition">🔄 Ganti Akun</button><button type="button" onclick="disconnectGoogleDrive()" class="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 hover:bg-rose-100 text-rose-600 border border-rose-200 dark:border-rose-800 text-xs font-bold transition">Putuskan</button>`;
    } else {
        badgeEl.innerHTML = `<span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">⚪ Belum Terhubung</span>`;
        btnContainer.innerHTML = `<button type="button" onclick="connectGoogleDrive()" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-2"><i class="fa-brands fa-google"></i> Hubungkan Google Drive</button>`;
    }
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.className = `fixed bottom-20 lg:bottom-5 right-4 lg:right-5 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg text-white transition-all duration-300 ${type === 'error' ? 'bg-rose-600' : 'bg-slate-900 dark:bg-blue-600'}`;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3500);
}

// ==================== 13. CHATBOT ASISTEN AI GEMINI (DASHBOARD GURU) ====================
let guruChatHistory = [];
let guruChatAbortController = null;
let guruChatIsStreaming = false;
let guruChatInitialized = false;
let guruChatReplyStore = {};
let guruChatReplySeq = 0;

function hasTeacherPersonalGeminiKey() {
    return Boolean(currentUser?.id && currentUser?.gemini_api_key && String(currentUser.gemini_api_key).trim() !== '');
}

function openTeacherGeminiSettingsFromChat() {
    toggleGuruAiChat(false);
    if (typeof switchGuruTab === 'function') switchGuruTab('bobot');
    setTimeout(() => {
        const badge = document.getElementById('gemini-key-status-badge');
        const card = badge?.closest('.bg-white') || badge;
        if (card && typeof card.scrollIntoView === 'function') {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-950');
            setTimeout(() => card.classList.remove('ring-2', 'ring-indigo-500', 'ring-offset-2', 'dark:ring-offset-slate-950'), 2400);
        }
        document.getElementById('gemini-api-key-input')?.focus();
    }, 140);
}

function updateGuruChatContextBadge() {
    const el = document.getElementById('guru-chat-context-label');
    if (!el) return;
    if (!hasTeacherPersonalGeminiKey()) {
        el.innerText = '⚠️ Belum terhubung ke Gemini pribadi';
        return;
    }
    const cls = classesCache.find(c => Number(c.id) === Number(activeClassId));
    const amp = getActiveAmpuan();
    if (!cls || !amp) {
        el.innerText = '✨ Gemini Pribadi • Pilih kelas & mapel';
        return;
    }
    el.innerText = `✨ Gemini Pribadi • ${cls.nama_kelas} • ${amp.mapel} • ${studentsCache.length} Siswa`;
}

function refreshGuruChatConnectionState() {
    updateGuruChatContextBadge();
    const connected = hasTeacherPersonalGeminiKey();
    const input = document.getElementById('guru-chat-input');
    const sendBtn = document.getElementById('btn-guru-chat-send');
    const quickWrap = document.getElementById('guru-chat-quick-prompts');

    if (input) {
        input.disabled = guruChatIsStreaming || !connected;
        input.placeholder = connected
            ? 'Tanya statistik kelas, tugas, atau saran bimbingan siswa...'
            : 'Hubungkan Gemini pribadi di menu Pengaturan terlebih dahulu...';
    }
    if (sendBtn) {
        sendBtn.disabled = !connected;
        sendBtn.classList.toggle('opacity-50', !connected);
        sendBtn.classList.toggle('cursor-not-allowed', !connected);
    }
    if (quickWrap) {
        quickWrap.classList.toggle('opacity-60', !connected);
    }
    if (guruChatInitialized && guruChatHistory.length === 0) {
        renderGuruChatWelcome();
    }
}

function buildGuruDashboardChatContext() {
    const cls = classesCache.find(c => Number(c.id) === Number(activeClassId));
    const amp = getActiveAmpuan();
    const kkm = Number(amp?.kkm || 75);

    if (!activeClassId || !cls || !amp) {
        return {
            status: 'belum_ada_kelas_aktif',
            guru: currentUser?.nama_lengkap || 'Guru',
            periode: activePeriodName || currentDatePeriodName || '-'
        };
    }

    let sumAttRate = 0, sumFinal = 0, sumDoneTasks = 0, sumTotalTasks = 0;
    let totalH = 0, totalS = 0, totalI = 0, totalA = 0;
    let tuntasCount = 0;

    const studentDetails = studentsCache.map(s => {
        const m = computeStudentMetrics(s.id);
        sumAttRate += m.attRate;
        sumFinal += m.finalScore;
        sumDoneTasks += m.doneTasks;
        sumTotalTasks += m.totalTasks;
        totalH += m.h;
        totalS += m.s;
        totalI += m.i;
        totalA += m.a;
        const isTuntas = m.finalScore >= m.kkm;
        if (isTuntas) tuntasCount++;

        const missingTasks = Math.max(0, m.totalTasks - m.doneTasks);
        const needsAttention = !isTuntas || m.attRate < 85 || missingTasks > 0;

        return {
            nama: s.nama,
            nisn: s.nisn,
            kehadiranPct: Number(m.attRate.toFixed(1)),
            hadir: m.h,
            sakit: m.s,
            izin: m.i,
            alpa: m.a,
            tugasSelesai: m.doneTasks,
            totalTugas: m.totalTasks,
            tunggakanTugas: missingTasks,
            rataTugas: Number(m.avgTugas.toFixed(1)),
            rataUjianBab: Number(m.avgBab.toFixed(1)),
            rataUjianSemester: Number(m.avgSmt.toFixed(1)),
            nilaiAkhir: Number(m.finalScore.toFixed(1)),
            status: isTuntas ? 'TUNTAS' : 'PERLU_BIMBINGAN',
            needsAttention
        };
    });

    const nStu = studentDetails.length;
    const avgAttRate = nStu ? Number((sumAttRate / nStu).toFixed(1)) : 100;
    const avgFinal = nStu ? Number((sumFinal / nStu).toFixed(1)) : 0;
    const taskCompletionPct = sumTotalTasks ? Number(((sumDoneTasks / sumTotalTasks) * 100).toFixed(1)) : 0;

    const assIdsSet = new Set(assessmentsCache.map(a => Number(a.id)));
    const pendingReviewCount = scoresCache.filter(sc =>
        assIdsSet.has(Number(sc.assessment_id)) &&
        (sc.status_pengajuan === 'pending' || ((sc.status_kumpul === true || sc.status_pengajuan === 'approved') && !hasFilledScore(sc)))
    ).length;

    const daftarPenilaian = assessmentsCache.slice(0, 15).map(a => {
        const relScores = scoresCache.filter(sc => Number(sc.assessment_id) === Number(a.id));
        const submittedCount = relScores.filter(sc => sc.status_kumpul === true || sc.status_pengajuan === 'approved' || hasFilledScore(sc)).length;
        const gradedScores = relScores.filter(sc => hasFilledScore(sc)).map(sc => Number(sc.nilai));
        const avgScore = gradedScores.length ? Number((gradedScores.reduce((acc, v) => acc + v, 0) / gradedScores.length).toFixed(1)) : null;
        return {
            judul: a.judul,
            kategori: getKategoriLabel(a.kategori),
            tenggat: a.deadline || null,
            terkumpul: submittedCount,
            belumKumpul: Math.max(0, nStu - submittedCount),
            rataRataNilai: avgScore
        };
    });

    const siswaPrioritasBimbingan = studentDetails
        .filter(s => s.needsAttention)
        .sort((a, b) => a.nilaiAkhir - b.nilaiAkhir || b.tunggakanTugas - a.tunggakanTugas)
        .slice(0, 20)
        .map(({ needsAttention, ...rest }) => rest);

    const siswaBerprestasi = [...studentDetails]
        .sort((a, b) => b.nilaiAkhir - a.nilaiAkhir)
        .slice(0, 5)
        .map(s => ({ nama: s.nama, nilaiAkhir: s.nilaiAkhir, kehadiranPct: s.kehadiranPct }));

    const ringkasanSemuaSiswa = studentDetails.slice(0, 45).map(s => ({
        nama: s.nama,
        nilaiAkhir: s.nilaiAkhir,
        kehadiranPct: s.kehadiranPct,
        tugas: `${s.tugasSelesai}/${s.totalTugas}`,
        alpa: s.alpa,
        status: s.status
    }));

    return {
        guru: currentUser?.nama_lengkap || 'Guru',
        kelas: cls.nama_kelas,
        mapel: amp.mapel,
        periode: activePeriodName || currentDatePeriodName || '-',
        kkm,
        ringkasanKelas: {
            totalSiswa: nStu,
            rataRataKehadiranPct: avgAttRate,
            totalHadir: totalH,
            totalSakit: totalS,
            totalIzin: totalI,
            totalAlpa: totalA,
            totalPenilaian: assessmentsCache.length,
            ketuntasanTugasPct: taskCompletionPct,
            rataRataNilaiAkhir: avgFinal,
            jumlahTuntasKkm: tuntasCount,
            jumlahPerluPerhatian: siswaPrioritasBimbingan.length,
            kirimanMenungguReview: pendingReviewCount,
            totalMateri: materialsCache.length
        },
        daftarPenilaian,
        siswaPrioritasBimbingan,
        siswaBerprestasi,
        ringkasanSemuaSiswa
    };
}

function renderChatMarkdownSafe(rawText) {
    const escaped = escapeHtmlSafe(rawText || '');
    const lines = escaped.split(/\r?\n/);
    const htmlParts = [];
    let listType = null;

    const formatInline = (txt) => txt
        .replace(/`([^`]+)`/g, '<code>$1</code>')
        .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
        .replace(/(^|[^*])\*([^*]+)\*(?!\*)/g, '$1<em>$2</em>');

    const closeList = () => {
        if (listType) {
            htmlParts.push(`</${listType}>`);
            listType = null;
        }
    };

    for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line) {
            closeList();
            continue;
        }
        const ulMatch = line.match(/^[-*•]\s+(.+)$/);
        const olMatch = line.match(/^\d+\.\s+(.+)$/);
        const hMatch = line.match(/^#{1,4}\s+(.+)$/);

        if (hMatch) {
            closeList();
            htmlParts.push(`<p class="font-extrabold text-slate-900 dark:text-white mt-1.5">${formatInline(hMatch[1])}</p>`);
        } else if (ulMatch) {
            if (listType !== 'ul') {
                closeList();
                htmlParts.push('<ul>');
                listType = 'ul';
            }
            htmlParts.push(`<li>${formatInline(ulMatch[1])}</li>`);
        } else if (olMatch) {
            if (listType !== 'ol') {
                closeList();
                htmlParts.push('<ol>');
                listType = 'ol';
            }
            htmlParts.push(`<li>${formatInline(olMatch[1])}</li>`);
        } else {
            closeList();
            htmlParts.push(`<p>${formatInline(line)}</p>`);
        }
    }
    closeList();
    return htmlParts.join('');
}

function renderGuruChatWelcome() {
    const container = document.getElementById('guru-chat-messages');
    if (!container) return;

    if (!hasTeacherPersonalGeminiKey()) {
        container.innerHTML = `
            <div class="flex items-start gap-2.5">
                <div class="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <i class="fa-solid fa-key text-xs"></i>
                </div>
                <div class="bg-white dark:bg-slate-900 border border-amber-200 dark:border-amber-800/70 rounded-2xl rounded-tl-sm px-3.5 py-3 text-xs text-slate-700 dark:text-slate-200 shadow-sm space-y-2.5 max-w-[90%]">
                    <p class="font-extrabold text-slate-900 dark:text-white">Hubungkan Google Gemini Pribadi Anda</p>
                    <p class="leading-relaxed">Agar kuota token tetap terjaga dan tidak habis dipakai bersama, setiap guru menghubungkan <strong>API Key Gemini pribadi</strong> masing-masing.</p>
                    <ol class="list-decimal pl-4 space-y-1 text-[11px] text-slate-600 dark:text-slate-300">
                        <li>Buka kartu <strong>Asisten Analisis AI (Google Gemini Mandiri)</strong> di menu <strong>Pengaturan</strong>.</li>
                        <li>Ambil API Key gratis dari Google AI Studio lalu klik <strong>Simpan &amp; Uji Koneksi</strong>.</li>
                    </ol>
                    <button type="button" onclick="openTeacherGeminiSettingsFromChat()" class="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm transition">
                        <i class="fa-solid fa-sliders"></i> Hubungkan Gemini di Pengaturan →
                    </button>
                </div>
            </div>
        `;
        return;
    }

    const cls = classesCache.find(c => Number(c.id) === Number(activeClassId));
    const amp = getActiveAmpuan();
    const ctxText = cls && amp
        ? `Saat ini terhubung otomatis ke data <strong>${escapeHtmlSafe(cls.nama_kelas)} — ${escapeHtmlSafe(amp.mapel)}</strong> (${studentsCache.length} siswa) menggunakan <strong>Gemini pribadi Anda</strong>.`
        : 'Terhubung dengan <strong>Gemini pribadi Anda</strong>. Pilih kelas dan mata pelajaran di ruang kerja agar saya dapat menganalisis data aktual kelas Anda.';

    container.innerHTML = `
        <div class="flex items-start gap-2.5">
            <div class="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
                <i class="fa-solid fa-wand-magic-sparkles text-xs"></i>
            </div>
            <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200 shadow-sm space-y-1.5 max-w-[88%]">
                <p class="font-extrabold text-slate-900 dark:text-white">Halo! Saya Asisten AI Dashboard Guru.</p>
                <p class="leading-relaxed">${ctxText}</p>
                <p class="text-[11px] text-slate-500 dark:text-slate-400">Tanyakan statistik kehadiran, evaluasi tugas, nama siswa tertentu, atau minta saran bimbingan personal.</p>
            </div>
        </div>
    `;
}

function toggleGuruAiChat(forceState) {
    const panel = document.getElementById('guru-ai-chat-panel');
    const fab = document.getElementById('guru-ai-chat-fab');
    if (!panel) return;
    const shouldOpen = typeof forceState === 'boolean' ? forceState : panel.classList.contains('hidden');
    panel.classList.toggle('hidden', !shouldOpen);
    if (fab) fab.classList.toggle('hidden', shouldOpen);
    if (shouldOpen) {
        if (!guruChatInitialized) {
            guruChatInitialized = true;
            renderGuruChatWelcome();
        }
        refreshGuruChatConnectionState();
        if (hasTeacherPersonalGeminiKey()) {
            setTimeout(() => document.getElementById('guru-chat-input')?.focus(), 100);
        }
    } else {
        updateGuruChatContextBadge();
    }
}

function resetGuruAiChat() {
    if (guruChatAbortController) {
        guruChatAbortController.abort();
        guruChatAbortController = null;
    }
    guruChatIsStreaming = false;
    guruChatHistory = [];
    guruChatReplyStore = {};
    setGuruChatBusyUI(false);
    renderGuruChatWelcome();
    refreshGuruChatConnectionState();
    showToast('🔄 Percakapan Asisten AI dimulai ulang.');
}

function askGuruAiQuickPrompt(promptText) {
    toggleGuruAiChat(true);
    if (!hasTeacherPersonalGeminiKey()) {
        if (guruChatHistory.length === 0) renderGuruChatWelcome();
        showToast('Hubungkan Gemini pribadi Anda di menu Pengaturan terlebih dahulu.', 'error');
        return;
    }
    if (guruChatIsStreaming) return;
    sendGuruAiChatMessage(null, promptText);
}

function handleGuruChatKeydown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendGuruAiChatMessage(e);
    }
}

function stopGuruAiChatStream() {
    if (guruChatAbortController) {
        guruChatAbortController.abort();
        guruChatAbortController = null;
    }
}

function setGuruChatBusyUI(busy) {
    guruChatIsStreaming = busy;
    const connected = hasTeacherPersonalGeminiKey();
    const sendBtn = document.getElementById('btn-guru-chat-send');
    const stopBtn = document.getElementById('btn-guru-chat-stop');
    const input = document.getElementById('guru-chat-input');
    if (sendBtn) {
        sendBtn.classList.toggle('hidden', busy);
        sendBtn.disabled = !connected;
    }
    if (stopBtn) stopBtn.classList.toggle('hidden', !busy);
    if (input) input.disabled = busy || !connected;
}

function copyGuruChatReply(replyKey) {
    const text = guruChatReplyStore[replyKey];
    if (!text) return;
    navigator.clipboard.writeText(text)
        .then(() => showToast('📋 Jawaban AI disalin ke clipboard'))
        .catch(() => showToast('Gagal menyalin teks.', 'error'));
}

async function sendGuruAiChatMessage(e, overridePrompt = null) {
    if (e && typeof e.preventDefault === 'function') e.preventDefault();
    if (guruChatIsStreaming) return;

    const inputEl = document.getElementById('guru-chat-input');
    const messagesEl = document.getElementById('guru-chat-messages');
    if (!messagesEl) return;

    if (!hasTeacherPersonalGeminiKey()) {
        if (guruChatHistory.length === 0) {
            renderGuruChatWelcome();
        } else {
            const warnWrap = document.createElement('div');
            warnWrap.className = 'flex items-start gap-2.5';
            warnWrap.innerHTML = `
                <div class="w-7 h-7 rounded-xl bg-amber-100 dark:bg-amber-950/80 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 mt-0.5">
                    <i class="fa-solid fa-key text-xs"></i>
                </div>
                <div class="bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs text-amber-900 dark:text-amber-200 shadow-sm space-y-2 max-w-[88%]">
                    <p class="font-bold">Gemini pribadi Anda belum terhubung.</p>
                    <button type="button" onclick="openTeacherGeminiSettingsFromChat()" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold transition">
                        <i class="fa-solid fa-sliders"></i> Buka Pengaturan Gemini
                    </button>
                </div>
            `;
            messagesEl.appendChild(warnWrap);
            messagesEl.scrollTop = messagesEl.scrollHeight;
        }
        refreshGuruChatConnectionState();
        showToast('Hubungkan Gemini pribadi Anda di menu Pengaturan terlebih dahulu.', 'error');
        return;
    }

    const prompt = (overridePrompt !== null ? overridePrompt : (inputEl?.value || '')).trim();
    if (!prompt) return;
    if (inputEl && overridePrompt === null) inputEl.value = '';

    // Bubble pesan guru
    const userWrap = document.createElement('div');
    userWrap.className = 'flex justify-end';
    userWrap.innerHTML = `
        <div class="bg-indigo-600 text-white rounded-2xl rounded-tr-sm px-3.5 py-2.5 text-xs leading-relaxed shadow-sm max-w-[85%] whitespace-pre-wrap">${escapeHtmlSafe(prompt)}</div>
    `;
    messagesEl.appendChild(userWrap);

    // Bubble balasan AI (streaming)
    const replyKey = `r_${++guruChatReplySeq}`;
    const aiWrap = document.createElement('div');
    aiWrap.className = 'flex items-start gap-2.5';
    aiWrap.innerHTML = `
        <div class="w-7 h-7 rounded-xl bg-indigo-100 dark:bg-indigo-950/80 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0 mt-0.5">
            <i class="fa-solid fa-wand-magic-sparkles text-xs"></i>
        </div>
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl rounded-tl-sm px-3.5 py-2.5 text-xs text-slate-700 dark:text-slate-200 shadow-sm max-w-[88%] space-y-2 min-w-0">
            <div class="guru-chat-md leading-relaxed break-words" data-ai-content>
                <span class="inline-flex items-center gap-1.5 text-slate-400"><i class="fa-solid fa-spinner fa-spin"></i> Menganalisis data kelas...</span>
            </div>
            <div class="hidden pt-1 border-t border-slate-100 dark:border-slate-800 flex items-center justify-end" data-ai-actions>
                <button type="button" onclick="copyGuruChatReply('${replyKey}')" class="inline-flex items-center gap-1 text-[10px] font-bold text-slate-400 hover:text-indigo-600 dark:hover:text-indigo-400 transition">
                    <i class="fa-regular fa-copy"></i> Salin
                </button>
            </div>
        </div>
    `;
    messagesEl.appendChild(aiWrap);
    messagesEl.scrollTop = messagesEl.scrollHeight;

    const contentBox = aiWrap.querySelector('[data-ai-content]');
    const actionsBox = aiWrap.querySelector('[data-ai-actions]');

    setGuruChatBusyUI(true);
    guruChatAbortController = new AbortController();

    let fullReply = '';
    const chatContext = buildGuruDashboardChatContext();
    const recentHistory = guruChatHistory.slice(-12);

    const appendReplyChunk = (piece) => {
        if (!piece) return;
        fullReply += piece;
        contentBox.innerHTML = renderChatMarkdownSafe(fullReply);
        messagesEl.scrollTop = messagesEl.scrollHeight;
    };

    try {
        const res = await fetch('/api/gemini/teacher-chat', {
            method: 'POST',
            credentials: 'include',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'text/event-stream, application/json'
            },
            signal: guruChatAbortController.signal,
            body: JSON.stringify({
                teacherId: currentUser.id,
                message: prompt,
                history: recentHistory,
                context: chatContext
            })
        });

        const contentType = (res.headers.get('content-type') || '').toLowerCase();
        const finalUrl = res.url || '';

        if (res.redirected && /__cookie_check|accounts\.google/i.test(finalUrl)) {
            const authErr = new Error('Sesi koneksi server perlu diperbarui. Klik "Muat Ulang Halaman" lalu kirim ulang pertanyaan Anda.');
            authErr.code = 'SESSION_RELOAD_REQUIRED';
            throw authErr;
        }

        if (!res.ok) {
            let errMsg = `Gagal terhubung ke Asisten AI (HTTP ${res.status}).`;
            let errCode = null;
            const rawErrText = await res.text().catch(() => '');
            if (rawErrText) {
                try {
                    const errJson = JSON.parse(rawErrText);
                    if (errJson?.error) errMsg = errJson.error;
                    if (errJson?.code) errCode = errJson.code;
                } catch {
                    if (res.status === 405 || res.status === 404) {
                        errMsg = `Layanan server Asisten AI tidak tersedia di alamat ini (HTTP ${res.status}). Pastikan aplikasi dibuka dari server backend yang aktif.`;
                    }
                }
            }
            const customErr = new Error(errMsg);
            customErr.code = errCode;
            throw customErr;
        }

        if (contentType.includes('text/event-stream') && res.body) {
            const reader = res.body.getReader();
            const decoder = new TextDecoder('utf-8');
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });

                const events = buffer.split('\n\n');
                buffer = events.pop() || '';

                for (const evt of events) {
                    const line = evt.trim();
                    if (!line.startsWith('data:')) continue;
                    const jsonStr = line.slice(5).trim();
                    if (!jsonStr) continue;
                    let payload;
                    try {
                        payload = JSON.parse(jsonStr);
                    } catch {
                        continue;
                    }
                    if (payload.error) {
                        const sseErr = new Error(payload.error);
                        sseErr.code = payload.code || null;
                        throw sseErr;
                    }
                    if (payload.text) appendReplyChunk(payload.text);
                }
            }
        } else {
            const rawText = await res.text();
            const looksLikeHtml = contentType.includes('text/html') || /^\s*<!doctype|^\s*<html/i.test(rawText);
            if (looksLikeHtml) {
                const isCookieGate = /__cookie_check|_aistudio-iframe|accounts\.google/i.test(finalUrl + ' ' + rawText.slice(0, 1000));
                const htmlErr = new Error(
                    isCookieGate
                        ? 'Sesi koneksi server perlu diperbarui. Klik "Muat Ulang Halaman" lalu coba kirim pertanyaan lagi.'
                        : 'Server mengembalikan halaman HTML bukan respons AI. Muat ulang halaman atau pastikan aplikasi dijalankan melalui server backend.'
                );
                htmlErr.code = 'SESSION_RELOAD_REQUIRED';
                throw htmlErr;
            }
            let data;
            try {
                data = JSON.parse(rawText);
            } catch {
                throw new Error('Respons server AI tidak berformat JSON yang valid. Coba muat ulang halaman.');
            }
            if (data?.error) {
                const jsonErr = new Error(data.error);
                jsonErr.code = data.code || null;
                throw jsonErr;
            }
            appendReplyChunk(data?.text || '');
        }

        if (!fullReply.trim()) {
            throw new Error('Tidak ada respons yang diterima dari Gemini.');
        }

        guruChatReplyStore[replyKey] = fullReply;
        guruChatHistory.push({ role: 'user', text: prompt });
        guruChatHistory.push({ role: 'model', text: fullReply });
        if (guruChatHistory.length > 24) guruChatHistory = guruChatHistory.slice(-24);
        if (actionsBox) actionsBox.classList.remove('hidden');
    } catch (err) {
        if (err.name === 'AbortError') {
            if (fullReply.trim()) {
                guruChatReplyStore[replyKey] = fullReply;
                contentBox.innerHTML = renderChatMarkdownSafe(fullReply) + '<p class="text-[10px] text-slate-400 italic mt-1">(Dihentikan oleh guru)</p>';
                if (actionsBox) actionsBox.classList.remove('hidden');
            } else {
                contentBox.innerHTML = '<span class="text-slate-400 italic">Permintaan dibatalkan.</span>';
            }
        } else {
            const needsKeySettings = err.code === 'MISSING_TEACHER_KEY' || err.code === 'INVALID_TEACHER_KEY';
            const needsReload = err.code === 'SESSION_RELOAD_REQUIRED';
            contentBox.innerHTML = `
                <div class="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 text-[11px] font-semibold space-y-2">
                    <div><i class="fa-solid fa-circle-exclamation mr-1"></i> ${escapeHtmlSafe(err.message || 'Terjadi kesalahan saat menghubungi layanan AI.')}</div>
                    ${needsKeySettings ? `<button type="button" onclick="openTeacherGeminiSettingsFromChat()" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold transition"><i class="fa-solid fa-sliders"></i> Buka Pengaturan Gemini</button>` : ''}
                    ${needsReload ? `<button type="button" onclick="window.location.reload()" class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-[11px] font-extrabold transition"><i class="fa-solid fa-rotate-right"></i> Muat Ulang Halaman</button>` : ''}
                </div>
            `;
        }
    } finally {
        guruChatAbortController = null;
        setGuruChatBusyUI(false);
        messagesEl.scrollTop = messagesEl.scrollHeight;
        if (hasTeacherPersonalGeminiKey()) {
            document.getElementById('guru-chat-input')?.focus();
        }
    }
}


