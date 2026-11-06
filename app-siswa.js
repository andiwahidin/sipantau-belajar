// ============================================================================
// FILE: app-siswa.js (PORTAL CEK PROGRES SISWA - DENGAN DETAIL TUGAS & ABSENSI)
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

    return {
        dayName,
        ddmmyyyy,
        full: dayName ? `${dayName}, ${ddmmyyyy}` : ddmmyyyy
    };
}

async function cariProgresSiswa() {
    const query = (document.getElementById('inputCariSiswa')?.value || '').trim().toLowerCase();
    const container = document.getElementById('hasilSiswaContainer');
    if (!query) {
        showToast('Masukkan NISN atau Nama Siswa terlebih dahulu!', 'error');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = `<div class="card-box bg-white p-6 rounded-2xl shadow-sm text-center py-8 text-slate-500">Mencari data siswa dan rincian tugas...</div>`;

    const client = getDbClient();
    let hasil = null;

    try {
        const { data: students } = await client.from('students').select('*');
        if (students && students.length > 0) {
            hasil = students.find(s => 
                (s.nama && s.nama.toLowerCase().includes(query)) ||
                (s.nisn && String(s.nisn).toLowerCase().includes(query))
            );
        }
    } catch (err) {
        console.warn('Gagal memuat database siswa:', err);
    }

    if (!hasil) {
        container.innerHTML = `<div class="card-box bg-white p-6 rounded-2xl shadow-sm text-center py-6 text-rose-600 font-medium">Data siswa dengan kata kunci "${query}" tidak ditemukan.</div>`;
        return;
    }

    const stuId = hasil.id;
    const classId = hasil.class_id;
    const nama = hasil.nama || 'Siswa';
    const nisn = hasil.nisn || '-';

    // Ambil data pendukung: Kelas, Penilaian Publik, Skor Siswa, dan Log Absen
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

    // Hitung tugas selesai dan belum
    const pendingTasks = [];
    const completedTasks = [];

    publicAssessments.forEach(ass => {
        const rec = studentScores.find(sc => sc.assessment_id === ass.id);
        const isDone = rec && rec.status_kumpul;
        if (isDone) {
            completedTasks.push({ ass, rec });
        } else {
            pendingTasks.push({ ass, rec });
        }
    });

    // Hitung hari ketidakhadiran (S, I, A)
    const uniqueDaysSakit = new Set(attendanceLogs.filter(l => l.status === 'S').map(l => l.tanggal)).size;
    const uniqueDaysIzin = new Set(attendanceLogs.filter(l => l.status === 'I').map(l => l.tanggal)).size;
    const uniqueDaysAlpa = new Set(attendanceLogs.filter(l => l.status === 'A').map(l => l.tanggal)).size;
    const uniqueDaysHadir = new Set(attendanceLogs.filter(l => l.status === 'H').map(l => l.tanggal)).size;

    // Render HTML Rincian Tugas & Absensi
    let pendingTasksHtml = '';
    if (pendingTasks.length === 0) {
        pendingTasksHtml = `<div class="p-4 rounded-xl bg-emerald-50 text-emerald-800 text-xs text-center font-bold">🎉 Luar Biasa! Semua tugas publik sudah selesai dikumpulkan.</div>`;
    } else {
        pendingTasksHtml = pendingTasks.map(({ ass }) => {
            const namaGuru = teachersMap[ass.teacher_id] || 'Guru Mapel';
            const namaMapel = ass.mapel || 'Mata Pelajaran';
            return `
                <div class="p-3.5 rounded-xl bg-rose-50/60 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs">
                    <div>
                        <span class="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-rose-100 text-rose-800">${namaMapel}</span>
                        <h4 class="font-bold text-slate-900 mt-1">${ass.judul}</h4>
                        <p class="text-slate-500 text-[11px]">Guru: ${namaGuru}</p>
                    </div>
                    ${ass.link_pengumpulan ? `
                        <a href="${ass.link_pengumpulan}" target="_blank" class="px-3 py-2 rounded-lg bg-white border border-slate-300 text-slate-700 font-bold hover:bg-slate-50 text-center shrink-0">
                            📤 Buka Link Pengumpulan ↗
                        </a>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    // Render Log Absensi per Hari
    const absenceLogs = attendanceLogs.filter(l => l.status === 'S' || l.status === 'I' || l.status === 'A');
    const groupedByDateMap = new Map();
    absenceLogs.forEach(log => {
        if (!groupedByDateMap.has(log.tanggal)) groupedByDateMap.set(log.tanggal, []);
        groupedByDateMap.get(log.tanggal).push(log);
    });

    let absenceRowsHtml = '';
    if (groupedByDateMap.size === 0) {
        absenceRowsHtml = `<tr><td colspan="3" class="p-4 text-center text-emerald-700 bg-emerald-50/30 text-xs font-semibold">✨ Tidak ada catatan ketidakhadiran (Sakit / Izin / Alpa).</td></tr>`;
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
                return `<div class="py-1 border-b last:border-b-0 border-slate-100 text-[11px]"><b>${item.mapel || 'Mapel'}</b> (${namaGuru})</div>`;
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
            <!-- Kartu Identitas -->
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

                <!-- Ringkasan Statistik -->
                <div class="grid grid-cols-4 gap-3 text-center text-xs">
                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span class="text-slate-500 block">Tugas Belum</span>
                        <span class="text-lg font-extrabold text-rose-600">${pendingTasks.length}</span>
                    </div>
                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span class="text-slate-500 block">Sakit (Hari)</span>
                        <span class="text-lg font-extrabold text-amber-500">${uniqueDaysSakit}</span>
                    </div>
                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span class="text-slate-500 block">Izin (Hari)</span>
                        <span class="text-lg font-extrabold text-sky-600">${uniqueDaysIzin}</span>
                    </div>
                    <div class="p-3 bg-slate-50 rounded-xl border border-slate-200">
                        <span class="text-slate-500 block">Alpa (Hari)</span>
                        <span class="text-lg font-extrabold text-rose-600">${uniqueDaysAlpa}</span>
                    </div>
                </div>
            </div>

            <!-- Daftar Tugas Belum Selesai & Link Pengumpulan -->
            <div class="card-box bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <h4 class="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>🚨</span> Daftar Tugas & Link Pengumpulan
                </h4>
                <div class="space-y-2.5">
                    ${pendingTasksHtml}
                </div>
            </div>

            <!-- Rincian Hari Ketidakhadiran -->
            <div class="card-box bg-white p-5 rounded-2xl shadow-sm border border-slate-200 space-y-3">
                <h4 class="font-extrabold text-sm text-slate-900 flex items-center gap-2">
                    <span>📅</span> Rincian Ketidakhadiran (S / I / A)
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
        </div>
    `;
}
