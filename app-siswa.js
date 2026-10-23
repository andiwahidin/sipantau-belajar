// ============================================================================
// FILE: app-siswa.js (v3.2)
// Direktori Utama Siswa & Halaman Profil Akademik Lengkap (Tugas & Absensi DD/MM/YYYY)
// ============================================================================

let allClasses = [];
let classesMap = {};
let teachersMap = {};
let directoryStudents = [];

// State Halaman Profil Siswa Aktif
let activeStudent = null;
let studentClassAssessments = [];
let studentScores = [];
let studentAttendanceSummary = [];
let studentAttendanceLogs = [];
let studentClassSettings = [];

// Helper Format Tanggal YYYY-MM-DD -> DD/MM/YYYY
function formatDateDDMMYYYY(dateStr) {
    if (!dateStr) return '-';
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return dateStr;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

window.onload = async () => {
    await initMasterData();

    // Cek parameter URL apakah langsung membuka profil siswa atau kelas tertentu
    const params = new URLSearchParams(window.location.search);
    const kelasParam = params.get('kelas');
    const siswaParam = params.get('siswa');
    const guruParam = params.get('guru');
    const mapelParam = params.get('mapel');

    if (kelasParam && classesMap[kelasParam]) {
        document.getElementById('dir-class').value = kelasParam;
    }

    await loadDirectoryStudents();

    if (siswaParam) {
        await openStudentProfilePage(Number(siswaParam), guruParam, mapelParam, false);
    }

    // Dukungan tombol Back/Forward browser
    window.onpopstate = async () => {
        const p = new URLSearchParams(window.location.search);
        if (p.get('siswa')) {
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
    const { data: cls } = await db.from('classes').select('*').order('nama_kelas');
    allClasses = cls || [];
    const selDirClass = document.getElementById('dir-class');
    selDirClass.innerHTML = '<option value="all">-- Semua Kelas --</option>';

    allClasses.forEach(c => {
        classesMap[c.id] = c.nama_kelas;
        selDirClass.innerHTML += `<option value="${c.id}">Kelas ${c.nama_kelas}</option>`;
    });

    document.getElementById('stat-total-classes').innerText = allClasses.length;

    const { data: teachers } = await db.from('app_users').select('id, nama_lengkap').eq('role', 'guru').order('nama_lengkap');
    (teachers || []).forEach(t => {
        teachersMap[t.id] = t.nama_lengkap;
    });
}

// ============================================================================
// 2. HALAMAN DIREKTORI UTAMA SISWA (TANPA STATUS TUGAS)
// ============================================================================
async function loadDirectoryStudents() {
    const classId = document.getElementById('dir-class').value;
    let query = db.from('students').select('*').order('nama');
    if (classId !== 'all') {
        query = query.eq('class_id', classId);
    }

    const { data } = await query;
    directoryStudents = data || [];
    renderDirectoryTable();
}

function renderDirectoryTable() {
    const tbody = document.getElementById('dir-tbody');
    const keyword = (document.getElementById('dir-search')?.value || '').trim().toLowerCase();

    const filtered = directoryStudents.filter(s =>
        s.nama.toLowerCase().includes(keyword) || s.nisn.toLowerCase().includes(keyword)
    );

    document.getElementById('stat-total-students').innerText = filtered.length;

    if (!filtered.length) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="p-10 text-center text-slate-400">
                    Tidak ada data siswa yang cocok dengan filter atau pencarian Anda.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach((s, idx) => {
        const namaKelas = classesMap[s.class_id] || '-';
        tbody.innerHTML += `
            <tr onclick="openStudentProfilePage(${s.id})" class="hover:bg-indigo-50/60 cursor-pointer transition group">
                <td class="p-4 text-center text-slate-400 font-bold">${idx + 1}</td>
                <td class="p-4 font-mono font-semibold text-slate-600">${s.nisn}</td>
                <td class="p-4">
                    <div class="flex items-center gap-3">
                        <div class="w-9 h-9 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0 group-hover:bg-indigo-600 group-hover:text-white transition">
                            ${getInitials(s.nama)}
                        </div>
                        <div>
                            <span class="font-extrabold text-slate-900 group-hover:text-indigo-600 transition block text-sm">
                                ${s.nama}
                            </span>
                            <span class="text-[11px] text-slate-400">Klik untuk melihat profil, tugas & kehadiran</span>
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
}

// ============================================================================
// 3. NAVIGASI KE HALAMAN PROFIL LENGKAP SISWA
// ============================================================================
async function openStudentProfilePage(studentId, preferredTeacher = null, preferredMapel = null, pushUrl = true) {
    // Cari data siswa di memori atau ambil dari database
    let stu = directoryStudents.find(s => s.id === studentId);
    if (!stu) {
        const { data } = await db.from('students').select('*').eq('id', studentId).single();
        stu = data;
    }
    if (!stu) {
        showToast('Data siswa tidak ditemukan!', 'error');
        return;
    }

    activeStudent = stu;
    const namaKelas = classesMap[stu.class_id] || '-';

    // Beralih tampilan halaman penuh
    document.getElementById('view-directory').classList.add('hidden');
    document.getElementById('view-profile').classList.remove('hidden');
    document.getElementById('btn-nav-back').classList.remove('hidden');
    document.getElementById('btn-nav-back').classList.add('inline-flex');
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Set Identitas Siswa di Header Profil
    document.getElementById('prof-avatar').innerText = getInitials(stu.nama);
    document.getElementById('prof-nama').innerText = stu.nama;
    document.getElementById('prof-kelas-badge').innerText = `Kelas ${namaKelas}`;
    document.getElementById('prof-nisn-badge').innerText = `NISN: ${stu.nisn}`;

    // Perbarui URL agar bisa dibagikan langsung
    if (pushUrl) {
        const newUrl = `${window.location.pathname}?kelas=${stu.class_id}&siswa=${stu.id}`;
        window.history.pushState({ studentId: stu.id }, '', newUrl);
    }

    // Ambil seluruh data akademik untuk siswa dan kelasnya
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
        const url = classId !== 'all' ? `${window.location.pathname}?kelas=${classId}` : window.location.pathname;
        window.history.pushState({}, '', url);
    }
}

function copyCurrentPageLink() {
    navigator.clipboard.writeText(window.location.href);
    showToast('Tautan halaman berhasil disalin!');
}

// ============================================================================
// 4. PENGAMBILAN & PEMFILTERAN DATA PROFIL SISWA (GURU / MAPEL / SELURUHNYA)
// ============================================================================
async function fetchStudentAcademicData(stu, preferredTeacher = null, preferredMapel = null) {
    // 1. Ambil pengaturan guru & mapel yang mengajar di kelas siswa ini
    const { data: settings } = await db.from('teacher_settings')
        .select('*')
        .eq('class_id', stu.class_id);
    studentClassSettings = settings || [];

    // 2. Ambil seluruh tugas/ujian di kelas siswa ini
    const { data: assessments } = await db.from('assessments')
        .select('*')
        .eq('class_id', stu.class_id)
        .order('id', { ascending: false });
    studentClassAssessments = assessments || [];

    // 3. Ambil status pengumpulan tugas milik siswa ini (TANPA mengambil kolom nilai angka)
    const assIds = studentClassAssessments.map(a => a.id);
    studentScores = [];
    if (assIds.length) {
        const { data: sc } = await db.from('scores')
            .select('assessment_id, student_id, nama_kelompok, status_kumpul, link_tugas_siswa')
            .eq('student_id', stu.id)
            .in('assessment_id', assIds);
        studentScores = sc || [];
    }

    // 4. Ambil rekap kehadiran siswa ini
    const { data: attSum } = await db.from('attendance')
        .select('*')
        .eq('student_id', stu.id);
    studentAttendanceSummary = attSum || [];

    // 5. Ambil log tanggal kehadiran siswa ini (untuk rincian Sakit, Izin, Alpa beserta tanggal DD/MM/YYYY)
    const { data: attLogs } = await db.from('attendance_logs')
        .select('*')
        .eq('student_id', stu.id)
        .order('tanggal', { ascending: false });
    studentAttendanceLogs = attLogs || [];

    // Isi Dropdown Filter Guru di Halaman Profil
    populateProfileFilterDropdowns(preferredTeacher, preferredMapel);
    renderStudentProfileContent();
}

function populateProfileFilterDropdowns(preferredTeacher = null, preferredMapel = null) {
    const selTeacher = document.getElementById('prof-filter-teacher');
    
    // Kumpulkan ID guru yang mengajar di kelas ini (dari settings, assessments, atau attendance)
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
        selTeacher.value = preferredTeacher;
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

// ============================================================================
// 5. RENDER ISI PROFIL SISWA (TUGAS BELUM SELESAI & KEHADIRAN DD/MM/YYYY)
// ============================================================================
function renderStudentProfileContent() {
    if (!activeStudent) return;

    const teacherFilter = document.getElementById('prof-filter-teacher').value;
    const mapelFilter = document.getElementById('prof-filter-mapel').value;

    // Label Info Filter Aktif
    const infoEl = document.getElementById('prof-filter-info');
    const teacherLabel = teacherFilter === 'all' ? 'Seluruh Guru' : teachersMap[teacherFilter];
    const mapelLabel = mapelFilter === 'all' ? 'Semua Mata Pelajaran' : `Mata Pelajaran ${mapelFilter}`;
    infoEl.innerHTML = `Menampilkan data untuk: <b class="text-indigo-700">${teacherLabel}</b> • <b class="text-indigo-700">${mapelLabel}</b>`;

    // ------------------------------------------------------------------------
    // A. FILTER & RENDER TUGAS YANG BELUM DISELESAIKAN
    // ------------------------------------------------------------------------
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

    // Update Summary Card & Headline Tugas
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

    // Render Daftar Tugas Belum Selesai
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

    // Render Riwayat Tugas Sudah Selesai
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

    // ------------------------------------------------------------------------
    // B. FILTER & RENDER KEHADIRAN (SAKIT, IZIN, ALPA) & TANGGAL (DD/MM/YYYY)
    // ------------------------------------------------------------------------
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

    // Hitung total S, I, A dari log tanggal maupun tabel rekap
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

    // Filter hanya catatan ketidakhadiran: Sakit (S), Izin (I), Alpa (A)
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
// 6. PENYETORAN LINK TUGAS DARI HALAMAN PROFIL SISWA
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

    const assessment_id = Number(document.getElementById('mod-ass-id').value);
    const nisnInput = document.getElementById('mod-nisn').value.trim();
    const link_tugas_siswa = document.getElementById('mod-link').value.trim();

    if (nisnInput !== activeStudent.nisn) {
        return showToast('NISN yang Anda masukkan tidak sesuai dengan pemilik profil ini!', 'error');
    }

    const { error } = await db.from('scores').upsert([{
        assessment_id,
        student_id: activeStudent.id,
        link_tugas_siswa,
        status_kumpul: true
    }], { onConflict: 'assessment_id,student_id' });

    if (error) return showToast('Gagal menyimpan link tugas: ' + error.message, 'error');

    closeSubmitModal();
    showToast(`Terima kasih ${activeStudent.nama}, tugas berhasil ditandai selesai!`);

    // Muat ulang data akademik profil siswa agar tugas langsung berpindah ke selesai
    const curTeacher = document.getElementById('prof-filter-teacher').value;
    const curMapel = document.getElementById('prof-filter-mapel').value;
    await fetchStudentAcademicData(activeStudent, curTeacher, curMapel);
}
