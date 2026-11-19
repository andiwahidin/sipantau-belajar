// ============================================================================
// PANTAU BELAJAR — APP-SISWA.JS (PORTAL LMS SISWA)
// ============================================================================
let teachersCache = [];
let currentPortalStudent = null;
let currentDatePeriodName = '';
let currentAssessmentsList = [];
let currentScoresList = [];
let currentMaterialsList = [];
let currentMaterialReadsList = [];
let materialReadsTableAvailable = true;
let currentAttLogsList = [];
let currentAttRecapList = [];
let currentPublishedGradesList = [];
let currentAnnouncementsList = [];
let currentCommentsList = [];
let selectedMapelFilter = 'all';
let selectedAssessmentObj = null;
let studentTaskChartInstance = null;
let studentAttChartInstance = null;
let isUploadingNow = false;
let stuCalYear = new Date().getFullYear();
let stuCalMonth = new Date().getMonth();
let stuCalSelectedDateKey = null;
let activeStudentTab = 'beranda';
let studentRealtimeChannel = null;
let studentRealtimeRefreshTimer = null;
let activeCheckinSessions = [];
let attendanceSessionsTableAvailable = true;
let stuCheckinCountdownTimer = null;
let pendingCheckinToken = '';
let activeStuQuizState = null;
let stuQuizTimerInterval = null;

function parseStuQuizDataSafe(raw) {
    if (!raw) return null;
    if (typeof raw === 'object') return raw;
    try { return JSON.parse(raw); } catch { return null; }
}

function escapeHtmlSafe(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Deteksi otomatis periode akademik berdasarkan tanggal hari ini
function detectCurrentPeriodName(dateObj = new Date()) {
    const year = dateObj.getFullYear();
    const month = dateObj.getMonth() + 1;
    const semester = month <= 6 ? 'Genap' : 'Ganjil';
    return `Semester ${semester} ${year}`;
}

function matchesStudentCurrentPeriod(recordPeriode) {
    if (!recordPeriode) return currentDatePeriodName === 'Semester Ganjil 2026';
    return recordPeriode === currentDatePeriodName;
}

function toggleStudentTheme() {
    const isDark = document.documentElement.classList.toggle('dark');
    localStorage.setItem('sipantau_theme', isDark ? 'dark' : 'light');
    renderStudentBerandaTab();
}

window.addEventListener('DOMContentLoaded', async () => {
    currentDatePeriodName = detectCurrentPeriodName(new Date());

    try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlToken = (urlParams.get('checkin') || '').trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (urlToken) {
            pendingCheckinToken = urlToken;
            sessionStorage.setItem('sipantau_pending_checkin_token', urlToken);
        } else {
            pendingCheckinToken = sessionStorage.getItem('sipantau_pending_checkin_token') || '';
        }
    } catch {}

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
        if (!localStorage.getItem('sipantau_theme')) {
            document.documentElement.classList.toggle('dark', e.matches);
            renderStudentBerandaTab();
        }
    });

    const saved = localStorage.getItem('sipantau_student');
    if (saved) {
        try {
            const parsed = JSON.parse(saved);
            const { data: freshStu } = await db.from('students')
                .select('*, classes(nama_kelas)')
                .eq('id', parsed.id)
                .single();
            if (freshStu) {
                currentPortalStudent = freshStu;
                localStorage.setItem('sipantau_student', JSON.stringify(currentPortalStudent));
                await enterStudentLMS();
                return;
            }
        } catch {
            localStorage.removeItem('sipantau_student');
        }
    }
    showLoginView();
});

function showLoginView() {
    document.getElementById('view-student-login').classList.remove('hidden');
    document.getElementById('view-student-lms').classList.add('hidden');
}

async function handleStudentLogin(e) {
    e.preventDefault();
    const nisnInput = document.getElementById('stu-login-nisn').value.trim();
    const passInput = document.getElementById('stu-login-pass').value;
    const btn = document.getElementById('btn-stu-login');
    btn.disabled = true;
    btn.innerText = 'Memeriksa akun...';

    const { data: stu, error } = await db.from('students')
        .select('*, classes(nama_kelas)')
        .eq('nisn', nisnInput)
        .maybeSingle();

    btn.disabled = false;
    btn.innerText = 'Masuk ke LMS Siswa →';

    if (error || !stu) return showToast('NISN tidak terdaftar di sistem!', 'error');

    const validPassword = (stu.password && stu.password.trim() !== '') ? stu.password : stu.nisn;
    if (passInput !== validPassword) {
        return showToast('Password salah! Gunakan NISN jika belum pernah diganti.', 'error');
    }

    currentPortalStudent = stu;
    localStorage.setItem('sipantau_student', JSON.stringify(currentPortalStudent));
    showToast(`Selamat datang, ${stu.nama}!`);
    await enterStudentLMS();
}

async function enterStudentLMS() {
    document.getElementById('view-student-login').classList.add('hidden');
    document.getElementById('view-student-lms').classList.remove('hidden');

    currentDatePeriodName = detectCurrentPeriodName(new Date());
    const className = currentPortalStudent.classes?.nama_kelas || 'Kelas';
    const initials = (currentPortalStudent.nama || 'SW').split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

    document.getElementById('stu-avatar').innerText = initials;
    document.getElementById('stu-topbar-name').innerText = currentPortalStudent.nama;
    document.getElementById('stu-topbar-nisn').innerText = `NISN: ${currentPortalStudent.nisn}`;
    document.getElementById('stu-topbar-class').innerText = `Kelas: ${className}`;
    const shortPeriod = String(currentDatePeriodName || '').replace(/^Semester\s+/i, '');
    document.getElementById('stu-topbar-period').innerText = `🗓️ ${shortPeriod}`;
    document.getElementById('stu-mobile-period').innerText = shortPeriod;
    document.getElementById('portal-banner-period').innerText = `🗓️ ${shortPeriod}`;
    document.getElementById('portal-stu-name').innerText = currentPortalStudent.nama;
    document.getElementById('portal-stu-nisn').innerText = `NISN: ${currentPortalStudent.nisn} | Kelas: ${className}`;

    const { data: tchData } = await db.from('app_users').select('id, nama_lengkap, gdrive_email');
    teachersCache = tchData || [];

    await loadAllStudentLMSData();
    setupStudentRealtime();
    if (pendingCheckinToken) {
        const inp = document.getElementById('stu-checkin-token');
        if (inp) inp.value = pendingCheckinToken;
        switchStudentTab('kehadiran');
        showToast(`⚡ Token presensi ${pendingCheckinToken} siap! Klik Check-in Hadir.`, 'info');
    } else {
        switchStudentTab('beranda');
    }
}

function studentLogout() {
    if (studentRealtimeChannel && typeof db.removeChannel === 'function') {
        db.removeChannel(studentRealtimeChannel);
        studentRealtimeChannel = null;
    }
    if (stuCheckinCountdownTimer) {
        clearInterval(stuCheckinCountdownTimer);
        stuCheckinCountdownTimer = null;
    }
    if (stuQuizTimerInterval) {
        clearInterval(stuQuizTimerInterval);
        stuQuizTimerInterval = null;
    }
    localStorage.removeItem('sipantau_student');
    currentPortalStudent = null;
    if (studentTaskChartInstance) { studentTaskChartInstance.destroy(); studentTaskChartInstance = null; }
    if (studentAttChartInstance) { studentAttChartInstance.destroy(); studentAttChartInstance = null; }
    showLoginView();
}

function toggleStuSidebar(forceClose = false) {
    const sb = document.getElementById('stu-sidebar');
    if (!sb) return;
    if (forceClose) sb.classList.add('hidden');
    else sb.classList.toggle('hidden');
}

function switchStudentTab(tab) {
    activeStudentTab = tab;
    const titles = {
        beranda: 'Beranda Akademik Siswa',
        materi: 'Materi & Modul Pembelajaran',
        tugas: 'Tugas & Pengumpulan File / Link',
        kehadiran: 'Kehadiran & Riwayat Ketidakhadiran',
        nilai: 'Hasil Belajar Akhir',
        pengumuman: 'Pengumuman & Diskusi Kelas'
    };
    document.getElementById('stu-page-title').innerText = titles[tab] || 'LMS Siswa';

    Object.keys(titles).forEach(t => {
        document.getElementById(`scontent-${t}`)?.classList.toggle('hidden', t !== tab);
        const btn = document.getElementById(`stab-${t}`);
        if (btn) {
            btn.className = t === tab
                ? 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 transition'
                : 'w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition';
        }
    });

    // Sinkronisasi highlight Bottom Navigation Bar Mobile Siswa
    const primaryMobileTabs = ['beranda', 'materi', 'tugas', 'kehadiran'];
    primaryMobileTabs.forEach(t => {
        const mBtn = document.getElementById(`smnav-${t}`);
        if (!mBtn) return;
        const isActive = tab === t;
        mBtn.classList.toggle('text-blue-600', isActive);
        mBtn.classList.toggle('dark:text-blue-400', isActive);
        mBtn.classList.toggle('font-extrabold', isActive);
        mBtn.classList.toggle('text-slate-500', !isActive);
        mBtn.classList.toggle('dark:text-slate-400', !isActive);
        mBtn.classList.toggle('font-bold', !isActive);
    });
    const moreBtn = document.getElementById('smnav-more');
    if (moreBtn) {
        const isMoreActive = !primaryMobileTabs.includes(tab);
        moreBtn.classList.toggle('text-blue-600', isMoreActive);
        moreBtn.classList.toggle('dark:text-blue-400', isMoreActive);
        moreBtn.classList.toggle('font-extrabold', isMoreActive);
        moreBtn.classList.toggle('text-slate-500', !isMoreActive);
        moreBtn.classList.toggle('dark:text-slate-400', !isMoreActive);
        moreBtn.classList.toggle('font-bold', !isMoreActive);
    }

    if (tab === 'pengumuman' && currentPortalStudent?.id) {
        localStorage.setItem(`sipantau_stu_last_seen_ann_${currentPortalStudent.id}`, new Date().toISOString());
        updateStudentSidebarBadges();
    }

    if (tab === 'beranda') renderStudentBerandaTab();
    if (tab === 'materi') renderStudentMaterialsTab();
    if (tab === 'tugas') renderStudentTasksTab();
    if (tab === 'kehadiran') renderStudentAttendanceTab();
    if (tab === 'nilai') renderPublishedFinalGrades();
    if (tab === 'pengumuman') renderStudentAnnouncementsTab();
}

function openStuPasswordModal() { document.getElementById('modal-stu-password').classList.remove('hidden'); }
function closeStuPasswordModal() { document.getElementById('modal-stu-password').classList.add('hidden'); }

async function handleStudentChangePassword(e) {
    e.preventDefault();
    const oldP = document.getElementById('stu-cp-old').value;
    const newP = document.getElementById('stu-cp-new').value;
    const confP = document.getElementById('stu-cp-confirm').value;

    const currentValidPass = (currentPortalStudent.password && currentPortalStudent.password.trim() !== '')
        ? currentPortalStudent.password
        : currentPortalStudent.nisn;

    if (oldP !== currentValidPass) return showToast('Password lama tidak sesuai!', 'error');
    if (newP !== confP) return showToast('Konfirmasi password baru tidak cocok!', 'error');

    const { error } = await db.from('students').update({ password: newP }).eq('id', currentPortalStudent.id);
    if (error) return showToast('Gagal mengubah password: ' + error.message, 'error');

    currentPortalStudent.password = newP;
    localStorage.setItem('sipantau_student', JSON.stringify(currentPortalStudent));
    closeStuPasswordModal();
    e.target.reset();
    showToast('✅ Password berhasil diperbarui!');
}

function parseFileJsonArray(raw) {
    if (!raw) return [];
    try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed;
    } catch {
        if (typeof raw === 'string' && raw.startsWith('http')) {
            return [{ name: 'Lampiran File', url: raw }];
        }
    }
    return [];
}

