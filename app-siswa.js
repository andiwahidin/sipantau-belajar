// ============================================================================
// FILE: app-siswa.js (v3.3 - Anti-Crash & Auto-Fallback)
// Direktori Utama Siswa & Halaman Profil Akademik Lengkap
// ============================================================================

let allClasses = [];
let classesMap = {};
let teachersMap = {};
let directoryStudents = [];

let activeStudent = null;
let studentClassAssessments = [];
let studentScores = [];
let studentAttendanceSummary = [];
let studentAttendanceLogs = [];
let studentClassSettings = [];

// Fallback aman jika getInitials belum ada di config.js
function safeGetInitials(name) {
    if (typeof getInitials === 'function') return getInitials(name);
    if (!name) return 'S';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

// Fallback aman jika showToast belum ada di config.js
function safeToast(msg, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        alert(msg);
    }
}

// Format Tanggal YYYY-MM-DD -> DD/MM/YYYY
function formatDateDDMMYYYY(dateStr) {
    if (!dateStr) return '-';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

window.onload = async () => {
    const tbody = document.getElementById('dir-tbody');

    // Pastikan config.js dan koneksi Supabase (db) tersedia
    if (typeof db === 'undefined') {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-rose-600 font-bold bg-rose-50">
                        ⚠️ Koneksi database (config.js) tidak ditemukan! Pastikan file <code>config.js</code> sudah diunggah di folder yang sama dengan <code>siswa.html</code>.
                    </td>
                </tr>
            `;
        }
        return;
    }

    await initMasterData();

    const params = new URLSearchParams(window.location.search);
    const kelasParam = params.get('kelas');
    const siswaParam = params.get('siswa');
    const guruParam = params.get('guru');
    const mapelParam = params.get('mapel');

    const selDirClass = document.getElementById('dir-class');
    if (kelasParam && kelasParam !== 'all' && classesMap[kelasParam]) {
        selDirClass.value = String(kelasParam);
    } else {
        selDirClass.value = 'all';
    }

    await loadDirectoryStudents();

    if (siswaParam && !isNaN(Number(siswaParam))) {
        await openStudentProfilePage(Number(siswaParam), guruParam, mapelParam, false);
    }

    window.onpopstate = async () => {
        const p = new URLSearchParams(window.location.search);
        if (p.get('siswa') && !isNaN(Number(p.get('siswa')))) {
            await openStudentProfilePage(Number(p.get('siswa')), p.get('guru'), p.get('mapel'), false);
        } else {
            showDirectoryView(false);
        }
    };
};

// ============================================================================
// 1. INISIALISASI MASTER KELAS & GURU
// ============================================================================
async function initMasterData() {
    const { data: cls, error: errCls } = await db.from('classes').select('*').order('nama_kelas');
    if (errCls) {
        console.error('Error memuat kelas:', errCls);
    }
    allClasses = cls || [];

    const selDirClass = document.getElementById('dir-class');
    if (selDirClass) {
        selDirClass.innerHTML = '<option value="all">-- Semua Kelas --</option>';
        allClasses.forEach(c => {
            classesMap[c.id] = c.nama_kelas;
            selDirClass.innerHTML += `<option value="${c.id}">Kelas ${c.nama_kelas}</option>`;
        });
    }

    const statCls = document.getElementById('stat-total-classes');
    if (statCls) statCls.innerText = allClasses.length;

    const { data: teachers } = await db.from('app_users').select('id, nama_lengkap').eq('role', 'guru').order('nama_lengkap');
    (teachers || []).forEach(t => {
        teachersMap[t.id] = t.nama_lengkap;
    });
}

// ============================================================================
// 2. HALAMAN DIREKTORI UTAMA SISWA
// ============================================================================
async function loadDirectoryStudents() {
    const selDirClass = document.getElementById('dir-class');
    const classId = selDirClass ? selDirClass.value : 'all';
    const tbody = document.getElementById('dir-tbody');

    let query = db.from('students').select('*').order('nama');

    // Validasi ketat agar hanya memfilter jika classId benar-benar angka yang valid
    if (classId && classId !== 'all' && !isNaN(Number(classId))) {
        query = query.eq('class_id', Number(classId));
    }

    const { data, error } = await query;

    if (error) {
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="5" class="p-8 text-center text-rose-600 font-bold bg-rose-50">
                        ⚠️ Gagal memuat data siswa dari Supabase: ${error.message}
                    </td>
                </tr>
            `;
        }
        return;
    }

    directoryStudents = data || [];
    renderDirectoryTable();
}

