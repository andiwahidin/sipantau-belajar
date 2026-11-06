// ============================================================================
// FILE: app-siswa.js (PORTAL SISWA - WARNA CHART PENGUMPULAN TUGAS: HIJAU & MERAH)
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
    const ddmmyyyy = `\${parts[2]}/${parts[1]}/${parts[0]}`;

    return { dayName, ddmmyyyy, full: dayName ? `${dayName},${ddmmyyyy}` : ddmmyyyy };
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
        container.innerHTML = `<div class="card-box bg-white p-6 rounded-2xl shadow-sm text-center py-6 text-rose-600 font-medium">Data siswa dengan kata kunci "\${query}" tidak ditemukan.</div>`;
        return;
    }

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
                        \${safeGetInitials(nama)}
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-900">\${nama}</h3>
                        <p class="text-xs text-slate-500">NISN: ${nisn} • Kelas: ${className}</p>
                    </div>
                </div>
                <button type="button" onclick="bukaDetailSiswa(\${stuId})" class="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-extrabold shadow-sm transition text-center shrink-0">
                    Lihat Detail & Laporan Lengkap →
                </button>
            </div>
        `;
    }

    container.innerHTML = `
        <div class="space-y-3">
            <p class="text-xs font-bold text-slate-600 mb-2">Ditemukan \${matchedStudents.