async function loadAllStudentLMSData() {
    if (!currentPortalStudent) return;
    const cid = currentPortalStudent.class_id;
    const sid = currentPortalStudent.id;

    const [assRes, scoresRes, attLogsRes, attRecapRes, finalRes, matRes, annRes, matReadsRes, attSessRes] = await Promise.all([
        db.from('assessments').select('*').eq('class_id', cid).eq('tampil_publik', true).order('id', { ascending: false }),
        db.from('scores').select('*').eq('student_id', sid),
        db.from('attendance_logs').select('*').eq('class_id', cid).eq('student_id', sid).order('tanggal', { ascending: false }),
        db.from('attendance').select('*').eq('student_id', sid),
        db.from('final_grades').select('*').eq('student_id', sid).eq('is_published', true).order('mapel'),
        db.from('materials').select('*').eq('class_id', cid).eq('tampil_publik', true).order('created_at', { ascending: false }),
        db.from('announcements').select('*').eq('class_id', cid).order('created_at', { ascending: false }),
        db.from('material_reads').select('*').eq('student_id', sid),
        db.from('attendance_sessions').select('*').eq('class_id', cid).eq('is_active', true).order('created_at', { ascending: false })
    ]);

    currentAssessmentsList = (assRes.data || []).filter(a => matchesStudentCurrentPeriod(a.periode));
    currentScoresList = scoresRes.data || [];
    currentAttLogsList = (attLogsRes.data || []).filter(l => matchesStudentCurrentPeriod(l.periode));
    currentAttRecapList = (attRecapRes.data || []).filter(r => matchesStudentCurrentPeriod(r.periode));
    currentPublishedGradesList = (finalRes.data || []).filter(g => matchesStudentCurrentPeriod(g.periode));
    currentMaterialsList = (matRes.data || []).filter(m => matchesStudentCurrentPeriod(m.periode));
    currentAnnouncementsList = (annRes.data || []).filter(an => matchesStudentCurrentPeriod(an.periode));

    if (attSessRes.error) {
        attendanceSessionsTableAvailable = false;
        activeCheckinSessions = [];
    } else {
        attendanceSessionsTableAvailable = true;
        const nowMs = Date.now();
        activeCheckinSessions = (attSessRes.data || []).filter(s =>
            matchesStudentCurrentPeriod(s.periode) && new Date(s.expires_at).getTime() > nowMs
        );
    }

    const matReadsStorageKey = `sipantau_stu_mat_reads_${sid}`;
    if (matReadsRes.error) {
        materialReadsTableAvailable = false;
        try {
            const cached = JSON.parse(localStorage.getItem(matReadsStorageKey) || '[]');
            currentMaterialReadsList = Array.isArray(cached) ? cached : [];
        } catch {
            currentMaterialReadsList = [];
        }
    } else {
        materialReadsTableAvailable = true;
        currentMaterialReadsList = matReadsRes.data || [];
        localStorage.setItem(matReadsStorageKey, JSON.stringify(currentMaterialReadsList));
    }

    const annIds = currentAnnouncementsList.map(a => a.id);
    if (annIds.length > 0) {
        const comRes = await db.from('announcement_comments').select('*').in('announcement_id', annIds).order('created_at');
        currentCommentsList = comRes.data || [];
    } else {
        currentCommentsList = [];
    }

    const allMapels = [...new Set([
        ...currentMaterialsList.map(m => m.mapel),
        ...currentAssessmentsList.map(a => a.mapel),
        ...currentAttLogsList.map(l => l.mapel),
        ...currentPublishedGradesList.map(g => g.mapel),
        ...currentAnnouncementsList.map(an => an.mapel)
    ].filter(Boolean))].sort();

    const filterSel = document.getElementById('stu-filter-mapel');
    if (filterSel) {
        filterSel.innerHTML = `<option value="all">Semua Mata Pelajaran (${allMapels.length})</option>` +
            allMapels.map(m => `<option value="${m}">${m}</option>`).join('');
        if (allMapels.includes(selectedMapelFilter)) filterSel.value = selectedMapelFilter;
        else selectedMapelFilter = 'all';
    }

    renderStudentActiveCheckinUI();
    renderStudentBerandaTab();
    renderStudentMaterialsTab();
    renderStudentTasksTab();
    renderStudentAttendanceTab();
    renderPublishedFinalGrades();
    renderStudentAnnouncementsTab();
    updateStudentSidebarBadges();
}

function updateStudentSidebarBadges() {
    const readSet = new Set(currentMaterialReadsList.map(r => Number(r.material_id)));
    const unreadMatCount = currentMaterialsList.filter(m => !readSet.has(Number(m.id))).length;
    const matBadge = document.getElementById('badge-stu-materi');
    if (matBadge) {
        matBadge.innerText = unreadMatCount > 99 ? '99+' : String(unreadMatCount);
        matBadge.classList.toggle('hidden', unreadMatCount === 0);
    }
    const mMatBadge = document.getElementById('mbadge-stu-materi');
    if (mMatBadge) {
        mMatBadge.innerText = unreadMatCount > 99 ? '99+' : String(unreadMatCount);
        mMatBadge.classList.toggle('hidden', unreadMatCount === 0);
    }

    const unsubmittedCount = currentAssessmentsList.filter(a => {
        const sc = currentScoresList.find(s => Number(s.assessment_id) === Number(a.id));
        return !(sc?.status_kumpul === true || sc?.status_pengajuan === 'approved' || sc?.status_pengajuan === 'pending');
    }).length;
    const tugasBadge = document.getElementById('badge-stu-tugas');
    if (tugasBadge) {
        tugasBadge.innerText = unsubmittedCount > 99 ? '99+' : String(unsubmittedCount);
        tugasBadge.classList.toggle('hidden', unsubmittedCount === 0);
    }
    const mTugasBadge = document.getElementById('mbadge-stu-tugas');
    if (mTugasBadge) {
        mTugasBadge.innerText = unsubmittedCount > 99 ? '99+' : String(unsubmittedCount);
        mTugasBadge.classList.toggle('hidden', unsubmittedCount === 0);
    }

    if (currentPortalStudent?.id) {
        const key = `sipantau_stu_last_seen_ann_${currentPortalStudent.id}`;
        if (activeStudentTab === 'pengumuman') {
            localStorage.setItem(key, new Date().toISOString());
        }
        const lastSeenIso = localStorage.getItem(key) || '1970-01-01T00:00:00.000Z';
        const newAnnCount = currentAnnouncementsList.filter(an => new Date(an.created_at).toISOString() > lastSeenIso).length;
        const newTeacherReplies = currentCommentsList.filter(c =>
            c.author_role === 'guru' && new Date(c.created_at).toISOString() > lastSeenIso
        ).length;
        const totalUnread = newAnnCount + newTeacherReplies;

        const annBadge = document.getElementById('badge-stu-pengumuman');
        if (annBadge) {
            annBadge.innerText = totalUnread > 99 ? '99+' : String(totalUnread);
            annBadge.classList.toggle('hidden', totalUnread === 0);
        }
        const mMoreDot = document.getElementById('mbadge-stu-more');
        if (mMoreDot) {
            mMoreDot.classList.toggle('hidden', totalUnread === 0);
        }
    }
}

function setupStudentRealtime() {
    if (studentRealtimeChannel || typeof db.channel !== 'function' || !currentPortalStudent) return;
    const cid = Number(currentPortalStudent.class_id);
    const sid = Number(currentPortalStudent.id);

    const scheduleStuRefresh = (msg) => {
        if (msg) showToast(msg, 'info');
        clearTimeout(studentRealtimeRefreshTimer);
        studentRealtimeRefreshTimer = setTimeout(() => {
            if (currentPortalStudent) loadAllStudentLMSData();
        }, 500);
    };

    let channelBuilder = db.channel(`student-live-${sid}`)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcements', filter: `class_id=eq.${cid}` }, () => {
            scheduleStuRefresh('📢 Pengumuman baru dari guru!');
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'assessments', filter: `class_id=eq.${cid}` }, () => {
            scheduleStuRefresh('📝 Tugas atau penilaian baru ditambahkan!');
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'materials', filter: `class_id=eq.${cid}` }, () => {
            scheduleStuRefresh('📘 Materi pembelajaran baru tersedia!');
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'scores', filter: `student_id=eq.${sid}` }, (payload) => {
            const row = payload.new;
            if (!row) return;
            if (row.status_pengajuan === 'rejected') {
                scheduleStuRefresh('❌ Tugas dikembalikan guru untuk revisi!');
            } else if (row.nilai !== null && row.nilai !== undefined && row.nilai !== '') {
                scheduleStuRefresh('📝 Nilai atau feedback tugas diperbarui guru!');
            } else if (row.catatan_guru) {
                scheduleStuRefresh('💬 Guru menambahkan catatan pada tugas Anda!');
            } else {
                scheduleStuRefresh(null);
            }
        })
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'announcement_comments' }, (payload) => {
            const row = payload.new;
            if (!row || row.author_role !== 'guru') return;
            if (currentAnnouncementsList.some(an => Number(an.id) === Number(row.announcement_id))) {
                scheduleStuRefresh('💬 Guru membalas diskusi kelas!');
            }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_logs', filter: `student_id=eq.${sid}` }, () => {
            scheduleStuRefresh(null);
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'final_grades', filter: `student_id=eq.${sid}` }, (payload) => {
            if (payload.new?.is_published) scheduleStuRefresh('🏆 Nilai akhir mata pelajaran diperbarui!');
        });

    if (attendanceSessionsTableAvailable) {
        channelBuilder = channelBuilder.on('postgres_changes', { event: '*', schema: 'public', table: 'attendance_sessions', filter: `class_id=eq.${cid}` }, (payload) => {
            const row = payload.new;
            if (payload.eventType === 'INSERT' && row?.is_active) {
                scheduleStuRefresh(`⚡ Guru membuka sesi presensi ${row.mapel || ''}!`);
            } else {
                scheduleStuRefresh(null);
            }
        });
    }

    studentRealtimeChannel = channelBuilder.subscribe();
}

