// ============================================================================
// FILE: app-siswa.js (PORTAL SISWA - PENCARIAN MULTI-HASIL & CHART VISUAL)
// ============================================================================

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

let teachersMap = {};
let studentChartInstances = {};

window.addEventListener('DOMContentLoaded', async () => {
    const client = getDbClient();
    const { data: teachers } = await client.from('app_users').select('id, nama_lengkap').eq('role', 'guru');
    (teachers || []).forEach(t => { teachersMap[t.id] = t.nama_lengkap; });
});

function safeGetInitials(name) {
    if (!name) return 'S';
    const parts = String(name).trim().split(/\s+/);
    if (parts.length === 1) return parts[0].substring(0, 2).toUpperCase();
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function parseDateToDayAndDDMMYYYY(dateStr) {
    if (!dateStr) return { dayName: '-', ddmmyyyy: '-', full: '-' };
    const parts = String(dateStr).split('-');
    if (parts.length !== 3) return { dayName: '', ddmmyyyy: dateStr, full: dateStr };

    const y = Number(parts[0]);
    const m = Number(parts[1]);
    const d = Number(parts[2]);
    const dateObj = new Date(y, m - 1, d);
    const daysIndo = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const dayName = daysIndo[dateObj.getDay()] || '';
    const ddmmyyyy = `${parts[2]}/${parts[1]}/${parts[0]}`;

    return { dayName, ddmmyyyy, full: dayName ? `${dayName}, ${ddmmyyyy}` : ddmmyyyy };
}

// 1. PENCARIAN UTAMA (MENAMPILKAN DAFTAR KARTU RINGKAS JIKA LEBIH DARI 1)
async function cariProgresSiswa() {
    const query = (document.getElementById('inputCariSiswa')?.value || '').trim().toLowerCase();
    const container = document.getElementById('hasilSiswaContainer');
    if (!query) {
        showToast('Masukkan NISN atau Nama Siswa terlebih dahulu!', 'error');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = `<div class="card-box bg-white p-6 rounded-2xl shadow-sm text-center py-8 text-slate-500">Mencari data siswa...</div>`;

    const client = getDbClient();
    let matchedStudents = [];

    try {
        const { data: students } = await client.from('students').select('*');
        if (students && students.length > 0) {
            matchedStudents = students.filter(s => 
                (s.nama && s.nama.toLowerCase().includes(query)) ||
                (s.nisn && String(s.nisn).toLowerCase().includes(query))
            );
        }
    } catch (err) {
        console.warn('Gagal memuat database siswa:', err);
    }

    if (!matchedStudents.length) {
        container.innerHTML = `<div class="card-box bg-white p-6 rounded-2xl shadow-sm text-center py-6 text-rose-600 font-medium">Data siswa dengan kata kunci "${query}" tidak ditemukan.</div>`;
        return;
    }

    // Jika ditemukan 1 atau lebih, render daftar ringkasannya terlebih dahulu
    let listHtml = '';
    for (const hasil of matchedStudents) {
        const stuId = hasil.id;
        const classId = hasil.class_id;
        const nama = hasil.nama || 'Siswa';
        const nisn = hasil.nisn || '-';

        let className = 'X-A';
        try {
            const { data: clsData } = await client.from('classes').select('nama_kelas').eq('id', classId).single();
            if (clsData) className = clsData.nama_kelas;
        } catch (e) {}

        listHtml += `
            <div class="card-box bg-white p-5 rounded-2xl shadow-sm border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3">
                <div class="flex items-center gap-3.5">
                    <div class="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base shrink-0">
                        ${safeGetInitials(nama)}
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-900">${nama}</h3>
                        <p class="text-xs text-slate-500">NISN: ${nisn} • Kelas: ${className}</p>
                    </div>
                </div>
                <button type="button" onclick="bukaDetailSiswa(${stuId})" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition text-center shrink-0">
                    Lihat Detail & Laporan Lengkap →
                </button>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="space-y-3">
            <p class="text-xs font-bold text-slate-600 mb-2">Ditemukan ${matchedStudents.length} siswa yang sesuai dengan pencarian:</p>
            ${listHtml}
        </div>
    `;
}

// 2. KETIKA TOMBOL DETAIL DIKLIK, TAMPILKAN LAPORAN KESELURUHAN BESERTA CHART & LINK TUGAS
async function bukaDetailSiswa(stuId) {
    const container = document.getElementById('hasilSiswaContainer');
    container.innerHTML = `<div class="card-box bg-white p-6 rounded-2xl shadow-sm text-center py-8 text-slate-500">Memuat laporan lengkap siswa...</div>`;

    const client = getDbClient();
    let hasil = null;

    try {
        const { data } = await client.from('students').select('*').eq('id', stuId).single();
        hasil = data;
    } catch (e) {}

    if (!hasil) {
        showToast('Gagal memuat profil siswa.', 'error');
        return;
    }

    const classId = hasil.class_id;
    const nama = hasil.nama || 'Siswa';
    const nisn = hasil.nisn || '-';

    let className = 'X-A';
    try {
        const { data: clsData } = await client.from('classes').select('nama_kelas').eq('id', classId).single();
        if (clsData) className = clsData.nama_kelas;
    } catch (e) {}

    let publicAssessments = [];
    try {
        const { data: assData } = await client.from('assessments').select('*').eq('class_id', classId);
        publicAssessments = (assData || []).filter(a => a.tampil_publik !== false);
    } catch (e) {}

    let studentScores = [];
    if (publicAssessments.length > 0) {
        try {
            const assIds = publicAssessments.map(a => a.id);
            const { data: scData } = await client.from('scores').select('*').eq('student_id', stuId).in('assessment_id', assIds);
            studentScores = scData || [];
        } catch (e) {}
    }

    let attendanceLogs = [];
    try {
        const { data: logData } = await client.from('attendance_logs').select('*').eq('student_id', stuId).order('tanggal', { ascending: false });
        attendanceLogs = logData || [];
    } catch (e) {}

    // Hitung tugas selesai / belum
    let doneCount = 0;
    let pendingCount = 0;
    const taskDetailsHtml = publicAssessments.map(ass => {
        const rec = studentScores.find(sc => sc.assessment_id === ass.id);
        const isDone = rec && rec.status_kumpul;
        if (isDone) doneCount++; else pendingCount++;

        const namaGuru = teachersMap[ass.teacher_id] || 'Guru Mapel';
        const namaMapel = ass.mapel || 'Mata Pelajaran';

        return `
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                    <div class="flex items-center gap-1.5">
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase ${isDone ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                            ${isDone ? 'Sudah Dikumpulkan' : 'Belum Dikumpulkan'}
                        </span>
                        <span class="text-slate-400">•</span>
                        <span class="font-bold text-slate-700">${namaMapel}</span>
                    </div>
                    <h5 class="font-extrabold text-slate-900 mt-1">${ass.judul}</h5>
                    <p class="text-[11px] text-slate-500">Guru: ${namaGuru}</p>
                </div>
                ${ass.link_pengumpulan ? `
                    <a href="${ass.link_pengumpulan}" target="_blank" class="px-3 py-1.5 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 font-bold hover:bg-blue-100 text-center shrink-0">
                        📤 Link Pengumpulan ↗
                    </a>
                ` : '<span class="text-slate-400 italic">Tanpa link khusus</span>'}
            </div>
        `;
    }).join('') || '<p class="text-xs text-slate-400 italic">Belum ada tugas publik.</p>';

    // Hitung rekap kehadiran
    const totalHadir = attendanceLogs.filter(l => l.status === 'H').length;
    const totalSakit = attendanceLogs.filter(l => l.status === 'S').length;
    const totalIzin  = attendanceLogs.filter(l => l.status === 'I').length;
    const totalAlpa  = attendanceLogs.filter(l => l.status === 'A').length;

    // Render Log Ketidakhadiran Saja
    const absenceLogs = attendanceLogs.filter(l => l.status === 'S' || l.status === 'I' || l.status === 'A');
    const groupedByDateMap = new Map();
    absenceLogs.forEach(log => {
        if (!groupedByDateMap.has(log.tanggal)) groupedByDateMap.set(log.tanggal, []);
        groupedByDateMap.get(log.tanggal).push(log);
    });

    let absenceRowsHtml = '';
    if (groupedByDateMap.size === 0) {
        absenceRowsHtml = `<tr><td colspan="3" class="p-4 text-center text-emerald-700 bg-emerald-50/30 text-xs font-semibold">✨ Bersih dari catatan ketidakhadiran (Sakit / Izin / Alpa).</td></tr>`;
    } else {
        groupedByDateMap.forEach((logsInDay, tanggalKey) => {
            const parsedDate = parseDateToDayAndDDMMYYYY(tanggalKey);
            const uniqueStatuses = [...new Set(logsInDay.map(l => l.status))];
            const statusBadgesHtml = uniqueStatuses.map(st => {
                if (st === 'S') return `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-amber-100 text-amber-800">🤒 Sakit</span>`;
                if (st === 'I') return `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-sky-100 text-sky-800">📩 Izin</span>`;
                return `<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800">⚠️ Alpa</span>`;
            }).join(' ');

            const detailsHtml = logsInDay.map(item => {
                const namaGuru = teachersMap[item.teacher_id] || 'Guru Mapel';
                return `<div class="py-0.5 text-[11px]"><b>${item.mapel || 'Mapel'}</b> (${namaGuru})</div>`;
            }).join('');

            absenceRowsHtml += `
                <tr class="hover:bg-slate-50 text-xs align-top">
                    <td class="p-2.5">
                        <span class="font-bold block">${parsedDate.dayName}</span>
                        <span class="font-mono text-indigo-600 text-[11px]">${parsedDate.ddmmyyyy}</span>
                    </td>
                    <td class="p-2.5 text-center">${statusBadgesHtml}</td>
                    <td class="p-2.5">${detailsHtml}</td>
                </tr>
            `;
        });
    }

    container.innerHTML = `
        <div class="space-y-5">
            <button type="button" onclick="cariProgresSiswa()" class="text-xs font-bold text-blue-600 hover:underline">
                ← Kembali ke Hasil Pencarian
            </button>

            <!-- Kartu Identitas Profil -->
            <div class="card-box bg-white p-5 rounded-2xl shadow-sm border border-slate-200">
                <div class="flex items-center justify-between pb-3 mb-3 border-b border-slate-200">
                    <div class="flex items-center gap-3">
                        <div class="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base">
                            ${safeGetInitials(nama)}
                        </div>
                        <div>
                            <h3 class="text-base font-bold text-slate-900">${nama}</h3>
                            <p class="text-xs text-slate-500">NISN: ${nisn} • Kelas: ${className}</p>
                        </div>
                    </div>
                    <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">Aktif Terpantau</span>
                </div>
            </div>

            <!-- BAGIAN 2 CHART (KEHADIRAN & PENGUMPULAN TUGAS) -->
            <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div class="card-box bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                    <h4 class="font-extrabold text-xs text-slate-700 mb-2">Chart Kehadiran (Hadir / Sakit / Izin / Alpa)</h4>
                    <div class="w-48 h-48 relative">
                        <canvas id="chartDetailAtt"></canvas>
                    </div>
                </div>

                <div class="card-box bg-white p-4 rounded-2xl shadow-sm border border-slate-200 flex flex-col items-center">
                    <h4 class="font-extrabold text-xs text-slate-700 mb-2">Chart Pengumpulan Tugas</h4>
                    <div class="w-48 h-48 relative">
                        <canvas id="chartDetailTask"></canvas>
                    </div>
                </div>
            </div>

            <!-- RINCIAN KETIDAKHADIRAN (HANYA KETERANGAN S/I/A) -->
            <div class="card-box bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <h4 class="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>📅</span> Rincian Keterangan Ketidakhadiran
                </h4>
                <div class="table-responsive-wrapper rounded-xl border border-slate-200">
                    <table class="w-full text-left border-collapse">
                        <thead>
                            <tr class="bg-slate-100 text-slate-600 text-xs border-b border-slate-200">
                                <th class="p-2.5 font-extrabold">Hari & Tanggal</th>
                                <th class="p-2.5 font-extrabold text-center">Status</th>
                                <th class="p-2.5 font-extrabold">Mata Pelajaran & Guru</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-200">
                            ${absenceRowsHtml}
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- DAFTAR TUGAS DAN LINK PENGUMPULANNYA -->
            <div class="card-box bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <h4 class="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>📋</span> Daftar Tugas & Link Pengumpulannya
                </h4>
                <div class="space-y-2">
                    ${taskDetailsHtml}
                </div>
            </div>
        </div>
    `;

    // Render Chart.js setelah elemen HTML terpasang
    renderStudentCharts(totalHadir, totalSakit, totalIzin, totalAlpa, doneCount, pendingCount);
}

// 3. FUNGSI RENDER CHART DENGAN CHART.JS
function renderStudentCharts(hadir, sakit, izin, alpa, done, pending) {
    if (typeof Chart === 'undefined') return;

    // Destroy chart lama jika ada
    if (studentChartInstances.att) studentChartInstances.att.destroy();
    if (studentChartInstances.task) studentChartInstances.task.destroy();

    // Chart Kehadiran
    const ctxAtt = document.getElementById('chartDetailAtt');
    if (ctxAtt) {
        studentChartInstances.att = new Chart(ctxAtt, {
            type: 'doughnut',
            data: {
                labels: ['Hadir', 'Sakit', 'Izin', 'Alpa'],
                datasets: [{
                    data: [hadir, sakit, izin, alpa],
                    backgroundColor: ['#10b981', '#f59e0b', '#0284c7', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                cutout: '60%'
            }
        });
    }

    // Chart Pengumpulan Tugas
    const ctxTask = document.getElementById('chartDetailTask');
    if (ctxTask) {
        studentChartInstances.task = new Chart(ctxTask, {
            type: 'doughnut',
            data: {
                labels: ['Sudah Dikumpulkan', 'Belum Dikumpulkan'],
                datasets: [{
                    data: [done, pending],
                    backgroundColor: ['#10b981', '#cbd5e1'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 10 } } } },
                cutout: '60%'
            }
        });
    }
}
