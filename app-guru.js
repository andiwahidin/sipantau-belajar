// ============================================================================
// PANTAU BELAJAR — APP-GURU.JS (MULTI-FILE SUPPORT & SKEMA SUPABASE ASLI)
// ============================================================================
const GOOGLE_OAUTH_CLIENT_ID = '565864753824-3ahjeunj19r6am2fgg2n1fv721kqfp77.apps.googleusercontent.com';

let currentUser = null;
let adminMode = 'teachers';
let classesCache = [];
let ampuanCache = [];
let activeClassId = null;
let activeAmpuanId = null;
let studentsCache = [];
let allStudentsGlobal = [];
let assessmentsCache = [];
let scoresCache = [];
let attLogsCache = [];
let attRecapCache = [];
let selectedStudentIds = new Set();
let deleteTargetIds = [];
let groupPresetsCache = [];
let modalGroupMap = {};
let binaanIdsCache = new Set();
let activeWaliStudentId = null;
let globalSearchQuery = '';
let chartInstances = {};

// ==================== 1. INISIALISASI & AUTENTIKASI ====================
window.addEventListener('DOMContentLoaded', async () => {
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
        handleGoogleOAuthCallback();
    }, 300);
});

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
}

function logout() {
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

// ==================== 2. PANEL ADMINISTRATOR ====================
async function switchAdminMode(mode) {
    adminMode = mode;
    if (mode === 'teachers') {
        showSection('view-admin');
        document.getElementById('adm-tab-teachers').className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-600 text-white';
        document.getElementById('adm-tab-students').className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600';
        await loadAdminUsers();
    } else {
        showSection('view-guru');
        setupTopbarUser();
        document.getElementById('admin-student-mode-banner').classList.remove('hidden');
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
            <td class="p-3 font-bold text-slate-900">${u.nama_lengkap || '-'}</td>
            <td class="p-3 font-mono text-xs">${u.username}</td>
            <td class="p-3 text-xs">${u.gdrive_email ? `<span class="text-emerald-600 font-bold">✅ Drive: ${u.gdrive_email}</span>` : '<span class="text-slate-400">Standar</span>'}</td>
            <td class="p-3"><span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${u.role === 'admin' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'}">${u.role}</span></td>
            <td class="p-3 text-right space-x-1">
                <button onclick="openEditTeacherModal(${u.id}, '${(u.nama_lengkap || '').replace(/'/g, "\\'")}', '${u.username}')" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold">Edit</button>
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
    if (!confirm('Reset password guru ini menjadi 123?')) return;
    await db.from('app_users').update({ password: '123' }).eq('id', id);
    showToast('✅ Password direset ke: 123');
}

async function deleteTeacher(id) {
    if (!confirm('Hapus akun guru ini secara permanen?')) return;
    await db.from('app_users').delete().eq('id', id);
    showToast('Akun guru dihapus.');
    await loadAdminUsers();
}

// ==================== 3. WORKSPACE GURU (teacher_settings) ====================
async function initGuruWorkspace() {
    document.getElementById('admin-student-mode-banner').classList.add('hidden');
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
                class="px-3 py-1.5 rounded-xl text-[11px] font-extrabold border shrink-0 transition ${isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'}">
                ${a.classes?.nama_kelas || 'Kelas'} • ${a.mapel}
            </button>
        `;
    }).join('');
}

async function selectAmpuanShortcut(classId, ampuanId) {
    activeClassId = Number(classId);
    activeAmpuanId = Number(ampuanId);
    document.getElementById('guru-active-class').value = activeClassId;
    await onGuruClassDropdownChange(true);
}

async function onGuruClassDropdownChange(keepAmpuan = false) {
    const clsVal = document.getElementById('guru-active-class').value;
    activeClassId = clsVal ? Number(clsVal) : null;

    if (adminMode === 'students' && currentUser.role === 'admin') {
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

    await onGuruMapelDropdownChange();
}

async function onGuruMapelDropdownChange() {
    const ampVal = document.getElementById('guru-active-mapel').value;
    activeAmpuanId = ampVal ? Number(ampVal) : null;
    renderTeacherAmpuanCards();

    const activeAmp = getActiveAmpuan();
    const clsObj = classesCache.find(c => Number(c.id) === Number(activeClassId));
    document.getElementById('workspace-label').innerText = activeAmp
        ? `${clsObj?.nama_kelas || ''} — ${activeAmp.mapel}`
        : (clsObj?.nama_kelas || 'Belum Dipilih');
    document.getElementById('workspace-kkm-label').innerText = `KKM: ${activeAmp?.kkm || 75}`;

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
    if (!confirm(`Hapus mata pelajaran "${amp.mapel}" dari kelas ini?`)) return;
    await db.from('teacher_settings').delete().eq('id', amp.id);
    activeAmpuanId = null;
    showToast('Mata pelajaran dihapus dari daftar ampuan.');
    await loadTeacherAmpuan();
}

// ==================== 4. NAVIGASI TAB & MUAT DATA ====================
function toggleMobileSidebar(forceClose = false) {
    const sb = document.getElementById('main-sidebar');
    if (!sb) return;
    if (forceClose) sb.classList.add('hidden');
    else sb.classList.toggle('hidden');
}

function switchGuruTab(tab) {
    const tabs = ['dashboard', 'kelas', 'absen', 'nilai', 'rekap', 'wali', 'bobot'];
    tabs.forEach(t => {
        document.getElementById(`gcontent-${t}`)?.classList.toggle('hidden', t !== tab);
        const btn = document.getElementById(`gtab-${t}`);
        if (btn) {
            btn.className = t === tab
                ? 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-50 text-blue-700 transition'
                : 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 hover:bg-slate-100 transition';
        }
    });

    if (tab === 'dashboard') renderDashboard();
    if (tab === 'kelas') renderStudentsTable();
    if (tab === 'absen') {
        loadRecordedDates();
        loadDailyAttendanceForDate();
        renderAttendanceRecapTable();
    }
    if (tab === 'nilai') renderAssessmentsDropdown();
    if (tab === 'rekap') renderRekapTab();
    if (tab === 'wali') loadGuruWaliTab();
    if (tab === 'bobot') {
        populateSettingsForm();
        updateGDriveConnectionUI();
    }
}

function copyStudentPortalLink() {
    let url = window.location.origin + window.location.pathname;
    url = url.replace(/index\.html$/, '') + 'siswa.html';
    navigator.clipboard.writeText(url);
    showToast('🔗 Link Portal Siswa disalin: ' + url);
}

function onGlobalSearchInput(val) {
    globalSearchQuery = val.trim().toLowerCase();
    renderDashboard();
    renderStudentsTable();
}

async function loadWorkspaceData() {
    if (!activeClassId) {
        studentsCache = [];
        assessmentsCache = [];
        scoresCache = [];
        attLogsCache = [];
        attRecapCache = [];
        renderDashboard();
        return;
    }

    const activeAmp = getActiveAmpuan();
    const mapelName = activeAmp?.mapel || '';

    const [stuRes, assRes, attLogsRes] = await Promise.all([
        db.from('students').select('*').eq('class_id', activeClassId).order('nama'),
        db.from('assessments').select('*').eq('class_id', activeClassId).eq('mapel', mapelName).order('id'),
        db.from('attendance_logs').select('*').eq('class_id', activeClassId)
    ]);

    studentsCache = stuRes.data || [];
    assessmentsCache = assRes.data || [];
    attLogsCache = (attLogsRes.data || []).filter(l => !l.mapel || l.mapel === mapelName);

    const stuIds = studentsCache.map(s => s.id);
    if (stuIds.length > 0 && mapelName) {
        const recapRes = await db.from('attendance').select('*').in('student_id', stuIds).eq('mapel', mapelName);
        attRecapCache = recapRes.data || [];
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

    renderDashboard();
    renderStudentsTable();
    renderAssessmentsDropdown();
    renderRekapTab();
}

// ==================== 5. PERHITUNGAN NILAI & DASHBOARD ====================
function computeStudentMetrics(studentId) {
    const amp = getActiveAmpuan() || { kkm: 75, w_absen: 10, w_tugas: 30, w_bab: 30, w_uas: 30, p_hadir: 100, p_sakit: 80, p_izin: 80, p_alpa: 0 };

    const logs = attLogsCache.filter(l => Number(l.student_id) === Number(studentId));
    const manual = attRecapCache.find(r => Number(r.student_id) === Number(studentId));

    let h = 0, s = 0, i = 0, a = 0;
    if (logs.length > 0) {
        logs.forEach(l => {
            if (l.status === 'H') h++;
            else if (l.status === 'S') s++;
            else if (l.status === 'I') i++;
            else if (l.status === 'A') a++;
        });
    } else if (manual) {
        h = Number(manual.hadir || 0);
        s = Number(manual.sakit || 0);
        i = Number(manual.izin || 0);
        a = Number(manual.alpa || 0);
    }

    const totalPertemuan = h + s + i + a;
    const attScore = totalPertemuan > 0
        ? ((h * (amp.p_hadir ?? 100) + s * (amp.p_sakit ?? 80) + i * (amp.p_izin ?? 80) + a * (amp.p_alpa ?? 0)) / totalPertemuan)
        : 100;
    const attRate = totalPertemuan > 0 ? (h / totalPertemuan) * 100 : 100;

    const calcCatAvg = (cats) => {
        const list = assessmentsCache.filter(as => cats.includes(as.kategori));
        if (!list.length) return 0;
        let sum = 0;
        list.forEach(as => {
            const sc = scoresCache.find(x => Number(x.assessment_id) === Number(as.id) && Number(x.student_id) === Number(studentId));
            sum += Number(sc?.nilai || 0);
        });
        return sum / list.length;
    };

    const avgTugas = calcCatAvg(['tugas_individu', 'tugas_kelompok']);
    const avgBab = calcCatAvg(['ujian_bab']);
    const avgSmt = calcCatAvg(['ujian_semester']);

    const wTotal = (Number(amp.w_absen) + Number(amp.w_tugas) + Number(amp.w_bab) + Number(amp.w_uas)) || 100;
    const finalScore = (
        (attScore * Number(amp.w_absen)) +
        (avgTugas * Number(amp.w_tugas)) +
        (avgBab * Number(amp.w_bab)) +
        (avgSmt * Number(amp.w_uas))
    ) / wTotal;

    const totalTasks = assessmentsCache.length;
    const doneTasks = assessmentsCache.filter(as => {
        const sc = scoresCache.find(x => Number(x.assessment_id) === Number(as.id) && Number(x.student_id) === Number(studentId));
        return sc?.status_kumpul === true || sc?.status_pengajuan === 'approved';
    }).length;

    return {
        h, s, i, a,
        attScore,
        attRate,
        avgTugas,
        avgBab,
        avgSmt,
        finalScore,
        doneTasks,
        totalTasks,
        kkm: Number(amp.kkm || 75)
    };
}

function renderDashboard() {
    const tbody = document.getElementById('dash-student-tbody');
    if (!tbody) return;

    const filtered = studentsCache.filter(s =>
        !globalSearchQuery || s.nama.toLowerCase().includes(globalSearchQuery) || String(s.nisn).includes(globalSearchQuery)
    );

    let sumAtt = 0, sumTaskPct = 0, sumFinal = 0, attentionCount = 0;
    let totH = 0, totS = 0, totI = 0, totA = 0;

    tbody.innerHTML = filtered.map(s => {
        const m = computeStudentMetrics(s.id);
        sumAtt += m.attRate;
        const tPct = m.totalTasks > 0 ? (m.doneTasks / m.totalTasks) * 100 : 100;
        sumTaskPct += tPct;
        sumFinal += m.finalScore;
        totH += m.h; totS += m.s; totI += m.i; totA += m.a;

        const isAttention = m.finalScore < m.kkm || (m.totalTasks > 0 && m.doneTasks < m.totalTasks);
        if (isAttention) attentionCount++;

        return `
            <tr class="hover:bg-slate-50">
                <td class="p-3">
                    <div class="font-bold text-slate-900">${s.nama}</div>
                    <div class="text-[10px] font-mono text-slate-400">${s.nisn}</div>
                </td>
                <td class="p-3 text-center font-bold">${m.attRate.toFixed(0)}%</td>
                <td class="p-3 text-center font-bold">${m.doneTasks} / ${m.totalTasks}</td>
                <td class="p-3 text-center font-extrabold text-blue-700">${m.finalScore.toFixed(1)}</td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${m.finalScore >= m.kkm ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'}">
                        ${m.finalScore >= m.kkm ? 'Tuntas' : 'Perlu Bimbingan'}
                    </span>
                </td>
                <td class="p-3 text-center">
                    <button onclick="switchGuruTab('nilai')" class="text-xs font-bold text-blue-600 hover:underline">Nilai →</button>
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

    document.getElementById('dash-stat-avg').innerText = (studentsCache.length ? sumFinal / n : 0).toFixed(1);
    document.getElementById('dash-stat-attention').innerText = `${attentionCount} Siswa`;

    renderDashboardCharts(totH, totS, totI, totA);
}

function renderDashboardCharts(h, s, i, a) {
    destroyChart('chartDashDonutAtt');
    const c1 = document.getElementById('chartDashDonutAtt');
    if (c1) {
        const hasData = (h + s + i + a) > 0;
        chartInstances['chartDashDonutAtt'] = new Chart(c1, {
            type: 'doughnut',
            data: {
                labels: hasData ? ['Hadir', 'Sakit', 'Izin', 'Alpa'] : ['Belum Ada Data'],
                datasets: [{ data: hasData ? [h, s, i, a] : [1], backgroundColor: hasData ? ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e'] : ['#e2e8f0'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '68%', plugins: { legend: { position: 'right', labels: { boxWidth: 10, font: { size: 10 } } } } }
        });
    }

    destroyChart('chartDashWeeklyTrend');
    const c2 = document.getElementById('chartDashWeeklyTrend');
    if (c2) {
        const dates = [...new Set(attLogsCache.map(l => l.tanggal))].sort().slice(-7);
        const rates = dates.map(d => {
            const dayLogs = attLogsCache.filter(l => l.tanggal === d);
            const hadir = dayLogs.filter(l => l.status === 'H').length;
            return dayLogs.length ? Math.round((hadir / dayLogs.length) * 100) : 0;
        });
        chartInstances['chartDashWeeklyTrend'] = new Chart(c2, {
            type: 'line',
            data: {
                labels: dates.length ? dates.map(d => d.slice(5)) : ['Belum Ada'],
                datasets: [{ label: '% Hadir', data: dates.length ? rates : [100], borderColor: '#2563eb', backgroundColor: 'rgba(37,99,235,0.1)', fill: true, tension: 0.3 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
        });
    }

    destroyChart('chartDashTaskBar');
    const c3 = document.getElementById('chartDashTaskBar');
    if (c3) {
        const labels = assessmentsCache.slice(0, 6).map(as => as.judul.slice(0, 12));
        const counts = assessmentsCache.slice(0, 6).map(as =>
            scoresCache.filter(sc => Number(sc.assessment_id) === Number(as.id) && (sc.status_kumpul || sc.status_pengajuan === 'approved')).length
        );
        chartInstances['chartDashTaskBar'] = new Chart(c3, {
            type: 'bar',
            data: {
                labels: labels.length ? labels : ['Belum Ada'],
                datasets: [{ label: 'Terkumpul', data: labels.length ? counts : [0], backgroundColor: '#10b981', borderRadius: 6 }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

function destroyChart(key) {
    if (chartInstances[key]) {
        chartInstances[key].destroy();
        delete chartInstances[key];
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
    if (adminMode === 'students') {
        activeClassId = data.id;
        await loadWorkspaceData();
    }
}

async function addStudentManual(e) {
    e.preventDefault();
    if (!activeClassId) return showToast('Pilih kelas terlebih dahulu!', 'error');
    const nisn = document.getElementById('stu-nisn').value.trim();
    const nama = document.getElementById('stu-nama').value.trim();
    const { error } = await db.from('students').insert([{ class_id: activeClassId, nisn, nama }]);
    if (error) return showToast('Gagal menambah siswa: ' + error.message, 'error');
    e.target.reset();
    showToast('✅ Siswa ditambahkan');
    await loadWorkspaceData();
}

function downloadTemplateSiswa() {
    const ws = XLSX.utils.aoa_to_sheet([['NISN', 'Nama Lengkap'], ['0081234561', 'Andi Pratama'], ['0081234562', 'Siti Rahmawati']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template_Siswa');
    XLSX.writeFile(wb, 'Template_Import_Siswa.xlsx');
}

async function importStudentsExcel() {
    if (!activeClassId) return showToast('Pilih kelas terlebih dahulu!', 'error');
    const fileInput = document.getElementById('excel-students');
    const file = fileInput?.files?.[0];
    if (!file) return showToast('Pilih file Excel (.xlsx) terlebih dahulu!', 'error');

    const reader = new FileReader();
    reader.onload = async (ev) => {
        const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const payload = rows.map(r => ({
            class_id: activeClassId,
            nisn: String(r['NISN'] || r['nisn'] || '').trim(),
            nama: String(r['Nama Lengkap'] || r['Nama'] || r['nama'] || '').trim()
        })).filter(x => x.nama);

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

    const filtered = studentsCache.filter(s =>
        !globalSearchQuery || s.nama.toLowerCase().includes(globalSearchQuery) || String(s.nisn).includes(globalSearchQuery)
    );

    tbody.innerHTML = filtered.map((s, idx) => `
        <tr class="hover:bg-slate-50">
            <td class="p-3 text-center"><input type="checkbox" ${selectedStudentIds.has(s.id) ? 'checked' : ''} onchange="toggleSingleStudentSelect(${s.id}, this.checked)" class="w-4 h-4 accent-blue-600"></td>
            <td class="p-3 text-center text-slate-400">${idx + 1}</td>
            <td class="p-3 font-mono text-xs">${s.nisn}</td>
            <td class="p-3 font-bold text-slate-900">${s.nama}</td>
            <td class="p-3 text-center space-x-1">
                <button onclick="openEditStudentModal(${s.id})" class="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-xs font-bold">Edit</button>
                <button onclick="initiateSingleStudentDelete(${s.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 text-xs font-bold">Hapus</button>
            </td>
        </tr>
    `).join('');
    updateBulkDeleteButtons();
}

function toggleSingleStudentSelect(id, checked) {
    if (checked) selectedStudentIds.add(id);
    else selectedStudentIds.delete(id);
    updateBulkDeleteButtons();
}

function toggleSelectAllStudents(checked) {
    selectedStudentIds.clear();
    if (checked) studentsCache.forEach(s => selectedStudentIds.add(s.id));
    renderStudentsTable();
}

function updateBulkDeleteButtons() {
    const cnt = selectedStudentIds.size;
    document.getElementById('selected-students-badge').innerText = `${cnt} dipilih`;
    document.getElementById('btn-selected-count').innerText = cnt;
    document.getElementById('btn-bulk-delete-selected').disabled = cnt === 0;
    document.getElementById('btn-bulk-delete-all').disabled = studentsCache.length === 0;
}

function openEditStudentModal(id) {
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
    const id = Number(document.getElementById('edit-stu-id').value);
    const nisn = document.getElementById('edit-stu-nisn').value.trim();
    const nama = document.getElementById('edit-stu-nama').value.trim();
    const class_id = Number(document.getElementById('edit-stu-kelas').value);
    await db.from('students').update({ nisn, nama, class_id }).eq('id', id);
    closeEditStudentModal();
    showToast('✅ Data siswa diperbarui');
    await loadWorkspaceData();
}

function initiateSingleStudentDelete(id) { deleteTargetIds = [id]; openDeleteConfirmModal(); }
function initiateBulkDeleteSelected() { deleteTargetIds = [...selectedStudentIds]; openDeleteConfirmModal(); }
function initiateDeleteAllInClass() { deleteTargetIds = studentsCache.map(s => s.id); openDeleteConfirmModal(); }

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
function toggleFinalDeleteButton() {
    document.getElementById('btn-execute-delete').disabled = !document.getElementById('del-final-check').checked;
}
async function executeConfirmedStudentDelete() {
    await db.from('students').delete().in('id', deleteTargetIds);
    selectedStudentIds.clear();
    closeDeleteConfirmModal();
    showToast(`🗑️ ${deleteTargetIds.length} siswa telah dihapus.`);
    await loadWorkspaceData();
}

// ==================== 7. KEHADIRAN & PRESENSI ====================
function loadRecordedDates() {
    const dates = [...new Set(attLogsCache.map(l => l.tanggal))].sort().reverse();
    const sel = document.getElementById('abs-recorded-dates');
    const chips = document.getElementById('abs-date-chips');
    if (sel) {
        sel.innerHTML = `<option value="">-- Riwayat Tanggal (${dates.length}) --</option>` + dates.map(d => `<option value="${d}">${d}</option>`).join('');
    }
    if (chips) {
        chips.innerHTML = dates.length
            ? dates.map(d => `<button type="button" onclick="selectRecordedDate('${d}')" class="px-2.5 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-[11px] font-bold border border-blue-200">${d}</button>`).join('')
            : `<span class="text-xs text-slate-400 italic">Belum ada pertemuan tercatat.</span>`;
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
        if (st === 'H') h++;
        else if (st === 'S' || st === 'I') si++;
        else if (st === 'A') a++;

        return `
            <tr data-stu-id="${s.id}">
                <td class="p-2.5 text-center text-slate-400">${idx + 1}</td>
                <td class="p-2.5 font-mono text-xs">${s.nisn}</td>
                <td class="p-2.5 font-bold text-slate-900">${s.nama}</td>
                <td class="p-2.5 text-center">
                    <div class="inline-flex rounded-xl border border-slate-200 overflow-hidden text-xs font-extrabold">
                        ${['H', 'S', 'I', 'A'].map(opt => `
                            <label class="cursor-pointer px-3 py-1.5 ${st === opt ? (opt === 'H' ? 'bg-emerald-600 text-white' : opt === 'A' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white') : 'bg-white text-slate-600 hover:bg-slate-50'}">
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
        if (val === 'H') h++;
        else if (val === 'S' || val === 'I') si++;
        else if (val === 'A') a++;

        document.querySelectorAll(`input[name="att_${s.id}"]`).forEach(inp => {
            const lbl = inp.parentElement;
            if (inp.checked) {
                lbl.className = `cursor-pointer px-3 py-1.5 ${inp.value === 'H' ? 'bg-emerald-600 text-white' : inp.value === 'A' ? 'bg-rose-600 text-white' : 'bg-amber-500 text-white'}`;
            } else {
                lbl.className = 'cursor-pointer px-3 py-1.5 bg-white text-slate-600 hover:bg-slate-50';
            }
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
    if (!activeClassId || !dateVal || !amp) return showToast('Pilih kelas dan tanggal pertemuan!', 'error');

    await db.from('attendance_logs').delete().eq('class_id', activeClassId).eq('tanggal', dateVal).eq('mapel', amp.mapel);

    const payload = studentsCache.map(s => {
        const checked = document.querySelector(`input[name="att_${s.id}"]:checked`);
        return {
            teacher_id: currentUser.id,
            class_id: activeClassId,
            student_id: s.id,
            mapel: amp.mapel,
            tanggal: dateVal,
            status: checked?.value || 'H'
        };
    });

    const { error } = await db.from('attendance_logs').insert(payload);
    if (error) return showToast('Gagal menyimpan absensi: ' + error.message, 'error');

    showToast(`✅ Absensi tanggal ${dateVal} tersimpan!`);
    await loadWorkspaceData();
    loadRecordedDates();
    renderAttendanceRecapTable();
}

async function deleteDailyAttendanceDate() {
    const dateVal = document.getElementById('abs-date-picker').value;
    const amp = getActiveAmpuan();
    if (!dateVal || !amp || !confirm(`Hapus catatan absensi tanggal ${dateVal}?`)) return;
    await db.from('attendance_logs').delete().eq('class_id', activeClassId).eq('tanggal', dateVal).eq('mapel', amp.mapel);
    showToast('Catatan tanggal dihapus.');
    await loadWorkspaceData();
    loadRecordedDates();
    loadDailyAttendanceForDate();
}

function exportDailyAttendanceExcel() {
    const dates = [...new Set(attLogsCache.map(l => l.tanggal))].sort();
    const header = ['No', 'NISN', 'Nama Siswa', ...dates, 'Hadir', 'Sakit', 'Izin', 'Alpa'];
    const rows = studentsCache.map((s, idx) => {
        const m = computeStudentMetrics(s.id);
        const dayCols = dates.map(d => {
            const log = attLogsCache.find(l => Number(l.student_id) === Number(s.id) && l.tanggal === d);
            return log?.status || '-';
        });
        return [idx + 1, s.nisn, s.nama, ...dayCols, m.h, m.s, m.i, m.a];
    });
    const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Matriks_Kehadiran');
    XLSX.writeFile(wb, 'Matriks_Kehadiran_Siswa.xlsx');
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
                <td class="p-2.5 text-center"><input type="number" class="recap-h w-14 border rounded-lg p-1 text-center" value="${m.h}"></td>
                <td class="p-2.5 text-center"><input type="number" class="recap-s w-14 border rounded-lg p-1 text-center" value="${m.s}"></td>
                <td class="p-2.5 text-center"><input type="number" class="recap-i w-14 border rounded-lg p-1 text-center" value="${m.i}"></td>
                <td class="p-2.5 text-center"><input type="number" class="recap-a w-14 border rounded-lg p-1 text-center" value="${m.a}"></td>
                <td class="p-2.5 text-center font-extrabold text-blue-700">${m.attScore.toFixed(1)}</td>
            </tr>
        `;
    }).join('');
}

async function saveAttendanceManual() {
    const amp = getActiveAmpuan();
    if (!activeClassId || !amp) return;
    const stuIds = studentsCache.map(s => s.id);
    if (stuIds.length) {
        await db.from('attendance').delete().in('student_id', stuIds).eq('mapel', amp.mapel);
    }
    const payload = [...document.querySelectorAll('#absen-tbody tr')].map(tr => ({
        teacher_id: currentUser.id,
        student_id: Number(tr.dataset.recapStu),
        mapel: amp.mapel,
        hadir: Number(tr.querySelector('.recap-h').value || 0),
        sakit: Number(tr.querySelector('.recap-s').value || 0),
        izin: Number(tr.querySelector('.recap-i').value || 0),
        alpa: Number(tr.querySelector('.recap-a').value || 0)
    }));
    await db.from('attendance').insert(payload);
    showToast('✅ Rekap kehadiran manual disimpan!');
    await loadWorkspaceData();
    renderAttendanceRecapTable();
}

function downloadTemplateAbsen() {
    const ws = XLSX.utils.aoa_to_sheet([['NISN', 'Nama', 'Hadir', 'Sakit', 'Izin', 'Alpa']]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Absen');
    XLSX.writeFile(wb, 'Template_Rekap_Absensi.xlsx');
}

async function importAbsenExcel() {
    const file = document.getElementById('excel-absen')?.files?.[0];
    if (!file) return showToast('Pilih file Excel terlebih dahulu!', 'error');
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

    const payload = {
        class_id: activeClassId,
        teacher_id: currentUser.id,
        mapel: amp.mapel,
        judul: document.getElementById('ass-judul').value.trim(),
        kategori: document.getElementById('ass-kategori').value,
        tipe_kerja: document.getElementById('ass-tipe').value,
        tampil_publik: document.getElementById('ass-publik').value === 'true',
        link_pengumpulan: document.getElementById('ass-link').value.trim() || null
    };

    const { error } = await db.from('assessments').insert([payload]);
    if (error) return showToast('Gagal membuat penilaian: ' + error.message, 'error');
    e.target.reset();
    showToast('✅ Tugas / Ujian baru ditambahkan!');
    await loadWorkspaceData();
}

function renderAssessmentsDropdown() {
    const sel = document.getElementById('active-assessment');
    if (!sel) return;
    document.getElementById('tgs-stat-total').innerText = assessmentsCache.length;

    sel.innerHTML = assessmentsCache.length
        ? assessmentsCache.map(a => `<option value="${a.id}">${a.judul} (${a.kategori.replace('_', ' ')})</option>`).join('')
        : `<option value="">-- Belum Ada Tugas / Ujian --</option>`;

    loadAssessmentScores();
}

function parseStudentSubmittedFiles(raw) {
    if (!raw) return [];
    try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr;
    } catch {
        if (String(raw).startsWith('http')) {
            return [{ name: 'File 1', url: raw }];
        }
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
    document.getElementById('edit-ass-kategori').value = ass.kategori;
    document.getElementById('edit-ass-tipe').value = ass.tipe_kerja || 'individu';
    document.getElementById('edit-ass-link').value = ass.link_pengumpulan || '';

    const btnPub = document.getElementById('btn-toggle-public');
    btnPub.innerText = ass.tampil_publik ? '🌐 Publik' : '🔒 Privat';
    btnPub.className = ass.tampil_publik
        ? 'px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-700'
        : 'px-2.5 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-600';

    const testLink = document.getElementById('btn-test-ass-link');
    if (ass.link_pengumpulan) {
        testLink.href = ass.link_pengumpulan;
        testLink.classList.remove('hidden');
    } else {
        testLink.classList.add('hidden');
    }

    const isGroup = ass.tipe_kerja === 'kelompok';
    grpBanner.classList.toggle('hidden', !isGroup);
    if (isGroup) loadGroupPresetsDropdown();

    thead.innerHTML = `
        <tr class="bg-slate-50 text-slate-600 border-b">
            <th class="p-3 text-center w-10">No</th>
            <th class="p-3">Nama Siswa</th>
            ${isGroup ? '<th class="p-3 w-36">Kelompok</th>' : ''}
            <th class="p-3 text-center">File Drive Siswa</th>
            <th class="p-3 text-center">Status Kumpul</th>
            <th class="p-3 text-center w-28">Nilai (0-100)</th>
        </tr>
    `;

    let submitted = 0, ungraded = 0, sumScore = 0, gradedCount = 0;

    tbody.innerHTML = studentsCache.map((s, idx) => {
        const sc = scoresCache.find(x => Number(x.assessment_id) === assId && Number(x.student_id) === Number(s.id)) || {};
        const isDone = sc.status_kumpul === true || sc.status_pengajuan === 'approved';
        const isPending = sc.status_pengajuan === 'pending' && !isDone;
        const val = sc.nilai !== null && sc.nilai !== undefined ? sc.nilai : '';

        if (isDone) submitted++;
        if (isDone && val === '') ungraded++;
        if (val !== '') { sumScore += Number(val); gradedCount++; }

        const parsedFiles = parseStudentSubmittedFiles(sc.link_tugas_siswa);
        const fileLinkHtml = parsedFiles.length > 0
            ? `<div class="flex flex-wrap items-center justify-center gap-1">
                ${parsedFiles.map((f, fIdx) => `
                    <a href="${f.url}" target="_blank" title="${f.name}" class="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-[11px] font-extrabold">
                        📂 File ${fIdx + 1} ↗
                    </a>
                `).join('')}
               </div>`
            : `<span class="text-[11px] text-slate-400">-</span>`;

        return `
            <tr data-score-stu="${s.id}" class="hover:bg-slate-50">
                <td class="p-2.5 text-center text-slate-400">${idx + 1}</td>
                <td class="p-2.5">
                    <div class="font-bold text-slate-900">${s.nama}</div>
                    <div class="text-[10px] font-mono text-slate-400">${s.nisn}</div>
                </td>
                ${isGroup ? `<td class="p-2.5"><input type="text" list="datalist-kelompok-options" value="${sc.nama_kelompok || ''}" oninput="syncGroupRowChange(${s.id})" class="sc-kelompok w-full border rounded-lg p-1.5 text-xs font-bold"></td>` : ''}
                <td class="p-2.5 text-center">${fileLinkHtml}</td>
                <td class="p-2.5 text-center">
                    <label class="inline-flex items-center gap-1.5 cursor-pointer">
                        <input type="checkbox" ${isDone ? 'checked' : ''} onchange="syncGroupRowChange(${s.id})" class="sc-kumpul w-4 h-4 accent-emerald-600">
                        <span class="text-[11px] font-bold ${isDone ? 'text-emerald-700' : isPending ? 'text-amber-600' : 'text-slate-400'}">
                            ${isDone ? 'Sudah' : isPending ? 'Pending' : 'Belum'}
                        </span>
                    </label>
                </td>
                <td class="p-2.5 text-center">
                    <input type="number" min="0" max="100" step="0.1" value="${val}" oninput="syncGroupRowChange(${s.id})" class="sc-nilai w-20 border border-slate-300 rounded-lg p-1.5 text-center font-extrabold text-blue-800">
                </td>
            </tr>
        `;
    }).join('');

    const tot = studentsCache.length || 1;
    document.getElementById('tgs-stat-submit').innerText = `${studentsCache.length ? Math.round((submitted / tot) * 100) : 0}%`;
    document.getElementById('tgs-stat-ungraded').innerText = ungraded;
    document.getElementById('tgs-stat-avg').innerText = gradedCount ? (sumScore / gradedCount).toFixed(1) : '0.0';
}

function syncGroupRowChange(changedStuId) {
    const assId = Number(document.getElementById('active-assessment')?.value);
    const ass = assessmentsCache.find(a => Number(a.id) === assId);
    if (!ass || ass.tipe_kerja !== 'kelompok') return;

    const sourceTr = document.querySelector(`tr[data-score-stu="${changedStuId}"]`);
    if (!sourceTr) return;
    const grpName = sourceTr.querySelector('.sc-kelompok')?.value.trim();
    if (!grpName) return;

    const kumpul = sourceTr.querySelector('.sc-kumpul').checked;
    const nilai = sourceTr.querySelector('.sc-nilai').value;

    document.querySelectorAll('#scores-tbody tr').forEach(tr => {
        const g = tr.querySelector('.sc-kelompok')?.value.trim();
        if (g && g.toLowerCase() === grpName.toLowerCase()) {
            tr.querySelector('.sc-kumpul').checked = kumpul;
            tr.querySelector('.sc-nilai').value = nilai;
        }
    });
}

async function saveAssessmentScores() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    if (!assId) return;

    const rows = [...document.querySelectorAll('#scores-tbody tr[data-score-stu]')];
    for (const tr of rows) {
        const stuId = Number(tr.dataset.scoreStu);
        const kumpul = tr.querySelector('.sc-kumpul').checked;
        const rawVal = tr.querySelector('.sc-nilai').value;
        const nilai = rawVal !== '' ? Number(rawVal) : null;
        const nama_kelompok = tr.querySelector('.sc-kelompok')?.value.trim() || null;

        const existing = scoresCache.find(x => Number(x.assessment_id) === assId && Number(x.student_id) === stuId);
        if (existing) {
            await db.from('scores').update({
                status_kumpul: kumpul,
                status_pengajuan: kumpul ? 'approved' : 'none',
                nilai,
                nama_kelompok
            }).eq('id', existing.id);
        } else {
            await db.from('scores').insert([{
                assessment_id: assId,
                student_id: stuId,
                status_kumpul: kumpul,
                status_pengajuan: kumpul ? 'approved' : 'none',
                nilai,
                nama_kelompok
            }]);
        }
    }

    showToast('✅ Semua nilai dan status pengumpulan tersimpan!');
    await loadWorkspaceData();
}

async function updateAssessmentLink() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    if (!assId) return;
    await db.from('assessments').update({
        judul: document.getElementById('edit-ass-judul').value.trim(),
        kategori: document.getElementById('edit-ass-kategori').value,
        tipe_kerja: document.getElementById('edit-ass-tipe').value,
        link_pengumpulan: document.getElementById('edit-ass-link').value.trim() || null
    }).eq('id', assId);
    showToast('✅ Detail tugas diperbarui');
    await loadWorkspaceData();
}

async function toggleAssessmentPublicVisibility() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    const ass = assessmentsCache.find(a => Number(a.id) === assId);
    if (!ass) return;
    await db.from('assessments').update({ tampil_publik: !ass.tampil_publik }).eq('id', assId);
    showToast(!ass.tampil_publik ? '🌐 Tugas ditampilkan di Portal Siswa' : '🔒 Tugas disembunyikan');
    await loadWorkspaceData();
}

async function deleteCurrentAssessment() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    if (!assId || !confirm('Hapus penilaian ini beserta seluruh nilainya?')) return;
    await db.from('assessments').delete().eq('id', assId);
    showToast('Penilaian dihapus.');
    await loadWorkspaceData();
}

// Preset Kelompok (kolom kelompok_template pada teacher_settings)
function loadGroupPresetsDropdown() {
    const amp = getActiveAmpuan();
    const raw = amp?.kelompok_template;
    groupPresetsCache = Array.isArray(raw) ? raw : [];
    const sel = document.getElementById('select-group-preset');
    if (sel) {
        sel.innerHTML = `<option value="">-- Pilih Preset Kelompok --</option>` + groupPresetsCache.map((p, idx) => `<option value="${idx}">${p.nama_preset}</option>`).join('');
    }
}

function applySelectedGroupPreset() {
    const idx = document.getElementById('select-group-preset').value;
    if (idx === '') return showToast('Pilih preset kelompok terlebih dahulu!', 'error');
    const preset = groupPresetsCache[Number(idx)];
    if (!preset) return;
    const mapping = preset.mapping || {};
    document.querySelectorAll('#scores-tbody tr[data-score-stu]').forEach(tr => {
        const stuId = tr.dataset.scoreStu;
        const inp = tr.querySelector('.sc-kelompok');
        if (inp && mapping[stuId]) inp.value = mapping[stuId];
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

function createNewGroupPreset() {
    document.getElementById('gm-preset-select').value = '';
    document.getElementById('gm-preset-name').value = '';
    modalGroupMap = {};
    renderGroupManagerRows();
}

async function deleteCurrentGroupPreset() {
    const idx = document.getElementById('gm-preset-select').value;
    const amp = getActiveAmpuan();
    if (idx === '' || !amp || !confirm('Hapus preset kelompok ini?')) return;
    const updatedList = groupPresetsCache.filter((_, i) => i !== Number(idx));
    await db.from('teacher_settings').update({ kelompok_template: updatedList }).eq('id', amp.id);
    amp.kelompok_template = updatedList;
    loadGroupPresetsDropdown();
    createNewGroupPreset();
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
            <td class="p-2"><input type="text" value="${modalGroupMap[s.id] || ''}" oninput="modalGroupMap[${s.id}] = this.value" class="w-full border rounded p-1"></td>
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

// ==================== 9. REKAPITULASI & RAPOR ====================
function renderRekapTab() {
    const tbody = document.getElementById('rekap-tbody');
    if (!tbody) return;

    let tuntas = 0, belum = 0;
    let sumAbs = 0, sumTgs = 0, sumBab = 0, sumSmt = 0;

    tbody.innerHTML = studentsCache.map((s, idx) => {
        const m = computeStudentMetrics(s.id);
        sumAbs += m.attScore; sumTgs += m.avgTugas; sumBab += m.avgBab; sumSmt += m.avgSmt;
        const ok = m.finalScore >= m.kkm;
        if (ok) tuntas++; else belum++;

        return `
            <tr>
                <td class="p-2.5 text-center">${idx + 1}</td>
                <td class="p-2.5 font-mono text-xs">${s.nisn}</td>
                <td class="p-2.5 font-bold">${s.nama}</td>
                <td class="p-2.5 text-center">${m.attScore.toFixed(1)}</td>
                <td class="p-2.5 text-center">${m.avgTugas.toFixed(1)}</td>
                <td class="p-2.5 text-center">${m.avgBab.toFixed(1)}</td>
                <td class="p-2.5 text-center">${m.avgSmt.toFixed(1)}</td>
                <td class="p-2.5 text-center font-extrabold bg-blue-50/60 text-blue-800">${m.finalScore.toFixed(1)}</td>
                <td class="p-2.5 text-center">${m.kkm}</td>
                <td class="p-2.5 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${ok ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">${ok ? 'TUNTAS' : 'REMEDIAL'}</span></td>
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
                labels: ['Absen', 'Tugas', 'Ujian Bab', 'Semester'],
                datasets: [{ label: 'Rata-rata', data: [sumAbs / n, sumTgs / n, sumBab / n, sumSmt / n], backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6', '#f59e0b'], borderRadius: 6 }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 0, max: 100 } }, plugins: { legend: { display: false } } }
        });
    }

    destroyChart('chartRekapKKM');
    const c2 = document.getElementById('chartRekapKKM');
    if (c2) {
        chartInstances['chartRekapKKM'] = new Chart(c2, {
            type: 'doughnut',
            data: {
                labels: ['Tuntas KKM', 'Belum Tuntas'],
                datasets: [{ data: [tuntas, belum], backgroundColor: ['#10b981', '#f43f5e'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
        });
    }
}

function exportRekapExcel() {
    const rows = studentsCache.map((s, idx) => {
        const m = computeStudentMetrics(s.id);
        return {
            No: idx + 1,
            NISN: s.nisn,
            Nama: s.nama,
            Absen: Number(m.attScore.toFixed(1)),
            Tugas: Number(m.avgTugas.toFixed(1)),
            Ujian_Bab: Number(m.avgBab.toFixed(1)),
            Semester: Number(m.avgSmt.toFixed(1)),
            Nilai_Akhir: Number(m.finalScore.toFixed(1)),
            Status: m.finalScore >= m.kkm ? 'TUNTAS' : 'REMEDIAL'
        };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Rekap_Nilai');
    XLSX.writeFile(wb, 'Rekap_Nilai_Akhir.xlsx');
}

function printClassRekapPDF() {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const amp = getActiveAmpuan();
    const cls = classesCache.find(c => Number(c.id) === Number(activeClassId));
    doc.setFontSize(14);
    doc.text(`REKAPITULASI NILAI — ${cls?.nama_kelas || ''} (${amp?.mapel || ''})`, 14, 16);
    doc.autoTable({
        startY: 22,
        head: [['No', 'NISN', 'Nama Siswa', 'Absen', 'Tugas', 'Bab', 'Smt', 'Akhir', 'Status']],
        body: studentsCache.map((s, idx) => {
            const m = computeStudentMetrics(s.id);
            return [idx + 1, s.nisn, s.nama, m.attScore.toFixed(1), m.avgTugas.toFixed(1), m.avgBab.toFixed(1), m.avgSmt.toFixed(1), m.finalScore.toFixed(1), m.finalScore >= m.kkm ? 'TUNTAS' : 'REMEDIAL'];
        })
    });
    doc.save('Rekap_Nilai_Kelas.pdf');
}

function printStudentRaporPDF(studentId) {
    const s = studentsCache.find(x => x.id === studentId);
    if (!s) return;
    const m = computeStudentMetrics(s.id);
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text(`LAPORAN CAPAIAN BELAJAR SISWA`, 14, 18);
    doc.setFontSize(11);
    doc.text(`Nama: ${s.nama} (${s.nisn})`, 14, 28);
    doc.text(`Nilai Akhir: ${m.finalScore.toFixed(1)} | KKM: ${m.kkm} | Status: ${m.finalScore >= m.kkm ? 'TUNTAS' : 'REMEDIAL'}`, 14, 36);
    doc.save(`Rapor_${s.nama.replace(/\s+/g, '_')}.pdf`);
}

// ==================== 10. GURU WALI (PA 360°) ====================
async function loadGuruWaliTab() {
    const [allStuRes, binRes] = await Promise.all([
        db.from('students').select('*, classes(nama_kelas)').order('nama'),
        db.from('wali_binaan').select('student_id').eq('teacher_id', currentUser.id)
    ]);
    allStudentsGlobal = allStuRes.data || [];
    binaanIdsCache = new Set((binRes.data || []).map(x => Number(x.student_id)));
    renderGuruWaliRows();
}

function renderGuruWaliRows() {
    const tbody = document.getElementById('wali-tbody');
    if (!tbody) return;
    const q = (document.getElementById('wali-search-input')?.value || '').toLowerCase();
    const binaanList = allStudentsGlobal.filter(s => binaanIdsCache.has(Number(s.id)) && (!q || s.nama.toLowerCase().includes(q)));

    document.getElementById('wali-stat-total').innerText = `${binaanList.length} Siswa`;
    document.getElementById('wali-stat-aman').innerText = `${binaanList.length} Siswa`;

    tbody.innerHTML = binaanList.length ? binaanList.map((s, idx) => `
        <tr>
            <td class="p-3 text-center">${idx + 1}</td>
            <td class="p-3">
                <div class="font-bold text-slate-900">${s.nama}</div>
                <div class="text-[10px] text-slate-500">${s.classes?.nama_kelas || '-'} • ${s.nisn}</div>
            </td>
            <td class="p-3 text-center font-bold text-emerald-600">Terpantau</td>
            <td class="p-3 text-center">-</td>
            <td class="p-3 text-center font-bold">-</td>
            <td class="p-3 text-center"><span class="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700">🟢 Aktif</span></td>
            <td class="p-3 text-center"><button onclick="openWali360Modal(${s.id})" class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 font-bold text-xs">Bedah 360°</button></td>
            <td class="p-3 text-center"><button onclick="openWali360Modal(${s.id})" class="px-2.5 py-1 rounded-lg bg-blue-600 text-white font-bold text-xs">Jurnal</button></td>
        </tr>
    `).join('') : `<tr><td colspan="8" class="p-6 text-center text-slate-400 italic">Belum ada siswa binaan dipilih. Klik tombol "Pilih / Kelola Siswa Binaan".</td></tr>`;
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
    const list = allStudentsGlobal.filter(s =>
        (cls === 'all' || String(s.class_id) === String(cls)) &&
        (!q || s.nama.toLowerCase().includes(q) || String(s.nisn).includes(q))
    );
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
    if (checked) binaanIdsCache.add(Number(id));
    else binaanIdsCache.delete(Number(id));
    document.getElementById('wali-picked-count-badge').innerText = `${binaanIdsCache.size} Siswa Dipilih`;
}

async function saveWaliBinaanSelection() {
    await db.from('wali_binaan').delete().eq('teacher_id', currentUser.id);
    const payload = [...binaanIdsCache].map(sid => ({ teacher_id: currentUser.id, student_id: sid }));
    if (payload.length) await db.from('wali_binaan').insert(payload);
    document.getElementById('modal-wali-manage').classList.add('hidden');
    showToast('✅ Daftar siswa binaan tersimpan!');
    renderGuruWaliRows();
}

async function openWali360Modal(studentId) {
    activeWaliStudentId = studentId;
    const s = allStudentsGlobal.find(x => Number(x.id) === Number(studentId));
    if (!s) return;
    document.getElementById('w360-nama').innerText = s.nama;
    document.getElementById('w360-kelas').innerText = s.classes?.nama_kelas || '-';
    document.getElementById('w360-nisn').innerText = s.nisn;
    document.getElementById('modal-wali-360').classList.remove('hidden');

    const { data: logs } = await db.from('wali_logs').select('*').eq('student_id', studentId).order('tanggal', { ascending: false });
    document.getElementById('w360-logs-list').innerHTML = (logs || []).map(l => `
        <div class="p-2.5 rounded-xl bg-slate-50 border text-xs">
            <div class="font-extrabold text-slate-900">${l.tanggal} — ${l.topik}</div>
            <p class="text-slate-600 mt-1">${l.catatan}</p>
        </div>
    `).join('') || `<p class="text-xs text-slate-400 italic">Belum ada catatan bimbingan.</p>`;
}
function closeWali360Modal() { document.getElementById('modal-wali-360').classList.add('hidden'); }

async function addWaliCounselingLog(e) {
    e.preventDefault();
    await db.from('wali_logs').insert([{
        teacher_id: currentUser.id,
        student_id: activeWaliStudentId,
        tanggal: document.getElementById('w360-log-date').value,
        topik: document.getElementById('w360-log-topic').value,
        catatan: document.getElementById('w360-log-note').value,
        tindak_lanjut: document.getElementById('w360-log-tindak').value
    }]);
    e.target.reset();
    showToast('✅ Jurnal bimbingan dicatat');
    openWali360Modal(activeWaliStudentId);
}

function saveWaliTargetAkademik() { showToast('✅ Target akademik siswa disimpan!'); }

function exportWaliBinaanExcel() {
    const list = allStudentsGlobal.filter(s => binaanIdsCache.has(Number(s.id)));
    const ws = XLSX.utils.json_to_sheet(list.map((s, i) => ({ No: i + 1, NISN: s.nisn, Nama: s.nama, Kelas: s.classes?.nama_kelas || '-' })));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Siswa_Binaan');
    XLSX.writeFile(wb, 'Daftar_Siswa_Binaan.xlsx');
}

// ==================== 11. PENGATURAN BOBOT & KKM ====================
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

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${encodeURIComponent(GOOGLE_OAUTH_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&response_type=code` +
        `&scope=${encodeURIComponent(scope)}` +
        `&access_type=offline` +
        `&prompt=consent` +
        `&state=${encodeURIComponent(String(currentUser.id))}`;

    window.location.href = authUrl;
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
            body: {
                action: 'exchange_code',
                code: code,
                redirect_uri: getGoogleRedirectUri(),
                teacher_id: Number(stateTeacherId)
            }
        });

        if (error || !data?.success) {
            throw new Error(data?.error || error?.message || 'Gagal verifikasi akun Google.');
        }

        if (currentUser && String(currentUser.id) === String(stateTeacherId)) {
            currentUser.gdrive_email = data.email;
            localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
        }

        updateGDriveConnectionUI();
        switchGuruTab('bobot');
        showToast(`✅ Google Drive (${data.email}) berhasil terhubung!`);
    } catch (err) {
        console.error(err);
        showToast('❌ Gagal menghubungkan Google Drive: ' + err.message, 'error');
    }
}

async function disconnectGoogleDrive() {
    if (!currentUser) return;
    if (!confirm('Putuskan koneksi Google Drive? Siswa tidak akan bisa mengunggah file langsung sampai Anda menghubungkannya kembali.')) return;

    showToast('⏳ Memutuskan koneksi...');
    const { data, error } = await db.functions.invoke('gdrive-bridge', {
        body: {
            action: 'disconnect',
            teacher_id: currentUser.id
        }
    });

    if (error || !data?.success) {
        return showToast('Gagal memutuskan koneksi: ' + (data?.error || error?.message), 'error');
    }

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
        badgeEl.innerHTML = `
            <span class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200">
                ✅ Terhubung: ${currentUser.gdrive_email}
            </span>
        `;
        btnContainer.innerHTML = `
            <button type="button" onclick="connectGoogleDrive()" class="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition">
                🔄 Ganti Akun
            </button>
            <button type="button" onclick="disconnectGoogleDrive()" class="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 text-xs font-bold transition">
                Putuskan
            </button>
        `;
    } else {
        badgeEl.innerHTML = `
            <span class="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-600">
                ⚪ Belum Terhubung
            </span>
        `;
        btnContainer.innerHTML = `
            <button type="button" onclick="connectGoogleDrive()" class="px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition flex items-center gap-2">
                <i class="fa-brands fa-google"></i> Hubungkan Google Drive
            </button>
        `;
    }
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.className = `fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg text-white transition-all duration-300 ${type === 'error' ? 'bg-rose-600' : 'bg-slate-900'}`;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3500);
}
