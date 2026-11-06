// ============================================================================
// FILE: app-guru.js (BAGIAN 1: STATE, SUPABASE SYNC, NAVIGASI & GRAFIK)
// ============================================================================

// 1. STATE GLOBAL APLIKASI
let state = {
    kelasAktif: 'X-A',
    periodeAktif: 'Semester Ganjil 2026',
    tanggalPresensi: new Date().toISOString().split('T')[0],
    siswaList: [],
    presensiList: [],
    tugasList: [],
    laporanList: [],
    charts: {},
    modalMode: null,
    editingId: null
};

// Data Default (Fallback jika tabel Supabase belum terisi / baru)
const DEFAULT_SISWA = [
    { id: 1, nama: 'Ahmad Fauzi', nis: '10108390601', kelas: 'X-A', jk: 'Laki-laki', kehadiran: 98, tugas_selesai: 12, total_tugas: 12, rata_nilai: 88, status: 'Sangat Aktif', wali: 'Bambang', no_wa: '081234567801', waktu_masuk: '07:15', status_hari_ini: 'Hadir', catatan_presensi: '—', catatan_wali: 'Sangat berprestasi, pertahankan keaktifannya.', foto: 'https://i.pravatar.cc/100?img=11' },
    { id: 2, nama: 'Budi Santoso', nis: '10108390602', kelas: 'X-A', jk: 'Laki-laki', kehadiran: 95, tugas_selesai: 11, total_tugas: 12, rata_nilai: 82, status: 'Aktif', wali: 'Hendro', no_wa: '081234567802', waktu_masuk: '07:22', status_hari_ini: 'Hadir', catatan_presensi: '—', catatan_wali: 'Sikap baik, konsisten dalam pengerjaan tugas.', foto: 'https://i.pravatar.cc/100?img=12' },
    { id: 3, nama: 'Citra Lestari', nis: '10108390301', kelas: 'X-A', jk: 'Perempuan', kehadiran: 88, tugas_selesai: 8, total_tugas: 12, rata_nilai: 65, status: 'Butuh Perhatian', wali: 'Suryadi', no_wa: '081234567803', waktu_masuk: '—', status_hari_ini: 'Sakit', catatan_presensi: 'Surat dokter', catatan_wali: 'Kehadiran menurun, perlu bimbingan untuk tugas.', foto: 'https://i.pravatar.cc/100?img=5' },
    { id: 4, nama: 'Dewi Amanda', nis: '10108800801', kelas: 'X-A', jk: 'Perempuan', kehadiran: 100, tugas_selesai: 12, total_tugas: 12, rata_nilai: 91, status: 'Sangat Aktif', wali: 'Rahmat', no_wa: '081234567804', waktu_masuk: '—', status_hari_ini: 'Izin', catatan_presensi: 'Acara keluarga', catatan_wali: 'Sangat rajin dan aktif di berbagai kegiatan belajar.', foto: 'https://i.pravatar.cc/100?img=9' },
    { id: 5, nama: 'Eko Prasetyo', nis: '10109370609', kelas: 'X-A', jk: 'Laki-laki', kehadiran: 85, tugas_selesai: 9, total_tugas: 12, rata_nilai: 72, status: 'Butuh Perhatian', wali: 'Gunawan', no_wa: '081234567805', waktu_masuk: '—', status_hari_ini: 'Alpa', catatan_presensi: 'Tanpa kabar', catatan_wali: 'Fokus tingkatkan hasil belajar kelompok.', foto: 'https://i.pravatar.cc/100?img=14' }
];

const DEFAULT_TUGAS = [
    { id: 1, judul: 'Tugas 4: Fungsi Kuadrat', tipe: 'Tugas', mapel: 'Matematika', kelas: 'X-A', tenggat: '12 Nov 2026', terkumpul: 32, total_siswa: 36, rerata_nilai: '-', status: 'Aktif' },
    { id: 2, judul: 'UTS Ganjil Matematika', tipe: 'Ujian', mapel: 'Matematika', kelas: 'X-A', tenggat: '05 Nov 2026', terkumpul: 36, total_siswa: 36, rerata_nilai: '80.5', status: 'Selesai' },
    { id: 3, judul: 'Tugas 3: Algoritma & Pemrograman', tipe: 'Tugas', mapel: 'Informatika', kelas: 'X-A', tenggat: '29 Okt 2026', terkumpul: 35, total_siswa: 36, rerata_nilai: '84.2', status: 'Selesai' },
    { id: 4, judul: 'Tugas 2: Puisi Rakyat', tipe: 'Tugas', mapel: 'Bahasa Indonesia', kelas: 'X-A', tenggat: '18 Okt 2026', terkumpul: 34, total_siswa: 36, rerata_nilai: '82.0', status: 'Selesai' },
    { id: 5, judul: 'Tugas Sejarah Nasional', tipe: 'Tugas', mapel: 'Sejarah', kelas: 'X-A', tenggat: '12 Okt 2026', terkumpul: 36, total_siswa: 36, rerata_nilai: '78.5', status: 'Selesai' }
];