function formatStuCountdownMs(ms) {
    const totalSec = Math.max(0, Math.floor(ms / 1000));
    const hrs = Math.floor(totalSec / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = totalSec % 60;
    if (hrs > 0) return `${String(hrs).padStart(2, '0')}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

function renderStudentActiveCheckinUI() {
    const berandaBox = document.getElementById('stu-beranda-active-session');
    const attBanner = document.getElementById('stu-checkin-active-banner');
    if (stuCheckinCountdownTimer) {
        clearInterval(stuCheckinCountdownTimer);
        stuCheckinCountdownTimer = null;
    }

    if (!attendanceSessionsTableAvailable) {
        if (berandaBox) berandaBox.classList.add('hidden');
        if (attBanner) {
            attBanner.classList.remove('hidden');
            attBanner.innerHTML = `<div class="p-2.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-200 dark:border-amber-800 text-[11px] text-amber-800 dark:text-amber-300">ℹ️ Sesi presensi QR/Token menunggu tabel <code class="font-mono font-bold">attendance_sessions</code> diaktifkan oleh admin/guru.</div>`;
        }
        return;
    }

    const openSessions = activeCheckinSessions.filter(s =>
        s.is_active === true && new Date(s.expires_at).getTime() > Date.now()
    );

    if (!openSessions.length) {
        if (berandaBox) { berandaBox.classList.add('hidden'); berandaBox.innerHTML = ''; }
        if (attBanner) { attBanner.classList.add('hidden'); attBanner.innerHTML = ''; }
        return;
    }

    const renderSessionCard = (sess, isBeranda) => {
        const alreadyH = currentAttLogsList.some(l =>
            l.mapel === sess.mapel && l.tanggal === sess.tanggal && l.status === 'H'
        );
        return `
            <div class="p-3.5 rounded-2xl border ${alreadyH ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/70 dark:bg-emerald-950/40' : 'border-indigo-200 dark:border-indigo-800 bg-indigo-50/80 dark:bg-indigo-950/40'} flex flex-wrap items-center justify-between gap-3">
                <div class="space-y-0.5 min-w-0">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${alreadyH ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-600 text-white animate-pulse'}">
                            ${alreadyH ? '✅ Sudah Hadir' : '⚡ Presensi Dibuka'}
                        </span>
                        <span class="font-extrabold text-xs text-slate-900 dark:text-white">${escapeHtmlSafe(sess.mapel)}</span>
                        <span class="text-[11px] text-slate-500 dark:text-slate-400">(${escapeHtmlSafe(sess.tanggal)})</span>
                    </div>
                    <div class="text-[11px] text-slate-600 dark:text-slate-300 font-mono">
                        Sisa waktu: <b class="stu-sess-countdown text-amber-700 dark:text-amber-300" data-exp="${escapeHtmlSafe(sess.expires_at)}">--:--</b>
                    </div>
                </div>
                ${alreadyH ? '' : `
                    <div class="flex items-center gap-2 shrink-0">
                        <button type="button" onclick="quickCheckinFromSession('${escapeHtmlSafe(sess.token)}')" class="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm">
                            ✅ Check-in Sekarang
                        </button>
                        ${isBeranda ? `<button type="button" onclick="switchStudentTab('kehadiran')" class="px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs font-bold">Buka Tab</button>` : ''}
                    </div>
                `}
            </div>
        `;
    };

    if (berandaBox) {
        berandaBox.classList.remove('hidden');
        berandaBox.innerHTML = openSessions.map(s => renderSessionCard(s, true)).join('');
    }
    if (attBanner) {
        attBanner.classList.remove('hidden');
        attBanner.innerHTML = openSessions.map(s => renderSessionCard(s, false)).join('');
    }

    const tick = () => {
        const els = document.querySelectorAll('.stu-sess-countdown');
        let anyExpired = false;
        els.forEach(el => {
            const diff = new Date(el.dataset.exp).getTime() - Date.now();
            if (diff <= 0) {
                el.innerText = '00:00';
                anyExpired = true;
            } else {
                el.innerText = formatStuCountdownMs(diff);
            }
        });
        if (anyExpired) {
            clearInterval(stuCheckinCountdownTimer);
            stuCheckinCountdownTimer = null;
            setTimeout(() => renderStudentActiveCheckinUI(), 1000);
        }
    };
    tick();
    stuCheckinCountdownTimer = setInterval(tick, 1000);
}

async function quickCheckinFromSession(token) {
    const inp = document.getElementById('stu-checkin-token');
    if (inp) inp.value = token;
    await submitStudentCheckinToken(null, token);
}

async function submitStudentCheckinToken(e, overrideToken = null) {
    if (e) e.preventDefault();
    if (!currentPortalStudent) return;
    if (!attendanceSessionsTableAvailable) {
        return showToast('Fitur Presensi QR/Token belum diaktifkan di database (tabel attendance_sessions belum dibuat).', 'error');
    }

    const inp = document.getElementById('stu-checkin-token');
    const rawToken = (overrideToken || inp?.value || '').trim().toUpperCase();
    if (!rawToken) return showToast('Masukkan kode token presensi dari guru!', 'error');

    const btn = document.getElementById('btn-stu-checkin');
    if (btn) btn.disabled = true;

    try {
        const { data: sess, error: sessErr } = await db.from('attendance_sessions')
            .select('*')
            .eq('class_id', currentPortalStudent.class_id)
            .eq('token', rawToken)
            .eq('is_active', true)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();

        if (sessErr) throw new Error(sessErr.message);
        if (!sess) {
            return showToast('❌ Token presensi tidak ditemukan atau sudah ditutup oleh guru.', 'error');
        }
        if (new Date(sess.expires_at).getTime() <= Date.now()) {
            return showToast('⏰ Waktu sesi presensi untuk token ini sudah berakhir!', 'error');
        }

        const { data: existingLog } = await db.from('attendance_logs')
            .select('*')
            .eq('class_id', currentPortalStudent.class_id)
            .eq('student_id', currentPortalStudent.id)
            .eq('mapel', sess.mapel)
            .eq('tanggal', sess.tanggal)
            .maybeSingle();

        if (existingLog) {
            if (existingLog.status === 'H') {
                pendingCheckinToken = '';
                sessionStorage.removeItem('sipantau_pending_checkin_token');
                if (inp) inp.value = '';
                return showToast(`✅ Anda sudah tercatat Hadir untuk ${sess.mapel} (${sess.tanggal}).`);
            }
            const { error: updErr } = await db.from('attendance_logs')
                .update({ status: 'H', periode: sess.periode })
                .eq('id', existingLog.id);
            if (updErr) throw new Error(updErr.message);
        } else {
            const { error: insErr } = await db.from('attendance_logs')
                .insert([{
                    teacher_id: sess.teacher_id,
                    class_id: currentPortalStudent.class_id,
                    student_id: currentPortalStudent.id,
                    mapel: sess.mapel,
                    periode: sess.periode,
                    tanggal: sess.tanggal,
                    status: 'H'
                }]);
            if (insErr) throw new Error(insErr.message);
        }

        pendingCheckinToken = '';
        sessionStorage.removeItem('sipantau_pending_checkin_token');
        if (inp) inp.value = '';
        try {
            const cleanUrl = new URL(window.location.href);
            if (cleanUrl.searchParams.has('checkin')) {
                cleanUrl.searchParams.delete('checkin');
                window.history.replaceState({}, '', cleanUrl.toString());
            }
        } catch {}

        showToast(`🎉 Presensi Hadir berhasil dicatat untuk ${sess.mapel}!`);
        await loadAllStudentLMSData();
    } catch (err) {
        showToast('❌ Gagal check-in: ' + err.message, 'error');
    } finally {
        if (btn) btn.disabled = false;
    }
}

function onStudentMapelFilterChange() {
    selectedMapelFilter = document.getElementById('stu-filter-mapel').value;
    renderStudentBerandaTab();
    renderStudentMaterialsTab();
    renderStudentTasksTab();
    renderStudentAttendanceTab();
    renderPublishedFinalGrades();
    renderStudentAnnouncementsTab();
}

function filterBySelectedMapel(arr) {
    if (selectedMapelFilter === 'all') return arr;
    return arr.filter(item => String(item.mapel || '') === selectedMapelFilter);
}

function renderStudentBerandaTab() {
    const assFiltered = filterBySelectedMapel(currentAssessmentsList);
    const matFiltered = filterBySelectedMapel(currentMaterialsList);
    const annFiltered = filterBySelectedMapel(currentAnnouncementsList);
    const logsFiltered = filterBySelectedMapel(currentAttLogsList);

    let doneCount = 0, pendingCount = 0;
    assFiltered.forEach(a => {
        const sc = currentScoresList.find(s => Number(s.assessment_id) === Number(a.id));
        if (sc?.status_kumpul === true || sc?.status_pengajuan === 'approved') doneCount++;
        else if (sc?.status_pengajuan === 'pending') pendingCount++;
    });
    const belumCount = Math.max(0, assFiltered.length - (doneCount + pendingCount));

    let h = 0, s = 0, i = 0, a = 0;
    if (logsFiltered.length > 0) {
        logsFiltered.forEach(l => {
            if (l.status === 'H') h++; else if (l.status === 'S') s++; else if (l.status === 'I') i++; else if (l.status === 'A') a++;
        });
    } else {
        const recFiltered = filterBySelectedMapel(currentAttRecapList);
        recFiltered.forEach(r => {
            h += Number(r.hadir || 0); s += Number(r.sakit || 0); i += Number(r.izin || 0); a += Number(r.alpa || 0);
        });
    }
    const totAtt = h + s + i + a;
    const attPct = totAtt > 0 ? Math.round((h / totAtt) * 100) : 100;

    document.getElementById('portal-stat-att').innerText = `${attPct}%`;
    document.getElementById('portal-stat-done').innerText = `${doneCount} / ${assFiltered.length}`;
    document.getElementById('portal-att-summary-pill').innerText = `H:${h} S:${s} I:${i} A:${a}`;

    document.getElementById('dash-stu-mat-count').innerText = matFiltered.length;
    document.getElementById('dash-stu-pending-count').innerText = belumCount;
    document.getElementById('dash-stu-pub-count').innerText = `${currentPublishedGradesList.length} Mapel`;
    document.getElementById('dash-stu-ann-count').innerText = annFiltered.length;

    const annBox = document.getElementById('beranda-latest-announcements');
    if (annBox) {
        annBox.innerHTML = annFiltered.length
            ? annFiltered.slice(0, 3).map(an => {
                const tch = teachersCache.find(t => Number(t.id) === Number(an.teacher_id));
                return `
                    <div class="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 text-xs">
                        <div class="flex items-center justify-between gap-2">
                            <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold text-[10px]">📘 ${an.mapel}</span>
                            <span class="text-[10px] text-slate-400">${new Date(an.created_at).toLocaleDateString('id-ID')}</span>
                        </div>
                        <h4 class="font-extrabold text-slate-900 dark:text-white mt-1">${an.judul}</h4>
                        <p class="text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">${an.isi}</p>
                        <span class="text-[10px] text-slate-400 block mt-1">Oleh: ${tch?.nama_lengkap || 'Guru'}</span>
                    </div>
                `;
            }).join('')
            : `<p class="text-xs text-slate-400 italic">Belum ada pengumuman terbaru pada periode ini.</p>`;
    }

    renderStudentDeadlineWidgets(assFiltered);

    setTimeout(() => {
        renderStudentCharts(doneCount, pendingCount, belumCount, h, s, i, a);
    }, 50);
}

function getDeadlineCountdownInfo(deadlineIso, isDone) {
    const dl = new Date(deadlineIso);
    const now = new Date();
    const diffMs = dl.getTime() - now.getTime();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const dlStart = new Date(dl.getFullYear(), dl.getMonth(), dl.getDate()).getTime();
    const diffDays = Math.round((dlStart - todayStart) / 86400000);

    if (isDone) {
        return { label: '✅ Selesai', cls: 'bg-emerald-100 text-emerald-700', dotCls: 'bg-emerald-500', state: 'done' };
    }
    if (diffMs < 0) {
        const lateDays = Math.max(1, Math.abs(diffDays));
        return { label: diffDays === 0 ? '⚠️ Lewat Jam' : `⚠️ Terlewat ${lateDays}h`, cls: 'bg-rose-100 text-rose-700', dotCls: 'bg-rose-500', state: 'overdue' };
    }
    if (diffDays === 0) {
        return { label: '🔥 Hari Ini', cls: 'bg-amber-100 text-amber-800', dotCls: 'bg-amber-500', state: 'soon' };
    }
    if (diffDays === 1) {
        return { label: '⏳ Besok', cls: 'bg-amber-100 text-amber-800', dotCls: 'bg-amber-500', state: 'soon' };
    }
    if (diffDays <= 3) {
        return { label: `⏰ ${diffDays} Hari Lagi`, cls: 'bg-orange-100 text-orange-800', dotCls: 'bg-orange-500', state: 'soon' };
    }
    return { label: `📅 ${diffDays} Hari Lagi`, cls: 'bg-blue-100 text-blue-700', dotCls: 'bg-blue-500', state: 'upcoming' };
}

function shiftStudentCalMonth(delta) {
    stuCalMonth += delta;
    if (stuCalMonth < 0) { stuCalMonth = 11; stuCalYear--; }
    if (stuCalMonth > 11) { stuCalMonth = 0; stuCalYear++; }
    stuCalSelectedDateKey = null;
    renderStudentDeadlineWidgets(filterBySelectedMapel(currentAssessmentsList));
}

function selectStudentCalDate(dateKey) {
    stuCalSelectedDateKey = stuCalSelectedDateKey === dateKey ? null : dateKey;
    renderStudentDeadlineWidgets(filterBySelectedMapel(currentAssessmentsList));
}

function openTaskFromReminder(assessmentId) {
    switchStudentTab('tugas');
    setTimeout(() => {
        const card = document.getElementById(`stu-task-card-${assessmentId}`);
        if (card) {
            card.scrollIntoView({ behavior: 'smooth', block: 'center' });
            card.classList.add('ring-2', 'ring-blue-500');
            setTimeout(() => card.classList.remove('ring-2', 'ring-blue-500'), 1800);
        }
    }, 80);
}

function renderStudentDeadlineWidgets(assFiltered) {
    const withDeadline = (assFiltered || [])
        .filter(a => Boolean(a.deadline))
        .map(a => {
            const sc = currentScoresList.find(s => Number(s.assessment_id) === Number(a.id));
            const isDone = sc?.status_kumpul === true || sc?.status_pengajuan === 'approved';
            const dl = new Date(a.deadline);
            const dateKey = `${dl.getFullYear()}-${String(dl.getMonth() + 1).padStart(2, '0')}-${String(dl.getDate()).padStart(2, '0')}`;
            return { ...a, isDone, dl, dateKey, info: getDeadlineCountdownInfo(a.deadline, isDone) };
        })
        .sort((a, b) => a.dl.getTime() - b.dl.getTime());

    // 1. Agenda Reminder List
    const remBox = document.getElementById('beranda-deadline-reminders');
    if (remBox) {
        const prioritized = [
            ...withDeadline.filter(x => !x.isDone),
            ...withDeadline.filter(x => x.isDone)
        ];
        remBox.innerHTML = prioritized.length ? prioritized.map(item => `
            <button type="button" onclick="openTaskFromReminder(${item.id})" class="w-full text-left p-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/70 hover:border-blue-400 transition flex items-start justify-between gap-2.5">
                <div class="min-w-0 space-y-1">
                    <div class="flex items-center gap-1.5 flex-wrap">
                        <span class="px-2 py-0.5 rounded bg-blue-100 text-blue-800 font-extrabold text-[10px]">📘 ${item.mapel}</span>
                        <span class="text-[10px] text-slate-400">${item.dl.toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</span>
                    </div>
                    <div class="font-extrabold text-xs text-slate-900 dark:text-white truncate">${item.judul}</div>
                </div>
                <span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold shrink-0 ${item.info.cls}">${item.info.label}</span>
            </button>
        `).join('') : `<p class="text-xs text-slate-400 italic py-6 text-center">Belum ada tugas dengan batas waktu (deadline) pada periode ini.</p>`;
    }

    // 2. Monthly Calendar
    const monthLabel = document.getElementById('stu-cal-month-label');
    const grid = document.getElementById('stu-cal-grid');
    const detailBox = document.getElementById('stu-cal-day-detail');
    if (!monthLabel || !grid) return;

    const monthNames = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    monthLabel.innerText = `${monthNames[stuCalMonth]} ${stuCalYear}`;

    const firstDay = new Date(stuCalYear, stuCalMonth, 1).getDay();
    const daysInMonth = new Date(stuCalYear, stuCalMonth + 1, 0).getDate();
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    const byDate = {};
    withDeadline.forEach(item => {
        if (!byDate[item.dateKey]) byDate[item.dateKey] = [];
        byDate[item.dateKey].push(item);
    });

    let cells = '';
    for (let i = 0; i < firstDay; i++) {
        cells += `<div class="h-9"></div>`;
    }
    for (let d = 1; d <= daysInMonth; d++) {
        const key = `${stuCalYear}-${String(stuCalMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const items = byDate[key] || [];
        const isToday = key === todayKey;
        const isSelected = key === stuCalSelectedDateKey;
        let dotHtml = '';
        if (items.length > 0) {
            const hasOverdue = items.some(it => it.info.state === 'overdue');
            const hasSoonOrOpen = items.some(it => !it.isDone);
            const dotColor = hasOverdue ? 'bg-rose-500' : (hasSoonOrOpen ? 'bg-amber-500' : 'bg-emerald-500');
            dotHtml = `<span class="w-1.5 h-1.5 rounded-full ${dotColor} mx-auto mt-0.5"></span>`;
        }
        cells += `
            <button type="button" onclick="selectStudentCalDate('${key}')" class="h-9 rounded-xl flex flex-col items-center justify-center text-[11px] font-bold transition ${isSelected ? 'bg-blue-600 text-white' : isToday ? 'bg-blue-50 dark:bg-blue-950/70 text-blue-700 dark:text-blue-300 border border-blue-300 dark:border-blue-700' : items.length ? 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                <span class="leading-none">${d}</span>
                ${dotHtml}
            </button>
        `;
    }
    grid.innerHTML = cells;

    if (detailBox) {
        if (stuCalSelectedDateKey && byDate[stuCalSelectedDateKey]?.length) {
            const listDay = byDate[stuCalSelectedDateKey];
            detailBox.classList.remove('hidden');
            detailBox.innerHTML = `<div class="text-[11px] font-extrabold text-slate-500">Tenggat tanggal ${stuCalSelectedDateKey.split('-').reverse().join('/')}:</div>` +
                listDay.map(it => `
                    <button type="button" onclick="openTaskFromReminder(${it.id})" class="w-full text-left px-2.5 py-1.5 rounded-lg bg-slate-50 dark:bg-slate-800 hover:bg-blue-50 dark:hover:bg-blue-950/50 flex items-center justify-between gap-2">
                        <span class="font-bold text-slate-800 dark:text-slate-200 truncate">📘 ${it.mapel} — ${it.judul}</span>
                        <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold shrink-0 ${it.info.cls}">${it.info.label}</span>
                    </button>
                `).join('');
        } else {
            detailBox.classList.add('hidden');
            detailBox.innerHTML = '';
        }
    }
}

function renderStudentCharts(done, pending, belum, hadir, sakit, izin, alpa) {
    const isDark = document.documentElement.classList.contains('dark');
    const labelColor = isDark ? '#cbd5e1' : '#475569';

    const ctxTask = document.getElementById('chartStudentTaskStatus');
    if (ctxTask && typeof Chart !== 'undefined') {
        if (studentTaskChartInstance) { studentTaskChartInstance.destroy(); studentTaskChartInstance = null; }
        studentTaskChartInstance = new Chart(ctxTask, {
            type: 'doughnut',
            data: {
                labels: ['Terkumpul', 'Pending', 'Belum'],
                datasets: [{ data: [done, pending, belum], backgroundColor: ['#10b981', '#f59e0b', isDark ? '#334155' : '#cbd5e1'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: labelColor, boxWidth: 10, font: { size: 10 } } } } }
        });
    }

    const ctxAtt = document.getElementById('chartStudentAttendance');
    if (ctxAtt && typeof Chart !== 'undefined') {
        if (studentAttChartInstance) { studentAttChartInstance.destroy(); studentAttChartInstance = null; }
        const totalAtt = hadir + sakit + izin + alpa;
        studentAttChartInstance = new Chart(ctxAtt, {
            type: 'doughnut',
            data: {
                labels: totalAtt > 0 ? ['Hadir', 'Sakit', 'Izin', 'Alpa'] : ['Belum Ada Data'],
                datasets: [{ data: totalAtt > 0 ? [hadir, sakit, izin, alpa] : [1], backgroundColor: totalAtt > 0 ? ['#10b981', '#f59e0b', '#3b82f6', '#f43f5e'] : [isDark ? '#1e293b' : '#e2e8f0'], borderWidth: 0 }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '70%', plugins: { legend: { position: 'bottom', labels: { color: labelColor, boxWidth: 10, font: { size: 10 } } } } }
        });
    }
}

function isStudentMaterialRead(materialId) {
    return currentMaterialReadsList.some(r => Number(r.material_id) === Number(materialId));
}

async function toggleMaterialRead(materialId, forceRead = null) {
    if (!currentPortalStudent) return;
    const sid = Number(currentPortalStudent.id);
    const mid = Number(materialId);
    const currentlyRead = isStudentMaterialRead(mid);
    const nextRead = forceRead !== null ? Boolean(forceRead) : !currentlyRead;
    if (nextRead === currentlyRead) return;

    const storageKey = `sipantau_stu_mat_reads_${sid}`;
    const nowIso = new Date().toISOString();

    if (nextRead) {
        currentMaterialReadsList = [
            ...currentMaterialReadsList.filter(r => Number(r.material_id) !== mid),
            { material_id: mid, student_id: sid, read_at: nowIso }
        ];
    } else {
        currentMaterialReadsList = currentMaterialReadsList.filter(r => Number(r.material_id) !== mid);
    }
    localStorage.setItem(storageKey, JSON.stringify(currentMaterialReadsList));
    renderStudentMaterialsTab();
    updateStudentSidebarBadges();

    if (materialReadsTableAvailable) {
        if (nextRead) {
            const { error } = await db.from('material_reads').upsert(
                [{ material_id: mid, student_id: sid, read_at: nowIso }],
                { onConflict: 'material_id,student_id' }
            );
            if (error) {
                materialReadsTableAvailable = false;
            }
        } else {
            const { error } = await db.from('material_reads')
                .delete()
                .eq('material_id', mid)
                .eq('student_id', sid);
            if (error) {
                materialReadsTableAvailable = false;
            }
        }
    }

    if (forceRead === null) {
        showToast(nextRead ? '✅ Materi ditandai sudah dipelajari!' : '📖 Status baca materi dibatalkan.');
    }
}

function markMaterialReadSilent(materialId) {
    if (!isStudentMaterialRead(materialId)) {
        toggleMaterialRead(materialId, true);
    }
}

function renderStudentMaterialsTab() {
    const container = document.getElementById('stu-materials-list');
    if (!container) return;
    const list = filterBySelectedMapel(currentMaterialsList);
    const progBox = document.getElementById('stu-materi-progress-box');
    const progText = document.getElementById('stu-materi-progress-text');
    const progBar = document.getElementById('stu-materi-progress-bar');

    if (progBox && progText && progBar) {
        if (list.length > 0) {
            const readCount = list.filter(m => isStudentMaterialRead(m.id)).length;
            const pct = Math.round((readCount / list.length) * 100);
            progBox.classList.remove('hidden');
            progText.innerText = `${readCount} / ${list.length} (${pct}%)`;
            progBar.style.width = `${pct}%`;
        } else {
            progBox.classList.add('hidden');
        }
    }

    if (!list.length) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-8">Belum ada materi pembelajaran yang dibagikan pada filter ini.</p>`;
        return;
    }

    container.innerHTML = list.map(m => {
        const tch = teachersCache.find(t => Number(t.id) === Number(m.teacher_id));
        const files = parseFileJsonArray(m.file_attachments);
        const dateStr = new Date(m.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' });
        const isRead = isStudentMaterialRead(m.id);

        return `
            <div class="p-4 sm:p-5 rounded-2xl border ${isRead ? 'border-emerald-200 dark:border-emerald-900/80 bg-emerald-50/20 dark:bg-emerald-950/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'} space-y-2.5 transition-all">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-blue-100 text-blue-800">📘 ${escapeHtmlSafe(m.mapel)}</span>
                        <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${isRead ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'}">
                            ${isRead ? '✅ Sudah Dipelajari' : '📖 Belum Dipelajari'}
                        </span>
                    </div>
                    <span class="text-[11px] text-slate-400">Diposting: ${dateStr} • Guru: ${escapeHtmlSafe(tch?.nama_lengkap || 'Pengampu')}</span>
                </div>
                <h4 class="font-extrabold text-base text-slate-900 dark:text-white">${escapeHtmlSafe(m.judul)}</h4>
                ${m.deskripsi ? `<div class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200/80 dark:border-slate-700 leading-relaxed">${escapeHtmlSafe(m.deskripsi)}</div>` : ''}
                <div class="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div class="flex flex-wrap items-center gap-2">
                        ${m.link_eksternal ? `
                            <a href="${m.link_eksternal}" target="_blank" onclick="markMaterialReadSilent(${m.id})" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm">
                                🔗 Buka Tautan / Video Materi ↗
                            </a>
                        ` : ''}
                        ${files.map((f, i) => `
                            <a href="${f.url}" target="_blank" onclick="markMaterialReadSilent(${m.id})" class="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-extrabold">
                                📥 Unduh Modul ${files.length > 1 ? i + 1 : ''}: ${escapeHtmlSafe(f.name)} ↗
                            </a>
                        `).join('')}
                    </div>
                    <button type="button" onclick="toggleMaterialRead(${m.id})" class="px-3.5 py-2 rounded-xl text-xs font-extrabold transition ${isRead ? 'bg-emerald-100 dark:bg-emerald-950/70 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 hover:bg-emerald-200' : 'bg-white dark:bg-slate-800 hover:bg-blue-50 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 shadow-sm'}">
                        ${isRead ? '✓ Selesai Dipelajari' : '📖 Tandai Sudah Dipelajari'}
                    </button>
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentTasksTab() {
    const container = document.getElementById('portal-tasks-container');
    if (!container) return;

    const statusFilter = document.getElementById('stu-filter-task-status')?.value || 'all';
    let list = filterBySelectedMapel(currentAssessmentsList);

    list = list.filter(a => {
        const sc = currentScoresList.find(s => Number(s.assessment_id) === Number(a.id));
        const isDone = sc?.status_kumpul === true || sc?.status_pengajuan === 'approved';
        const isRevision = sc?.status_pengajuan === 'rejected';
        if (statusFilter === 'submitted') return isDone;
        if (statusFilter === 'revision') return isRevision;
        if (statusFilter === 'unsubmitted') return !isDone;
        return true;
    });

    if (!list.length) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-8">Tidak ada tugas atau penilaian yang sesuai filter.</p>`;
        return;
    }

    container.innerHTML = list.map(a => {
        const teacher = teachersCache.find(t => Number(t.id) === Number(a.teacher_id));
        const sc = currentScoresList.find(s => Number(s.assessment_id) === Number(a.id)) || { status_kumpul: false, status_pengajuan: 'none' };

        const isApproved = sc.status_kumpul === true || sc.status_pengajuan === 'approved';
        const isPending = sc.status_pengajuan === 'pending' && !isApproved;
        const isRejected = sc.status_pengajuan === 'rejected';

        const teacherFiles = parseFileJsonArray(a.lampiran_guru);
        const studentItems = parseFileJsonArray(sc.link_tugas_siswa);
        const quizData = parseStuQuizDataSafe(a.quiz_data);
        const isQuiz = Boolean(quizData && Array.isArray(quizData.questions) && quizData.questions.length > 0);

        const dlInfo = a.deadline ? getDeadlineCountdownInfo(a.deadline, isApproved) : null;
        const deadlineHtml = a.deadline
            ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${dlInfo.cls}">⏰ ${new Date(a.deadline).toLocaleString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} (${dlInfo.label})</span>`
            : '';

        const quizMetaBadge = isQuiz
            ? `<span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold bg-purple-100 text-purple-800">🧩 Kuis (${quizData.questions.length} Soal${quizData.duration_minutes ? ` • ${quizData.duration_minutes} mnt` : ''})</span>`
            : '';

        let badgeHtml = '';
        let actionBtn = '';

        const hasStoredQuizAttempt = Boolean(
            parseStuQuizDataSafe(sc.quiz_answers) ||
            parseStuQuizDataSafe(localStorage.getItem(`sipantau_stu_quiz_attempt_${currentPortalStudent?.id}_${a.id}`))
        );

        if (isQuiz) {
            if (isRejected) {
                badgeHtml = `<span class="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800">❌ Perlu Revisi</span>`;
                actionBtn = `<button type="button" onclick="openStudentQuizModal(${a.id})" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm">🧩 Kerjakan Ulang Kuis</button>`;
            } else if (isApproved) {
                badgeHtml = `<span class="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">✅ Kuis Selesai</span>`;
                actionBtn = (quizData.show_review !== false && hasStoredQuizAttempt)
                    ? `<button type="button" onclick="openStudentQuizReviewModal(${a.id})" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-50 dark:bg-indigo-950/60 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800">👁️ Lihat Hasil Kuis</button>`
                    : '';
            } else {
                badgeHtml = `<span class="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Belum Dikerjakan</span>`;
                actionBtn = `<button type="button" onclick="openStudentQuizModal(${a.id})" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm flex items-center gap-1.5">
                    🧩 Kerjakan Kuis
                </button>`;
            }
        } else if (isApproved) {
            badgeHtml = `<span class="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">✅ Terkumpul</span>`;
            actionBtn = `<button type="button" onclick="openPortalSubmitModal(${a.id})" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 transition">➕ Tambah File / Link</button>`;
        } else if (isPending) {
            badgeHtml = `<span class="px-3 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">⏳ Menunggu Verifikasi</span>`;
            actionBtn = `<button type="button" onclick="openPortalSubmitModal(${a.id})" class="px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200">Unggah Ulang / Link</button>`;
        } else if (isRejected) {
            badgeHtml = `<span class="px-3 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800">❌ Perlu Revisi</span>`;
            actionBtn = `<button type="button" onclick="openPortalSubmitModal(${a.id})" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-rose-600 hover:bg-rose-700 text-white shadow-sm">📤 Kirim Revisi</button>`;
        } else {
            badgeHtml = `<span class="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300">Belum Mengumpulkan</span>`;
            actionBtn = `<button type="button" onclick="openPortalSubmitModal(${a.id})" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-blue-600 hover:bg-blue-700 text-white shadow-sm flex items-center gap-1.5">
                <i class="fa-solid fa-paper-plane"></i> Kirim File / Link
            </button>`;
        }

        const nilaiBadge = (sc.nilai !== null && sc.nilai !== undefined && sc.nilai !== '')
            ? `<span class="px-2.5 py-0.5 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800">Skor Tugas: ${sc.nilai}</span>`
            : '';

        const teacherFeedbackText = (sc.catatan_guru || '').trim();
        const feedbackHtml = (isRejected || teacherFeedbackText)
            ? `<div class="p-3 rounded-xl border text-xs whitespace-pre-line leading-relaxed ${isRejected ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200' : 'bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'}">
                <span class="text-[10px] font-extrabold uppercase block mb-0.5">${isRejected ? '⚠️ Catatan Revisi Guru:' : '💬 Feedback / Catatan Guru:'}</span>
                ${escapeHtmlSafe(teacherFeedbackText || 'Tugas dikembalikan guru untuk diperbaiki. Silakan periksa kembali dan kirim revisi.')}
               </div>`
            : '';

        return `
            <div id="stu-task-card-${a.id}" class="p-4 sm:p-5 rounded-2xl border ${isRejected ? 'border-rose-300 dark:border-rose-800 bg-rose-50/20 dark:bg-rose-950/10' : 'border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50'} space-y-3 transition-all">
                <div class="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                    <div class="space-y-1.5">
                        <div class="flex items-center gap-2 flex-wrap">
                            <span class="px-2.5 py-0.5 rounded text-[10px] font-extrabold bg-blue-100 text-blue-800">📘 ${escapeHtmlSafe(a.mapel)}</span>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-200 dark:bg-slate-700 text-slate-700 dark:text-slate-200 uppercase">${escapeHtmlSafe(a.tipe_kerja || 'individu')}</span>
                            ${quizMetaBadge}
                            ${badgeHtml}
                            ${nilaiBadge}
                            ${deadlineHtml}
                        </div>
                        <h4 class="font-extrabold text-sm sm:text-base text-slate-900 dark:text-white">${escapeHtmlSafe(a.judul)}</h4>
                        <p class="text-[11px] text-slate-500 dark:text-slate-400">Guru Pengampu: ${escapeHtmlSafe(teacher?.nama_lengkap || '-')}</p>
                    </div>
                    <div class="shrink-0 flex items-center gap-2">
                        ${actionBtn}
                    </div>
                </div>

                ${feedbackHtml}

                ${a.deskripsi ? `
                    <div class="bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs text-slate-700 dark:text-slate-300 whitespace-pre-line leading-relaxed">
                        <span class="text-[10px] font-extrabold uppercase text-slate-400 block mb-1">Instruksi / Deskripsi Tugas:</span>
                        ${escapeHtmlSafe(a.deskripsi)}
                    </div>
                ` : ''}

                <div class="flex flex-wrap items-center gap-2">
                    ${teacherFiles.map((tf, i) => `
                        <a href="${tf.url}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[11px] font-extrabold">
                            📄 Unduh Soal/Panduan ${teacherFiles.length > 1 ? i + 1 : ''}: ${escapeHtmlSafe(tf.name)} ↗
                        </a>
                    `).join('')}

                    ${a.link_pengumpulan ? `
                        <a href="${a.link_pengumpulan}" target="_blank" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-200/80 dark:bg-slate-700 text-slate-700 dark:text-slate-200 text-[11px] font-bold">
                            🔗 Tautan Tambahan Guru ↗
                        </a>
                    ` : ''}

                    ${studentItems.map((sf, i) => {
                        if (sf.type === 'quiz_result') {
                            return `<span class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-50 text-purple-800 border border-purple-200 text-[11px] font-extrabold">
                                🧩 ${escapeHtmlSafe(sf.name || 'Kuis Selesai')}
                            </span>`;
                        }
                        const isLink = sf.type === 'link' || String(sf.name || '').startsWith('Link:');
                        return isLink
                            ? `<a href="${sf.url}" target="_blank" title="${escapeHtmlSafe(sf.url)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-[11px] font-extrabold">
                                🔗 ${escapeHtmlSafe(sf.name)} ↗
                               </a>`
                            : `<a href="${sf.url}" target="_blank" title="${escapeHtmlSafe(sf.name)}" class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-[11px] font-extrabold">
                                📎 File Terkirim ${i + 1} ↗
                               </a>`;
                    }).join('')}
                </div>
            </div>
        `;
    }).join('');
}

function renderStudentAttendanceTab() {
    const logsFiltered = filterBySelectedMapel(currentAttLogsList);
    const recFiltered = filterBySelectedMapel(currentAttRecapList);

    let h = 0, s = 0, i = 0, a = 0;
    if (logsFiltered.length > 0) {
        logsFiltered.forEach(l => {
            if (l.status === 'H') h++; else if (l.status === 'S') s++; else if (l.status === 'I') i++; else if (l.status === 'A') a++;
        });
    } else {
        recFiltered.forEach(r => {
            h += Number(r.hadir || 0); s += Number(r.sakit || 0); i += Number(r.izin || 0); a += Number(r.alpa || 0);
        });
    }

    const tot = h + s + i + a;
    const rate = tot > 0 ? ((h / tot) * 100).toFixed(1) : '100.0';

    document.getElementById('att-tab-rate').innerText = `${rate}%`;
    document.getElementById('att-tab-h').innerText = h;
    document.getElementById('att-tab-s').innerText = s;
    document.getElementById('att-tab-i').innerText = i;
    document.getElementById('att-tab-a').innerText = a;

    const mapelTbody = document.getElementById('att-per-mapel-tbody');
    const mapels = [...new Set([...currentAttLogsList.map(l => l.mapel), ...currentAttRecapList.map(r => r.mapel)].filter(Boolean))].sort();
    if (mapelTbody) {
        mapelTbody.innerHTML = mapels.length ? mapels.map(mpl => {
            const mLogs = currentAttLogsList.filter(l => l.mapel === mpl);
            const mRec = currentAttRecapList.find(r => r.mapel === mpl);
            let mh = 0, ms = 0, mi = 0, ma = 0;
            if (mLogs.length > 0) {
                mLogs.forEach(l => {
                    if (l.status === 'H') mh++; else if (l.status === 'S') ms++; else if (l.status === 'I') mi++; else if (l.status === 'A') ma++;
                });
            } else if (mRec) {
                mh = Number(mRec.hadir || 0); ms = Number(mRec.sakit || 0); mi = Number(mRec.izin || 0); ma = Number(mRec.alpa || 0);
            }
            const mTot = mh + ms + mi + ma;
            const mPct = mTot > 0 ? ((mh / mTot) * 100).toFixed(1) : '100.0';
            return `
                <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td class="p-3 font-extrabold text-slate-900 dark:text-white">${mpl}</td>
                    <td class="p-3 text-center font-bold text-emerald-600">${mh}</td>
                    <td class="p-3 text-center font-bold text-amber-600">${ms}</td>
                    <td class="p-3 text-center font-bold text-blue-600">${mi}</td>
                    <td class="p-3 text-center font-bold text-rose-600">${ma}</td>
                    <td class="p-3 text-center font-extrabold text-slate-900 dark:text-white">${mPct}%</td>
                </tr>
            `;
        }).join('') : `<tr><td colspan="6" class="p-5 text-center text-slate-400 italic">Belum ada data presensi tercatat pada periode ini.</td></tr>`;
    }

    const logTbody = document.getElementById('att-detailed-logs-tbody');
    const stFilter = document.getElementById('att-log-filter-status')?.value || 'all';
    if (logTbody) {
        const filteredLogs = logsFiltered.filter(l => {
            if (stFilter === 'absent_only') return l.status !== 'H';
            if (stFilter !== 'all') return l.status === stFilter;
            return true;
        });

        logTbody.innerHTML = filteredLogs.length ? filteredLogs.map((l, idx) => {
            const stMap = {
                H: { label: 'Hadir', cls: 'bg-emerald-100 text-emerald-700', note: 'Hadir mengikuti pembelajaran' },
                S: { label: 'Sakit', cls: 'bg-amber-100 text-amber-800', note: 'Tidak hadir karena sakit' },
                I: { label: 'Izin', cls: 'bg-blue-100 text-blue-700', note: 'Tidak hadir dengan keterangan izin' },
                A: { label: 'Alpa', cls: 'bg-rose-100 text-rose-700', note: 'Tanpa keterangan (Alpa)' }
            };
            const info = stMap[l.status] || { label: l.status, cls: 'bg-slate-100 text-slate-700', note: '-' };
            const dateFormatted = new Date(l.tanggal).toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });

            return `
                <tr class="${l.status !== 'H' ? 'bg-rose-50/30 dark:bg-rose-950/30' : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'}">
                    <td class="p-3 text-center text-slate-400">${idx + 1}</td>
                    <td class="p-3 font-bold text-slate-900 dark:text-white">${dateFormatted}</td>
                    <td class="p-3 font-semibold text-slate-700 dark:text-slate-300">${l.mapel || '-'}</td>
                    <td class="p-3 text-center"><span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${info.cls}">${info.label}</span></td>
                    <td class="p-3 text-slate-600 dark:text-slate-300">${info.note}</td>
                </tr>
            `;
        }).join('') : `<tr><td colspan="5" class="p-6 text-center text-slate-400 italic">Tidak ada riwayat presensi/ketidakhadiran yang sesuai filter.</td></tr>`;
    }
}

function renderPublishedFinalGrades() {
    const tbody = document.getElementById('portal-final-grades-tbody');
    const badge = document.getElementById('published-grades-count');
    const list = filterBySelectedMapel(currentPublishedGradesList);
    if (!tbody) return;
    if (badge) badge.innerText = `${list.length} Mapel Dipublikasikan`;

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400 italic">Belum ada hasil belajar akhir yang dipublikasikan oleh guru mata pelajaran pada periode ini.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map((g, idx) => {
        const teacher = teachersCache.find(t => Number(t.id) === Number(g.teacher_id));
        const finalScore = (g.nilai_manual !== null && g.nilai_manual !== undefined && g.nilai_manual !== '')
            ? Number(g.nilai_manual)
            : Number(g.nilai_otomatis || 0);
        const kkm = Number(g.kkm || 75);
        const isTuntas = finalScore >= kkm;

        return `
            <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                <td class="p-3 text-center text-slate-400">${idx + 1}</td>
                <td class="p-3 font-extrabold text-slate-900 dark:text-white">${g.mapel}</td>
                <td class="p-3 text-slate-600 dark:text-slate-300">${teacher?.nama_lengkap || '-'}</td>
                <td class="p-3 text-center font-bold text-slate-500">${kkm}</td>
                <td class="p-3 text-center font-extrabold text-sm bg-blue-50/60 dark:bg-blue-950/60 text-blue-800 dark:text-blue-300">${finalScore.toFixed(1)}</td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold ${isTuntas ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}">
                        ${isTuntas ? 'TUNTAS' : 'BELUM TUNTAS'}
                    </span>
                </td>
            </tr>
        `;
    }).join('');
}

function renderStudentAnnouncementsTab() {
    const container = document.getElementById('stu-announcements-list');
    if (!container) return;
    const list = filterBySelectedMapel(currentAnnouncementsList);

    if (!list.length) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-8">Belum ada pengumuman atau diskusi kelas pada periode ini.</p>`;
        return;
    }

    container.innerHTML = list.map(an => {
        const tch = teachersCache.find(t => Number(t.id) === Number(an.teacher_id));
        const comments = currentCommentsList.filter(c => Number(c.announcement_id) === Number(an.id));
        const dateStr = new Date(an.created_at).toLocaleString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

        return `
            <div class="p-4 sm:p-5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/50 dark:bg-slate-800/50 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                    <span class="px-2.5 py-0.5 rounded text-[11px] font-extrabold bg-indigo-100 text-indigo-800">📘 ${an.mapel}</span>
                    <span class="text-[11px] text-slate-400">${dateStr} • ${tch?.nama_lengkap || 'Guru'}</span>
                </div>
                <h4 class="font-extrabold text-base text-slate-900 dark:text-white">${an.judul}</h4>
                <p class="text-xs sm:text-sm text-slate-700 dark:text-slate-300 whitespace-pre-line bg-white dark:bg-slate-900 p-3.5 rounded-xl border border-slate-200 dark:border-slate-700">${an.isi}</p>

                <div class="pt-2 space-y-2">
                    <span class="text-[11px] font-extrabold text-slate-500">💬 Diskusi & Pertanyaan (${comments.length})</span>
                    <div class="space-y-1.5 max-h-48 overflow-y-auto">
                        ${comments.map(c => `
                            <div class="p-2.5 rounded-xl text-xs ${c.author_role === 'guru' ? 'bg-blue-50 dark:bg-blue-950/60 border border-blue-200 dark:border-blue-800' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700'}">
                                <div class="flex items-center justify-between">
                                    <b class="${c.author_role === 'guru' ? 'text-blue-800 dark:text-blue-300' : 'text-slate-800 dark:text-slate-200'}">${c.author_name} ${c.author_role === 'guru' ? '(Guru)' : ''}</b>
                                    <span class="text-[10px] text-slate-400">${new Date(c.created_at).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}</span>
                                </div>
                                <p class="text-slate-700 dark:text-slate-300 mt-0.5">${c.komentar}</p>
                            </div>
                        `).join('')}
                    </div>
                    <form onsubmit="postStudentComment(event, ${an.id})" class="flex gap-2 pt-1">
                        <input type="text" id="stu-comment-inp-${an.id}" required placeholder="Tulis pertanyaan atau tanggapan..." class="w-full border border-slate-300 dark:border-slate-700 rounded-xl px-3 py-2 text-xs bg-white dark:bg-slate-800">
                        <button type="submit" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shrink-0">Kirim</button>
                    </form>
                </div>
            </div>
        `;
    }).join('');
}

async function postStudentComment(e, announcementId) {
    e.preventDefault();
    const inp = document.getElementById(`stu-comment-inp-${announcementId}`);
    const text = inp?.value.trim();
    if (!text) return;

    const { error } = await db.from('announcement_comments').insert([{
        announcement_id: announcementId,
        author_name: currentPortalStudent.nama,
        author_role: 'siswa',
        komentar: text
    }]);
    if (error) return showToast('Gagal mengirim komentar: ' + error.message, 'error');
    inp.value = '';
    await loadAllStudentLMSData();
}

function previewSelectedFiles() {
    const files = [...(document.getElementById('portal-file-input')?.files || [])];
    const box = document.getElementById('selected-files-preview');
    if (!box) return;
    if (!files.length) { box.innerHTML = ''; return; }
    box.innerHTML = `<div class="font-bold text-blue-700 dark:text-blue-400">Dipilih ${files.length} file:</div>` +
        files.map((f, i) => `<div class="truncate bg-slate-50 dark:bg-slate-800 px-2 py-1 rounded border border-slate-200 dark:border-slate-700">${i + 1}. ${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)</div>`).join('');
}

function openPortalSubmitModal(assessmentId) {
    selectedAssessmentObj = currentAssessmentsList.find(a => Number(a.id) === Number(assessmentId));
    if (!selectedAssessmentObj) return;

    const teacher = teachersCache.find(t => Number(t.id) === Number(selectedAssessmentObj.teacher_id));
    const hasDrive = Boolean(teacher?.gdrive_email);

    document.getElementById('modal-task-title').innerText = `${selectedAssessmentObj.mapel} — ${selectedAssessmentObj.judul}`;

    const existingSc = currentScoresList.find(s => Number(s.assessment_id) === Number(selectedAssessmentObj.id));
    const fbBox = document.getElementById('modal-task-feedback');
    if (fbBox) {
        const isRej = existingSc?.status_pengajuan === 'rejected';
        const fbTxt = (existingSc?.catatan_guru || '').trim();
        if (isRej || fbTxt) {
            fbBox.classList.remove('hidden');
            fbBox.className = `p-3 rounded-xl border text-xs whitespace-pre-line ${isRej ? 'bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800 text-rose-800 dark:text-rose-200' : 'bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200'}`;
            fbBox.innerHTML = `<span class="text-[10px] font-extrabold uppercase block mb-0.5">${isRej ? '⚠️ Catatan Revisi Guru:' : '💬 Catatan Guru:'}</span>${escapeHtmlSafe(fbTxt || 'Silakan perbaiki jawaban Anda lalu kirim ulang.')}`;
        } else {
            fbBox.classList.add('hidden');
            fbBox.innerHTML = '';
        }
    }

    document.getElementById('portal-file-input').value = '';
    document.getElementById('selected-files-preview').innerHTML = '';
    document.getElementById('portal-link-input').value = '';
    document.getElementById('portal-link-label').value = '';
    document.getElementById('upload-progress-box').classList.add('hidden');
    document.getElementById('upload-progress-bar').style.width = '0%';
    document.getElementById('upload-percent-text').innerText = '0%';

    const fileBox = document.getElementById('upload-file-box');
    const confirmBtn = document.getElementById('btn-confirm-upload');

    if (hasDrive) {
        fileBox.classList.remove('hidden');
        document.getElementById('modal-task-subtitle').innerText = 'Unggah file ke folder guru dan/atau tempel tautan tugas';
        confirmBtn.innerHTML = `<i class="fa-solid fa-paper-plane"></i> Kirim Tugas`;
    } else {
        fileBox.classList.add('hidden');
        document.getElementById('modal-task-subtitle').innerText = 'Tempel tautan tugas Anda atau konfirmasi selesai';
        confirmBtn.innerHTML = `✅ Kirim / Konfirmasi Selesai`;
    }

    document.getElementById('modal-portal-submit').classList.remove('hidden');
}

function closePortalSubmitModal() {
    if (isUploadingNow) return;
    selectedAssessmentObj = null;
    document.getElementById('modal-portal-submit').classList.add('hidden');
}

function normalizeSubmittedUrl(rawUrl) {
    const trimmed = rawUrl.trim();
    if (!trimmed) return '';
    const withProto = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    try {
        const parsed = new URL(withProto);
        if (!parsed.hostname.includes('.')) return null;
        return parsed.href;
    } catch {
        return null;
    }
}

async function executeDirectDriveUpload() {
    if (!currentPortalStudent || !selectedAssessmentObj || isUploadingNow) return;

    const teacher = teachersCache.find(t => Number(t.id) === Number(selectedAssessmentObj.teacher_id));
    const hasDrive = Boolean(teacher?.gdrive_email);

    const fileInput = document.getElementById('portal-file-input');
    const files = hasDrive ? [...(fileInput?.files || [])] : [];
    const rawLink = document.getElementById('portal-link-input')?.value.trim() || '';
    const linkLabel = document.getElementById('portal-link-label')?.value.trim() || '';

    let normalizedLink = '';
    if (rawLink) {
        normalizedLink = normalizeSubmittedUrl(rawLink);
        if (!normalizedLink) {
            return showToast('Format tautan (URL) tidak valid! Contoh: https://canva.com/...', 'error');
        }
    }

    if (hasDrive && files.length === 0 && !normalizedLink) {
        return showToast('Silakan pilih minimal 1 file atau tempel tautan (link) tugas!', 'error');
    }

    if (!hasDrive && !normalizedLink) {
        await recordSubmissionToSupabase([], 'pending');
        return;
    }

    const linkItemArray = normalizedLink
        ? [{
            name: linkLabel ? `Link: ${linkLabel}` : `Link: ${normalizedLink}`,
            url: normalizedLink,
            type: 'link'
        }]
        : [];

    if (files.length === 0 && linkItemArray.length > 0) {
        await recordSubmissionToSupabase(linkItemArray, 'approved');
        return;
    }

    isUploadingNow = true;
    setUploadControlsDisabled(true);

    const progBox = document.getElementById('upload-progress-box');
    const progBar = document.getElementById('upload-progress-bar');
    const progPct = document.getElementById('upload-percent-text');
    const progTxt = document.getElementById('upload-status-text');
    progBox.classList.remove('hidden');

    try {
        const cleanStudentName = currentPortalStudent.nama.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
        const cleanTaskTitle = selectedAssessmentObj.judul.replace(/[^a-zA-Z0-9\s]/g, '').trim().replace(/\s+/g, '_');
        const className = currentPortalStudent.classes?.nama_kelas || 'Kelas';
        const uploadedResults = [];

        for (let idx = 0; idx < files.length; idx++) {
            const file = files[idx];
            const ext = file.name.includes('.') ? '.' + file.name.split('.').pop() : '';
            const suffix = files.length > 1 ? `_File${idx + 1}` : '';
            const formattedFileName = `${currentPortalStudent.nisn}_${cleanStudentName}_${cleanTaskTitle}${suffix}${ext}`;

            progTxt.innerText = `Menyiapkan file ${idx + 1} dari ${files.length}...`;

            const { data: initData, error: initErr } = await db.functions.invoke('gdrive-bridge', {
                body: {
                    action: 'init_upload',
                    teacher_id: selectedAssessmentObj.teacher_id,
                    class_name: className,
                    mapel: selectedAssessmentObj.mapel,
                    task_title: selectedAssessmentObj.judul,
                    file_name: formattedFileName,
                    mime_type: file.type || 'application/octet-stream'
                }
            });

            if (initErr || !initData?.success || !initData?.uploadUrl) {
                throw new Error(initData?.error || initErr?.message || `Gagal menyiapkan file ke-${idx + 1}.`);
            }

            progTxt.innerText = `Mengunggah file ${idx + 1} dari ${files.length} (${file.name})...`;
            const driveResponse = await uploadFileWithProgress(initData.uploadUrl, file, (filePct) => {
                const overallPct = Math.round(((idx + filePct / 100) / files.length) * 95);
                progBar.style.width = `${overallPct}%`;
                progPct.innerText = `${overallPct}%`;
            });

            const fileViewUrl = driveResponse.webViewLink || (driveResponse.id ? `https://drive.google.com/file/d/${driveResponse.id}/view` : null);
            if (fileViewUrl) uploadedResults.push({ name: formattedFileName, url: fileViewUrl, type: 'file' });
        }

        progTxt.innerText = 'Mencatat bukti pengumpulan...';
        progBar.style.width = '100%';
        progPct.innerText = '100%';

        await recordSubmissionToSupabase([...uploadedResults, ...linkItemArray], 'approved');
    } catch (err) {
        console.error(err);
        showToast('❌ Gagal mengunggah: ' + err.message, 'error');
        isUploadingNow = false;
        setUploadControlsDisabled(false);
    }
}

function uploadFileWithProgress(uploadUrl, file, onProgress) {
    return new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('PUT', uploadUrl, true);
        xhr.setRequestHeader('Content-Type', file.type || 'application/octet-stream');
        xhr.upload.onprogress = (e) => {
            if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
        };
        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                try { resolve(JSON.parse(xhr.responseText)); } catch { resolve({}); }
            } else {
                reject(new Error(`Google Drive menolak file (HTTP ${xhr.status})`));
            }
        };
        xhr.onerror = () => reject(new Error('Koneksi internet terputus saat mengunggah file.'));
        xhr.send(file);
    });
}

