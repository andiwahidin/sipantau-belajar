// ============================================================================
// FILE: app-siswa.js (PORTAL CEK PROGRES SISWA TERHUBUNG SUPABASE)
// ============================================================================

async function cariProgresSiswa() {
    const query = (document.getElementById('inputCariSiswa')?.value || '').trim().toLowerCase();
    const container = document.getElementById('hasilSiswaContainer');
    if (!query) {
        showToast('Masukkan NISN atau Nama Siswa terlebih dahulu!', 'error');
        return;
    }

    container.classList.remove('hidden');
    container.innerHTML = `<div class="card-box text-center py-6 text-slate-500">Mencari data siswa...</div>`;

    let hasil = null;

    // 1. Cari di database Supabase terlebih dahulu (menggunakan tabel 'students')
    if (typeof db !== 'undefined' && db) {
        try {
            const { data, error } = await db.from('students').select('*');
            if (!error && data && data.length > 0) {
                hasil = data.find(s => 
                    (s.nama && s.nama.toLowerCase().includes(query)) ||
                    (s.nisn && String(s.nisn).toLowerCase().includes(query))
                );
            }
        } catch (err) {
            console.warn('Fallback pencarian lokal:', err);
        }
    }

    // 2. Fallback jika belum ditemukan di tabel
    if (!hasil) {
        const fallbackList = [
            { nama: 'Ahmad Fauzi', nisn: '10108390601', kelas: 'X-A', kehadiran: 98, tugas_selesai: 12, total_tugas: 12, rata_nilai: 88, status: 'Sangat Aktif', catatan_wali: 'Sangat berprestasi, pertahankan keaktifannya.' },
            { nama: 'Budi Santoso', nisn: '10108390602', kelas: 'X-A', kehadiran: 95, tugas_selesai: 11, total_tugas: 12, rata_nilai: 82, status: 'Aktif', catatan_wali: 'Sikap baik, konsisten dalam pengerjaan tugas.' },
            { nama: 'Citra Lestari', nisn: '10108390301', kelas: 'X-A', kehadiran: 88, tugas_selesai: 8, total_tugas: 12, rata_nilai: 65, status: 'Butuh Perhatian', catatan_wali: 'Kehadiran menurun, perlu bimbingan untuk tugas.' }
        ];
        hasil = fallbackList.find(s => s.nama.toLowerCase().includes(query) || String(s.nisn).includes(query));
    }

    if (!hasil) {
        container.innerHTML = `<div class="card-box text-center py-6 text-rose-600 font-medium">Data siswa dengan kata kunci "${query}" tidak ditemukan.</div>`;
        return;
    }

    const nama = hasil.nama || hasil.nama_siswa || 'Siswa';
    const nis = hasil.nisn || hasil.nis || '-';
    const kelas = hasil.kelas || 'X-A';
    const hadir = hasil.kehadiran ?? 95;
    const nilai = hasil.rata_nilai ?? hasil.nilai ?? 82;
    const tugas = `${hasil.tugas_selesai ?? 11}/${hasil.total_tugas ?? 12}`;
    const catatan = hasil.catatan_wali || 'Tetap semangat mengikuti pembelajaran.';

    container.innerHTML = `
        <div class="card-box bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
            <div class="flex items-center justify-between pb-4 mb-4 border-b border-slate-200">
                <div class="flex items-center gap-3">
                    <div class="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center font-bold text-base">
                        ${getInitials(nama)}
                    </div>
                    <div>
                        <h3 class="text-base font-bold text-slate-900">${nama}</h3>
                        <p class="text-xs text-slate-500">NISN: ${nis} • Kelas: ${kelas}</p>
                    </div>
                </div>
                <span class="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">Aktif Terpantau</span>
            </div>

            <div class="grid grid-cols-3 gap-4 mb-4 text-center">
                <div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span class="text-xs text-slate-500 block">Tingkat Kehadiran</span>
                    <span class="text-2xl font-extrabold text-emerald-600">${hadir}%</span>
                </div>
                <div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span class="text-xs text-slate-500 block">Pengumpulan Tugas</span>
                    <span class="text-2xl font-extrabold text-slate-900">${tugas}</span>
                </div>
                <div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
                    <span class="text-xs text-slate-500 block">Rata-rata Nilai</span>
                    <span class="text-2xl font-extrabold text-blue-600">${nilai}</span>
                </div>
            </div>

            <div class="p-3.5 bg-blue-50 border border-blue-200 rounded-lg text-xs text-slate-700">
                <strong>Catatan Guru Wali:</strong> ${catatan}
            </div>
        </div>
    `;
}