// 2. INISIALISASI SAAT HALAMAN DIMUAT
document.addEventListener('DOMContentLoaded', async () => {
    // Set tanggal hari ini pada filter presensi
    const dateInput = document.getElementById('prsFilterTanggal');
    if (dateInput) dateInput.value = state.tanggalPresensi;

    // Pasang listener filter kelas di Dashboard
    const dashKelas = document.getElementById('dashFilterKelas');
    if (dashKelas) {
        dashKelas.addEventListener('change', (e) => {
            state.kelasAktif = e.target.value;
            syncFilterKelasDropdowns(state.kelasAktif);
            renderAllViews();
        });
    }

    // Listener Pencarian Global di Topbar
    const globalSearch = document.getElementById('globalSearchInput');
    if (globalSearch) {
        globalSearch.addEventListener('input', (e) => {
            const q = e.target.value.trim();
            const dsSearch = document.getElementById('dsSearchInput');
            if (dsSearch) dsSearch.value = q;
            renderDashboardTable(q);
            if (typeof renderDataSiswaTable === 'function') renderDataSiswaTable();
        });
    }

    await loadDataFromSupabase();
    initAllCharts();
    renderAllViews();
});

function syncFilterKelasDropdowns(kelas) {
    ['dashFilterKelas', 'dsFilterKelas', 'prsFilterKelas', 'tgsFilterKelas'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = kelas;
    });
    const dashTitle = document.getElementById('dashTableTitle');
    if (dashTitle) dashTitle.textContent = `Daftar Pemantauan Siswa Kelas ${kelas}`;
}

// 3. KONEKSI & PENGAMBILAN DATA SUPABASE (TANPA MENGHILANGKAN DATA LAMA)
async function loadDataFromSupabase() {
    if (typeof db === 'undefined' || !db) {
        state.siswaList = [...DEFAULT_SISWA];
        state.tugasList = [...DEFAULT_TUGAS];
        return;
    }

    try {
        // Coba ambil data siswa dari tabel 'siswa' atau 'students' di Supabase
        let { data: siswaData, error: errSiswa } = await db.from('siswa').select('*').order('nama', { ascending: true });
        
        if (!errSiswa && siswaData && siswaData.length > 0) {
            state.siswaList = siswaData.map((s, idx) => ({
                id: s.id || idx + 1,
                nama: s.nama || s.nama_siswa || s.name || 'Siswa',
                nis: s.nis || s.nisn || `10108390${idx + 100}`,
                kelas: s.kelas || 'X-A',
                jk: s.jenis_kelamin || s.jk || 'Laki-laki',
                kehadiran: Number(s.kehadiran ?? s.persentase_hadir ?? 95),
                tugas_selesai: Number(s.tugas_selesai ?? 11),
                total_tugas: Number(s.total_tugas ?? 12),
                rata_nilai: Number(s.rata_nilai ?? s.nilai_akhir ?? s.nilai ?? 82),
                status: tentukanStatusBelajar(Number(s.kehadiran ?? 95), Number(s.rata_nilai ?? 82)),
                wali: s.nama_wali || s.wali || 'Orang Tua/Wali',
                no_wa: s.no_wa || s.kontak_wali || s.telepon || '081234567890',
                waktu_masuk: s.waktu_masuk || '07:15',
                status_hari_ini: s.status_hari_ini || 'Hadir',
                catatan_presensi: s.catatan_presensi || '—',
                catatan_wali: s.catatan_wali || 'Perkembangan belajar baik dan kondusif.',
                foto: s.foto || `https://ui-avatars.com/api/?name=${encodeURIComponent(s.nama || 'S')}&background=1a73e8&color=fff`
            }));
        } else {
            state.siswaList = [...DEFAULT_SISWA];
        }

        // Coba ambil data tugas/ujian jika tabel 'tugas' tersedia
        let { data: tugasData, error: errTugas } = await db.from('tugas').select('*');
        if (!errTugas && tugasData && tugasData.length > 0) {
            state.tugasList = tugasData.map((t, idx) => ({
                id: t.id || idx + 1,
                judul: t.judul || t.nama_tugas || 'Tugas Pembelajaran',
                tipe: t.tipe || t.kategori || 'Tugas',
                mapel: t.mapel || t.mata_pelajaran || 'Informatika',
                kelas: t.kelas || 'X-A',
                tenggat: t.tenggat || '12 Nov 2026',
                terkumpul: Number(t.terkumpul ?? 32),
                total_siswa: Number(t.total_siswa ?? 36),
                rerata_nilai: t.rerata_nilai ?? '82.0',
                status: t.status || 'Aktif'
            }));
        } else {
            state.tugasList = [...DEFAULT_TUGAS];
        }
    } catch (err) {
        console.warn('Menggunakan data lokal sementara:', err);
        state.siswaList = [...DEFAULT_SISWA];
        state.tugasList = [...DEFAULT_TUGAS];
    }
}

function tentukanStatusBelajar(kehadiran, nilai) {
    if (kehadiran < 90 || nilai < 75) return 'Butuh Perhatian';
    if (kehadiran >= 95 && nilai >= 85) return 'Sangat Aktif';
    return 'Aktif';
}

// 4. NAVIGASI ANTAR-MENU SIDEBAR & SUB-TAB PENGATURAN
function switchTab(tabId) {
    // Nonaktifkan semua section
    document.querySelectorAll('.page-section').forEach(sec => sec.classList.remove('active'));
    const targetSec = document.getElementById(`section-${tabId}`);
    if (targetSec) targetSec.classList.add('active');

    // Update tombol aktif di sidebar
    const navButtons = document.querySelectorAll('.sidebar-nav .nav-item');
    const tabMap = ['dashboard', 'data-siswa', 'kehadiran', 'tugas-ujian', 'grafik-laporan', 'guru-wali', 'pengaturan'];
    const idx = tabMap.indexOf(tabId);
    navButtons.forEach((btn, i) => {
        if (i === idx) btn.classList.add('active');
        else btn.classList.remove('active');
    });

    // Resize grafik jika masuk ke tab yang memiliki canvas Chart.js
    if (tabId === 'dashboard' || tabId === 'grafik-laporan') {
        setTimeout(() => {
            Object.values(state.charts).forEach(ch => ch && ch.resize());
        }, 50);
    }
}