async function recordSubmissionToSupabase(newItemsArray, statusPengajuan) {
    const isApproved = statusPengajuan === 'approved';
    const { data: existing } = await db.from('scores')
        .select('*')
        .eq('assessment_id', selectedAssessmentObj.id)
        .eq('student_id', currentPortalStudent.id)
        .maybeSingle();

    const prevItems = parseFileJsonArray(existing?.link_tugas_siswa);
    const mergedItems = [...prevItems, ...newItemsArray];
    const serializedLinks = mergedItems.length > 0 ? JSON.stringify(mergedItems) : null;

    let error = null;
    if (existing) {
        const res = await db.from('scores')
            .update({ status_pengajuan: statusPengajuan, status_kumpul: isApproved, link_tugas_siswa: serializedLinks })
            .eq('id', existing.id);
        error = res.error;
    } else {
        const res = await db.from('scores')
            .insert([{ assessment_id: selectedAssessmentObj.id, student_id: currentPortalStudent.id, status_pengajuan: statusPengajuan, status_kumpul: isApproved, link_tugas_siswa: serializedLinks }]);
        error = res.error;
    }

    // Sinkronisasi otomatis anggota satu kelompok
    if (!error && selectedAssessmentObj.tipe_kerja === 'kelompok' && existing?.nama_kelompok) {
        const groupName = existing.nama_kelompok.trim();
        if (groupName) {
            await db.from('scores')
                .update({ status_pengajuan: statusPengajuan, status_kumpul: isApproved })
                .eq('assessment_id', selectedAssessmentObj.id)
                .ilike('nama_kelompok', groupName);
        }
    }

    isUploadingNow = false;
    setUploadControlsDisabled(false);
    closePortalSubmitModal();

    if (error) return showToast('Gagal mencatat pengumpulan: ' + error.message, 'error');
    showToast(isApproved ? `✅ ${newItemsArray.length} lampiran tugas berhasil dikirim!` : '✅ Pengajuan berhasil dikirim!');
    await loadAllStudentLMSData();
}

