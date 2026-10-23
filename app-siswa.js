// ============================================================================
// FILE: app-siswa.js (v3.5 - Auto-Recovery & Fallback Koneksi Langsung)
// ============================================================================

// Koneksi Fallback Otomatis ke Supabase Anda jika config.js tertahan cache
const BACKUP_SUPABASE_URL = 'https://hypajvsnlalytainfjjn.supabase.co';
const BACKUP_SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imh5cGFqdnNubGFseXRhaW5mampuIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI3MjkyMzcsImV4cCI6MjEwODMwNTIzN30.iwGl4NxMeo_O5QCoeik7NlI__FBpFdPrLBaaQPmrY6Q';

let sdb = null;
function getDbClient() {
    if (sdb) return sdb;
    const isConfigValid = (
        typeof db !== 'undefined' &&
        typeof SUPABASE_URL !== 'undefined' &&
        typeof SUPABASE_ANON_KEY !== 'undefined' &&
        !String(SUPABASE_URL).includes('GANTI_') &&
        !String(SUPABASE_ANON_KEY).includes('GANTI_')
    );
    sdb = isConfigValid ? db : supabase.createClient(BACKUP_SUPABASE_URL, BACKUP_SUPABASE_KEY);
    return sdb;
}

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

function safeGetInitials(name) {
    if (!name) return 'S';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function safeToast(msg, type = 'success') {
    if (typeof showToast === 'function') {
        showToast(msg, type);
    } else {
        alert(msg);
    }
}

function formatDateDDMMYYYY(dateStr) {
    if (!dateStr) return '-';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function showDiagnostic(msg, isError = false) {
    const box = document.getElementById('diagnostic-box');
    if (!box) return;
    box.classList.remove('hidden');
    box.className = `p-4 rounded-2xl border text-xs space-y-1 ${
        isError ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-amber-50 border-amber-300 text-amber-900'
    }`;
    box.innerHTML = msg;
}

function hideDiagnostic() {
    const box = document.getElementById('diagnostic-box');
    if (box) box.classList.add('hidden');
}

// ============================================================================
// INISIALISASI HALAMAN
// ============================================================================
window.addEventListener('DOMContentLoaded', async () => {
    await startStudentPortal();
});

async function startStudentPortal() {
    try {
        const client = getDbClient();
        await initMasterData(client);

        const params = new URLSearchParams(window.location.search);
        const kelasParam = params.get('kelas');
        const siswaParam = params.get('siswa');
        const guruParam = params.get('guru');
        const mapelParam = params.get('mapel');

        const selClass = document.getElementById('dir-class') || document.getElementById('pub-class');
        if (selClass) {
            if (kelasParam && kelasParam !== 'all' && classesMap[kelasParam]) {
                selClass.value = String(kelasParam);
            } else {
                selClass.value = 'all';
            }
        }

        await loadDirectoryStudents(false);

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
    } catch (err) {
        console.error('Error inisialisasi portal siswa:', err);
        showDiagnostic(`<b>⚠️ Terjadi kesalahan saat memuat halaman:</b> ${err.message}`, true);
    }
}

async function initMasterData(client) {
    const { data: cls, error: errCls } = await client.from('classes').select('*').order('nama_kelas');
    if (errCls) {
        showDiagnostic(`<b>⚠️ Gagal membaca tabel classes dari Supabase:</b> ${errCls.message}`, true);
    }
    allClasses = cls || [];

    const selClass = document.getElementById('dir-class') || document.getElementById('pub-class');
    if (selClass) {
        selClass.innerHTML = '<option value="all">-- Semua Kelas --</option>';
        allClasses.forEach(c => {
            classesMap[c.id] = c.nama_kelas;
            selClass.innerHTML += `<option value="${c.id}">Kelas ${c.nama_kelas}</option>`;
        });
    }

    const statCls = document.getElementById('stat-total-classes');
    if (statCls) statCls.innerText = allClasses.length;

    const { data: teachers } = await client.from('app_users').select('id, nama_lengkap').eq('role', 'guru').order('nama_lengkap');
    (teachers || []).forEach(t => {
        teachersMap[t.id] = t.nama_lengkap;
    });
}

// ============================================================================
// MEMUAT & MENAMPILKAN DAFTAR SISWA (DENGAN AUTO-FALLBACK KE SEMUA KELAS)
// ============================================================================
async function loadDirectoryStudents(manualTrigger = false) {
    const client = getDbClient();
    const selClass = document.getElementById('dir-class') || document.getElementById('pub-class');
    let classId = selClass ? selClass.value : 'all';

    hideDiagnostic();

    let query = client.from('students').select('*').order('nama');
    if (classId && classId !== 'all' && !isNaN(Number(classId))) {
        query = query.eq('class_id', Number(classId));
    }

    let { data, error } = await query;

    if (error) {
        showDiagnostic(`
            <p class="font-extrabold">⚠️ Gagal memuat tabel students dari Supabase: ${error.message}</p>
            <p>Pastikan Row Level Security (RLS) pada tabel <code>students</code> sudah dinonaktifkan dengan perintah: <code>ALTER TABLE students DISABLE ROW LEVEL SECURITY;</code></p>
        `, true);
        directoryStudents = [];
        renderDirectoryTable();
        return;
    }

    // Jika filter kelas tertentu menghasilkan 0 siswa saat halaman baru dibuka, cek apakah ada siswa di kelas lain
    if ((!data || data.length === 0) && classId !== 'all' && !manualTrigger) {
        const { data: allStu } = await client.from('students').select('*').order('nama');
        if (allStu && allStu.length > 0) {
            if (selClass) selClass.value = 'all';
            data = allStu;
            showDiagnostic(`
                <p>ℹ️ Kelas yang dipilih pada tautan belum memiliki siswa. Sistem otomatis menampilkan <b>seluruh siswa (${allStu.length} orang)</b> dari semua kelas.</p>
            `, false);
        }
    }

    directoryStudents = data || [];

    if (directoryStudents.length === 0 && classId === 'all') {
        showDiagnostic(`
            <p class="font-extrabold">ℹ️ Koneksi Database Berhasil, namun Tabel Siswa Masih Kosong (0 Siswa).</p>
            <p>Tercatat <b>${allClasses.length} kelas</b> dan <b>0 siswa</b> di database. Silakan login ke <b>Panel Guru / Admin (index.html)</b> untuk menambahkan atau mengimpor daftar siswa terlebih dahulu, atau pastikan RLS pada tabel <code>students</code> sudah <i>Disabled</i> di Supabase.</p>
        `, false);
    }

    renderDirectoryTable();
}

function renderDirectoryTable() {
    const tbody = document.getElementById('dir-tbody') || document.getElementById('pub-tbody');
    if (!tbody) return;

    const searchInput = document.getElementById('dir-search') || document.getElementById('pub-search');
    const keyword = (searchInput?.value || '').trim().toLowerCase();

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
                    Tidak ada data siswa yang ditemukan pada pilihan kelas atau kata kunci ini.
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
// HALAMAN PROFIL LENGKAP SISWA (FULL-PAGE VIEW)
// ============================================================================
async function openStudentProfilePage(studentId, preferredTeacher = null, preferredMapel = null, pushUrl = true) {
    const client = getDbClient();
    let stu = directoryStudents.find(s => s.id === studentId);
    if (!stu) {
        const { data } = await client.from('students').select('*').eq('id', studentId).single();
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
        const selClass = document.getElementById('dir-class');
        const classId = selClass ? selClass.value : 'all';
        const url = (classId && classId !== 'all') ? `${window.location.pathname}?kelas=${classId}` : window.location.pathname;
        window.history.pushState({}, '', url);
    }
}

function copyCurrentPageLink() {
    navigator.clipboard.writeText(window.location.href);
    safeToast('Tautan halaman berhasil disalin!');
}

async function fetchStudentAcademicData(stu, preferredTeacher = null, preferredMapel = null) {
    const client = getDbClient();

    const { data: settings } = await client.from('teacher_settings').select('*').eq('class_id', stu.class_id);
    studentClassSettings = settings || [];

    const { data: assessments } = await client.from('assessments').select('*').eq('class_id', stu.class_id).order('id', { ascending: false });
    studentClassAssessments = assessments || [];

    const assIds = studentClassAssessments.map(a => a.id);
    studentScores = [];
    if (assIds.length) {
        const { data: sc } = await client.from('scores')
            .select('assessment_id, student_id, nama_kelompok, status_kumpul, link_tugas_siswa')
            .eq('student_id', stu.id)
            .in('assessment_id', assIds);
        studentScores = sc || [];
    }

    const { data: attSum } = await client.from('attendance').select('*').eq('student_id', stu.id);
    studentAttendanceSummary = attSum || [];

    const { data: attLogs } = await client.from('attendance_logs').select('*').eq('student_id', stu.id).order('tanggal', { ascending: false });
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
    teacherIds.forEach(tid => {
        if (teachersMap[tid]) {
            selTeacher.innerHTML += `<option value="${tid}">${teachersMap[tid]}</option>`;
        }
    });

    if (preferredTeacher && teacherIds.has(Number(preferredTeacher))) {
        selTeacher.value = String(preferredTeacher);
    }

    populateProfileMapelDropdown(preferredMapel);
}

function onProfileTeacherFilterChange() {
    populateProfileMapelDropdown();
    renderStudentProfileContent();
}

function populateProfileMapelDropdown(preferredMapel = null) {
    const teacherFilter = document.getElementById('prof-filter-teacher').value;
    const selMapel = document.getElementById('prof-filter-mapel');

    const mapelSet = new Set();
    studentClassSettings.forEach(s => {
        if (teacherFilter === 'all' || s.teacher_id == teacherFilter) {
            if (s.mapel) mapelSet.add(s.mapel);
        }
    });
    studentClassAssessments.forEach(a => {
        if (teacherFilter === 'all' || a.teacher_id == teacherFilter) {
            if (a.mapel) mapelSet.add(a.mapel);
        }
    });
    studentAttendanceLogs.forEach(l => {
        if (teacherFilter === 'all' || l.teacher_id == teacherFilter) {
            if (l.mapel) mapelSet.add(l.mapel);
        }
    });

    selMapel.innerHTML = '<option value="all">-- Semua Mata Pelajaran --</option>';
    mapelSet.forEach(m => {
        selMapel.innerHTML += `<option value="${m}">${m}</option>`;
    });

    if (preferredMapel && mapelSet.has(preferredMapel)) {
        selMapel.value = preferredMapel;
    }
}

function renderStudentProfileContent() {
    if (!activeStudent) return;

    const teacherFilter = document.getElementById('prof-filter-teacher').value;
    const mapelFilter = document.getElementById('prof-filter-mapel').value;

    const infoEl = document.getElementById('prof-filter-info');
    const teacherLabel = teacherFilter === 'all' ? 'Seluruh Guru' : teachersMap[teacherFilter];
    const mapelLabel = mapelFilter === 'all' ? 'Semua Mata Pelajaran' : `Mata Pelajaran ${mapelFilter}`;
    infoEl.innerHTML = `Menampilkan data untuk: <b class="text-indigo-700">${teacherLabel}</b> • <b class="text-indigo-700">${mapelLabel}</b>`;

    const filteredAssessments = studentClassAssessments.filter(a => {
        const matchTeacher = (teacherFilter === 'all') || (a.teacher_id == teacherFilter);
        const matchMapel = (mapelFilter === 'all') || ((a.mapel || 'Mata Pelajaran') === mapelFilter);
        return matchTeacher && matchMapel;
    });

    const pendingTasks = [];
    const completedTasks = [];

    filteredAssessments.forEach(ass => {
        const rec = studentScores.find(sc => sc.assessment_id === ass.id);
        const isDone = rec && rec.status_kumpul;
        if (isDone) {
            completedTasks.push({ ass, rec });
        } else {
            pendingTasks.push({ ass, rec });
        }
    });

    document.getElementById('card-uncompleted-count').innerText = pendingTasks.length;
    document.getElementById('card-total-tasks-sub').innerText = `dari ${filteredAssessments.length} total tugas`;
    document.getElementById('badge-pending-tasks').innerText = `${pendingTasks.length} Belum Selesai`;
    document.getElementById('badge-done-tasks').innerText = `${completedTasks.length} Selesai`;

    const headlineEl = document.getElementById('prof-status-headline');
    if (pendingTasks.length === 0) {
        headlineEl.innerText = '🎉 Semua Tugas Tuntas!';
        headlineEl.className = 'text-sm font-extrabold text-emerald-300';
    } else {
        headlineEl.innerText = `⚠️ ${pendingTasks.length} Tugas Belum Dikumpulkan`;
        headlineEl.className = 'text-sm font-extrabold text-amber-300';
    }

    const pendingListEl = document.getElementById('prof-pending-tasks-list');
    pendingListEl.innerHTML = '';

    if (filteredAssessments.length === 0) {
        pendingListEl.innerHTML = `
            <div class="p-8 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-400 text-xs">
                Belum ada tugas atau ujian yang diberikan pada filter guru/mata pelajaran ini.
            </div>
        `;
    } else if (pendingTasks.length === 0) {
        pendingListEl.innerHTML = `
            <div class="p-6 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-center space-y-1">
                <div class="text-2xl">🎉</div>
                <p class="font-extrabold text-sm">Luar Biasa! Tidak Ada Tanggungan Tugas</p>
                <p class="text-xs text-emerald-700">Seluruh tugas pada mata pelajaran ini sudah dikumpulkan.</p>
            </div>
        `;
    } else {
        pendingTasks.forEach(({ ass }) => {
            const labelKat = ass.kategori === 'tugas' ? 'Tugas' : (ass.kategori === 'ujian_bab' ? 'Ujian Akhir Bab' : 'Ujian Semester');
            const namaGuru = teachersMap[ass.teacher_id] || 'Guru Mapel';
            const namaMapel = ass.mapel || 'Mata Pelajaran';

            pendingListEl.innerHTML += `
                <div class="p-4 rounded-2xl bg-rose-50/50 border border-rose-200 hover:border-rose-300 transition flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div class="space-y-1">
                        <div class="flex flex-wrap items-center gap-1.5">
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-rose-100 text-rose-800">
                                ${namaMapel}
                            </span>
                            <span class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-200 text-slate-700">
                                ${labelKat} • ${ass.tipe_kerja}
                            </span>
                        </div>
                        <h4 class="font-extrabold text-sm text-slate-900 pt-0.5">${ass.judul}</h4>
                        <p class="text-xs text-slate-500">Guru Pengampu: <b class="text-slate-700">${namaGuru}</b></p>
                    </div>

                    <div class="flex flex-wrap items-center gap-2 shrink-0">
                        ${ass.link_pengumpulan ? `
                            <a href="${ass.link_pengumpulan}" target="_blank" class="px-3 py-2 rounded-xl bg-white border border-slate-300 text-slate-700 text-xs font-bold hover:bg-slate-100 transition">
                                📤 Buka Link Guru ↗
                            </a>
                        ` : ''}
                        <button onclick="openSubmitModal(${ass.id}, '${ass.judul.replace(/'/g, "\\'")}', '${activeStudent.nisn}')" class="px-3.5 py-2 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 transition shadow-sm">
                            🔗 Setor Link Tugas
                        </button>
                    </div>
                </div>
            `;
        });
    }

    const doneListEl = document.getElementById('prof-completed-tasks-list');
    doneListEl.innerHTML = '';
    if (!completedTasks.length) {
        doneListEl.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-2">Belum ada tugas yang selesai.</p>`;
    } else {
        completedTasks.forEach(({ ass, rec }) => {
            const namaGuru = teachersMap[ass.teacher_id] || 'Guru Mapel';
            const namaMapel = ass.mapel || 'Mata Pelajaran';
            doneListEl.innerHTML += `
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div>
                        <span class="font-extrabold text-slate-800">✅ [${namaMapel}] ${ass.judul}</span>
                        <span class="text-slate-500 block sm:inline sm:ml-1.5">• ${namaGuru}</span>
                    </div>
                    ${rec?.link_tugas_siswa ? `
                        <a href="${rec.link_tugas_siswa}" target="_blank" class="text-indigo-600 font-bold hover:underline">Lihat Bukti Tugas ↗</a>
                    ` : `<span class="text-emerald-700 font-bold">Sudah Dinilai / Tercatat</span>`}
                </div>
            `;
        });
    }

    // Filter Kehadiran (Sakit, Izin, Alpa)
    const filteredLogs = studentAttendanceLogs.filter(l => {
        const matchTeacher = (teacherFilter === 'all') || (l.teacher_id == teacherFilter);
        const matchMapel = (mapelFilter === 'all') || ((l.mapel || 'Mata Pelajaran') === mapelFilter);
        return matchTeacher && matchMapel;
    });

    const filteredSummaries = studentAttendanceSummary.filter(a => {
        const matchTeacher = (teacherFilter === 'all') || (a.teacher_id == teacherFilter);
        const matchMapel = (mapelFilter === 'all') || ((a.mapel || 'Mata Pelajaran') === mapelFilter);
        return matchTeacher && matchMapel;
    });

    const logSakit = filteredLogs.filter(l => l.status === 'S').length;
    const logIzin = filteredLogs.filter(l => l.status === 'I').length;
    const logAlpa = filteredLogs.filter(l => l.status === 'A').length;
    const logHadir = filteredLogs.filter(l => l.status === 'H').length;

    const sumSakit = filteredSummaries.reduce((acc, cur) => acc + (Number(cur.sakit) || 0), 0);
    const sumIzin = filteredSummaries.reduce((acc, cur) => acc + (Number(cur.izin) || 0), 0);
    const sumAlpa = filteredSummaries.reduce((acc, cur) => acc + (Number(cur.alpa) || 0), 0);
    const sumHadir = filteredSummaries.reduce((acc, cur) => acc + (Number(cur.hadir) || 0), 0);

    const totalSakit = Math.max(logSakit, sumSakit);
    const totalIzin = Math.max(logIzin, sumIzin);
    const totalAlpa = Math.max(logAlpa, sumAlpa);
    const totalHadir = Math.max(logHadir, sumHadir);

    document.getElementById('card-sakit-count').innerText = totalSakit;
    document.getElementById('card-izin-count').innerText = totalIzin;
    document.getElementById('card-alpa-count').innerText = totalAlpa;

    const absenceLogs = filteredLogs.filter(l => l.status === 'S' || l.status === 'I' || l.status === 'A');
    const absTbody = document.getElementById('prof-absence-logs-tbody');
    absTbody.innerHTML = '';

    if (absenceLogs.length === 0) {
        absTbody.innerHTML = `
            <tr>
                <td colspan="3" class="p-6 text-center text-emerald-700 bg-emerald-50/40 font-semibold">
                    ✨ Tidak ada catatan tanggal ketidakhadiran (Sakit / Izin / Alpa).
                </td>
            </tr>
        `;
    } else {
        absenceLogs.forEach(log => {
            const tglFormatted = formatDateDDMMYYYY(log.tanggal);
            const namaGuru = teachersMap[log.teacher_id] || 'Guru Mapel';
            const namaMapel = log.mapel || 'Mata Pelajaran';

            let statusBadge = '';
            if (log.status === 'S') {
                statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200">🤒 Sakit (S)</span>`;
            } else if (log.status === 'I') {
                statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-sky-100 text-sky-800 border border-sky-200">📩 Izin (I)</span>`;
            } else if (log.status === 'A') {
                statusBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200">⚠️ Alpa (A)</span>`;
            }

            absTbody.innerHTML += `
                <tr class="hover:bg-slate-50">
                    <td class="p-3 font-mono font-bold text-slate-800 whitespace-nowrap">${tglFormatted}</td>
                    <td class="p-3 text-center whitespace-nowrap">${statusBadge}</td>
                    <td class="p-3">
                        <span class="font-bold text-slate-800 block">${namaMapel}</span>
                        <span class="text-[11px] text-slate-500">${namaGuru}</span>
                    </td>
                </tr>
            `;
        });
    }

    document.getElementById('prof-attendance-note').innerHTML = `
        <b>Ringkasan Kehadiran:</b> Tercatat <b>${totalHadir} kali Hadir</b>, <b>${totalSakit} Sakit</b>, <b>${totalIzin} Izin</b>, dan <b>${totalAlpa} Alpa</b> pada filter yang dipilih.
    `;
}

// ============================================================================
// PENYETORAN LINK TUGAS DARI HALAMAN PROFIL SISWA
// ============================================================================
function openSubmitModal(assId, assTitle, prefilledNisn = '') {
    document.getElementById('mod-ass-id').value = assId;
    document.getElementById('mod-ass-title').innerText = assTitle;
    document.getElementById('mod-nisn').value = prefilledNisn;
    document.getElementById('mod-link').value = '';
    document.getElementById('modal-submit-link').classList.remove('hidden');
}

function closeSubmitModal() {
    document.getElementById('modal-submit-link').classList.add('hidden');
}

async function submitStudentTaskLink(e) {
    e.preventDefault();
    if (!activeStudent) return;
    const client = getDbClient();

    const assessment_id = Number(document.getElementById('mod-ass-id').value);
    const nisnInput = document.getElementById('mod-nisn').value.trim();
    const link_tugas_siswa = document.getElementById('mod-link').value.trim();

    if (nisnInput !== activeStudent.nisn) {
        return safeToast('NISN yang Anda masukkan tidak sesuai dengan pemilik profil ini!', 'error');
    }

    const { error } = await client.from('scores').upsert([{
        assessment_id,
        student_id: activeStudent.id,
        link_tugas_siswa,
        status_kumpul: true
    }], { onConflict: 'assessment_id,student_id' });

    if (error) return safeToast('Gagal menyimpan link tugas: ' + error.message, 'error');

    closeSubmitModal();
    safeToast(`Terima kasih ${activeStudent.nama}, tugas berhasil ditandai selesai!`);

    const curTeacher = document.getElementById('prof-filter-teacher').value;
    const curMapel = document.getElementById('prof-filter-mapel').value;
    await fetchStudentAcademicData(activeStudent, curTeacher, curMapel);
}