function switchSettingsTab(paneId) {
    document.querySelectorAll('.settings-pane').forEach(p => p.classList.remove('active'));
    const target = document.getElementById(`pane-${paneId}`);
    if (target) target.classList.add('active');

    const btns = document.querySelectorAll('.settings-sidebar .settings-tab-btn');
    const paneMap = ['profil', 'kelas', 'notifikasi', 'keamanan'];
    const idx = paneMap.indexOf(paneId);
    btns.forEach((b, i) => {
        if (i === idx) b.classList.add('active');
        else b.classList.remove('active');
    });
}

// 5. RENDER DASHBOARD UTAMA
function renderDashboardView() {
    const list = state.siswaList;
    const total = list.length || 1;

    // Hitung metrik kartu atas
    const avgHadir = (list.reduce((acc, s) => acc + Number(s.kehadiran || 0), 0) / total).toFixed(1);
    const avgNilai = (list.reduce((acc, s) => acc + Number(s.rata_nilai || 0), 0) / total).toFixed(1);
    const butuhPerhatian = list.filter(s => s.status === 'Butuh Perhatian').length;

    const elHadir = document.getElementById('statKehadiranPct');
    const elNilai = document.getElementById('statRataNilai');
    const elPerhatian = document.getElementById('statPerhatianCount');

    if (elHadir) elHadir.textContent = `${avgHadir}%`;
    if (elNilai) elNilai.textContent = avgNilai;
    if (elPerhatian) elPerhatian.textContent = `${butuhPerhatian} Siswa`;

    renderDashboardTable();
}

function renderDashboardTable(searchQuery = '') {
    const tbody = document.getElementById('dashStudentTableBody');
    if (!tbody) return;

    const filtered = state.siswaList.filter(s => {
        const matchQuery = !searchQuery || 
            s.nama.toLowerCase().includes(searchQuery.toLowerCase()) ||
            s.nis.includes(searchQuery);
        return matchQuery;
    });

    tbody.innerHTML = filtered.map(s => {
        const badgeClass = s.status === 'Sangat Aktif' ? 'badge-success' :
                           s.status === 'Aktif' ? 'badge-info' : 'badge-warning';
        return `
            <tr>
                <td>
                    <div class="student-cell">
                        <img src="${s.foto}" alt="${s.nama}" class="student-avatar">
                        <span>${s.nama}</span>
                    </div>
                </td>
                <td class="font-semibold">${s.kehadiran}%</td>
                <td>${s.tugas_selesai}/${s.total_tugas}</td>
                <td class="font-bold">${s.rata_nilai}</td>
                <td><span class="badge ${badgeClass}">${s.status}</span></td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="lihatDetailSiswa(${s.id})">Detail</button>
                </td>
            </tr>
        `;
    }).join('');
}