function setUploadControlsDisabled(disabled) {
    document.getElementById('btn-confirm-upload').disabled = disabled;
    document.getElementById('btn-cancel-upload').disabled = disabled;
    document.getElementById('portal-file-input').disabled = disabled;
    document.getElementById('portal-link-input').disabled = disabled;
    document.getElementById('portal-link-label').disabled = disabled;
}

// ==================== KUIS ONLINE SISWA ====================
function openStudentQuizModal(assessmentId) {
    const ass = currentAssessmentsList.find(a => Number(a.id) === Number(assessmentId));
    const quizData = parseStuQuizDataSafe(ass?.quiz_data);
    if (!ass || !quizData || !Array.isArray(quizData.questions) || !quizData.questions.length) {
        return showToast('Soal kuis belum tersedia.', 'error');
    }

    let questions = quizData.questions.map(q => ({ ...q }));
    if (quizData.shuffle) {
        questions.sort(() => Math.random() - 0.5);
    }

    const durMins = Number(quizData.duration_minutes || 0);
    activeStuQuizState = {
        assObj: ass,
        quizData,
        questions,
        answers: {},
        currentIndex: 0,
        startedAtMs: Date.now(),
        deadlineMs: durMins > 0 ? Date.now() + durMins * 60000 : null,
        mode: 'run',
        confirmOpen: false,
        submitting: false,
        attemptResult: null
    };

    document.getElementById('stu-quiz-title').innerText = `🧩 ${ass.judul}`;
    document.getElementById('stu-quiz-subtitle').innerText = `${ass.mapel} • ${questions.length} Soal${durMins ? ` • Waktu ${durMins} Menit` : ''}`;

    if (stuQuizTimerInterval) {
        clearInterval(stuQuizTimerInterval);
        stuQuizTimerInterval = null;
    }
    const timerBadge = document.getElementById('stu-quiz-timer-badge');
    if (activeStuQuizState.deadlineMs && timerBadge) {
        timerBadge.classList.remove('hidden');
        const tickQuiz = () => {
            if (!activeStuQuizState || activeStuQuizState.mode !== 'run') return;
            const diff = activeStuQuizState.deadlineMs - Date.now();
            if (diff <= 0) {
                timerBadge.innerText = '⏳ 00:00';
                clearInterval(stuQuizTimerInterval);
                stuQuizTimerInterval = null;
                showToast('⏰ Waktu habis! Jawaban kuis dikirim otomatis.', 'info');
                submitStuQuizAnswers();
                return;
            }
            timerBadge.innerText = `⏳ ${formatStuCountdownMs(diff)}`;
        };
        tickQuiz();
        stuQuizTimerInterval = setInterval(tickQuiz, 1000);
    } else if (timerBadge) {
        timerBadge.classList.add('hidden');
    }

    renderStudentQuizModal();
    document.getElementById('modal-student-quiz').classList.remove('hidden');
}