function renderDirectoryTable() {
    const tbody = document.getElementById('dir-tbody');
    if (!tbody) return;

    const keyword = (document.getElementById('dir-search')?.value || '').trim().toLowerCase();

    const filtered = directoryStudents.filter(s => {
        const nama = String(s.nama || '').toLowerCase();
        const nisn = String(s.nisn || '').toLowerCase();
        return nama.includes(keyword) || nisn.includes(keyword);
    });

    const statStu = document.getElementById('stat-total-students');
    if (statStu) statStu.innerText = filtered.length;

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="p-10 text-center text-slate-400">
                    Belum ada data siswa di kelas ini atau tidak ada nama yang cocok dengan pencarian Anda.
                </td>
            </tr>
        `;
        return;
    }

    let rowsHtml = '';
    filtered.forEach((s, idx) => {
        const namaKelas = classesMap[s.class_id] || '-';
        const inisial = safeGetInitials(s.nama);
        rowsHtml += `
            <tr onclick="openStudentProfilePage(${s.id})" class="hover:bg-indigo-50/60 cursor-pointer transition group">
                <td class="p-4 text-center text-slate-400 font-bold">${idx + 1}</td>
                <td class="p-4 font-mono font-semibold text-slate-600">${s.nisn || '-'}</td>
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                            ${inisial}
                        </div>
                        <div>
                            <span class="font-extrabold text-slate-900 group-hover:text-indigo-600 transition block text-sm">
                                ${s.nama || '-'}
                            </span>
                            <span class="text-[11px] text-slate-400">Klik untuk membuka halaman profil, tugas & kehadiran</span>
                        </div>
                    </div>
                </td>
                <td class="p-4 text-center">
                    <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-slate-100 text-slate-700 border border-slate-200">
                        ${namaKelas}
                    </span>
                </td>
                <td class="p-4 text-right">
                    <span class="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-indigo-50 text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition">
                        Lihat Profil →
                    </span>
                </td>
            </tr>
        `;
    });

    tbody.innerHTML = rowsHtml;
}

// ============================================================================
// 3. NAVIGASI KE HALAMAN PROFIL LENGKAP SISWA
// ============================================================================
async function openStudentProfilePage(studentId, preferredTeacher = null, preferredMapel = null, pushUrl = true) {
    let stu = directoryStudents.find(s => s.id === studentId);
    if (!stu) {
        const { data } = await db.from('students').select('*').eq('id', studentId).single();
        stu = data;
    }
    if (!stu) {
        safeToast('Data siswa tidak ditemukan!', 'error');
        return;
    }

    activeStudent = stu;
    const namaKelas = classesMap[stu.class_id] || '-';

    document.getElementById('view-directory').classList.add('hidden');
    document.getElementById('view-profile').classList.remove('hidden');
    document.getElementById('btn-nav-back').classList.remove('hidden');
    document.getElementById('btn-nav-back').classList.add('inline-flex');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    document.getElementById('prof-avatar').innerText = safeGetInitials(stu.nama);
    document.getElementById('prof-nama').innerText = stu.nama;
    document.getElementById('prof-kelas-badge').innerText = `Kelas ${namaKelas}`;
    document.getElementById('prof-nisn-badge').innerText = `NISN: ${stu.nisn}`;

    if (pushUrl) {
        const newUrl = `${window.location.pathname}?kelas=${stu.class_id}&siswa=${stu.id}`;
        window.history.pushState({ studentId: stu.id }, '', newUrl);
    }

    await fetchStudentAcademicData(stu, preferredTeacher, preferredMapel);
}

function backToDirectory() {
    showDirectoryView(true);
}

function showDirectoryView(pushUrl = true) {
    activeStudent = null;
    document.getElementById('view-profile').classList.add('hidden');
    document.getElementById('view-directory').classList.remove('hidden');
    document.getElementById('btn-nav-back').classList.add('hidden');
    document.getElementById('btn-nav-back').classList.remove('inline-flex');

    if (pushUrl) {
        const classId = document.getElementById('dir-class').value;
        const url = (classId && classId !== 'all') ? `${window.location.pathname}?kelas=${classId}` : window.location.pathname;
        window.history.pushState({}, '', url);
    }
}

function copyCurrentPageLink() {
    navigator.clipboard.writeText(window.location.href);
    safeToast('Tautan halaman berhasil disalin!');
}

// ============================================================================
// 4. PENGAMBILAN & PEMFILTERAN DATA PROFIL SISWA
// ============================================================================
async function fetchStudentAcademicData(stu, preferredTeacher = null, preferredMapel = null) {
    const { data: settings } = await db.from('teacher_settings').select('*').eq('class_id', stu.class_id);
    studentClassSettings = settings || [];

    const { data: assessments } = await db.from('assessments').select('*').eq('class_id', stu.class_id).order('id', { ascending: false });
    studentClassAssessments = assessments || [];

    const assIds = studentClassAssessments.map(a => a.id);
    studentScores = [];
    if (assIds.length) {
        const { data: sc } = await db.from('scores')
            .select('assessment_id, student_id, nama_kelompok, status_kumpul, link_tugas_siswa')
            .eq('student_id', stu.id)
            .in('assessment_id', assIds);
        studentScores = sc || [];
    }

    const { data: attSum } = await db.from('attendance').select('*').eq('student_id', stu.id);
    studentAttendanceSummary = attSum || [];

    const { data: attLogs } = await db.from('attendance_logs').select('*').eq('student_id', stu.id).order('tanggal', { ascending: false });
    studentAttendanceLogs = attLogs || [];

    populateProfileFilterDropdowns(preferredTeacher, preferredMapel);
    renderStudentProfileContent();
}

function populateProfileFilterDropdowns(preferredTeacher = null, preferredMapel = null) {
    const selTeacher = document.getElementById('prof-filter-teacher');
    const teacherIds = new Set([
        ...studentClassSettings.map(s => s.teacher_id),
        ...studentClassAssessments.map(a => a.teacher_id),
        ...studentAttendanceSummary.map(a => a.teacher_id),
        ...studentAttendanceLogs.map(l => l.teacher_id)
    ]);

    selTeacher.innerHTML = '<option value="all">-- Seluruh Guru Pengampu --</option>';
    teacherIds