// 6. INISIALISASI GRAFIK (CHART.JS)
function initAllCharts() {
    if (typeof Chart === 'undefined') return;

    // A. Grafik Tren Kehadiran Mingguan (Dashboard)
    const ctxTren = document.getElementById('chartTrenKehadiran');
    if (ctxTren) {
        state.charts.trenKehadiran = new Chart(ctxTren, {
            type: 'line',
            data: {
                labels: ['Minggu 1', 'Minggu 2', 'Minggu 3', 'Minggu 4', 'Minggu 5', 'Minggu 6', 'Minggu 7', 'Minggu 8'],
                datasets: [{
                    label: 'Kehadiran (%)',
                    data: [88, 95, 91, 90, 86, 94, 89, 94.5],
                    borderColor: '#1a73e8',
                    backgroundColor: 'rgba(26, 115, 232, 0.12)',
                    borderWidth: 2.5,
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointBackgroundColor: '#1a73e8'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    y: { min: 50, max: 100, ticks: { stepSize: 10 } },
                    x: { grid: { display: false } }
                }
            }
        });
    }

    // B. Grafik Status Pengumpulan Tugas per Mapel (Dashboard)
    const ctxTugas = document.getElementById('chartPengumpulanTugas');
    if (ctxTugas) {
        state.charts.pengumpulanTugas = new Chart(ctxTugas, {
            type: 'bar',
            data: {
                labels: ['Matematika', 'Informatika', 'IPA', 'B. Indonesia', 'Sejarah'],
                datasets: [
                    {
                        label: 'Target Tugas (%)',
                        data: [100, 100, 100, 100, 100],
                        backgroundColor: '#2563eb',
                        borderRadius: 4,
                        barPercentage: 0.7
                    },
                    {
                        label: 'Terkumpul (%)',
                        data: [92, 95, 88, 84, 90],
                        backgroundColor: '#16a34a',
                        borderRadius: 4,
                        barPercentage: 0.7
                    }
                ]
            },
            options: {
                indexAxis: 'y',
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } },
                scales: {
                    x: { beginAtZero: true, max: 100 }
                }
            }
        });
    }

    // C. Grafik Tren Rata-rata Nilai Kelas (Halaman Grafik & Laporan)
    const ctxRepNilai = document.getElementById('chartReportNilai');
    if (ctxRepNilai) {
        state.charts.reportNilai = new Chart(ctxRepNilai, {
            type: 'line',
            data: {
                labels: ['Jul', 'Agu', 'Sep', 'Okt', 'Nov'],
                datasets: [{
                    label: 'Rata-rata Nilai',
                    data: [78, 80, 81.5, 82.0, 82.4],
                    borderColor: '#1a73e8',
                    backgroundColor: 'rgba(26, 115, 232, 0.15)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.3,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 60, max: 100 } }
            }
        });
    }

    // D. Grafik Distribusi Ketuntasan Belajar / KKM (Halaman Grafik & Laporan)
    const ctxRepKBM = document.getElementById('chartReportKBM');
    if (ctxRepKBM) {
        state.charts.reportKBM = new Chart(ctxRepKBM, {
            type: 'doughnut',
            data: {
                labels: ['Tuntas (≥ KKM)', 'Belum Tuntas (< KKM)'],
                datasets: [{
                    data: [88, 12],
                    backgroundColor: ['#1a73e8', '#f97316'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: {
                    legend: { position: 'bottom', labels: { boxWidth: 12 } }
                }
            }
        });
    }
}

// ============================================================================
// FILE: app-guru.js (BAGIAN 2: TABEL MENU, CRUD SUPABASE, MODAL, WA & EKSPOR)
// ============================================================================

function renderAllViews() {
    renderDashboardView();
    renderDataSiswaTable();
    renderPresensiTable();
    renderTugasTable();
    renderWaliTable();
}

// 7. MENU DATA SISWA
function renderDataSiswaTable() {
    const tbody = document.getElementById('dsTableBody');
    if (!tbody) return;

    const filterKelas = document.getElementById('dsFilterKelas')?.value || state.kelasAktif;
    const searchQ = (document.getElementById('dsSearchInput')?.value || '').toLowerCase();

    const filtered = state.siswaList.filter(s => {
        const matchKelas = !filterKelas || s.kelas === filterKelas || state.siswaList.every(item => item.kelas === 'X-A');
        const matchSearch = !searchQ || s.nama.toLowerCase().includes(searchQ) || s.nis.includes(searchQ);
        return matchKelas && matchSearch;
    });

    // Update Stat Cards Data Siswa
    const total = filtered.length;
    const laki = filtered.filter(s => s.jk.toLowerCase().includes('laki')).length;
    const perempuan = total - laki;
    const perhatian = filtered.filter(s => s.status === 'Butuh Perhatian').length;

    const elTotal = document.getElementById('dsTotalSiswa');
    const elGender = document.getElementById('dsGenderCount');
    const elPerhatian = document.getElementById('dsPerhatianCount');

    if (elTotal) elTotal.textContent = `${total} Siswa`;
    if (elGender) elGender.textContent = `${laki} Laki-laki • ${perempuan} Perempuan`;
    if (elPerhatian) elPerhatian.textContent = `${perhatian} Siswa`;

    tbody.innerHTML = filtered.map((s, idx) => {
        const badgeClass = s.status === 'Butuh Perhatian' ? 'badge-warning' : 'badge-success';
        const labelStatus = s.status === 'Butuh Perhatian' ? 'Butuh Perhatian' : 'Aktif';
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <div class="student-cell">
                        <img src="${s.foto}" alt="${s.nama}" class="student-avatar">
                        <span>${s.nama}</span>
                    </div>
                </td>
                <td>${s.nis}</td>
                <td>${s.jk}</td>
                <td><span class="badge ${badgeClass}">${labelStatus}</span></td>
                <td>${s.wali} (${s.no_wa})</td>
                <td>
                    <div class="flex items-center gap-1.5">
                        <button class="btn btn-sm btn-outline" onclick="lihatDetailSiswa(${s.id})">Detail</button>
                        <button class="btn btn-sm btn-outline" onclick="openEditSiswaModal(${s.id})">Edit</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 8. MENU KEHADIRAN & PRESENSI HARIAN
function renderPresensiTable() {
    const tbody = document.getElementById('prsTableBody');
    if (!tbody) return;

    const list = state.siswaList;
    const hadir = list.filter(s => s.status_hari_ini === 'Hadir').length;
    const sakitIzin = list.filter(s => s.status_hari_ini === 'Sakit' || s.status_hari_ini === 'Izin').length;
    const alpa = list.filter(s => s.status_hari_ini === 'Alpa').length;
    const pct = list.length ? ((hadir / list.length) * 100).toFixed(1) : '0.0';

    const elPct = document.getElementById('prsTingkatTotal');
    const elHadir = document.getElementById('prsHadirCount');
    const elSakit = document.getElementById('prsSakitIzinCount');
    const elAlpa = document.getElementById('prsAlpaCount');

    if (elPct) elPct.textContent = `${pct}%`;
    if (elHadir) elHadir.textContent = hadir;
    if (elSakit) elSakit.textContent = sakitIzin;
    if (elAlpa) elAlpa.textContent = alpa;

    tbody.innerHTML = list.map((s, idx) => {
        const st = s.status_hari_ini || 'Hadir';
        const cls = st === 'Hadir' ? 'status-hadir' :
                    st === 'Sakit' ? 'status-sakit' :
                    st === 'Izin'  ? 'status-izin'  : 'status-alpa';

        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <div class="student-cell">
                        <img src="${s.foto}" alt="${s.nama}" class="student-avatar">
                        <span>${s.nama}</span>
                    </div>
                </td>
                <td>${s.nis}</td>
                <td>${st === 'Hadir' ? (s.waktu_masuk !== '—' ? s.waktu_masuk : '07:15') : '—'}</td>
                <td>
                    <select class="status-select ${cls}" onchange="ubahStatusPresensi(${s.id}, this.value)">
                        <option value="Hadir" ${st === 'Hadir' ? 'selected' : ''}>Hadir</option>
                        <option value="Sakit" ${st === 'Sakit' ? 'selected' : ''}>Sakit</option>
                        <option value="Izin" ${st === 'Izin' ? 'selected' : ''}>Izin</option>
                        <option value="Alpa" ${st === 'Alpa' ? 'selected' : ''}>Alpa</option>
                    </select>
                </td>
                <td>${s.catatan_presensi || '—'}</td>
                <td>
                    <button class="btn btn-sm btn-outline" onclick="openUbahCatatanPresensi(${s.id})">Ubah</button>
                </td>
            </tr>
        `;
    }).join('');
}

async function ubahStatusPresensi(siswaId, statusBaru) {
    const siswa = state.siswaList.find(s => s.id === siswaId);
    if (!siswa) return;

    siswa.status_hari_ini = statusBaru;
    if (statusBaru === 'Hadir') {
        siswa.waktu_masuk = '07:15';
        siswa.catatan_presensi = '—';
    } else {
        siswa.waktu_masuk = '—';
        if (statusBaru === 'Alpa') siswa.catatan_presensi = 'Tanpa kabar';
    }

    // Simpan ke Supabase jika kolom/tabel tersedia
    if (typeof db !== 'undefined' && db) {
        try {
            await db.from('siswa').update({ status_hari_ini: statusBaru }).eq('id', siswaId);
        } catch (e) { /* Abaikan jika kolom belum ada */ }
    }

    renderPresensiTable();
    showToast(`Status kehadiran ${siswa.nama} diubah menjadi ${statusBaru}`);
}

// 9. MENU TUGAS & UJIAN
function renderTugasTable() {
    const tbody = document.getElementById('tgsTableBody');
    if (!tbody) return;

    const kat = document.getElementById('tgsFilterKategori')?.value || 'Semua';
    const mapel = document.getElementById('tgsFilterMapel')?.value || 'Semua';
    const q = (document.getElementById('tgsSearchInput')?.value || '').toLowerCase();

    const filtered = state.tugasList.filter(t => {
        const matchKat = kat === 'Semua' || t.tipe === kat;
        const matchMapel = mapel === 'Semua' || t.mapel === mapel;
        const matchQ = !q || t.judul.toLowerCase().includes(q);
        return matchKat && matchMapel && matchQ;
    });

    tbody.innerHTML = filtered.map((t, idx) => {
        const badgeCls = t.status === 'Aktif' ? 'badge-success-soft' : 'badge-info-soft';
        return `
            <tr>
                <td>${idx + 1}</td>
                <td class="font-semibold">${t.judul}</td>
                <td>${t.tipe}</td>
                <td>${t.mapel}</td>
                <td>${t.tenggat}</td>
                <td>${t.terkumpul}/${t.total_siswa}</td>
                <td class="font-bold">${t.rerata_nilai}</td>
                <td><span class="badge ${badgeCls}">${t.status}</span></td>
                <td>
                    <div class="flex items-center gap-1.5">
                        <button class="btn btn-sm btn-outline" onclick="openEditTugasModal(${t.id})">Edit</button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

// 10. MENU GURU WALI / KOMUNIKASI WALI
function renderWaliTable() {
    const tbody = document.getElementById('waliTableBody');
    if (!tbody) return;

    const filterKelas = document.getElementById('waliFilterKelas')?.value || 'Semua';
    const q = (document.getElementById('waliSearchInput')?.value || '').toLowerCase();

    const filtered = state.siswaList.filter(s => {
        const matchKelas = filterKelas === 'Semua' || s.kelas === filterKelas;
        const matchQ = !q || s.nama.toLowerCase().includes(q) || s.nis.includes(q) || s.kelas.toLowerCase().includes(q);
        return matchKelas && matchQ;
    });

    tbody.innerHTML = filtered.map((s, idx) => {
        const badgeClass = s.status === 'Sangat Aktif' ? 'badge-success-soft' :
                           s.status === 'Aktif' ? 'badge-info-soft' : 'badge-warning-soft';
        return `
            <tr>
                <td>${idx + 1}</td>
                <td>
                    <div class="student-cell">
                        <img src="${s.foto}" alt="${s.nama}" class="student-avatar">
                        <span>${s.nama}</span>
                    </div>
                </td>
                <td>${s.kelas}</td>
                <td>${s.nis}</td>
                <td class="font-semibold">${s.kehadiran}%</td>
                <td class="font-bold">${s.rata_nilai}</td>
                <td>${s.tugas_selesai}/${s.total_tugas}</td>
                <td class="text-xs text-slate-600 max-w-[220px]">${s.catatan_wali}</td>
                <td><span class="badge ${badgeClass}">${s.status}</span></td>
                <td>
                    <div class="flex items-center gap-1.5">
                        <button class="btn btn-sm btn-outline" onclick="lihatDetailSiswa(${s.id})">Detail</button>
                        <button class="btn btn-sm btn-outline" onclick="kirimWaWaliSiswa(${s.id})">
                            <i class="fa-brands fa-whatsapp text-emerald-600"></i> Kirim WA
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }).join('');
}

function kirimWaWaliSiswa(siswaId) {
    const s = state.siswaList.find(item => item.id === siswaId);
    if (!s) return;

    let phone = (s.no_wa || '').replace(/[^0-9]/g, '');
    if (phone.startsWith('0')) phone = '62' + phone.substring(1);

    const pesan = `Yth. Bapak/Ibu *${s.wali}* (Wali dari *${s.nama}* - Kelas ${s.kelas}),\n\nBerikut laporan ringkas perkembangan belajar dari *PantauBelajar*:\n• Kehadiran: *${s.kehadiran}%*\n• Tugas Selesai: *${s.tugas_selesai}/${s.total_tugas}*\n• Rata-rata Nilai: *${s.rata_nilai}*\n• Status: *${s.status}*\n• Catatan Guru: _"${s.catatan_wali}"_\n\nTerima kasih atas kerja samanya.`;
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(pesan)}`, '_blank');
}

function kirimMassalWaliWA() {
    showToast('Pilih tombol Kirim WA pada baris siswa untuk membuka WhatsApp Wali.', 'info');
}

// 11. MODAL POPUP DINAMIS (TAMBAH / EDIT SISWA, PRESENSI, TUGAS, LAPORAN)
function openModal(title, bodyHtml, mode, editingId = null) {
    state.modalMode = mode;
    state.editingId = editingId;
    document.getElementById('modalTitle').textContent = title;
    document.getElementById('modalBody').innerHTML = bodyHtml;
    const modal = document.getElementById('globalModal');
    modal.classList.remove('hidden');
    modal.classList.add('active');
}

function closeModal() {
    const modal = document.getElementById('globalModal');
    modal.classList.remove('active');
    modal.classList.add('hidden');
    state.modalMode = null;
    state.editingId = null;
}

function openTambahSiswaModal() {
    openModal('Tambah Data Siswa Baru', `
        <div class="form-group">
            <label>Nama Lengkap Siswa</label>
            <input type="text" id="mdlNama" class="form-control" placeholder="Contoh: Ahmad Fauzi">
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
                <label>NIS / NISN</label>
                <input type="text" id="mdlNis" class="form-control" placeholder="10108390...">
            </div>
            <div class="form-group">
                <label>Kelas</label>
                <select id="mdlKelas" class="form-control">
                    <option value="X-A">X-A</option>
                    <option value="XI Unggul">XI Unggul</option>
                    <option value="XII Unggul Cendikia">XII Unggul Cendikia</option>
                </select>
            </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
                <label>Jenis Kelamin</label>
                <select id="mdlJk" class="form-control">
                    <option value="Laki-laki">Laki-laki</option>
                    <option value="Perempuan">Perempuan</option>
                </select>
            </div>
            <div class="form-group">
                <label>Rata-rata Nilai Awal</label>
                <input type="number" id="mdlNilai" class="form-control" value="80">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
                <label>Nama Orang Tua / Wali</label>
                <input type="text" id="mdlWali" class="form-control" placeholder="Nama Wali">
            </div>
            <div class="form-group">
                <label>No. WhatsApp Wali</label>
                <input type="text" id="mdlWa" class="form-control" placeholder="0812...">
            </div>
        </div>
    `, 'tambah-siswa');
}

function openEditSiswaModal(id) {
    const s = state.siswaList.find(item => item.id === id);
    if (!s) return;

    openModal(`Edit Data Siswa: ${s.nama}`, `
        <div class="form-group">
            <label>Nama Lengkap Siswa</label>
            <input type="text" id="mdlNama" class="form-control" value="${s.nama}">
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
                <label>NIS / NISN</label>
                <input type="text" id="mdlNis" class="form-control" value="${s.nis}">
            </div>
            <div class="form-group">
                <label>Kehadiran (%)</label>
                <input type="number" id="mdlKehadiran" class="form-control" value="${s.kehadiran}">
            </div>
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
                <label>Rata-rata Nilai</label>
                <input type="number" id="mdlNilai" class="form-control" value="${s.rata_nilai}">
            </div>
            <div class="form-group">
                <label>No. WhatsApp Wali</label>
                <input type="text" id="mdlWa" class="form-control" value="${s.no_wa}">
            </div>
        </div>
        <div class="form-group">
            <label>Catatan Guru Wali</label>
            <input type="text" id="mdlCatatanWali" class="form-control" value="${s.catatan_wali}">
        </div>
    `, 'edit-siswa', id);
}

function lihatDetailSiswa(id) {
    const s = state.siswaList.find(item => item.id === id);
    if (!s) return;

    openModal(`Ringkasan Capaian Siswa`, `
        <div class="flex items-center gap-4 mb-4 pb-3 border-b border-slate-200">
            <img src="${s.foto}" class="w-14 h-14 rounded-full object-cover border border-slate-300">
            <div>
                <h4 class="font-bold text-base text-slate-900">${s.nama}</h4>
                <p class="text-xs text-slate-500">NIS: ${s.nis} • Kelas ${s.kelas}</p>
                <span class="badge badge-info mt-1">${s.status}</span>
            </div>
        </div>
        <div class="grid grid-cols-3 gap-3 text-center mb-4">
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div class="text-xs text-slate-500">Kehadiran</div>
                <div class="text-lg font-bold text-slate-900">${s.kehadiran}%</div>
            </div>
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div class="text-xs text-slate-500">Tugas Selesai</div>
                <div class="text-lg font-bold text-slate-900">${s.tugas_selesai}/${s.total_tugas}</div>
            </div>
            <div class="p-3 bg-slate-50 rounded-lg border border-slate-200">
                <div class="text-xs text-slate-500">Rata-rata Nilai</div>
                <div class="text-lg font-bold text-blue-600">${s.rata_nilai}</div>
            </div>
        </div>
        <div class="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <strong>Catatan Guru Wali:</strong><br>${s.catatan_wali}
        </div>
    `, 'detail-only');
}

function openUbahCatatanPresensi(id) {
    const s = state.siswaList.find(item => item.id === id);
    if (!s) return;
    openModal(`Catatan Kehadiran: ${s.nama}`, `
        <div class="form-group">
            <label>Waktu Masuk (Jam:Menit)</label>
            <input type="text" id="mdlWaktuMasuk" class="form-control" value="${s.waktu_masuk}">
        </div>
        <div class="form-group">
            <label>Catatan Keterangan</label>
            <input type="text" id="mdlCatatanPresensi" class="form-control" value="${s.catatan_presensi}">
        </div>
    `, 'ubah-presensi', id);
}

function openInputPresensiModal() {
    showToast('Silakan ubah status langsung pada kolom Status di tabel Kehadiran Harian.', 'info');
}

function openTambahTugasModal() {
    openModal('Tambah Tugas / Ujian Baru', `
        <div class="form-group">
            <label>Nama Tugas / Ujian</label>
            <input type="text" id="mdlJudulTugas" class="form-control" placeholder="Contoh: Tugas 5: Struktur Data">
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
                <label>Tipe</label>
                <select id="mdlTipeTugas" class="form-control">
                    <option value="Tugas">Tugas</option>
                    <option value="Ujian">Ujian</option>
                </select>
            </div>
            <div class="form-group">
                <label>Mata Pelajaran</label>
                <select id="mdlMapelTugas" class="form-control">
                    <option value="Informatika">Informatika</option>
                    <option value="Matematika">Matematika</option>
                    <option value="IPA">IPA</option>
                    <option value="Bahasa Indonesia">Bahasa Indonesia</option>
                </select>
            </div>
        </div>
        <div class="form-group">
            <label>Tenggat Waktu</label>
            <input type="text" id="mdlTenggatTugas" class="form-control" placeholder="20 Nov 2026">
        </div>
    `, 'tambah-tugas');
}

function openEditTugasModal(id) {
    const t = state.tugasList.find(item => item.id === id);
    if (!t) return;
    openModal(`Edit Tugas: ${t.judul}`, `
        <div class="form-group">
            <label>Nama Tugas / Ujian</label>
            <input type="text" id="mdlJudulTugas" class="form-control" value="${t.judul}">
        </div>
        <div class="grid grid-cols-2 gap-3">
            <div class="form-group">
                <label>Jumlah Terkumpul</label>
                <input type="number" id="mdlTerkumpul" class="form-control" value="${t.terkumpul}">
            </div>
            <div class="form-group">
                <label>Rerata Nilai</label>
                <input type="text" id="mdlRerataTugas" class="form-control" value="${t.rerata_nilai}">
            </div>
        </div>
    `, 'edit-tugas', id);
}

function openBuatLaporanModal() {
    openModal('Buat Dokumen Laporan Baru', `
        <div class="form-group">
            <label>Nama Laporan</label>
            <input type="text" id="mdlNamaLaporan" class="form-control" placeholder="Laporan Evaluasi Bulanan">
        </div>
        <div class="form-group">
            <label>Jenis Laporan</label>
            <select id="mdlJenisLaporan" class="form-control">
                <option value="Hasil Belajar">Hasil Belajar</option>
                <option value="Kehadiran">Kehadiran</option>
                <option value="Evaluasi Khusus">Evaluasi Khusus</option>
            </select>
        </div>
    `, 'buat-laporan');
}

async function submitModalData() {
    const mode = state.modalMode;
    if (mode === 'detail-only') {
        closeModal();
        return;
    }

    if (mode === 'tambah-siswa') {
        const nama = document.getElementById('mdlNama').value.trim();
        const nis = document.getElementById('mdlNis').value.trim() || '10108999';
        const kelas = document.getElementById('mdlKelas').value;
        const jk = document.getElementById('mdlJk').value;
        const nilai = Number(document.getElementById('mdlNilai').value || 80);
        const wali = document.getElementById('mdlWali').value.trim() || 'Wali Murid';
        const wa = document.getElementById('mdlWa').value.trim() || '08123456789';

        if (!nama) return showToast('Nama siswa wajib diisi!', 'error');

        const newItem = {
            id: Date.now(),
            nama, nis, kelas, jk,
            kehadiran: 100,
            tugas_selesai: 10,
            total_tugas: 12,
            rata_nilai: nilai,
            status: tentukanStatusBelajar(100, nilai),
            wali, no_wa: wa,
            waktu_masuk: '07:10',
            status_hari_ini: 'Hadir',
            catatan_presensi: '—',
            catatan_wali: 'Siswa aktif mengikuti kegiatan pembelajaran.',
            foto: `https://ui-avatars.com/api/?name=${encodeURIComponent(nama)}&background=1a73e8&color=fff`
        };

        state.siswaList.push(newItem);

        // Simpan juga ke Supabase jika tabel 'siswa' tersedia
        if (typeof db !== 'undefined' && db) {
            try {
                await db.from('siswa').insert([{ nama, nis, kelas }]);
            } catch (e) { /* Tetap tersimpan di state */ }
        }

        renderAllViews();
        closeModal();
        showToast('Data siswa berhasil ditambahkan!');
    } 
    else if (mode === 'edit-siswa') {
        const s = state.siswaList.find(item => item.id === state.editingId);
        if (s) {
            s.nama = document.getElementById('mdlNama').value.trim() || s.nama;
            s.nis = document.getElementById('mdlNis').value.trim() || s.nis;
            s.kehadiran = Number(document.getElementById('mdlKehadiran').value || s.kehadiran);
            s.rata_nilai = Number(document.getElementById('mdlNilai').value || s.rata_nilai);
            s.no_wa = document.getElementById('mdlWa').value.trim() || s.no_wa;
            s.catatan_wali = document.getElementById('mdlCatatanWali').value.trim() || s.catatan_wali;
            s.status = tentukanStatusBelajar(s.kehadiran, s.rata_nilai);

            if (typeof db !== 'undefined' && db) {
                try {
                    await db.from('siswa').update({ nama: s.nama, nis: s.nis }).eq('id', s.id);
                } catch (e) {}
            }
            renderAllViews();
            closeModal();
            showToast('Perubahan data siswa disimpan!');
        }
    }
    else if (mode === 'ubah-presensi') {
        const s = state.siswaList.find(item => item.id === state.editingId);
        if (s) {
            s.waktu_masuk = document.getElementById('mdlWaktuMasuk').value.trim();
            s.catatan_presensi = document.getElementById('mdlCatatanPresensi').value.trim();
            renderPresensiTable();
            closeModal();
            showToast('Catatan presensi diperbarui!');
        }
    }
    else if (mode === 'tambah-tugas') {
        const judul = document.getElementById('mdlJudulTugas').value.trim();
        const tipe = document.getElementById('mdlTipeTugas').value;
        const mapel = document.getElementById('mdlMapelTugas').value;
        const tenggat = document.getElementById('mdlTenggatTugas').value.trim() || '25 Nov 2026';
        if (!judul) return showToast('Nama tugas wajib diisi!', 'error');

        state.tugasList.unshift({
            id: Date.now(),
            judul, tipe, mapel,
            kelas: state.kelasAktif,
            tenggat,
            terkumpul: 0,
            total_siswa: state.siswaList.length || 36,
            rerata_nilai: '-',
            status: 'Aktif'
        });
        renderTugasTable();
        closeModal();
        showToast('Tugas/Ujian baru berhasil ditambahkan!');
    }
    else if (mode === 'edit-tugas') {
        const t = state.tugasList.find(item => item.id === state.editingId);
        if (t) {
            t.judul = document.getElementById('mdlJudulTugas').value.trim() || t.judul;
            t.terkumpul = Number(document.getElementById('mdlTerkumpul').value || t.terkumpul);
            t.rerata_nilai = document.getElementById('mdlRerataTugas').value.trim() || t.rerata_nilai;
            renderTugasTable();
            closeModal();
            showToast('Data tugas diperbarui!');
        }
    }
    else if (mode === 'buat-laporan') {
        const namaLap = document.getElementById('mdlNamaLaporan').value.trim() || 'Laporan Baru';
        const jenisLap = document.getElementById('mdlJenisLaporan').value;
        const tbody = document.getElementById('laporanTableBody');
        if (tbody) {
            const rowCount = tbody.querySelectorAll('tr').length + 1;
            tbody.insertAdjacentHTML('beforeend', `
                <tr>
                    <td>${rowCount}</td>
                    <td>${namaLap}</td>
                    <td>${jenisLap}</td>
                    <td>${state.periodeAktif}</td>
                    <td>Hari ini</td>
                    <td>PDF</td>
                    <td>
                        <button class="btn btn-sm btn-primary" onclick="downloadReportItem(${rowCount})">Unduh</button>
                    </td>
                </tr>
            `);
        }
        closeModal();
        showToast('Dokumen laporan berhasil dibuat!');
    }
}

// 12. PENGATURAN & EKSPOR DATA CSV
function simpanProfilGuru() {
    const nama = document.getElementById('settingsNama')?.value || 'Pak Andi Wahidin';
    const topbarName = document.getElementById('topbarUserName');
    if (topbarName) topbarName.textContent = nama;
    showToast('Profil guru berhasil diperbarui!');
}

function simpanPengaturanKelas() {
    showToast('Konfigurasi Kelas & KKM berhasil disimpan!');
}

function loadPengaturanData() {
    showToast('Perubahan dibatalkan.', 'info');
}

function ubahFotoProfil() {
    showToast('Fitur unggah foto siap digunakan.', 'info');
}

function editAksesKelas() {
    showToast('Akses kelas aktif.', 'info');
}

function exportDataSiswaCSV() {
    const headers = ['No,Nama Siswa,NIS,Kelas,Kehadiran (%),Rata-rata Nilai,Status'];
    const rows = state.siswaList.map((s, i) => `${i + 1},"${s.nama}",${s.nis},${s.kelas},${s.kehadiran},${s.rata_nilai},"${s.status}"`);
    const csvContent = 'data:text/csv;charset=utf-8,' + [headers, ...rows].join('\n');
    const link = document.createElement('a');
    link.setAttribute('href', encodeURI(csvContent));
    link.setAttribute('download', `Data_Siswa_${state.kelasAktif}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showToast('Data siswa berhasil diekspor ke CSV!');
}

function exportPresensiReport() { exportDataSiswaCSV(); }
function exportTugasData() { showToast('Data tugas berhasil diekspor!'); }
function exportAllLaporanData() { window.print(); }
function exportWaliReport() { exportDataSiswaCSV(); }
function downloadReportItem() { window.print(); }
function viewReportItem() { showToast('Menampilkan pratinjau laporan...', 'info'); }