function openStudentQuizReviewModal(assessmentId) {
    const ass = currentAssessmentsList.find(a => Number(a.id) === Number(assessmentId));
    const quizData = parseStuQuizDataSafe(ass?.quiz_data);
    const sc = currentScoresList.find(s => Number(s.assessment_id) === Number(assessmentId));
    const attempt = parseStuQuizDataSafe(sc?.quiz_answers)
        || parseStuQuizDataSafe(localStorage.getItem(`sipantau_stu_quiz_attempt_${currentPortalStudent?.id}_${assessmentId}`));

    if (!ass || !quizData || !attempt) {
        return showToast('Pembahasan kuis tidak tersedia pada perangkat ini.', 'info');
    }

    if (stuQuizTimerInterval) {
        clearInterval(stuQuizTimerInterval);
        stuQuizTimerInterval = null;
    }
    document.getElementById('stu-quiz-timer-badge')?.classList.add('hidden');

    activeStuQuizState = {
        assObj: ass,
        quizData,
        questions: quizData.questions || [],
        answers: {},
        currentIndex: 0,
        mode: 'review',
        attemptResult: attempt
    };

    document.getElementById('stu-quiz-title').innerText = `📊 Hasil Kuis: ${ass.judul}`;
    document.getElementById('stu-quiz-subtitle').innerText = `${ass.mapel} • Skor Akhir: ${sc?.nilai ?? attempt.score}`;
    renderStudentQuizModal();
    document.getElementById('modal-student-quiz').classList.remove('hidden');
}

function closeStudentQuizModal() {
    if (activeStuQuizState?.submitting) return;
    if (stuQuizTimerInterval) {
        clearInterval(stuQuizTimerInterval);
        stuQuizTimerInterval = null;
    }
    activeStuQuizState = null;
    document.getElementById('modal-student-quiz').classList.add('hidden');
}

function selectStuQuizOption(qId, optIdx) {
    if (!activeStuQuizState || activeStuQuizState.mode !== 'run') return;
    activeStuQuizState.answers[String(qId)] = Number(optIdx);
    activeStuQuizState.confirmOpen = false;
    renderStudentQuizModal();
}

function inputStuQuizShort(qId, val) {
    if (!activeStuQuizState || activeStuQuizState.mode !== 'run') return;
    activeStuQuizState.answers[String(qId)] = val;
}

function goStuQuizQuestion(nextIdx) {
    if (!activeStuQuizState || activeStuQuizState.mode !== 'run') return;
    const max = activeStuQuizState.questions.length - 1;
    activeStuQuizState.currentIndex = Math.max(0, Math.min(max, nextIdx));
    activeStuQuizState.confirmOpen = false;
    renderStudentQuizModal();
}

function requestSubmitStuQuiz() {
    if (!activeStuQuizState || activeStuQuizState.mode !== 'run') return;
    activeStuQuizState.confirmOpen = true;
    renderStudentQuizModal();
}

function cancelSubmitStuQuiz() {
    if (!activeStuQuizState) return;
    activeStuQuizState.confirmOpen = false;
    renderStudentQuizModal();
}

function renderStudentQuizModal() {
    const body = document.getElementById('stu-quiz-body');
    const footer = document.getElementById('stu-quiz-footer');
    if (!body || !footer || !activeStuQuizState) return;

    if (activeStuQuizState.mode === 'review') {
        const attempt = activeStuQuizState.attemptResult;
        const qList = activeStuQuizState.quizData.questions || [];
        const showReview = activeStuQuizState.quizData.show_review !== false;
        const letters = ['A', 'B', 'C', 'D'];

        body.innerHTML = `
            <div class="p-4 rounded-2xl bg-gradient-to-r from-indigo-600 to-blue-600 text-white flex flex-wrap items-center justify-between gap-3 shadow-sm">
                <div>
                    <span class="text-[11px] uppercase font-bold text-blue-100 block">Nilai Otomatis Kuis</span>
                    <div class="text-3xl font-black">${attempt.score}</div>
                </div>
                <div class="text-right text-xs">
                    <div class="font-extrabold">${attempt.correct_count} dari ${attempt.total_questions} Soal Benar</div>
                    <div class="text-blue-100 text-[11px]">Skor otomatis tersimpan di nilai kelas</div>
                </div>
            </div>
            ${showReview ? `
                <div class="space-y-2.5">
                    ${(attempt.items || []).map((it, idx) => {
                        const q = qList.find(qq => String(qq.id) === String(it.q_id)) || {};
                        const userAnsText = q.type === 'short'
                            ? (it.user_answer || '(Tidak dijawab)')
                            : (it.user_answer !== null && it.user_answer !== undefined ? `${letters[Number(it.user_answer)]}. ${(q.options || [])[Number(it.user_answer)] || ''}` : '(Tidak dijawab)');
                        const keyText = q.type === 'short'
                            ? (q.accepted_answers || []).join(' / ')
                            : `${letters[Number(q.correct_index)]}. ${(q.options || [])[Number(q.correct_index)] || ''}`;
                        return `
                            <div class="p-3.5 rounded-xl border ${it.is_correct ? 'border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/30' : 'border-rose-200 dark:border-rose-800 bg-rose-50/50 dark:bg-rose-950/30'} space-y-1">
                                <div class="flex items-center justify-between font-extrabold">
                                    <span>Soal #${idx + 1}</span>
                                    <span class="${it.is_correct ? 'text-emerald-700 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}">${it.is_correct ? `✅ Benar (+${it.points_earned})` : '❌ Salah'}</span>
                                </div>
                                <div class="font-semibold text-slate-900 dark:text-white">${escapeHtmlSafe(q.prompt || '-')}</div>
                                <div class="text-[11px] text-slate-600 dark:text-slate-300">Jawaban Anda: <b>${escapeHtmlSafe(userAnsText)}</b></div>
                                ${!it.is_correct ? `<div class="text-[11px] text-emerald-700 dark:text-emerald-400">Kunci Benar: <b>${escapeHtmlSafe(keyText)}</b></div>` : ''}
                            </div>
                        `;
                    }).join('')}
                </div>
            ` : `<p class="text-center text-slate-500 py-4">Pembahasan soal disembunyikan oleh guru. Nilai Anda sudah tercatat.</p>`}
        `;

        footer.innerHTML = `
            <span class="text-[11px] text-slate-400">Selesai pada ${new Date(attempt.submitted_at || Date.now()).toLocaleString('id-ID')}</span>
            <button type="button" onclick="closeStudentQuizModal()" class="px-4 py-2 rounded-xl bg-slate-900 dark:bg-blue-600 text-white font-extrabold text-xs">Tutup</button>
        `;
        return;
    }

    const { questions, answers, currentIndex, confirmOpen } = activeStuQuizState;
    const q = questions[currentIndex];
    const ans = answers[String(q.id)];
    const answeredCount = questions.filter(qq => {
        const a = answers[String(qq.id)];
        return a !== undefined && a !== null && String(a).trim() !== '';
    }).length;
    const letters = ['A', 'B', 'C', 'D'];

    const navHtml = `
        <div class="flex flex-wrap items-center gap-1.5">
            ${questions.map((qq, idx) => {
                const a = answers[String(qq.id)];
                const hasAns = a !== undefined && a !== null && String(a).trim() !== '';
                const isCur = idx === currentIndex;
                return `<button type="button" onclick="goStuQuizQuestion(${idx})" class="w-7 h-7 rounded-lg text-[11px] font-extrabold transition ${isCur ? 'bg-indigo-600 text-white ring-2 ring-indigo-300' : hasAns ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700'}">${idx + 1}</button>`;
            }).join('')}
        </div>
    `;

    const questionBodyHtml = q.type !== 'short'
        ? `<div class="space-y-2">
            ${(q.options || []).map((optText, optIdx) => {
                if (!String(optText || '').trim()) return '';
                const checked = Number(ans) === optIdx;
                return `
                    <button type="button" onclick="selectStuQuizOption('${escapeHtmlSafe(q.id)}', ${optIdx})" class="w-full text-left p-3 rounded-xl border transition flex items-center gap-3 ${checked ? 'border-indigo-500 bg-indigo-50 dark:bg-indigo-950/60 text-indigo-900 dark:text-indigo-100 ring-1 ring-indigo-500' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800/70 hover:bg-slate-50 dark:hover:bg-slate-800'}">
                        <span class="w-7 h-7 rounded-lg flex items-center justify-center font-extrabold text-xs shrink-0 ${checked ? 'bg-indigo-600 text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}">${letters[optIdx]}</span>
                        <span class="text-xs sm:text-sm font-semibold">${escapeHtmlSafe(optText)}</span>
                    </button>
                `;
            }).join('')}
           </div>`
        : `<div class="space-y-1.5">
            <label class="block font-bold text-slate-600 dark:text-slate-300">Ketik Jawaban Singkat Anda:</label>
            <input type="text" value="${escapeHtmlSafe(ans || '')}" oninput="inputStuQuizShort('${escapeHtmlSafe(q.id)}', this.value)" placeholder="Tulis jawaban singkat..." class="w-full border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 rounded-xl p-3 text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-500">
           </div>`;

    const confirmHtml = confirmOpen
        ? `<div class="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-800 flex flex-wrap items-center justify-between gap-2">
            <span class="font-bold text-amber-900 dark:text-amber-200">
                ${answeredCount < questions.length ? `⚠️ Masih ada ${questions.length - answeredCount} soal belum dijawab. Tetap kirim sekarang?` : '✅ Semua soal sudah terisi. Kirim dan hitung nilai sekarang?'}
            </span>
            <div class="flex items-center gap-2">
                <button type="button" onclick="cancelSubmitStuQuiz()" class="px-3 py-1.5 rounded-lg bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 font-bold">Periksa Lagi</button>
                <button type="button" id="btn-final-submit-quiz" onclick="submitStuQuizAnswers()" class="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold">Ya, Kirim Kuis</button>
            </div>
           </div>`
        : '';

    body.innerHTML = `
        <div class="flex flex-wrap items-center justify-between gap-2">
            <span class="font-extrabold text-slate-500">Soal ${currentIndex + 1} dari ${questions.length} • Terjawab ${answeredCount}/${questions.length}</span>
            <span class="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-800 font-bold text-slate-600 dark:text-slate-300">Bobot: ${q.points || 1} poin</span>
        </div>
        ${navHtml}
        <div class="p-4 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 space-y-3">
            <div class="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white whitespace-pre-line leading-relaxed">${escapeHtmlSafe(q.prompt)}</div>
            ${questionBodyHtml}
        </div>
        ${confirmHtml}
    `;

    footer.innerHTML = `
        <div class="flex items-center gap-2">
            <button type="button" onclick="goStuQuizQuestion(${currentIndex - 1})" ${currentIndex === 0 ? 'disabled class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs opacity-60 cursor-not-allowed"' : 'class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300"'}>← Sebelumnya</button>
            <button type="button" onclick="goStuQuizQuestion(${currentIndex + 1})" ${currentIndex >= questions.length - 1 ? 'disabled class="px-3 py-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-400 font-bold text-xs opacity-60 cursor-not-allowed"' : 'class="px-3 py-2 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-xs hover:bg-slate-300"'}>Berikutnya →</button>
        </div>
        <button type="button" onclick="requestSubmitStuQuiz()" class="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs shadow-sm">
            ✅ Selesai & Kirim
        </button>
    `;
}

async function submitStuQuizAnswers() {
    if (!activeStuQuizState || activeStuQuizState.submitting || !currentPortalStudent) return;
    activeStuQuizState.submitting = true;
    if (stuQuizTimerInterval) {
        clearInterval(stuQuizTimerInterval);
        stuQuizTimerInterval = null;
    }
    document.getElementById('stu-quiz-timer-badge')?.classList.add('hidden');

    const { assObj, quizData, questions, answers, startedAtMs } = activeStuQuizState;
    const orderedQuestions = quizData.questions || questions;
    let totalPts = 0;
    let earnedPts = 0;
    let correctCount = 0;

    const items = orderedQuestions.map(q => {
        const pts = Math.max(1, Number(q.points || 1));
        totalPts += pts;
        const rawAns = answers[String(q.id)];
        let isCorrect = false;
        let normalizedUserAns = null;

        if (q.type === 'short') {
            const userStr = String(rawAns || '').trim();
            normalizedUserAns = userStr;
            const userNorm = userStr.toLowerCase().replace(/\s+/g, ' ');
            const keys = (q.accepted_answers || []).map(k => String(k || '').trim().toLowerCase().replace(/\s+/g, ' ')).filter(Boolean);
            isCorrect = Boolean(userNorm && keys.includes(userNorm));
        } else {
            normalizedUserAns = (rawAns !== undefined && rawAns !== null && rawAns !== '') ? Number(rawAns) : null;
            isCorrect = normalizedUserAns !== null && normalizedUserAns === Number(q.correct_index);
        }

        if (isCorrect) {
            earnedPts += pts;
            correctCount++;
        }

        return {
            q_id: q.id,
            type: q.type,
            user_answer: normalizedUserAns,
            is_correct: isCorrect,
            points_earned: isCorrect ? pts : 0,
            points_max: pts
        };
    });

    const finalScore = totalPts > 0 ? Math.round((earnedPts / totalPts) * 1000) / 10 : 0;
    const submittedIso = new Date().toISOString();
    const attemptPayload = {
        submitted_at: submittedIso,
        duration_used_sec: Math.max(1, Math.round((Date.now() - startedAtMs) / 1000)),
        correct_count: correctCount,
        total_questions: orderedQuestions.length,
        score: finalScore,
        items
    };

    const summaryItem = {
        type: 'quiz_result',
        name: `Hasil Kuis: ${finalScore} (${correctCount}/${orderedQuestions.length} Benar)`,
        score: finalScore,
        correct: correctCount,
        total: orderedQuestions.length,
        submitted_at: submittedIso
    };
    const serializedSummary = JSON.stringify([summaryItem]);

    localStorage.setItem(`sipantau_stu_quiz_attempt_${currentPortalStudent.id}_${assObj.id}`, JSON.stringify(attemptPayload));

    try {
        const { data: existing } = await db.from('scores')
            .select('*')
            .eq('assessment_id', assObj.id)
            .eq('student_id', currentPortalStudent.id)
            .maybeSingle();

        const basePayload = {
            status_pengajuan: 'approved',
            status_kumpul: true,
            nilai: finalScore,
            link_tugas_siswa: serializedSummary
        };
        const fullPayload = { ...basePayload, quiz_answers: attemptPayload };

        let saveErr = null;
        if (existing) {
            const res = await db.from('scores').update(fullPayload).eq('id', existing.id);
            if (res.error && /quiz_answers|does not exist|schema cache/i.test(res.error.message || '')) {
                const fallbackRes = await db.from('scores').update(basePayload).eq('id', existing.id);
                saveErr = fallbackRes.error;
            } else {
                saveErr = res.error;
            }
        } else {
            const res = await db.from('scores').insert([{
                assessment_id: assObj.id,
                student_id: currentPortalStudent.id,
                ...fullPayload
            }]);
            if (res.error && /quiz_answers|does not exist|schema cache/i.test(res.error.message || '')) {
                const fallbackRes = await db.from('scores').insert([{
                    assessment_id: assObj.id,
                    student_id: currentPortalStudent.id,
                    ...basePayload
                }]);
                saveErr = fallbackRes.error;
            } else {
                saveErr = res.error;
            }
        }

        if (saveErr) throw new Error(saveErr.message);

        activeStuQuizState.submitting = false;
        activeStuQuizState.mode = 'review';
        activeStuQuizState.attemptResult = attemptPayload;
        document.getElementById('stu-quiz-title').innerText = `📊 Hasil Kuis: ${assObj.judul}`;
        document.getElementById('stu-quiz-subtitle').innerText = `${assObj.mapel} • Skor Akhir: ${finalScore}`;
        renderStudentQuizModal();
        showToast(`🎉 Kuis selesai! Skor Anda: ${finalScore}`);
        await loadAllStudentLMSData();
    } catch (err) {
        activeStuQuizState.submitting = false;
        showToast('❌ Gagal menyimpan hasil kuis: ' + err.message, 'error');
    }
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.className = `fixed bottom-20 lg:bottom-5 right-4 lg:right-5 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg text-white transition-all duration-300 ${type === 'error' ? 'bg-rose-600' : 'bg-slate-900 dark:bg-blue-600'}`;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 4000);
}
