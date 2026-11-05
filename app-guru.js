
Gemini

New chat
Library
Images
Scheduled
Students

More
New notebook
Kurikulum Pembelajaran Informatika Fase F
🌐 Perangkat Pembelajaran Informatika
Untitled notebook
Website SiPantau
Buatkan game edukatif berbasis web di google script (gratis) dengan tema materi pelajaran Informatik
Tutorial Pembuatan Website SiPantau
Target Skor
Jadwal
Penyelesaian Soal Geometri Sudut
Apakah login admin untuk kode ini?
@pembuat-virtual-lab
Perbaikan Kode Bahasa C
Bahan Bacaan Karakter dan String Kelas XI
Perbaikan Program Cetak Array
Panduan Menggunakan Vektor C++
Pembuatan Modul Belajar Pemrograman C++
Durasi Penurunan Lemak dengan Olahraga
Pembuatan Solusi PDF Percabangan Siswa
Cara Memperbaiki Error Tanda Kutip
Penyelesaian Masalah Angka 25
Pembuatan Bahan Bacaan Pemrograman Dinamis
Panduan Login Router Orbit HKM281
Cara Login Router Orbit HKM281
Penyelesaian Aktivitas Latihan Ekspresi
Solusi Latihan Ekspresi Logika
Untitled
Bantuan Materi dan Tugas Siswa
Kontrol Lampu dengan Tepukan Tangan
Correcting Farming Practice Grammar
Empty Conversation
Grammatical Analysis of Fabric Sentence
Menggabungkan Piagam dan Latar Belakang
Mengubah Ukuran Piagam
Conversation with Gemini
Revisi:

-Buat agar guru bisa mengedit jenis nama & jenis tugas yang telah diberikan (Individu/Kelompok)

-Buat agar guru bisa membuat daftar kelompok siswa sehingga penilainnya dapat digunakan untuk beberapa tugas kelompok

Berikut adalah pembaruan kode untuk index.html dan app-guru.js pada proyek SiPantau Belajar guna menambahkan fitur Edit Detail Tugas (Nama, Kategori, & Jenis Individu/Kelompok) serta Manajemen Daftar Kelompok Siswa (Master/Preset Kelompok) yang dapat digunakan berulang kali di berbagai tugas kelompok.   
andiwahidin/sipantau-belajar

Ringkasan Perubahan Fitur
Edit Nama, Kategori, & Jenis Tugas (Individu/Kelompok):

Panel #ass-link-editor pada index.html diperluas menjadi Panel Edit Detail Tugas yang memuat input Judul Tugas (#edit-ass-judul), Kategori (#edit-ass-kategori: Tugas / Ujian Bab / UAS), Tipe Kerja (#edit-ass-tipe: Individu / Kelompok), serta Link Pengumpulan (#edit-ass-link).   
andiwahidin/sipantau-belajar

Saat guru mengubah jenis tugas dari Individu 
→ Kelompok (atau sebaliknya) dan menekan Simpan Perubahan, sistem memperbarui tabel assessments di Supabase, mempertahankan tugas yang sedang dipilih di dropdown, dan langsung menyesuaikan tampilan kolom Kelompok pada tabel nilai.   
andiwahidin/sipantau-belajar

Manajemen Daftar Kelompok Siswa (Reusable untuk Banyak Tugas Kelompok):

Multi-Preset & Sinkronisasi Otomatis: Guru dapat membuat satu atau beberapa daftar kelompok per kelas (misalnya: Kelompok Default, Kelompok Praktikum, Kelompok Diskusi).

Generator Kelompok Otomatis: Tersedia fitur bagi kelompok otomatis secara Acak (Random) maupun Urut Abjad cukup dengan memasukkan jumlah kelompok yang diinginkan.

Impor dari Tugas Sebelumnya & Simpan dari Tabel: Guru dapat mengambil susunan kelompok dari tugas kelompok yang sudah pernah dinilai di Supabase (scores), atau menyimpan susunan kelompok yang baru diketik di tabel nilai menjadi preset tetap.   
andiwahidin/sipantau-belajar

Auto-Fill Tugas Kelompok Baru: Saat membuka tugas kelompok yang belum memiliki data kelompok siswa, sistem dapat langsung menerapkan daftar kelompok default secara otomatis dan menyinkronkan nilai antar-anggota kelompok.   
andiwahidin/sipantau-belajar

1. Opsional: Query SQL Supabase (Sinkronisasi Antar-Perangkat)
Sistem daftar kelompok di bawah sudah dirancang langsung berjalan tanpa wajib mengubah database (menggunakan kombinasi riwayat tabel scores Supabase + penyimpanan lokal). Namun, agar preset Daftar Kelompok tersinkronisasi penuh di tabel teacher_settings Supabase saat login di perangkat berbeda, Anda dapat menjalankan 1 baris perintah berikut di SQL Editor Supabase:   
andiwahidin/sipantau-belajar

SQL
ALTER TABLE teacher_settings 
ADD COLUMN IF NOT EXISTS kelompok_template JSONB DEFAULT '{}'::jsonb;
2. Pembaruan pada index.html
Buka file index.html, cari bagian #ass-link-editor dan #group-mode-banner di dalam tab Tugas & Nilai (#gcontent-nilai), lalu ganti keduanya dengan struktur HTML berikut (serta tambahkan modal #modal-group-manager di bagian bawah halaman sebelum tag </body>):   
andiwahidin/sipantau-belajar

HTML
<!-- 1. GANTI BAGIAN #ass-link-editor DI DALAM #gcontent-nilai DENGAN KODE INI -->
<div id="ass-link-editor" style="display:none; background:#f8fafc; border:1px solid #cbd5e1; padding:14px; border-radius:10px; margin-bottom:15px;">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:8px; margin-bottom:10px;">
        <span style="font-size:13px; font-weight:700; color:#1e293b;">
            ⚙️ Edit Pengaturan & Jenis Tugas Terpilih
        </span>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
            <button id="btn-toggle-public" class="btn-secondary btn-sm" onclick="toggleAssessmentPublicVisibility()" style="font-size:12px;">
                👁️ Publik
            </button>
            <button class="btn-secondary btn-sm" onclick="openGroupManagerModal()" style="font-size:12px; background:#eff6ff; color:#1d4ed8; border-color:#bfdbfe;">
                👥 Kelola Daftar Kelompok Kelas
            </button>
        </div>
    </div>

    <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:10px; margin-bottom:10px;">
        <div>
            <label style="font-size:11px; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Nama / Judul Penilaian</label>
            <input type="text" id="edit-ass-judul" placeholder="Nama Tugas / Ujian" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
        </div>
        <div>
            <label style="font-size:11px; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Kategori Penilaian</label>
            <select id="edit-ass-kategori" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
                <option value="tugas">Tugas Harian / Proyek</option>
                <option value="bab">Ujian Akhir Bab (Formatif)</option>
                <option value="uas">Ujian Semester (Sumatif)</option>
            </select>
        </div>
        <div>
            <label style="font-size:11px; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Jenis / Tipe Kerja</label>
            <select id="edit-ass-tipe" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
                <option value="individu">👤 Individu</option>
                <option value="kelompok">👥 Kelompok</option>
            </select>
        </div>
    </div>

    <div style="display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
        <div style="flex:1; min-width:220px;">
            <label style="font-size:11px; font-weight:600; color:#475569; display:block; margin-bottom:4px;">Link Folder / Form Pengumpulan (Opsional)</label>
            <input type="url" id="edit-ass-link" placeholder="https://drive.google.com/..." style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
        </div>
        <div style="display:flex; gap:6px; align-self:flex-end;">
            <button class="btn-primary btn-sm" onclick="updateAssessmentLink()" style="padding:8px 14px;">
                💾 Simpan Perubahan Tugas
            </button>
            <a id="btn-test-ass-link" href="#" target="_blank" class="btn-secondary btn-sm" style="display:none; text-decoration:none; padding:8px 12px;">
                🔗 Cek Link
            </a>
        </div>
    </div>
</div>

<!-- 2. GANTI BAGIAN #group-mode-banner DI DALAM #gcontent-nilai DENGAN KODE INI -->
<div id="group-mode-banner" style="display:none; background:#eff6ff; border:1px solid #93c5fd; color:#1e3a8a; padding:12px 14px; border-radius:10px; margin-bottom:14px; font-size:13px;">
    <div style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
        <div>
            <strong>👥 Mode Tugas Kelompok Aktif:</strong>
            <span>Mengisi nilai/status pada satu anggota akan otomatis menyamakan nilai seluruh anggota di kelompok yang sama.</span>
        </div>
        <div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">
            <select id="select-group-preset" style="padding:6px 10px; border:1px solid #93c5fd; border-radius:6px; font-size:12px; background:#fff; color:#1e293b;">
                <option value="">-- Pilih Daftar Kelompok --</option>
            </select>
            <button class="btn-primary btn-sm" onclick="applySelectedGroupPreset()" style="font-size:12px; padding:6px 10px;">
                ⚡ Terapkan ke Tabel
            </button>
            <button class="btn-secondary btn-sm" onclick="saveCurrentTableAsGroupPreset()" style="font-size:12px; padding:6px 10px; background:#fff;">
                📥 Simpan Susunan Tabel Ini
            </button>
            <button class="btn-secondary btn-sm" onclick="openGroupManagerModal()" style="font-size:12px; padding:6px 10px; background:#1e40af; color:#fff; border:none;">
                🛠️ Atur / Buat Kelompok
            </button>
        </div>
    </div>
</div>
Selanjutnya, tambahkan Modal Manajemen Daftar Kelompok Siswa berikut di bagian paling bawah index.html (tepat sebelum <script src="app-guru.js"></script>):   
andiwahidin/sipantau-belajar

HTML
<!-- 3. TAMBAHKAN MODAL KELOLA DAFTAR KELOMPOK SISWA SEBELUM SCRIPT APP-GURU.JS -->
<div id="modal-group-manager" style="display:none; position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:9999; align-items:center; justify-content:center; padding:16px;">
    <div style="background:#fff; width:100%; max-width:780px; max-height:90vh; border-radius:14px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.2); display:flex; flex-direction:column; overflow:hidden;">
        <!-- Header Modal -->
        <div style="padding:16px 20px; background:#1e293b; color:#fff; display:flex; justify-content:space-between; align-items:center;">
            <div>
                <h3 style="margin:0; font-size:16px;">👥 Manajemen Daftar Kelompok Siswa</h3>
                <p style="margin:3px 0 0; font-size:12px; color:#cbd5e1;">Daftar kelompok ini dapat digunakan berulang kali untuk berbagai tugas kelompok.</p>
            </div>
            <button onclick="closeGroupManagerModal()" style="background:transparent; border:none; color:#fff; font-size:20px; cursor:pointer;">&times;</button>
        </div>

        <!-- Body Modal -->
        <div style="padding:16px 20px; overflow-y:auto; flex:1;">
            <!-- Baris Pilih / Buat Preset Daftar Kelompok -->
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:flex-end; background:#f8fafc; padding:12px; border:1px solid #e2e8f0; border-radius:10px; margin-bottom:14px;">
                <div style="flex:1; min-width:180px;">
                    <label style="font-size:11px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Pilih Daftar Kelompok Tersimpan</label>
                    <select id="gm-preset-select" onchange="loadPresetIntoModal()" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;"></select>
                </div>
                <div style="flex:1; min-width:180px;">
                    <label style="font-size:11px; font-weight:700; color:#475569; display:block; margin-bottom:4px;">Nama Daftar Kelompok (Buat/Ubah)</label>
                    <input type="text" id="gm-preset-name" placeholder="Misal: Kelompok Praktikum / Default" style="width:100%; padding:8px; border:1px solid #cbd5e1; border-radius:6px; font-size:13px;">
                </div>
                <button class="btn-secondary btn-sm" onclick="createNewGroupPreset()" style="padding:8px 12px;">➕ Baru</button>
                <button class="btn-danger btn-sm" onclick="deleteCurrentGroupPreset()" style="padding:8px 12px;">🗑️ Hapus Daftar</button>
            </div>

            <!-- Baris Generator Kelompok Otomatis -->
            <div style="display:flex; gap:8px; flex-wrap:wrap; align-items:center; justify-content:space-between; background:#eff6ff; padding:10px 12px; border:1px solid #bfdbfe; border-radius:8px; margin-bottom:14px;">
                <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
                    <span style="font-size:12px; font-weight:700; color:#1e3a8a;">🎲 Bagi Kelompok Otomatis:</span>
                    <input type="number" id="gm-auto-count" min="2" max="30" value="5" style="width:65px; padding:6px; border:1px solid #93c5fd; border-radius:6px; font-size:12px; text-align:center;">
                    <span style="font-size:12px; color:#1e3a8a;">Kelompok</span>
                </div>
                <div style="display:flex; gap:6px; flex-wrap:wrap;">
                    <button class="btn-primary btn-sm" onclick="autoGenerateGroups('random')" style="font-size:12px; padding:6px 10px;">🔀 Bagi Acak</button>
                    <button class="btn-secondary btn-sm" onclick="autoGenerateGroups('urut')" style="font-size:12px; padding:6px 10px; background:#fff;">📋 Bagi Urut Absen</button>
                    <button class="btn-secondary btn-sm" onclick="clearAllModalGroups()" style="font-size:12px; padding:6px 10px; background:#fff; color:#dc2626;">🧹 Reset</button>
                </div>
            </div>

            <!-- Ringkasan Jumlah Anggota per Kelompok -->
            <div id="gm-summary-badges" style="display:flex; gap:6px; flex-wrap:wrap; margin-bottom:12px;"></div>

            <!-- Tabel Penetapan Kelompok Siswa -->
            <div class="table-responsive" style="max-height:360px; overflow-y:auto; border:1px solid #e2e8f0; border-radius:8px;">
                <table class="data-table" style="width:100%; border-collapse:collapse;">
                    <thead style="position:sticky; top:0; background:#f1f5f9; z-index:2;">
                        <tr>
                            <th style="width:45px; padding:8px; text-align:center;">No</th>
                            <th style="width:120px; padding:8px;">NISN</th>
                            <th style="padding:8px;">Nama Siswa</th>
                            <th style="width:220px; padding:8px;">Nama Kelompok</th>
                        </tr>
                    </thead>
                    <tbody id="gm-students-tbody"></tbody>
                </table>
            </div>
        </div>

        <!-- Footer Modal -->
        <div style="padding:14px 20px; background:#f8fafc; border-top:1px solid #e2e8f0; display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:10px;">
            <button class="btn-secondary" onclick="closeGroupManagerModal()">Tutup</button>
            <div style="display:flex; gap:8px; flex-wrap:wrap;">
                <button class="btn-primary" onclick="saveGroupPresetFromModal(false)">💾 Simpan Daftar Kelompok</button>
                <button class="btn-primary" onclick="saveGroupPresetFromModal(true)" style="background:#059669; border-color:#059669;">
                    ⚡ Simpan & Terapkan ke Tugas Aktif
                </button>
            </div>
        </div>
    </div>
</div>
3. Pembaruan pada app-guru.js
Buka file app-guru.js, lalu ganti fungsi loadAssessmentsDropdown, updateAssessmentLink, loadAssessmentScores, dan syncGroupRow yang lama dengan blok kode lengkap di bawah ini (kode ini juga menambahkan seluruh fungsi manajemen daftar kelompok siswa):   
andiwahidin/sipantau-belajar

JavaScript
// ============================================================================
// REVISI: EDIT DETAIL TUGAS (JUDUL, KATEGORI, INDIVIDU/KELOMPOK) 
// & MANAJEMEN DAFTAR KELOMPOK SISWA MULTI-TUGAS
// ============================================================================

// Variabel penyimpan daftar preset kelompok untuk kelas aktif
// Format: { "Kelompok Default": { "student_id_1": "Kelompok 1", ... }, "Kelompok Praktikum": { ... } }
let classGroupPresets = {};
let activePresetKey = "Kelompok Default";

/**
 * Kunci localStorage spesifik per guru, kelas, dan mapel sebagai cadangan otomatis
 */
function getGroupStorageKey() {
    const classId = document.getElementById('guru-active-class')?.value || 'none';
    const mapel = currentSettings?.mapel || 'umum';
    const teacherId = currentUser?.id || 'anon';
    return `sipantau_groups_${teacherId}_${classId}_${mapel}`;
}

/**
 * Memuat daftar preset kelompok dari Supabase (teacher_settings.kelompok_template),
 * localStorage, serta otomatis memindai riwayat tugas kelompok dari tabel scores.
 */
async function loadClassGroupPresets() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId || !currentUser) return {};

    let presets = {};

    // 1. Cek dari localStorage terlebih dahulu
    try {
        const localRaw = localStorage.getItem(getGroupStorageKey());
        if (localRaw) {
            const parsed = JSON.parse(localRaw);
            if (parsed && typeof parsed === 'object') presets = { ...parsed };
        }
    } catch (e) {
        console.warn('Gagal memuat preset kelompok dari localStorage:', e);
    }

    // 2. Cek dari currentSettings.kelompok_template di Supabase (jika kolom tersedia)
    if (currentSettings && currentSettings.kelompok_template && typeof currentSettings.kelompok_template === 'object') {
        presets = { ...presets, ...currentSettings.kelompok_template };
    }

    // 3. Tarik juga riwayat susunan kelompok dari tugas-tugas kelompok yang sudah pernah dinilai di tabel scores
    try {
        const groupAssessments = (currentAssessments || []).filter(a => a.tipe_kerja === 'kelompok');
        if (groupAssessments.length > 0) {
            const assIds = groupAssessments.map(a => a.id);
            const { data: pastScores } = await db
                .from('scores')
                .select('assessment_id, student_id, nama_kelompok')
                .in('assessment_id', assIds);

            if (pastScores && pastScores.length > 0) {
                groupAssessments.forEach(ass => {
                    const rows = pastScores.filter(s => s.assessment_id === ass.id && s.nama_kelompok && s.nama_kelompok.trim() !== '');
                    if (rows.length > 0) {
                        const mapObj = {};
                        rows.forEach(r => { mapObj[r.student_id] = r.nama_kelompok.trim(); });
                        // Jika belum ada "Kelompok Default", jadikan tugas kelompok terbaru sebagai default
                        if (!presets['Kelompok Default']) {
                            presets['Kelompok Default'] = { ...mapObj };
                        }
                        presets[`[Riwayat] ${ass.judul}`] = mapObj;
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Gagal memindai riwayat kelompok dari scores:', e);
    }

    if (Object.keys(presets).length === 0) {
        presets['Kelompok Default'] = {};
    }

    classGroupPresets = presets;
    if (!classGroupPresets[activePresetKey]) {
        activePresetKey = Object.keys(classGroupPresets)[0] || 'Kelompok Default';
    }

    refreshGroupPresetDropdown();
    return classGroupPresets;
}

/**
 * Menyimpan preset kelompok ke localStorage dan Supabase (teacher_settings.kelompok_template)
 */
async function persistClassGroupPresets() {
    // Filter agar preset [Riwayat] otomatis tidak ikut membebani penyimpanan utama kecuali disimpan ulang
    const cleanPresets = {};
    Object.keys(classGroupPresets).forEach(k => {
        if (!k.startsWith('[Riwayat] ')) {
            cleanPresets[k] = classGroupPresets[k];
        }
    });

    try {
        localStorage.setItem(getGroupStorageKey(), JSON.stringify(cleanPresets));
    } catch (e) {
        console.warn('Gagal menyimpan ke localStorage:', e);
    }

    // Coba simpan ke Supabase teacher_settings jika baris pengaturan guru sudah ada
    if (currentSettings && currentSettings.id) {
        try {
            const { error } = await db
                .from('teacher_settings')
                .update({ kelompok_template: cleanPresets })
                .eq('id', currentSettings.id);
            if (!error) {
                currentSettings.kelompok_template = cleanPresets;
            }
        } catch (e) {
            // Abaikan jika kolom kelompok_template belum ditambahkan di SQL Supabase
        }
    }

    refreshGroupPresetDropdown();
}

/**
 * Memperbarui isi dropdown pilihan daftar kelompok pada banner Tugas & Nilai
 */
function refreshGroupPresetDropdown() {
    const sel = document.getElementById('select-group-preset');
    if (!sel) return;

    const keys = Object.keys(classGroupPresets);
    sel.innerHTML = `<option value="">-- Pilih Daftar Kelompok --</option>`;
    keys.forEach(k => {
        const countAssigned = Object.values(classGroupPresets[k] || {}).filter(v => v && v.trim() !== '').length;
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `${k} (${countAssigned} siswa)`;
        if (k === activePresetKey) opt.selected = true;
        sel.appendChild(opt);
    });
}

/**
 * Memuat daftar penilaian pada dropdown #active-assessment
 * Mendukung preserveAssId agar pilihan tugas tidak ter-reset setelah diedit
 */
async function loadAssessmentsDropdown(preserveAssId = null) {
    const classId = document.getElementById('guru-active-class')?.value;
    const select = document.getElementById('active-assessment');
    if (!select) return;

    const previousVal = preserveAssId || select.value;
    select.innerHTML = '<option value="">-- Pilih Penilaian --</option>';

    if (!classId || !currentUser) return;

    const activeMapel = currentSettings?.mapel || '';
    let query = db
        .from('assessments')
        .select('*')
        .eq('class_id', classId)
        .eq('teacher_id', currentUser.id)
        .order('id', { ascending: true });

    if (activeMapel) {
        query = query.eq('mapel', activeMapel);
    }

    const { data, error } = await query;
    if (error) {
        console.error('Gagal memuat daftar penilaian:', error);
        return;
    }

    currentAssessments = data || [];

    const katLabel = {
        tugas: 'Tugas',
        bab: 'Ujian Bab',
        uas: 'UAS'
    };

    currentAssessments.forEach(a => {
        const tipeBadge = a.tipe_kerja === 'kelompok' ? '👥 Kelompok' : '👤 Individu';
        const visBadge = a.tampil_publik === false ? ' [🔒 Disembunyikan]' : '';
        const opt = document.createElement('option');
        opt.value = a.id;
        opt.textContent = `[${katLabel[a.kategori] || a.kategori}] ${a.judul} (${tipeBadge})${visBadge}`;
        select.appendChild(opt);
    });

    // Muat daftar preset kelompok kelas
    await loadClassGroupPresets();

    if (previousVal && currentAssessments.some(a => String(a.id) === String(previousVal))) {
        select.value = previousVal;
        await loadAssessmentScores();
    } else {
        const linkEditor = document.getElementById('ass-link-editor');
        const groupBanner = document.getElementById('group-mode-banner');
        const tbody = document.getElementById('scores-tbody');
        if (linkEditor) linkEditor.style.display = 'none';
        if (groupBanner) groupBanner.style.display = 'none';
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Silakan pilih atau buat penilaian terlebih dahulu.</td></tr>';
        }
    }
}

/**
 * Menyimpan perubahan Nama/Judul Tugas, Kategori, Jenis Tugas (Individu/Kelompok),
 * serta Link Pengumpulan pada tugas yang sedang dipilih
 */
async function updateAssessmentLink() {
    const assId = document.getElementById('active-assessment')?.value;
    if (!assId) return alert('Pilih penilaian terlebih dahulu!');

    const assObj = currentAssessments.find(a => String(a.id) === String(assId));
    if (!assObj) return;

    const newJudulEl = document.getElementById('edit-ass-judul');
    const newKatEl = document.getElementById('edit-ass-kategori');
    const newTipeEl = document.getElementById('edit-ass-tipe');
    const newLinkEl = document.getElementById('edit-ass-link');

    const newJudul = newJudulEl ? newJudulEl.value.trim() : assObj.judul;
    const newKategori = newKatEl ? newKatEl.value : assObj.kategori;
    const newTipe = newTipeEl ? newTipeEl.value : assObj.tipe_kerja;
    const newLink = newLinkEl ? newLinkEl.value.trim() : (assObj.link_pengumpulan || '');

    if (!newJudul) {
        return alert('Nama / Judul penilaian tidak boleh kosong!');
    }

    const payload = {
        judul: newJudul,
        kategori: newKategori,
        tipe_kerja: newTipe,
        link_pengumpulan: newLink
    };

    const { error } = await db
        .from('assessments')
        .update(payload)
        .eq('id', assId);

    if (error) {
        return alert('Gagal memperbarui detail tugas: ' + error.message);
    }

    // Perbarui state lokal
    assObj.judul = newJudul;
    assObj.kategori = newKategori;
    assObj.tipe_kerja = newTipe;
    assObj.link_pengumpulan = newLink;

    // Refresh dropdown penilaian dengan tetap mempertahankan tugas yang sedang dibuka
    await loadAssessmentsDropdown(assId);
    alert('✅ Detail penilaian (Nama, Kategori, Jenis Individu/Kelompok, & Link) berhasil diperbarui!');
}

// Alias fungsi untuk kompatibilitas
const updateAssessmentDetails = updateAssessmentLink;

/**
 * Memuat tabel nilai untuk penilaian yang dipilih & mengatur visibilitas mode kelompok
 */
async function loadAssessmentScores() {
    const assId = document.getElementById('active-assessment')?.value;
    const tbody = document.getElementById('scores-tbody');
    const groupBanner = document.getElementById('group-mode-banner');
    const thKelompok = document.getElementById('th-kelompok');
    const linkEditor = document.getElementById('ass-link-editor');

    if (!assId) {
        if (linkEditor) linkEditor.style.display = 'none';
        if (groupBanner) groupBanner.style.display = 'none';
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Silakan pilih penilaian terlebih dahulu.</td></tr>';
        }
        return;
    }

    const assObj = currentAssessments.find(a => String(a.id) === String(assId));
    if (!assObj) return;

    // Tampilkan dan isi Panel Edit Detail Tugas
    if (linkEditor) {
        linkEditor.style.display = 'block';
        const judulInput = document.getElementById('edit-ass-judul');
        const katInput = document.getElementById('edit-ass-kategori');
        const tipeInput = document.getElementById('edit-ass-tipe');
        const linkInput = document.getElementById('edit-ass-link');
        const testBtn = document.getElementById('btn-test-ass-link');
        const pubBtn = document.getElementById('btn-toggle-public');

        if (judulInput) judulInput.value = assObj.judul || '';
        if (katInput) katInput.value = assObj.kategori || 'tugas';
        if (tipeInput) tipeInput.value = assObj.tipe_kerja || 'individu';
        if (linkInput) linkInput.value = assObj.link_pengumpulan || '';

        if (testBtn) {
            if (assObj.link_pengumpulan) {
                testBtn.href = assObj.link_pengumpulan;
                testBtn.style.display = 'inline-block';
            } else {
                testBtn.style.display = 'none';
            }
        }

        if (pubBtn) {
            const isPub = assObj.tampil_publik !== false;
            pubBtn.textContent = isPub ? '👁️ Tampil di Portal Siswa (Klik untuk Sembunyikan)' : '🔒 Disembunyikan dari Siswa (Klik untuk Tampilkan)';
            pubBtn.style.background = isPub ? '#dcfce7' : '#fee2e2';
            pubBtn.style.color = isPub ? '#166534' : '#991b1b';
            pubBtn.style.borderColor = isPub ? '#86efac' : '#fca5a5';
        }
    }

    const isGroup = assObj.tipe_kerja === 'kelompok';
    if (groupBanner) groupBanner.style.display = isGroup ? 'block' : 'none';
    if (thKelompok) thKelompok.style.display = isGroup ? '' : 'none';

    if (tbody) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; padding:16px;">Memuat data nilai siswa...</td></tr>';
    }

    const { data: scoresData, error } = await db
        .from('scores')
        .select('*')
        .eq('assessment_id', assId);

    if (error) {
        console.error('Gagal memuat skor:', error);
        return;
    }

    const scoreMap = {};
    let hasAnySavedGroupInThisTask = false;
    (scoresData || []).forEach(s => {
        scoreMap[s.student_id] = s;
        if (s.nama_kelompok && s.nama_kelompok.trim() !== '') {
            hasAnySavedGroupInThisTask = true;
        }
    });

    // Ambil preset kelompok aktif sebagai fallback otomatis jika tugas kelompok ini baru dibuat
    const defaultPresetMap = (isGroup && !hasAnySavedGroupInThisTask && classGroupPresets[activePresetKey])
        ? classGroupPresets[activePresetKey]
        : {};

    // Kumpulkan daftar nama kelompok unik untuk datalist autocomplete
    const groupNamesSet = new Set(['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5', 'Kelompok 6']);
    Object.values(classGroupPresets).forEach(presetObj => {
        Object.values(presetObj || {}).forEach(gName => {
            if (gName && gName.trim()) groupNamesSet.add(gName.trim());
        });
    });
    (scoresData || []).forEach(s => {
        if (s.nama_kelompok && s.nama_kelompok.trim()) groupNamesSet.add(s.nama_kelompok.trim());
    });

    // Buat/perbarui datalist HTML agar guru mudah memilih/mengetik nama kelompok
    let datalistEl = document.getElementById('datalist-kelompok-options');
    if (!datalistEl) {
        datalistEl = document.createElement('datalist');
        datalistEl.id = 'datalist-kelompok-options';
        document.body.appendChild(datalistEl);
    }
    datalistEl.innerHTML = Array.from(groupNamesSet)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(g => `<option value="${g}">`)
        .join('');

    tbody.innerHTML = '';
    if (!studentsList || studentsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" style="text-align:center; color:#64748b; padding:20px;">Belum ada siswa di kelas ini.</td></tr>';
        return;
    }

    studentsList.forEach((stu, idx) => {
        const sc = scoreMap[stu.id] || {};
        const groupName = (sc.nama_kelompok && sc.nama_kelompok.trim() !== '')
            ? sc.nama_kelompok
            : (defaultPresetMap[stu.id] || '');
        const statusKumpul = sc.status_kumpul || 'belum';
        const linkSiswa = sc.link_tugas_siswa || '';
        const nilai = (sc.nilai !== undefined && sc.nilai !== null) ? sc.nilai : 0;

        const tr = document.createElement('tr');
        tr.setAttribute('data-student-id', stu.id);

        tr.innerHTML = `
            <td style="text-align:center;">${idx + 1}</td>
            <td><strong>${stu.nama}</strong><br><small style="color:#64748b;">${stu.nisn}</small></td>
            <td style="display:${isGroup ? '' : 'none'};">
                <input type="text" class="sc-group" list="datalist-kelompok-options" 
                    value="${groupName.replace(/"/g, '&quot;')}" 
                    placeholder="Nama Kelompok..." 
                    onchange="onStudentGroupNameChange(this)"
                    style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
            </td>
            <td>
                <select class="sc-status" onchange="syncGroupRow(this)" style="padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px; width:100%;">
                    <option value="belum" ${statusKumpul === 'belum' ? 'selected' : ''}>❌ Belum Kumpul</option>
                    <option value="sudah" ${statusKumpul === 'sudah' ? 'selected' : ''}>✅ Sudah Kumpul</option>
                    <option value="terlambat" ${statusKumpul === 'terlambat' ? 'selected' : ''}>⚠️ Terlambat</option>
                </select>
            </td>
            <td>
                <div style="display:flex; gap:4px; align-items:center;">
                    <input type="url" class="sc-link" value="${linkSiswa.replace(/"/g, '&quot;')}" 
                        placeholder="Link tugas..." onchange="syncGroupRow(this)"
                        style="flex:1; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
                    ${linkSiswa ? `<a href="${linkSiswa}" target="_blank" title="Buka Link Tugas" style="padding:5px 8px; background:#eff6ff; border:1px solid #bfdbfe; border-radius:6px; text-decoration:none; font-size:12px;">🔗</a>` : ''}
                </div>
            </td>
            <td>
                <input type="number" class="sc-nilai" min="0" max="100" value="${nilai}" 
                    oninput="syncGroupRow(this)"
                    style="width:80px; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-weight:700; text-align:center;">
            </td>
        `;
        tbody.appendChild(tr);
    });
}

/**
 * Ketika nama kelompok seorang siswa diubah di tabel nilai:
 * jika kelompok baru tersebut sudah memiliki nilai dari anggota lain di tabel,
 * otomatis samakan nilai & statusnya.
 */
function onStudentGroupNameChange(groupInputEl) {
    const tr = groupInputEl.closest('tr');
    if (!tr) return;
    const newGroup = groupInputEl.value.trim().toLowerCase();
    if (!newGroup) return;

    const allRows = document.querySelectorAll('#scores-tbody tr');
    for (const row of allRows) {
        if (row === tr) continue;
        const gInput = row.querySelector('.sc-group');
        if (gInput && gInput.value.trim().toLowerCase() === newGroup) {
            const existingNilai = parseFloat(row.querySelector('.sc-nilai')?.value || 0);
            const existingStatus = row.querySelector('.sc-status')?.value || 'belum';
            const existingLink = row.querySelector('.sc-link')?.value || '';

            if (existingNilai > 0 || existingStatus !== 'belum' || existingLink !== '') {
                const targetNilai = tr.querySelector('.sc-nilai');
                const targetStatus = tr.querySelector('.sc-status');
                const targetLink = tr.querySelector('.sc-link');
                if (targetNilai) targetNilai.value = existingNilai;
                if (targetStatus) targetStatus.value = existingStatus;
                if (targetLink && !targetLink.value && existingLink) targetLink.value = existingLink;
                break;
            }
        }
    }
}

/**
 * Menyinkronkan nilai, status pengumpulan, dan link tugas ke seluruh anggota kelompok yang sama
 */
function syncGroupRow(changedEl) {
    const assId = document.getElementById('active-assessment')?.value;
    const assObj = currentAssessments.find(a => String(a.id) === String(assId));
    if (!assObj || assObj.tipe_kerja !== 'kelompok') return;

    const currentRow = changedEl.closest('tr');
    if (!currentRow) return;

    const groupName = currentRow.querySelector('.sc-group')?.value.trim();
    if (!groupName) return;

    const currentStatus = currentRow.querySelector('.sc-status')?.value;
    const currentNilai = currentRow.querySelector('.sc-nilai')?.value;
    const currentLink = currentRow.querySelector('.sc-link')?.value;

    const allRows = document.querySelectorAll('#scores-tbody tr');
    allRows.forEach(row => {
        if (row === currentRow) return;
        const rowGroup = row.querySelector('.sc-group')?.value.trim();
        if (rowGroup && rowGroup.toLowerCase() === groupName.toLowerCase()) {
            const stEl = row.querySelector('.sc-status');
            const nlEl = row.querySelector('.sc-nilai');
            const lkEl = row.querySelector('.sc-link');

            if (stEl) stEl.value = currentStatus;
            if (nlEl) nlEl.value = currentNilai;
            if (lkEl && currentLink && !lkEl.value) lkEl.value = currentLink;

            row.style.transition = 'background-color 0.25s';
            row.style.backgroundColor = '#dbeafe';
            setTimeout(() => { row.style.backgroundColor = ''; }, 500);
        }
    });
}

/**
 * Menerapkan daftar kelompok yang dipilih pada dropdown #select-group-preset ke tabel nilai saat ini
 */
function applySelectedGroupPreset() {
    const presetKey = document.getElementById('select-group-preset')?.value;
    if (!presetKey || !classGroupPresets[presetKey]) {
        return alert('Pilih daftar kelompok terlebih dahulu pada dropdown!');
    }

    activePresetKey = presetKey;
    const presetMap = classGroupPresets[presetKey];
    const rows = document.querySelectorAll('#scores-tbody tr[data-student-id]');
    if (rows.length === 0) return;

    let appliedCount = 0;
    rows.forEach(row => {
        const stuId = row.getAttribute('data-student-id');
        const gInput = row.querySelector('.sc-group');
        if (gInput && presetMap[stuId] !== undefined) {
            gInput.value = presetMap[stuId];
            appliedCount++;
        }
    });

    // Sinkronkan skor per kelompok jika ada satu anggota kelompok yang sudah memiliki nilai > 0
    syncAllGroupsInTable();

    alert(`✅ Daftar "${presetKey}" diterapkan ke ${appliedCount} siswa di tabel! Jangan lupa klik Simpan Nilai untuk menyimpan ke database.`);
}

/**
 * Menyamakan nilai anggota kelompok di tabel jika salah satu anggota sudah punya nilai
 */
function syncAllGroupsInTable() {
    const rows = document.querySelectorAll('#scores-tbody tr[data-student-id]');
    const groupMasterScore = {};

    rows.forEach(row => {
        const g = row.querySelector('.sc-group')?.value.trim();
        if (!g) return;
        const key = g.toLowerCase();
        const nilai = parseFloat(row.querySelector('.sc-nilai')?.value || 0);
        const status = row.querySelector('.sc-status')?.value || 'belum';
        const link = row.querySelector('.sc-link')?.value || '';

        if (!groupMasterScore[key] || nilai > groupMasterScore[key].nilai) {
            groupMasterScore[key] = {
                nilai: nilai,
                status: status !== 'belum' ? status : (groupMasterScore[key]?.status || 'belum'),
                link: link || (groupMasterScore[key]?.link || '')
            };
        }
    });

    rows.forEach(row => {
        const g = row.querySelector('.sc-group')?.value.trim();
        if (!g) return;
        const master = groupMasterScore[g.toLowerCase()];
        if (master && (master.nilai > 0 || master.status !== 'belum')) {
            const nlEl = row.querySelector('.sc-nilai');
            const stEl = row.querySelector('.sc-status');
            const lkEl = row.querySelector('.sc-link');
            if (nlEl) nlEl.value = master.nilai;
            if (stEl) stEl.value = master.status;
            if (lkEl && !lkEl.value && master.link) lkEl.value = master.link;
        }
    });
}

/**
 * Menyimpan susunan kelompok yang sedang tertulis di tabel nilai menjadi Preset Daftar Kelompok
 */
async function saveCurrentTableAsGroupPreset() {
    const rows = document.querySelectorAll('#scores-tbody tr[data-student-id]');
    if (rows.length === 0) return alert('Tabel siswa masih kosong.');

    const defaultName = activePresetKey && !activePresetKey.startsWith('[Riwayat] ')
        ? activePresetKey
        : 'Kelompok Default';

    const presetName = prompt('Masukkan nama Daftar Kelompok untuk menyimpan susunan saat ini:', defaultName);
    if (!presetName || !presetName.trim()) return;

    const cleanName = presetName.trim();
    const mapObj = {};
    let filled = 0;

    rows.forEach(row => {
        const stuId = row.getAttribute('data-student-id');
        const gVal = row.querySelector('.sc-group')?.value.trim() || '';
        if (stuId) {
            mapObj[stuId] = gVal;
            if (gVal) filled++;
        }
    });

    if (filled === 0) {
        return alert('Belum ada nama kelompok yang diisi pada tabel nilai.');
    }

    classGroupPresets[cleanName] = mapObj;
    activePresetKey = cleanName;
    await persistClassGroupPresets();
    alert(`✅ Susunan kelompok (${filled} siswa) berhasil disimpan ke daftar "${cleanName}" dan siap dipakai untuk tugas kelompok lainnya!`);
}

// ============================================================================
// FUNGSI MODAL MANAJEMEN DAFTAR KELOMPOK SISWA
// ============================================================================

async function openGroupManagerModal() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId) return alert('Pilih kelas terlebih dahulu!');

    await loadClassGroupPresets();

    const modal = document.getElementById('modal-group-manager');
    if (modal) modal.style.display = 'flex';

    populateModalPresetSelect();
    loadPresetIntoModal();
}

function closeGroupManagerModal() {
    const modal = document.getElementById('modal-group-manager');
    if (modal) modal.style.display = 'none';
}

function populateModalPresetSelect() {
    const sel = document.getElementById('gm-preset-select');
    if (!sel) return;

    sel.innerHTML = '';
    Object.keys(classGroupPresets).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        if (k === activePresetKey) opt.selected = true;
        sel.appendChild(opt);
    });
}

function loadPresetIntoModal() {
    const sel = document.getElementById('gm-preset-select');
    const nameInput = document.getElementById('gm-preset-name');
    const tbody = document.getElementById('gm-students-tbody');
    if (!tbody) return;

    const chosenKey = sel?.value || activePresetKey || 'Kelompok Default';
    activePresetKey = chosenKey;

    if (nameInput) {
        nameInput.value = chosenKey.replace(/^\[Riwayat\]\s*/, '');
    }

    const presetMap = classGroupPresets[chosenKey] || {};
    tbody.innerHTML = '';

    if (!studentsList || studentsList.length === 0) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:16px; color:#64748b;">Belum ada siswa di kelas ini.</td></tr>';
        renderModalGroupSummary();
        return;
    }

    studentsList.forEach((stu, idx) => {
        const gVal = presetMap[stu.id] || '';
        const tr = document.createElement('tr');
        tr.setAttribute('data-gm-student-id', stu.id);
        tr.innerHTML = `
            <td style="text-align:center; padding:6px 8px;">${idx + 1}</td>
            <td style="padding:6px 8px; color:#475569; font-size:12px;">${stu.nisn}</td>
            <td style="padding:6px 8px; font-weight:600;">${stu.nama}</td>
            <td style="padding:6px 8px;">
                <input type="text" class="gm-stu-group" list="datalist-kelompok-options"
                    value="${gVal.replace(/"/g, '&quot;')}"
                    placeholder="Contoh: Kelompok 1"
                    oninput="renderModalGroupSummary()"
                    style="width:100%; padding:6px 8px; border:1px solid #cbd5e1; border-radius:6px; font-size:12px;">
            </td>
        `;
        tbody.appendChild(tr);
    });

    renderModalGroupSummary();
}

function renderModalGroupSummary() {
    const container = document.getElementById('gm-summary-badges');
    if (!container) return;

    const inputs = document.querySelectorAll('#gm-students-tbody .gm-stu-group');
    const counts = {};
    let unassigned = 0;

    inputs.forEach(inp => {
        const val = inp.value.trim();
        if (val) {
            counts[val] = (counts[val] || 0) + 1;
        } else {
            unassigned++;
        }
    });

    const groupNames = Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (groupNames.length === 0) {
        container.innerHTML = `<span style="font-size:12px; color:#64748b;">Belum ada siswa yang dimasukkan ke kelompok (${unassigned} siswa belum memiliki kelompok).</span>`;
        return;
    }

    let html = groupNames.map(g => `
        <span style="background:#dbeafe; color:#1e40af; border:1px solid #93c5fd; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600;">
            ${g}: ${counts[g]} siswa
        </span>
    `).join('');

    if (unassigned > 0) {
        html += `
            <span style="background:#fee2e2; color:#991b1b; border:1px solid #fca5a5; padding:3px 10px; border-radius:999px; font-size:11px; font-weight:600;">
                Belum ada kelompok: ${unassigned} siswa
            </span>
        `;
    }
    container.innerHTML = html;
}

function createNewGroupPreset() {
    const newName = prompt('Masukkan nama daftar kelompok baru (misal: Kelompok Praktikum / Kelompok Proyek):');
    if (!newName || !newName.trim()) return;

    const clean = newName.trim();
    if (!classGroupPresets[clean]) {
        classGroupPresets[clean] = {};
    }
    activePresetKey = clean;
    populateModalPresetSelect();
    loadPresetIntoModal();
}

async function deleteCurrentGroupPreset() {
    const sel = document.getElementById('gm-preset-select');
    const key = sel?.value;
    if (!key) return;

    if (Object.keys(classGroupPresets).length <= 1) {
        return alert('Minimal harus ada 1 daftar kelompok. Anda dapat mereset isinya jika ingin mengosongkan.');
    }

    if (!confirm(`Hapus daftar kelompok "${key}"?`)) return;

    delete classGroupPresets[key];
    activePresetKey = Object.keys(classGroupPresets)[0] || 'Kelompok Default';
    await persistClassGroupPresets();
    populateModalPresetSelect();
    loadPresetIntoModal();
}

function autoGenerateGroups(mode = 'random') {
    const countInput = document.getElementById('gm-auto-count');
    const numGroups = Math.max(2, parseInt(countInput?.value || 5, 10));
    const rows = Array.from(document.querySelectorAll('#gm-students-tbody tr[data-gm-student-id]'));
    if (rows.length === 0) return;

    let indices = rows.map((_, i) => i);
    if (mode === 'random') {
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
    }

    indices.forEach((rowIndex, pos) => {
        const groupNumber = (pos % numGroups) + 1;
        const inp = rows[rowIndex].querySelector('.gm-stu-group');
        if (inp) inp.value = `Kelompok ${groupNumber}`;
    });

    renderModalGroupSummary();
}

function clearAllModalGroups() {
    document.querySelectorAll('#gm-students-tbody .gm-stu-group').forEach(inp => {
        inp.value = '';
    });
    renderModalGroupSummary();
}

async function saveGroupPresetFromModal(applyToActiveTask = false) {
    const nameInput = document.getElementById('gm-preset-name');
    const presetName = (nameInput?.value || '').trim() || 'Kelompok Default';

    const rows = document.querySelectorAll('#gm-students-tbody tr[data-gm-student-id]');
    const mapObj = {};

    rows.forEach(row => {
        const stuId = row.getAttribute('data-gm-student-id');
        const gVal = row.querySelector('.gm-stu-group')?.value.trim() || '';
        if (stuId) mapObj[stuId] = gVal;
    });

    classGroupPresets[presetName] = mapObj;
    activePresetKey = presetName;

    await persistClassGroupPresets();
    populateModalPresetSelect();

    if (applyToActiveTask) {
        const assId = document.getElementById('active-assessment')?.value;
        const assObj = currentAssessments.find(a => String(a.id) === String(assId));
        if (assObj && assObj.tipe_kerja === 'kelompok') {
            const selectPresetEl = document.getElementById('select-group-preset');
            if (selectPresetEl) selectPresetEl.value = presetName;
            applySelectedGroupPreset();
        }
        closeGroupManagerModal();
    } else {
        alert(`✅ Daftar kelompok "${presetName}" berhasil disimpan!`);
    }
}
Cara Menggunakan Fitur Baru
Mengedit Nama, Kategori, atau Mengubah Tugas Individu 
↔ Kelompok:

Buka tab Tugas & Nilai, lalu pilih tugas pada dropdown Pilih Penilaian.   
andiwahidin/sipantau-belajar

Pada kotak Edit Pengaturan & Jenis Tugas Terpilih, ubah Nama/Judul Penilaian, Kategori, atau ganti Jenis/Tipe Kerja dari Individu ke Kelompok (maupun sebaliknya), lalu klik Simpan Perubahan Tugas.

Membuat & Menggunakan Daftar Kelompok Siswa untuk Banyak Tugas:

Klik tombol Kelola Daftar Kelompok Kelas (atau tombol Atur / Buat Kelompok pada banner biru saat membuka tugas kelompok).

Gunakan fitur Bagi Kelompok Otomatis (misal: 5 kelompok 
→ klik Bagi Acak atau Bagi Urut Absen) atau ketik nama kelompok per siswa, lalu klik Simpan & Terapkan ke Tugas Aktif.

Untuk tugas-tugas kelompok berikutnya, guru cukup memilih nama daftar kelompok di dropdown Pilih Daftar Kelompok lalu klik Terapkan ke Tabel.

Buatkan saya kode yang lengkap/utuh sehingga bisa saya langsung ganti

Berdasarkan kode asli pada repositori SiPantau Belajar (v3.7 / v3.8) Anda, seluruh perubahan hanya berada pada Tab 4 (#gcontent-nilai) di index.html dan Bagian 6 di app-guru.js.   
andiwahidin/sipantau-belajar
+ 1

Agar Anda dapat langsung menggantinya tanpa risiko kode terpotong dan tetap 100% kompatibel dengan fitur Rekap Nilai Akhir, Cetak PDF, Ekspor Excel, serta Portal Publik Siswa (siswa.html & app-siswa.js), silakan ganti langsung kedua bagian berikut secara utuh.   
andiwahidin/sipantau-belajar

1. Kode Utuh Pengganti pada index.html (Baris 639–740)
Buka file index.html, cari bagian <!-- TAB 4: TUGAS, VISIBILITAS PUBLIK, LINK PENGUMPULAN & PENILAIAN (FIXED MOBILE LAYOUT) --> (mulai dari <div id="gcontent-nilai" ...> pada baris 639 sampai penutup </div> sebelum <!-- TAB 5: ... --> pada baris 740), lalu hapus dan ganti seluruhnya dengan kode utuh berikut (sudah termasuk Modal Manajemen Daftar Kelompok Siswa di dalamnya):   
andiwahidin/sipantau-belajar

HTML
            <!-- TAB 4: TUGAS, VISIBILITAS PUBLIK, LINK PENGUMPULAN & PENILAIAN (REVISI EDIT TUGAS & DAFTAR KELOMPOK) -->
            <div id="gcontent-nilai" class="hidden bg-white p-4 sm:p-6 rounded-2xl shadow-sm border border-slate-200/80 space-y-5">
                
                <!-- Form Buat Penilaian Baru -->
                <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <h3 class="font-extrabold text-sm text-slate-800">Buat Daftar Tugas / Ujian Baru pada Mata Pelajaran Ini</h3>
                        <button type="button" onclick="openGroupManagerModal()" class="self-start sm:self-auto px-3 py-1.5 rounded-xl text-xs font-extrabold bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200 transition flex items-center gap-1.5 shadow-sm">
                            <span>👥</span> Kelola Daftar Kelompok Siswa
                        </button>
                    </div>
                    <form onsubmit="createAssessment(event)" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-3">
                        <div class="sm:col-span-2 lg:col-span-4">
                            <input type="text" id="ass-judul" required placeholder="Judul Tugas/Ujian (Misal: Tugas 1)" class="w-full border border-slate-300 bg-white p-2.5 rounded-xl text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div class="lg:col-span-3">
                            <select id="ass-kategori" class="w-full border border-slate-300 bg-white p-2.5 rounded-xl text-sm outline-none">
                                <option value="tugas">Kategori: Tugas</option>
                                <option value="ujian_bab">Kategori: Ujian Akhir Bab</option>
                                <option value="ujian_semester">Kategori: Ujian Semester</option>
                            </select>
                        </div>
                        <div class="lg:col-span-2">
                            <select id="ass-tipe" class="w-full border border-slate-300 bg-white p-2.5 rounded-xl text-sm outline-none">
                                <option value="individu">Sistem: Individu</option>
                                <option value="kelompok">Sistem: Berkelompok</option>
                            </select>
                        </div>
                        <div class="lg:col-span-3">
                            <select id="ass-publik" class="w-full border border-indigo-200 bg-indigo-50/60 text-indigo-950 font-bold p-2.5 rounded-xl text-xs outline-none">
                                <option value="true">🌐 Tampilkan di Hal. Siswa</option>
                                <option value="false">🔒 Sembunyikan dari Siswa</option>
                            </select>
                        </div>
                        <div class="sm:col-span-2 lg:col-span-9">
                            <input type="url" id="ass-link" placeholder="Link Folder Google Drive / OneDrive Pengumpulan Tugas (Opsional)" class="w-full border border-slate-300 bg-white p-2.5 rounded-xl text-xs sm:text-sm outline-none focus:ring-2 focus:ring-indigo-500">
                        </div>
                        <div class="sm:col-span-2 lg:col-span-3">
                            <button type="submit" class="w-full bg-indigo-600 text-white rounded-xl px-4 py-2.5 text-xs sm:text-sm font-bold hover:bg-indigo-700 shadow-sm transition">
                                + Buat Penilaian
                            </button>
                        </div>
                    </form>
                </div>

                <!-- Bar Pilih Penilaian -->
                <div class="space-y-3 border-b pb-4 min-w-0">
                    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 min-w-0">
                        <div class="flex flex-col sm:flex-row sm:items-center gap-2 w-full sm:w-auto flex-grow min-w-0">
                            <label class="text-xs sm:text-sm font-extrabold text-slate-700 shrink-0">Pilih Penilaian:</label>
                            <select id="active-assessment" onchange="loadAssessmentScores()" class="w-full sm:max-w-md border-2 border-indigo-200 bg-indigo-50 text-indigo-950 font-bold p-2.5 rounded-xl text-xs sm:text-sm outline-none truncate"></select>
                        </div>
                        <div class="flex items-center gap-3 self-start sm:self-center shrink-0">
                            <button type="button" onclick="openGroupManagerModal()" class="text-xs font-bold text-indigo-600 hover:underline py-1">
                                👥 Daftar Kelompok Kelas
                            </button>
                            <button type="button" onclick="deleteCurrentAssessment()" class="text-xs font-bold text-rose-600 hover:underline py-1">
                                🗑️ Hapus Penilaian Ini
                            </button>
                        </div>
                    </div>

                    <!-- Kotak Edit Nama, Kategori, Jenis (Individu/Kelompok), Link & Visibilitas Publik -->
                    <div id="ass-link-editor" class="hidden bg-indigo-50/70 p-3.5 sm:p-4 rounded-2xl border border-indigo-200 space-y-3 min-w-0">
                        <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-indigo-200/70 pb-2.5">
                            <span class="text-xs font-extrabold text-indigo-950 flex items-center gap-1.5">
                                ⚙️ Edit Nama, Jenis Tugas (Individu/Kelompok) & Link Pengumpulan
                            </span>
                            <div class="flex items-center gap-2 shrink-0">
                                <span class="text-[11px] font-bold text-slate-600">Visibilitas Hal. Siswa:</span>
                                <button type="button" id="btn-toggle-public" onclick="toggleAssessmentPublicVisibility()" class="px-3 py-1.5 rounded-xl text-xs font-extrabold transition shadow-sm text-center"></button>
                            </div>
                        </div>

                        <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-2.5">
                            <div class="sm:col-span-2 lg:col-span-4">
                                <label class="block text-[11px] font-bold text-indigo-900 mb-1">Nama / Judul Tugas</label>
                                <input type="text" id="edit-ass-judul" placeholder="Judul Tugas/Ujian" class="w-full border border-indigo-200 bg-white rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                            <div class="lg:col-span-3">
                                <label class="block text-[11px] font-bold text-indigo-900 mb-1">Kategori Penilaian</label>
                                <select id="edit-ass-kategori" class="w-full border border-indigo-200 bg-white rounded-xl px-3 py-2 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="tugas">Tugas</option>
                                    <option value="ujian_bab">Ujian Akhir Bab</option>
                                    <option value="ujian_semester">Ujian Semester</option>
                                </select>
                            </div>
                            <div class="lg:col-span-2">
                                <label class="block text-[11px] font-bold text-indigo-900 mb-1">Sistem / Jenis Kerja</label>
                                <select id="edit-ass-tipe" class="w-full border border-indigo-200 bg-white rounded-xl px-3 py-2 text-xs font-bold text-indigo-950 outline-none focus:ring-2 focus:ring-indigo-500">
                                    <option value="individu">👤 Individu</option>
                                    <option value="kelompok">👥 Berkelompok</option>
                                </select>
                            </div>
                            <div class="sm:col-span-2 lg:col-span-3">
                                <label class="block text-[11px] font-bold text-indigo-900 mb-1">📂 Link Pengumpulan Guru</label>
                                <input type="url" id="edit-ass-link" placeholder="https://drive.google.com/..." class="w-full border border-indigo-200 bg-white rounded-xl px-3 py-2 text-xs outline-none focus:ring-2 focus:ring-indigo-500">
                            </div>
                        </div>

                        <div class="flex flex-wrap items-center justify-end gap-2 pt-1">
                            <a id="btn-test-ass-link" href="#" target="_blank" class="hidden text-center bg-white border border-indigo-300 text-indigo-700 px-3.5 py-2 rounded-xl text-xs font-bold hover:bg-indigo-100">
                                ↗ Buka Link Guru
                            </a>
                            <button type="button" onclick="updateAssessmentLink()" class="w-full sm:w-auto bg-indigo-600 text-white px-4 py-2 rounded-xl text-xs font-extrabold hover:bg-indigo-700 shadow-sm transition">
                                💾 Simpan Perubahan Tugas
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Banner & Toolbar Mode Penilaian Berkelompok -->
                <div id="group-mode-banner" class="hidden bg-amber-50 border border-amber-300 text-amber-900 p-3.5 rounded-2xl text-xs space-y-3">
                    <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5">
                        <div class="leading-relaxed">
                            💡 <b>Mode Penilaian Berkelompok Aktif:</b> Saat nilai, link bukti, atau centang kumpul diisi pada satu anggota, seluruh anggota di kelompok yang sama otomatis disamakan.
                        </div>
                        <div class="flex flex-wrap items-center gap-1.5 shrink-0">
                            <select id="select-group-preset" class="border border-amber-300 bg-white text-slate-800 font-bold rounded-xl px-2.5 py-1.5 text-xs outline-none"></select>
                            <button type="button" onclick="applySelectedGroupPreset()" class="bg-amber-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold hover:bg-amber-700 transition shadow-sm">
                                ⚡ Terapkan Kelompok
                            </button>
                            <button type="button" onclick="saveCurrentTableAsGroupPreset()" class="bg-white border border-amber-300 text-amber-900 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-amber-100 transition">
                                📥 Simpan dari Tabel Ini
                            </button>
                            <button type="button" onclick="openGroupManagerModal()" class="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold hover:bg-indigo-700 transition shadow-sm">
                                🛠️ Buat / Edit Daftar Kelompok
                            </button>
                        </div>
                    </div>
                </div>

                <!-- Datalist Autocomplete Nama Kelompok -->
                <datalist id="datalist-kelompok-options"></datalist>

                <p class="text-[11px] text-indigo-600 font-semibold md:hidden">↔️ Geser tabel ke samping untuk mengisi Status Kumpul & Nilai.</p>

                <!-- Tabel Penilaian (Kolom Kelompok otomatis disembunyikan jika tipe Individu) -->
                <div class="table-responsive-wrapper rounded-xl border border-slate-200">
                    <table class="w-full text-sm border-collapse">
                        <thead class="bg-slate-100 text-slate-700">
                            <tr>
                                <th class="p-3 border-b text-left col-nisn">NISN</th>
                                <th class="p-3 border-b text-left col-nama">Nama Siswa</th>
                                <th id="th-kelompok" class="p-3 border-b text-left min-w-[130px]">Kelompok</th>
                                <th class="p-3 border-b text-center min-w-[110px]">Status Kumpul</th>
                                <th class="p-3 border-b text-center min-w-[110px]">Nilai (0-100)</th>
                                <th class="p-3 border-b text-left min-w-[190px]">Link Bukti Siswa</th>
                            </tr>
                        </thead>
                        <tbody id="scores-tbody" class="divide-y divide-slate-200"></tbody>
                    </table>
                </div>

                <button onclick="saveAssessmentScores()" class="w-full sm:w-auto bg-indigo-600 text-white px-6 py-3 sm:py-2.5 rounded-xl text-sm font-bold hover:bg-indigo-700 shadow-md">
                    💾 Simpan Status Tugas, Link & Nilai
                </button>

                <!-- MODAL 6: MANAJEMEN DAFTAR KELOMPOK SISWA (REUSABLE UNTUK BANYAK TUGAS KELOMPOK) -->
                <div id="modal-group-manager" class="hidden fixed inset-0 modal-backdrop flex items-center justify-center z-50 p-3 sm:p-4">
                    <div class="bg-white rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-slate-100 overflow-hidden">
                        <div class="flex justify-between items-center bg-slate-900 text-white px-5 py-4 shrink-0">
                            <div>
                                <h3 class="font-extrabold text-sm sm:text-base">👥 Manajemen Daftar Kelompok Siswa</h3>
                                <p class="text-[11px] text-slate-300 mt-0.5">Daftar kelompok ini dapat digunakan berulang kali untuk berbagai tugas kelompok di kelas ini.</p>
                            </div>
                            <button type="button" onclick="closeGroupManagerModal()" class="text-slate-300 hover:text-white font-bold text-lg">✕</button>
                        </div>

                        <div class="p-4 sm:p-5 overflow-y-auto space-y-4 flex-1">
                            <!-- Pilih / Buat Preset Daftar Kelompok -->
                            <div class="grid grid-cols-1 sm:grid-cols-12 gap-2.5 bg-slate-50 p-3.5 rounded-2xl border border-slate-200 items-end">
                                <div class="sm:col-span-5">
                                    <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Pilih Daftar Kelompok Tersimpan</label>
                                    <select id="gm-preset-select" onchange="loadPresetIntoModal()" class="w-full border border-slate-300 bg-white rounded-xl p-2 text-xs font-bold outline-none"></select>
                                </div>
                                <div class="sm:col-span-4">
                                    <label class="block text-[11px] font-bold uppercase text-slate-500 mb-1">Nama Daftar Kelompok</label>
                                    <input type="text" id="gm-preset-name" placeholder="Contoh: Kelompok Praktikum" class="w-full border border-slate-300 bg-white rounded-xl p-2 text-xs font-semibold outline-none">
                                </div>
                                <div class="sm:col-span-3 flex gap-1.5">
                                    <button type="button" onclick="createNewGroupPreset()" class="flex-1 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-xl px-2.5 py-2 text-xs font-extrabold hover:bg-indigo-100">
                                        + Baru
                                    </button>
                                    <button type="button" onclick="deleteCurrentGroupPreset()" class="bg-rose-50 text-rose-600 border border-rose-200 rounded-xl px-2.5 py-2 text-xs font-extrabold hover:bg-rose-100">
                                        🗑️ Hapus
                                    </button>
                                </div>
                            </div>

                            <!-- Generator Pembagian Kelompok Otomatis -->
                            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-indigo-50/70 border border-indigo-200 p-3 rounded-2xl">
                                <div class="flex items-center gap-2 flex-wrap">
                                    <span class="text-xs font-extrabold text-indigo-950">🎲 Bagi Kelompok Otomatis:</span>
                                    <input type="number" id="gm-auto-count" min="2" max="30" value="5" class="w-16 border border-indigo-300 bg-white rounded-xl p-1.5 text-xs font-extrabold text-center outline-none">
                                    <span class="text-xs font-semibold text-indigo-900">Kelompok</span>
                                </div>
                                <div class="flex flex-wrap gap-1.5">
                                    <button type="button" onclick="autoGenerateGroups('random')" class="bg-indigo-600 text-white px-3 py-1.5 rounded-xl text-xs font-extrabold hover:bg-indigo-700 shadow-sm">
                                        🔀 Bagi Acak
                                    </button>
                                    <button type="button" onclick="autoGenerateGroups('urut')" class="bg-white border border-indigo-300 text-indigo-800 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-indigo-100">
                                        📋 Bagi Urut Absen
                                    </button>
                                    <button type="button" onclick="clearAllModalGroups()" class="bg-white border border-rose-200 text-rose-600 px-3 py-1.5 rounded-xl text-xs font-bold hover:bg-rose-50">
                                        🧹 Kosongkan
                                    </button>
                                </div>
                            </div>

                            <!-- Badge Ringkasan Anggota per Kelompok -->
                            <div id="gm-summary-badges" class="flex flex-wrap gap-1.5"></div>

                            <!-- Tabel Siswa & Input Nama Kelompok -->
                            <div class="border border-slate-200 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
                                <table class="w-full text-xs border-collapse">
                                    <thead class="bg-slate-100 text-slate-700 sticky top-0 z-10">
                                        <tr>
                                            <th class="p-2.5 border-b text-center w-10">No</th>
                                            <th class="p-2.5 border-b text-left w-28">NISN</th>
                                            <th class="p-2.5 border-b text-left">Nama Siswa</th>
                                            <th class="p-2.5 border-b text-left w-48">Nama Kelompok</th>
                                        </tr>
                                    </thead>
                                    <tbody id="gm-students-tbody" class="divide-y divide-slate-200"></tbody>
                                </table>
                            </div>
                        </div>

                        <div class="px-5 py-3.5 bg-slate-50 border-t border-slate-200 flex flex-wrap justify-between items-center gap-2 shrink-0">
                            <button type="button" onclick="closeGroupManagerModal()" class="px-4 py-2 rounded-xl text-xs font-bold bg-slate-200 text-slate-700 hover:bg-slate-300">
                                Tutup
                            </button>
                            <div class="flex flex-wrap gap-2">
                                <button type="button" onclick="saveGroupPresetFromModal(false)" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm">
                                    💾 Simpan Daftar Kelompok
                                </button>
                                <button type="button" onclick="saveGroupPresetFromModal(true)" class="px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 shadow-sm">
                                    ⚡ Simpan & Terapkan ke Tugas Aktif
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
2. Kode Utuh Pengganti pada app-guru.js (Bagian 6: Baris 1307–1583)
Buka file app-guru.js, cari // 6. TUGAS, VISIBILITAS PUBLIK, LINK PENGUMPULAN & PENILAIAN (TAB 4 - AUTO-SYNC HEADER) pada baris 1307 sampai akhir fungsi saveAssessmentScores() pada baris 1583 (tepat di atas // 7. REKAP NILAI AKHIR, EKSPOR EXCEL & CETAK KARTU PDF (TAB 5)), lalu hapus dan ganti seluruh Bagian 6 tersebut dengan kode utuh berikut:   
andiwahidin/sipantau-belajar

JavaScript
// ============================================================================
// 6. TUGAS, VISIBILITAS PUBLIK, LINK PENGUMPULAN, EDIT JENIS TUGAS & DAFTAR KELOMPOK (TAB 4)
// ============================================================================

let classGroupPresets = {};
let activePresetKey = 'Kelompok Default';

function getGroupStorageKey() {
    const classId = document.getElementById('guru-active-class')?.value || 'none';
    const mapel = currentSettings?.mapel || 'umum';
    const teacherId = currentUser?.id || 'anon';
    return `sipantau_groups_${teacherId}_${classId}_${mapel}`;
}

async function loadClassGroupPresets() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId || !currentUser) return {};

    let presets = {};

    // 1. Muat dari localStorage
    try {
        const raw = localStorage.getItem(getGroupStorageKey());
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') presets = { ...parsed };
        }
    } catch (e) {
        console.warn('Gagal memuat preset kelompok lokal:', e);
    }

    // 2. Muat dari currentSettings.kelompok_template di Supabase (jika kolom tersedia)
    if (currentSettings && currentSettings.kelompok_template && typeof currentSettings.kelompok_template === 'object') {
        presets = { ...presets, ...currentSettings.kelompok_template };
    }

    // 3. Pindai otomatis riwayat kelompok dari tugas-tugas kelompok yang sudah ada di tabel scores
    try {
        const groupAssessments = (currentAssessments || []).filter(a => a.tipe_kerja === 'kelompok');
        if (groupAssessments.length > 0) {
            const assIds = groupAssessments.map(a => a.id);
            const { data: pastScores } = await db.from('scores')
                .select('assessment_id, student_id, nama_kelompok')
                .in('assessment_id', assIds);

            if (pastScores && pastScores.length > 0) {
                groupAssessments.forEach(ass => {
                    const rows = pastScores.filter(s => s.assessment_id === ass.id && s.nama_kelompok && s.nama_kelompok.trim() !== '');
                    if (rows.length > 0) {
                        const mapObj = {};
                        rows.forEach(r => { mapObj[r.student_id] = r.nama_kelompok.trim(); });
                        if (!presets['Kelompok Default'] || Object.keys(presets['Kelompok Default']).length === 0) {
                            presets['Kelompok Default'] = { ...mapObj };
                        }
                        presets[`[Riwayat] ${ass.judul}`] = mapObj;
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Gagal memindai riwayat kelompok:', e);
    }

    if (Object.keys(presets).length === 0) {
        presets['Kelompok Default'] = {};
    }

    classGroupPresets = presets;
    if (!classGroupPresets[activePresetKey]) {
        activePresetKey = Object.keys(classGroupPresets)[0] || 'Kelompok Default';
    }

    refreshGroupPresetDropdown();
    updateGroupAutocompleteDatalist();
    return classGroupPresets;
}

async function persistClassGroupPresets() {
    const cleanPresets = {};
    Object.keys(classGroupPresets).forEach(k => {
        if (!k.startsWith('[Riwayat] ')) {
            cleanPresets[k] = classGroupPresets[k];
        }
    });

    try {
        localStorage.setItem(getGroupStorageKey(), JSON.stringify(cleanPresets));
    } catch (e) {
        console.warn('Gagal menyimpan preset kelompok ke localStorage:', e);
    }

    if (currentSettings && currentSettings.id) {
        try {
            const { error } = await db.from('teacher_settings')
                .update({ kelompok_template: cleanPresets })
                .eq('id', currentSettings.id);
            if (!error) {
                currentSettings.kelompok_template = cleanPresets;
            }
        } catch (e) {
            // Abaikan jika kolom kelompok_template belum dibuat di tabel teacher_settings
        }
    }

    refreshGroupPresetDropdown();
    updateGroupAutocompleteDatalist();
}

function refreshGroupPresetDropdown() {
    const sel = document.getElementById('select-group-preset');
    if (!sel) return;

    sel.innerHTML = '';
    Object.keys(classGroupPresets).forEach(k => {
        const countAssigned = Object.values(classGroupPresets[k] || {}).filter(v => v && v.trim() !== '').length;
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `${k} (${countAssigned} siswa)`;
        if (k === activePresetKey) opt.selected = true;
        sel.appendChild(opt);
    });
}

function updateGroupAutocompleteDatalist(extraScores = []) {
    const dl = document.getElementById('datalist-kelompok-options');
    if (!dl) return;

    const names = new Set(['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5', 'Kelompok 6']);
    Object.values(classGroupPresets).forEach(mapObj => {
        Object.values(mapObj || {}).forEach(g => {
            if (g && g.trim()) names.add(g.trim());
        });
    });
    (extraScores || []).forEach(s => {
        if (s.nama_kelompok && s.nama_kelompok.trim()) names.add(s.nama_kelompok.trim());
    });

    dl.innerHTML = Array.from(names)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(n => `<option value="${n.replace(/"/g, '&quot;')}">`)
        .join('');
}

async function loadAssessmentsDropdown(keepSelectedId = null) {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId || !currentSettings) return;

    const { data } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('id');

    currentAssessments = data || [];
    const sel = document.getElementById('active-assessment');
    const prevSelected = keepSelectedId || sel.value;

    sel.innerHTML = currentAssessments.length ? '' : '<option value="">-- Belum Ada Penilaian di Mapel Ini --</option>';
    currentAssessments.forEach(a => {
        const labelKat = a.kategori === 'tugas' ? 'Tugas' : (a.kategori === 'ujian_bab' ? 'Ujian Bab' : 'Ujian Smt');
        const labelTipe = a.tipe_kerja === 'kelompok' ? '👥 Kelompok' : '👤 Individu';
        const visIcon = (a.tampil_publik !== false) ? '🌐 Publik' : '🔒 Sembunyi';
        sel.innerHTML += `<option value="${a.id}">[${visIcon} | ${labelKat} • ${labelTipe}] ${a.judul}</option>`;
    });

    await loadClassGroupPresets();

    if (prevSelected && currentAssessments.some(a => a.id == prevSelected)) {
        sel.value = prevSelected;
    }

    await loadAssessmentScores();
}

async function createAssessment(e) {
    e.preventDefault();
    const class_id = document.getElementById('guru-active-class').value;
    if (!class_id || !currentSettings) return showToast('Pilih kelas & mapel terlebih dahulu!', 'error');
    const judul = document.getElementById('ass-judul').value.trim();
    const kategori = document.getElementById('ass-kategori').value;
    const tipe_kerja = document.getElementById('ass-tipe').value;
    const tampil_publik = document.getElementById('ass-publik').value === 'true';
    const link_pengumpulan = document.getElementById('ass-link').value.trim();

    let { data, error } = await db.from('assessments')
        .insert([{
            teacher_id: currentUser.id,
            class_id: Number(class_id),
            mapel: currentSettings.mapel,
            judul,
            kategori,
            tipe_kerja,
            tampil_publik,
            link_pengumpulan
        }])
        .select().single();

    if (error && String(error.message).includes('tampil_publik')) {
        const retry = await db.from('assessments')
            .insert([{
                teacher_id: currentUser.id,
                class_id: Number(class_id),
                mapel: currentSettings.mapel,
                judul,
                kategori,
                tipe_kerja,
                link_pengumpulan
            }])
            .select().single();
        data = retry.data;
        error = retry.error;
    }

    if (error) return showToast('Gagal membuat penilaian: ' + error.message, 'error');

    document.getElementById('ass-judul').value = '';
    document.getElementById('ass-link').value = '';
    showToast(`Penilaian "${judul}" berhasil dibuat!`);
    await loadAssessmentsDropdown(data.id);
}

async function updateAssessmentLink() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId) return;

    const assObj = currentAssessments.find(a => a.id == assId);
    if (!assObj) return;

    const judulEl = document.getElementById('edit-ass-judul');
    const katEl = document.getElementById('edit-ass-kategori');
    const tipeEl = document.getElementById('edit-ass-tipe');
    const linkEl = document.getElementById('edit-ass-link');

    const judul = judulEl ? judulEl.value.trim() : assObj.judul;
    const kategori = katEl ? katEl.value : assObj.kategori;
    const tipe_kerja = tipeEl ? tipeEl.value : assObj.tipe_kerja;
    const link_pengumpulan = linkEl ? linkEl.value.trim() : (assObj.link_pengumpulan || '');

    if (!judul) {
        return showToast('Nama / Judul penilaian tidak boleh kosong!', 'error');
    }

    const { error } = await db.from('assessments')
        .update({ judul, kategori, tipe_kerja, link_pengumpulan })
        .eq('id', assId);

    if (error) {
        return showToast('Gagal memperbarui penilaian: ' + error.message, 'error');
    }

    assObj.judul = judul;
    assObj.kategori = kategori;
    assObj.tipe_kerja = tipe_kerja;
    assObj.link_pengumpulan = link_pengumpulan;

    showToast('Detail penilaian (Nama, Kategori, Sistem Kerja & Link) berhasil diperbarui!');
    await loadAssessmentsDropdown(assId);
}

async function toggleAssessmentPublicVisibility() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId) return;
    const assObj = currentAssessments.find(a => a.id == assId);
    if (!assObj) return;

    const currentPub = assObj.tampil_publik !== false;
    const newPub = !currentPub;

    const { error } = await db.from('assessments')
        .update({ tampil_publik: newPub })
        .eq('id', assId);

    if (error) {
        return showToast('Gagal mengubah visibilitas! Pastikan kolom tampil_publik sudah dibuat di Supabase.', 'error');
    }

    assObj.tampil_publik = newPub;
    showToast(newPub ? '🌐 Tugas DITAMPILKAN di halaman publik siswa.' : '🔒 Tugas DISEMBUNYIKAN dari halaman publik siswa.');
    await loadAssessmentsDropdown(assId);
}

function renderAssLinkEditor(assObj) {
    const box = document.getElementById('ass-link-editor');
    const judulInput = document.getElementById('edit-ass-judul');
    const katSelect = document.getElementById('edit-ass-kategori');
    const tipeSelect = document.getElementById('edit-ass-tipe');
    const input = document.getElementById('edit-ass-link');
    const btnTest = document.getElementById('btn-test-ass-link');
    const btnToggle = document.getElementById('btn-toggle-public');

    if (!assObj) {
        box.classList.add('hidden');
        return;
    }
    box.classList.remove('hidden');

    if (judulInput) judulInput.value = assObj.judul || '';
    if (katSelect) katSelect.value = assObj.kategori || 'tugas';
    if (tipeSelect) tipeSelect.value = assObj.tipe_kerja || 'individu';
    if (input) input.value = assObj.link_pengumpulan || '';

    if (assObj.link_pengumpulan) {
        btnTest.href = assObj.link_pengumpulan;
        btnTest.classList.remove('hidden');
    } else {
        btnTest.classList.add('hidden');
    }

    const isPublic = assObj.tampil_publik !== false;
    if (btnToggle) {
        if (isPublic) {
            btnToggle.className = 'w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm text-center';
            btnToggle.innerHTML = '🌐 Ditampilkan di Siswa (Klik untuk Sembunyikan)';
        } else {
            btnToggle.className = 'w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-slate-700 text-white hover:bg-slate-800 transition shadow-sm text-center';
            btnToggle.innerHTML = '🔒 Disembunyikan dari Siswa (Klik untuk Tampilkan)';
        }
    }
}

async function deleteCurrentAssessment() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId || !confirm('Hapus penilaian beserta seluruh nilainya?')) return;
    await db.from('assessments').delete().eq('id', assId);
    showToast('Penilaian dihapus.');
    await loadAssessmentsDropdown();
}

async function loadAssessmentScores() {
    const assId = document.getElementById('active-assessment').value;
    const tbody = document.getElementById('scores-tbody');
    const tableEl = tbody ? tbody.closest('table') : null;
    const theadEl = tableEl ? tableEl.querySelector('thead') : null;

    if (!assId) {
        document.getElementById('ass-link-editor').classList.add('hidden');
        document.getElementById('group-mode-banner').classList.add('hidden');
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Silakan buat atau pilih penilaian di atas.</td></tr>';
        return;
    }

    const assObj = currentAssessments.find(a => a.id == assId);
    renderAssLinkEditor(assObj);

    const isGroup = assObj && assObj.tipe_kerja === 'kelompok';
    document.getElementById('group-mode-banner').classList.toggle('hidden', !isGroup);

    if (theadEl) {
        theadEl.innerHTML = `
            <tr class="bg-slate-100 text-slate-700">
                <th class="p-3 border-b text-left col-nisn">NISN</th>
                <th class="p-3 border-b text-left col-nama">Nama Siswa</th>
                <th id="th-kelompok" class="p-3 border-b text-left min-w-[140px] ${!isGroup ? 'hidden' : ''}">Kelompok</th>
                <th class="p-3 border-b text-center min-w-[115px]">Status Kumpul</th>
                <th class="p-3 border-b text-center min-w-[115px]">Nilai (0-100)</th>
                <th class="p-3 border-b text-left min-w-[190px]">Link Bukti Siswa</th>
            </tr>
        `;
    }

    const { data } = await db.from('scores').select('*').eq('assessment_id', assId);
    const scoreMap = {};
    let hasSavedGroupsInTask = false;
    (data || []).forEach(s => {
        scoreMap[s.student_id] = s;
        if (s.nama_kelompok && s.nama_kelompok.trim() !== '') {
            hasSavedGroupsInTask = true;
        }
    });

    updateGroupAutocompleteDatalist(data || []);

    // Jika tugas ini bertipe kelompok dan belum memiliki nama kelompok di database, otomatis gunakan daftar kelompok aktif
    const fallbackPresetMap = (isGroup && !hasSavedGroupsInTask && classGroupPresets[activePresetKey])
        ? classGroupPresets[activePresetKey]
        : {};

    tbody.innerHTML = '';
    studentsList.forEach(stu => {
        const sc = scoreMap[stu.id] || { nama_kelompok: '', status_kumpul: false, link_tugas_siswa: '', nilai: null };
        const valGroup = (sc.nama_kelompok && sc.nama_kelompok.trim() !== '')
            ? sc.nama_kelompok
            : (fallbackPresetMap[stu.id] || '');
        const valNilai = (sc.nilai !== null && sc.nilai !== undefined) ? sc.nilai : '';
        const valLink = sc.link_tugas_siswa || '';
        const safeGroup = String(valGroup).replace(/"/g, '&quot;');
        const safeLink = String(valLink).replace(/"/g, '&quot;');

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 font-mono text-xs whitespace-nowrap">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-2 ${!isGroup ? 'hidden' : ''}">
                    <input type="text" list="datalist-kelompok-options" value="${safeGroup}" placeholder="${isGroup ? 'Kelompok 1' : '-'}" 
                        ${!isGroup ? 'disabled' : ''} 
                        oninput="onStudentGroupNameInput(this)"
                        class="sc-group w-full border rounded-lg p-1.5 text-xs font-semibold text-indigo-950 bg-white">
                </td>
                <td class="p-2 text-center whitespace-nowrap">
                    <label class="inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" ${sc.status_kumpul ? 'checked' : ''} onchange="onStatusOrScoreChange(this)" class="sc-status w-4 h-4 accent-indigo-600 cursor-pointer">
                        <span class="text-xs ml-1.5 font-semibold">Sudah</span>
                    </label>
                </td>
                <td class="p-2">
                    <input type="number" step="0.1" min="0" max="100" value="${valNilai}" placeholder="-" oninput="onStatusOrScoreChange(this)" class="sc-nilai w-full border rounded-lg p-1.5 text-center font-bold">
                </td>
                <td class="p-2">
                    <div class="flex items-center gap-1">
                        <input type="url" value="${safeLink}" placeholder="https://..." oninput="onStatusOrScoreChange(this)" class="sc-link w-full border rounded-lg p-1.5 text-xs">
                        ${valLink ? `<a href="${safeLink}" target="_blank" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold shrink-0">↗</a>` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
}

function onStudentGroupNameInput(groupInputEl) {
    const tr = groupInputEl.closest('tr');
    if (!tr) return;
    const targetGroup = groupInputEl.value.trim().toLowerCase();
    if (!targetGroup) return;

    // Jika siswa ini dimasukkan ke kelompok yang anggotanya sudah punya nilai/link/status di tabel, samakan otomatis
    const rows = document.querySelectorAll('#scores-tbody tr');
    for (const row of rows) {
        if (row === tr) continue;
        const g = row.querySelector('.sc-group')?.value.trim().toLowerCase();
        if (g === targetGroup) {
            const otherNilai = row.querySelector('.sc-nilai')?.value || '';
            const otherLink = row.querySelector('.sc-link')?.value || '';
            const otherStatus = row.querySelector('.sc-status')?.checked || false;

            if (otherNilai !== '' || otherLink !== '' || otherStatus) {
                tr.querySelector('.sc-nilai').value = otherNilai;
                tr.querySelector('.sc-link').value = otherLink;
                tr.querySelector('.sc-status').checked = otherStatus;
                break;
            }
        }
    }
}

function onStatusOrScoreChange(inputEl) {
    const tr = inputEl.closest('tr');
    const nilaiInput = tr.querySelector('.sc-nilai');
    const linkInput = tr.querySelector('.sc-link');
    const statusCheck = tr.querySelector('.sc-status');

    if ((inputEl === nilaiInput && nilaiInput.value !== '') || (inputEl === linkInput && linkInput.value.trim() !== '')) {
        statusCheck.checked = true;
    }
    syncGroupRow(tr);
}

function syncGroupRow(el) {
    const tr = el.closest('tr');
    const groupName = tr.querySelector('.sc-group').value.trim().toLowerCase();
    if (!groupName) return;

    const currentNilai = tr.querySelector('.sc-nilai').value;
    const currentLink = tr.querySelector('.sc-link').value;
    const currentStatus = tr.querySelector('.sc-status').checked;

    document.querySelectorAll('#scores-tbody tr').forEach(row => {
        if (row === tr) return;
        const g = row.querySelector('.sc-group').value.trim().toLowerCase();
        if (g === groupName) {
            row.querySelector('.sc-nilai').value = currentNilai;
            row.querySelector('.sc-link').value = currentLink;
            row.querySelector('.sc-status').checked = currentStatus;
        }
    });
}

function syncAllGroupsInCurrentTable() {
    const rows = document.querySelectorAll('#scores-tbody tr');
    const masterByGroup = {};

    rows.forEach(row => {
        const g = row.querySelector('.sc-group')?.value.trim().toLowerCase();
        if (!g) return;
        const valNilai = row.querySelector('.sc-nilai')?.value || '';
        const valLink = row.querySelector('.sc-link')?.value || '';
        const valStatus = row.querySelector('.sc-status')?.checked || false;

        if (!masterByGroup[g]) {
            masterByGroup[g] = { nilai: valNilai, link: valLink, status: valStatus };
        } else {
            if (masterByGroup[g].nilai === '' && valNilai !== '') masterByGroup[g].nilai = valNilai;
            if (masterByGroup[g].link === '' && valLink !== '') masterByGroup[g].link = valLink;
            if (!masterByGroup[g].status && valStatus) masterByGroup[g].status = true;
        }
    });

    rows.forEach(row => {
        const g = row.querySelector('.sc-group')?.value.trim().toLowerCase();
        if (!g || !masterByGroup[g]) return;
        const m = masterByGroup[g];
        if (m.nilai !== '' || m.link !== '' || m.status) {
            row.querySelector('.sc-nilai').value = m.nilai;
            row.querySelector('.sc-link').value = m.link;
            row.querySelector('.sc-status').checked = m.status;
        }
    });
}

function applySelectedGroupPreset() {
    const sel = document.getElementById('select-group-preset');
    const presetKey = sel ? sel.value : activePresetKey;
    if (!presetKey || !classGroupPresets[presetKey]) {
        return showToast('Pilih daftar kelompok terlebih dahulu!', 'error');
    }

    activePresetKey = presetKey;
    const mapObj = classGroupPresets[presetKey] || {};
    const rows = document.querySelectorAll('#scores-tbody tr');
    let count = 0;

    rows.forEach(r => {
        const stuId = r.getAttribute('data-stuid');
        const gInput = r.querySelector('.sc-group');
        if (gInput && mapObj[stuId] !== undefined) {
            gInput.value = mapObj[stuId];
            if (mapObj[stuId]) count++;
        }
    });

    syncAllGroupsInCurrentTable();
    showToast(`Daftar "${presetKey}" diterapkan (${count} siswa). Klik Simpan di bawah tabel untuk menyimpan nilai!`);
}

async function saveCurrentTableAsGroupPreset() {
    const rows = document.querySelectorAll('#scores-tbody tr');
    if (!rows.length) return;

    const defaultName = (activePresetKey && !activePresetKey.startsWith('[Riwayat] '))
        ? activePresetKey
        : 'Kelompok Default';
    const nameInput = prompt('Simpan susunan kelompok di tabel ini dengan nama:', defaultName);
    if (!nameInput || !nameInput.trim()) return;

    const cleanName = nameInput.trim();
    const mapObj = {};
    let filledCount = 0;

    rows.forEach(r => {
        const stuId = r.getAttribute('data-stuid');
        const gVal = r.querySelector('.sc-group')?.value.trim() || '';
        if (stuId) {
            mapObj[stuId] = gVal;
            if (gVal) filledCount++;
        }
    });

    if (filledCount === 0) {
        return showToast('Belum ada nama kelompok yang diisi pada tabel!', 'error');
    }

    classGroupPresets[cleanName] = mapObj;
    activePresetKey = cleanName;
    await persistClassGroupPresets();
    showToast(`Daftar kelompok "${cleanName}" (${filledCount} siswa) berhasil disimpan untuk tugas-tugas berikutnya!`);
}

async function openGroupManagerModal() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId) return showToast('Pilih kelas terlebih dahulu!', 'error');

    await loadClassGroupPresets();
    populateModalPresetSelect();
    loadPresetIntoModal();
    document.getElementById('modal-group-manager').classList.remove('hidden');
}

function closeGroupManagerModal() {
    document.getElementById('modal-group-manager').classList.add('hidden');
}

function populateModalPresetSelect() {
    const sel = document.getElementById('gm-preset-select');
    if (!sel) return;
    sel.innerHTML = '';
    Object.keys(classGroupPresets).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        if (k === activePresetKey) opt.selected = true;
        sel.appendChild(opt);
    });
}

function loadPresetIntoModal() {
    const sel = document.getElementById('gm-preset-select');
    const nameInput = document.getElementById('gm-preset-name');
    const tbody = document.getElementById('gm-students-tbody');
    if (!tbody) return;

    const key = sel?.value || activePresetKey || 'Kelompok Default';
    activePresetKey = key;

    if (nameInput) {
        nameInput.value = key.replace(/^\[Riwayat\]\s*/, '');
    }

    const mapObj = classGroupPresets[key] || {};
    tbody.innerHTML = '';

    if (!studentsList.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada siswa di kelas ini.</td></tr>';
        renderModalGroupSummary();
        return;
    }

    studentsList.forEach((stu, idx) => {
        const gVal = String(mapObj[stu.id] || '').replace(/"/g, '&quot;');
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-gm-stuid="${stu.id}">
                <td class="p-2.5 text-center text-slate-500">${idx + 1}</td>
                <td class="p-2.5 font-mono text-slate-600">${stu.nisn}</td>
                <td class="p-2.5 font-semibold text-slate-800">${stu.nama}</td>
                <td class="p-2">
                    <input type="text" list="datalist-kelompok-options" value="${gVal}" placeholder="Contoh: Kelompok 1"
                        oninput="renderModalGroupSummary()"
                        class="gm-stu-group w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500">
                </td>
            </tr>
        `;
    });

    renderModalGroupSummary();
}

function renderModalGroupSummary() {
    const box = document.getElementById('gm-summary-badges');
    if (!box) return;

    const inputs = document.querySelectorAll('#gm-students-tbody .gm-stu-group');
    const counts = {};
    let emptyCount = 0;

    inputs.forEach(inp => {
        const v = inp.value.trim();
        if (v) counts[v] = (counts[v] || 0) + 1;
        else emptyCount++;
    });

    const groups = Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!groups.length) {
        box.innerHTML = `<span class="text-[11px] text-slate-500 italic">Belum ada siswa yang dikelompokkan (${emptyCount} siswa belum memiliki kelompok).</span>`;
        return;
    }

    let html = groups.map(g => `
        <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
            ${g}: ${counts[g]} siswa
        </span>
    `).join('');

    if (emptyCount > 0) {
        html += `
            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                Belum dikelompokkan: ${emptyCount} siswa
            </span>
        `;
    }
    box.innerHTML = html;
}

function createNewGroupPreset() {
    const newName = prompt('Masukkan nama Daftar Kelompok baru (Contoh: Kelompok Praktikum / Kelompok Diskusi):');
    if (!newName || !newName.trim()) return;
    const clean = newName.trim();
    if (!classGroupPresets[clean]) {
        classGroupPresets[clean] = {};
    }
    activePresetKey = clean;
    populateModalPresetSelect();
    loadPresetIntoModal();
}

async function deleteCurrentGroupPreset() {
    const sel = document.getElementById('gm-preset-select');
    const key = sel?.value;
    if (!key) return;

    if (Object.keys(classGroupPresets).length <= 1) {
        return showToast('Minimal harus ada 1 daftar kelompok. Gunakan tombol Kosongkan jika ingin mereset.', 'error');
    }
    if (!confirm(`Hapus daftar kelompok "${key}"?`)) return;

    delete classGroupPresets[key];
    activePresetKey = Object.keys(classGroupPresets)[0] || 'Kelompok Default';
    await persistClassGroupPresets();
    populateModalPresetSelect();
    loadPresetIntoModal();
    showToast(`Daftar kelompok "${key}" dihapus.`);
}

function autoGenerateGroups(mode = 'random') {
    const countInput = document.getElementById('gm-auto-count');
    const numGroups = Math.max(2, parseInt(countInput?.value || 5, 10));
    const rows = Array.from(document.querySelectorAll('#gm-students-tbody tr[data-gm-stuid]'));
    if (!rows.length) return;

    const indices = rows.map((_, i) => i);
    if (mode === 'random') {
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
    }

    indices.forEach((rowIdx, pos) => {
        const groupNum = (pos % numGroups) + 1;
        const inp = rows[rowIdx].querySelector('.gm-stu-group');
        if (inp) inp.value = `Kelompok ${groupNum}`;
    });

    renderModalGroupSummary();
}

function clearAllModalGroups() {
    document.querySelectorAll('#gm-students-tbody .gm-stu-group').forEach(inp => {
        inp.value = '';
    });
    renderModalGroupSummary();
}

async function saveGroupPresetFromModal(applyNow = false) {
    const nameInput = document.getElementById('gm-preset-name');
    const presetName = (nameInput?.value || '').trim() || 'Kelompok Default';
    const rows = document.querySelectorAll('#gm-students-tbody tr[data-gm-stuid]');
    const mapObj = {};

    rows.forEach(r => {
        const stuId = r.getAttribute('data-gm-stuid');
        const gVal = r.querySelector('.gm-stu-group')?.value.trim() || '';
        if (stuId) mapObj[stuId] = gVal;
    });

    classGroupPresets[presetName] = mapObj;
    activePresetKey = presetName;
    await persistClassGroupPresets();
    populateModalPresetSelect();

    if (applyNow) {
        const assId = document.getElementById('active-assessment')?.value;
        const assObj = currentAssessments.find(a => a.id == assId);
        if (assObj && assObj.tipe_kerja === 'kelompok') {
            const selPreset = document.getElementById('select-group-preset');
            if (selPreset) selPreset.value = presetName;
            applySelectedGroupPreset();
        } else {
            showToast(`Daftar "${presetName}" disimpan! Pilih tugas bertipe Berkelompok untuk menerapkannya.`);
        }
        closeGroupManagerModal();
    } else {
        showToast(`Daftar kelompok "${presetName}" berhasil disimpan!`);
    }
}

async function saveAssessmentScores() {
    const assId = Number(document.getElementById('active-assessment').value);
    if (!assId) return;

    const assObj = currentAssessments.find(a => a.id == assId);
    const isGroup = assObj && assObj.tipe_kerja === 'kelompok';

    const rows = document.querySelectorAll('#scores-tbody tr');
    const upserts = [];
    const currentGroupMap = {};
    let hasGroupFilled = false;

    rows.forEach(r => {
        const student_id = Number(r.getAttribute('data-stuid'));
        const nama_kelompok = r.querySelector('.sc-group').value.trim();
        const link_tugas_siswa = r.querySelector('.sc-link').value.trim();
        const nilaiRaw = r.querySelector('.sc-nilai').value;
        const nilai = nilaiRaw === '' ? null : Number(nilaiRaw);
        const status_kumpul = (nilai !== null || link_tugas_siswa !== '') ? true : r.querySelector('.sc-status').checked;

        if (isGroup && nama_kelompok) {
            currentGroupMap[student_id] = nama_kelompok;
            hasGroupFilled = true;
        }

        upserts.push({ assessment_id: assId, student_id, nama_kelompok, link_tugas_siswa, status_kumpul, nilai });
    });

    if (upserts.length) {
        await db.from('scores').upsert(upserts, { onConflict: 'assessment_id,student_id' });
    }

    // Jika tugas kelompok disimpan dan "Kelompok Default" masih kosong, otomatis simpan sebagai Kelompok Default
    if (isGroup && hasGroupFilled) {
        if (!classGroupPresets['Kelompok Default'] || Object.keys(classGroupPresets['Kelompok Default']).length === 0) {
            classGroupPresets['Kelompok Default'] = currentGroupMap;
            await persistClassGroupPresets();
        }
    }

    showToast('Nilai & Status pengumpulan disimpan!');
    await loadAssessmentScores();
}
3. Opsional: 1 Baris SQL di Supabase (Agar Preset Kelompok Tersinkronisasi Antar-Perangkat)
Tanpa menjalankan SQL apa pun, fitur di atas sudah langsung berjalan penuh karena sistem secara otomatis memindai riwayat kelompok dari tabel scores di Supabase dan menyimpannya juga di localStorage. Namun jika Anda ingin semua preset kelompok tersimpan permanen di tabel teacher_settings Supabase saat berganti HP/laptop, jalankan perintah singkat ini di SQL Editor Supabase:   
andiwahidin/sipantau-belajar

SQL
ALTER TABLE teacher_settings ADD COLUMN IF NOT EXISTS kelompok_template JSONB DEFAULT '{}'::jsonb;
tampilannya berubah bermasalah

File index.html, app-guru.js, dan paket .zip lengkap siap diunduh dan langsung digunakan untuk menggantikan file di GitHub Anda:

HTML icon
index
 HTML 
JS icon
app-guru
 JS 
ZIP icon
sipantau-belajar-revisi-utuh
 ZIP 
Penyebab Tampilan Rusak pada Screenshot
Pada tangkapan layar terlihat halaman web langsung dimulai dari tulisan "Buat Daftar Tugas / Ujian Baru pada Mata Pelajaran Ini" tanpa warna/desain (Tailwind CSS), tanpa bilah navigasi atas, dan tanpa halaman Login.   
image_b5c52c.png

Hal tersebut terjadi karena potongan kode Tab 4 pada jawaban sebelumnya ditempelkan menggantikan seluruh isi file index.html (dan app-guru.js), sehingga baris <!DOCTYPE html>, <head>, pemanggil CSS Tailwind, halaman Login, Admin, serta Tab 1, 2, 3, dan 5 ikut terhapus.   
andiwahidin/sipantau-belajar
+ 1

Cara Memperbaiki dengan Cepat (Langsung Ganti Utuh)
Karena ukuran kode utuh index.html (933 baris) dan app-guru.js (2.097 baris) mencapai lebih dari 169 KB, saya menyediakannya dalam bentuk file utuh di atas agar tidak terpotong oleh batas karakter chat:

Unduh File di Atas:

Klik dan unduh index.html (71 KB — utuh dari <!DOCTYPE html> sampai </html>) serta app-guru.js (98 KB — utuh dari baris 1 sampai baris terakhir).

Atau unduh sipantau-belajar-revisi-utuh.zip yang sudah berisi keenam file proyek Anda secara lengkap (index.html, app-guru.js, siswa.html, app-siswa.js, config.js, style.css).   
andiwahidin/sipantau-belajar

Ganti di GitHub (andiwahidin/sipantau-belajar):

Cara Paling Mudah (Upload Langsung): Buka repositori GitHub Anda 
→ klik tombol Add file 
→ pilih Upload files 
→ tarik/masukkan file index.html dan app-guru.js yang baru diunduh 
→ klik Commit changes.   
andiwahidin/sipantau-belajar
+ 1

Cara Copy-Paste Utuh: Buka file index.html dan app-guru.js hasil unduhan menggunakan Notepad atau VS Code 
→ tekan Ctrl + A lalu Ctrl + C 
→ tempelkan (Ctrl + V) menggantikan seluruh isi file yang ada di editor GitHub 
→ klik Commit changes.

Refresh Halaman Web:

Tunggu sekitar 30–60 detik hingga GitHub Pages selesai memproses perubahan, lalu buka kembali [https://andiwahidin.github.io/sipantau-belajar/](https://andiwahidin.github.io/sipantau-belajar/) dan tekan Ctrl + Shift + R (Hard Refresh).   
image_b5c52c.png





Gemini is AI and can make mistakes.

Checking for complete HTML file structure
// ============================================================================
// FILE: app-guru.js (v3.8 - Auto-Sync Header & Body Tabel Nilai)
// ============================================================================

let currentUser = null;
let classesList = [];
let teacherAmpuanList = [];
let studentsList = [];
let currentSettings = null;
let currentAssessments = [];
let latestRekapData = [];

let isCurrentClassLockedForGuru = false;
let otherTeachersInCurrentClass = [];
let selectedStudentIds = new Set();
let pendingDeleteStudentIds = [];

function getLocalTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

window.onload = async () => {
    const dp = document.getElementById('abs-date-picker');
    if (dp) dp.value = getLocalTodayString();

    const savedUser = localStorage.getItem('sipantau_user');
    if (savedUser) {
        currentUser = JSON.parse(savedUser);
        updateAuthUI();
    }
};

function switchView(view) {
    ['login', 'admin', 'guru'].forEach(v => {
        document.getElementById('view-' + v).classList.add('hidden');
    });
    document.getElementById('view-' + view).classList.remove('hidden');
}

// ============================================================================
// 1. AUTENTIKASI, UBAH PASSWORD & PANEL ADMIN
// ============================================================================
async function handleLogin(e) {
    e.preventDefault();
    const u = document.getElementById('login-user').value.trim();
    const p = document.getElementById('login-pass').value.trim();

    const { data, error } = await db.from('app_users')
        .select('*')
        .eq('username', u)
        .eq('password', p)
        .single();

    if (error || !data) {
        showToast('Username atau Password salah!', 'error');
        return;
    }

    currentUser = data;
    localStorage.setItem('sipantau_user', JSON.stringify(data));
    showToast(`Selamat datang, ${data.nama_lengkap}!`);
    updateAuthUI();
}

function updateAuthUI() {
    if (!currentUser) return;
    const badge = document.getElementById('user-badge');
    badge.classList.remove('hidden');
    badge.classList.add('flex');
    document.getElementById('user-display-name').innerText = `${currentUser.nama_lengkap} (${currentUser.role.toUpperCase()})`;

    const adminSwitcher = document.getElementById('admin-nav-switcher');
    if (currentUser.role === 'admin') {
        adminSwitcher.classList.remove('hidden');
        adminSwitcher.classList.add('grid');
        switchAdminMode('teachers');
    } else {
        adminSwitcher.classList.add('hidden');
        adminSwitcher.classList.remove('grid');
        document.getElementById('guru-only-header').classList.remove('hidden');
        document.getElementById('admin-student-mode-banner').classList.add('hidden');
        document.getElementById('teacher-ampuan-cards').classList.remove('hidden');
        document.getElementById('guru-mapel-selector-box').classList.remove('hidden');
        document.getElementById('guru-tabs-nav').classList.remove('hidden');
        document.getElementById('active-workspace-banner').classList.remove('hidden');
        switchView('guru');
        initGuruDashboard();
    }
}

async function switchAdminMode(mode) {
    if (!currentUser || currentUser.role !== 'admin') return;
    const btnTch = document.getElementById('adm-tab-teachers');
    const btnStu = document.getElementById('adm-tab-students');

    if (mode === 'teachers') {
        btnTch.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold bg-indigo-600 text-white transition text-center';
        btnStu.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold text-slate-600 hover:text-slate-900 transition text-center';
        switchView('admin');
        await loadAdminUsers();
    } else {
        btnStu.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold bg-indigo-600 text-white transition text-center';
        btnTch.className = 'px-3 py-1.5 rounded-lg text-xs font-extrabold text-slate-600 hover:text-slate-900 transition text-center';
        
        switchView('guru');
        document.getElementById('guru-only-header').classList.add('hidden');
        document.getElementById('admin-student-mode-banner').classList.remove('hidden');
        document.getElementById('teacher-ampuan-cards').classList.add('hidden');
        document.getElementById('guru-mapel-selector-box').classList.add('hidden');
        document.getElementById('guru-tabs-nav').classList.add('hidden');
        document.getElementById('active-workspace-banner').classList.add('hidden');

        switchGuruTab('kelas');
        const { data: cls } = await db.from('classes').select('*').order('nama_kelas');
        classesList = cls || [];
        const selClass = document.getElementById('guru-active-class');
        selClass.innerHTML = classesList.length ? '' : '<option value="">-- Belum Ada Kelas --</option>';
        classesList.forEach(c => {
            selClass.innerHTML += `<option value="${c.id}">${c.nama_kelas}</option>`;
        });

        if (classesList.length) {
            await fetchStudentsByClass(selClass.value);
        } else {
            document.getElementById('stu-tbody').innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada kelas.</td></tr>';
        }
    }
}

function logout() {
    localStorage.removeItem('sipantau_user');
    currentUser = null;
    document.getElementById('user-badge').classList.add('hidden');
    document.getElementById('admin-nav-switcher').classList.add('hidden');
    switchView('login');
}

function openPasswordModal() {
    document.getElementById('cp-old').value = '';
    document.getElementById('cp-new').value = '';
    document.getElementById('cp-confirm').value = '';
    document.getElementById('modal-password').classList.remove('hidden');
}

function closePasswordModal() {
    document.getElementById('modal-password').classList.add('hidden');
}

async function handleChangePassword(e) {
    e.preventDefault();
    const oldPass = document.getElementById('cp-old').value.trim();
    const newPass = document.getElementById('cp-new').value.trim();
    const confirmPass = document.getElementById('cp-confirm').value.trim();

    if (newPass !== confirmPass) {
        return showToast('Konfirmasi password baru tidak cocok!', 'error');
    }

    const { data: verify } = await db.from('app_users')
        .select('id')
        .eq('id', currentUser.id)
        .eq('password', oldPass)
        .single();

    if (!verify) return showToast('Password saat ini salah!', 'error');

    const { error } = await db.from('app_users')
        .update({ password: newPass })
        .eq('id', currentUser.id);

    if (error) return showToast('Gagal mengubah password: ' + error.message, 'error');

    currentUser.password = newPass;
    localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
    closePasswordModal();
    showToast('Password Anda berhasil diperbarui!');
}

async function loadAdminUsers() {
    const { data } = await db.from('app_users')
        .select('id, nama_lengkap, username, role')
        .order('id');

    const tbody = document.getElementById('adm-user-list');
    tbody.innerHTML = '';
    (data || []).forEach(u => {
        const safeNama = u.nama_lengkap.replace(/'/g, "\\'");
        const safeUser = u.username.replace(/'/g, "\\'");
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-semibold text-slate-800">${u.nama_lengkap}</td>
                <td class="p-3 font-mono text-indigo-700 font-bold">${u.username}</td>
                <td class="p-3">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 whitespace-nowrap">
                        🔒 Terlindungi
                    </span>
                </td>
                <td class="p-3 uppercase text-xs font-extrabold text-slate-500">${u.role}</td>
                <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="openEditTeacherModal(${u.id}, '${safeNama}', '${safeUser}')" class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100">
                        ✏️ Edit
                    </button>
                    ${u.role !== 'admin' ? `
                        <button onclick="resetTeacherPassword(${u.id}, '${safeUser}')" class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold hover:bg-amber-100">
                            🔄 Reset
                        </button>
                        <button onclick="deleteUser(${u.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100">
                            🗑️ Hapus
                        </button>
                    ` : '<span class="text-xs text-slate-400 ml-2">Utama</span>'}
                </td>
            </tr>
        `;
    });
}

function openEditTeacherModal(id, nama, username) {
    document.getElementById('edit-tch-id').value = id;
    document.getElementById('edit-tch-nama').value = nama;
    document.getElementById('edit-tch-user').value = username;
    document.getElementById('modal-edit-teacher').classList.remove('hidden');
}

function closeEditTeacherModal() {
    document.getElementById('modal-edit-teacher').classList.add('hidden');
}

async function handleUpdateTeacher(e) {
    e.preventDefault();
    const id = Number(document.getElementById('edit-tch-id').value);
    const nama_lengkap = document.getElementById('edit-tch-nama').value.trim();
    const username = document.getElementById('edit-tch-user').value.trim();

    if (!nama_lengkap || !username) return;

    const { error } = await db.from('app_users')
        .update({ nama_lengkap, username })
        .eq('id', id);

    if (error) {
        return showToast('Gagal memperbarui guru (Username mungkin sudah digunakan): ' + error.message, 'error');
    }

    if (currentUser && currentUser.id === id) {
        currentUser.nama_lengkap = nama_lengkap;
        currentUser.username = username;
        localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
        document.getElementById('user-display-name').innerText = `${currentUser.nama_lengkap} (${currentUser.role.toUpperCase()})`;
    }

    closeEditTeacherModal();
    showToast(`Data akun ${nama_lengkap} (${username}) berhasil diperbarui!`);
    await loadAdminUsers();
}

async function addTeacher(e) {
    e.preventDefault();
    const nama_lengkap = document.getElementById('adm-nama').value.trim();
    const username = document.getElementById('adm-user').value.trim();
    const password = username;

    const { error } = await db.from('app_users').insert([{ nama_lengkap, username, password, role: 'guru' }]);
    if (error) return showToast('Gagal menambah guru: ' + error.message, 'error');

    e.target.reset();
    showToast(`Akun ${nama_lengkap} dibuat! Password awal: ${username}`);
    loadAdminUsers();
}

async function resetTeacherPassword(id, username) {
    if (!confirm(`Reset password guru ini kembali menjadi sama dengan username (${username})?`)) return;
    await db.from('app_users').update({ password: username }).eq('id', id);
    showToast(`Password direset menjadi: ${username}`);
}

async function deleteUser(id) {
    if (!confirm('Hapus akun guru ini beserta seluruh data penilaiannya?')) return;
    await db.from('app_users').delete().eq('id', id);
    showToast('Akun guru dihapus.');
    loadAdminUsers();
}

// ============================================================================
// 2. MANAJEMEN KELAS & MATA PELAJARAN YANG DIAMPU GURU
// ============================================================================
function switchGuruTab(tab) {
    ['kelas', 'bobot', 'absen', 'nilai', 'rekap'].forEach(t => {
        document.getElementById('gcontent-' + t).classList.add('hidden');
        const btn = document.getElementById('gtab-' + t);
        if (btn) {
            const spanClass = t === 'rekap' ? 'col-span-2 sm:col-span-1 ' : '';
            btn.className = `${spanClass}px-3 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition text-center`;
        }
    });
    document.getElementById('gcontent-' + tab).classList.remove('hidden');
    const activeBtn = document.getElementById('gtab-' + tab);
    if (activeBtn) {
        const spanClass = tab === 'rekap' ? 'col-span-2 sm:col-span-1 ' : '';
        activeBtn.className = `${spanClass}px-3 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-sm transition text-center`;
    }

    if (tab === 'bobot') loadSettingsForm();
    if (tab === 'absen') loadAttendanceTab();
    if (tab === 'nilai') loadAssessmentsDropdown();
    if (tab === 'rekap') calculateAndRenderRekap();
}

async function initGuruDashboard() {
    switchGuruTab('kelas');
    await fetchClassesAndAmpuan();
}

async function fetchClassesAndAmpuan(preferredSettingId = null) {
    const { data: cls } = await db.from('classes').select('*').order('nama_kelas');
    classesList = cls || [];

    const { data: amp } = await db.from('teacher_settings')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .order('id');
    teacherAmpuanList = amp || [];

    const selClass = document.getElementById('guru-active-class');
    selClass.innerHTML = classesList.length ? '' : '<option value="">-- Belum Ada Kelas --</option>';
    classesList.forEach(c => {
        selClass.innerHTML += `<option value="${c.id}">${c.nama_kelas}</option>`;
    });

    if (!classesList.length) {
        renderAmpuanCards();
        updateWorkspaceBanner();
        document.getElementById('stu-tbody').innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Silakan buat kelas terlebih dahulu.</td></tr>';
        return;
    }

    let targetSetting = null;
    if (preferredSettingId) {
        targetSetting = teacherAmpuanList.find(a => a.id == preferredSettingId);
    }
    if (!targetSetting && currentSettings) {
        targetSetting = teacherAmpuanList.find(a => a.id == currentSettings.id);
    }
    if (!targetSetting && teacherAmpuanList.length > 0) {
        targetSetting = teacherAmpuanList[0];
    }

    if (targetSetting) {
        selClass.value = targetSetting.class_id;
        await populateMapelDropdownForClass(targetSetting.class_id, targetSetting.id);
    } else {
        const firstClassId = classesList[0].id;
        selClass.value = firstClassId;
        await populateMapelDropdownForClass(firstClassId);
    }
}

async function populateMapelDropdownForClass(classId, selectedSettingId = null) {
    if (currentUser.role === 'admin') {
        await fetchStudentsByClass(classId);
        return;
    }

    const selMapel = document.getElementById('guru-active-mapel');
    let mapelsInClass = teacherAmpuanList.filter(a => a.class_id == classId);

    if (teacherAmpuanList.length === 0 && classId) {
        const { data: created } = await db.from('teacher_settings')
            .insert([{ teacher_id: currentUser.id, class_id: Number(classId), mapel: 'Mata Pelajaran' }])
            .select().single();
        if (created) {
            teacherAmpuanList.push(created);
            mapelsInClass = [created];
        }
    }

    selMapel.innerHTML = '';
    if (mapelsInClass.length === 0) {
        selMapel.innerHTML = `<option value="">-- Belum Diampu (+ Tambah) --</option>`;
        currentSettings = null;
    } else {
        mapelsInClass.forEach(m => {
            selMapel.innerHTML += `<option value="${m.id}">${m.mapel}</option>`;
        });
        if (selectedSettingId && mapelsInClass.some(m => m.id == selectedSettingId)) {
            selMapel.value = selectedSettingId;
        } else {
            selMapel.value = mapelsInClass[0].id;
        }
        currentSettings = teacherAmpuanList.find(a => a.id == selMapel.value) || null;
    }

    renderAmpuanCards();
    updateWorkspaceBanner();

    await fetchStudentsByClass(classId);
    refreshActiveGuruTab();
}

function renderAmpuanCards() {
    const container = document.getElementById('teacher-ampuan-cards');
    if (!container) return;

    if (!teacherAmpuanList.length) {
        container.innerHTML = `<span class="text-xs text-slate-400 italic">Belum ada kelas & mata pelajaran yang ditambahkan.</span>`;
        return;
    }

    container.innerHTML = '';
    teacherAmpuanList.forEach(amp => {
        const clsObj = classesList.find(c => c.id == amp.class_id);
        if (!clsObj) return;
        const isActive = currentSettings && currentSettings.id == amp.id;

        container.innerHTML += `
            <button onclick="selectAmpuanCard(${amp.id})" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isActive 
                ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50 hover:border-indigo-200'
            }">
                <span>🏫 ${clsObj.nama_kelas}</span>
                <span class="${isActive ? 'text-indigo-200' : 'text-slate-300'}">•</span>
                <span>📘 ${amp.mapel}</span>
            </button>
        `;
    });
}

function updateWorkspaceBanner() {
    const label = document.getElementById('workspace-label');
    const kkmLabel = document.getElementById('workspace-kkm-label');
    if (!currentSettings) {
        label.innerText = 'Kelas Ini Belum Anda Ampu (Klik "+ Tambah Mapel")';
        kkmLabel.innerText = 'KKM: -';
        return;
    }
    const clsObj = classesList.find(c => c.id == currentSettings.class_id);
    const namaKelas = clsObj ? clsObj.nama_kelas : '-';
    label.innerText = `Kelas ${namaKelas} — ${currentSettings.mapel}`;
    kkmLabel.innerText = `KKM: ${currentSettings.kkm}`;
}

async function selectAmpuanCard(settingId) {
    const target = teacherAmpuanList.find(a => a.id == settingId);
    if (!target) return;
    document.getElementById('guru-active-class').value = target.class_id;
    await populateMapelDropdownForClass(target.class_id, target.id);
}

async function onGuruClassDropdownChange() {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId) return;
    await populateMapelDropdownForClass(classId);
}

async function onGuruMapelDropdownChange() {
    const settingId = document.getElementById('guru-active-mapel').value;
    currentSettings = teacherAmpuanList.find(a => a.id == settingId) || null;
    renderAmpuanCards();
    updateWorkspaceBanner();
    refreshActiveGuruTab();
}

function refreshActiveGuruTab() {
    const activeTab = ['kelas', 'bobot', 'absen', 'nilai', 'rekap'].find(t => !document.getElementById('gcontent-' + t).classList.contains('hidden'));
    if (activeTab) switchGuruTab(activeTab);
}

function openAddAmpuanModal() {
    if (!classesList.length) {
        return showToast('Buat master kelas terlebih dahulu di Tab 1!', 'error');
    }
    const sel = document.getElementById('amp-kelas');
    sel.innerHTML = '';
    const activeClassId = document.getElementById('guru-active-class').value;
    classesList.forEach(c => {
        sel.innerHTML += `<option value="${c.id}" ${c.id == activeClassId ? 'selected' : ''}>${c.nama_kelas}</option>`;
    });
    document.getElementById('amp-mapel').value = '';
    document.getElementById('amp-kkm').value = '75';
    document.getElementById('modal-add-ampuan').classList.remove('hidden');
}

function closeAddAmpuanModal() {
    document.getElementById('modal-add-ampuan').classList.add('hidden');
}

async function handleAddAmpuan(e) {
    e.preventDefault();
    const class_id = Number(document.getElementById('amp-kelas').value);
    const mapel = document.getElementById('amp-mapel').value.trim();
    const kkm = Number(document.getElementById('amp-kkm').value) || 75;

    const { data, error } = await db.from('teacher_settings')
        .insert([{ teacher_id: currentUser.id, class_id, mapel, kkm }])
        .select().single();

    if (error) {
        return showToast('Mata pelajaran tersebut sudah ada di kelas ini!', 'error');
    }

    closeAddAmpuanModal();
    showToast(`Mata pelajaran ${mapel} berhasil ditambahkan!`);
    await fetchClassesAndAmpuan(data.id);
}

async function deleteCurrentAmpuan() {
    if (!currentSettings) return;
    if (teacherAmpuanList.length <= 1) {
        return showToast('Minimal harus ada 1 Kelas & Mata Pelajaran yang diampu!', 'error');
    }
    const clsObj = classesList.find(c => c.id == currentSettings.class_id);
    if (!confirm(`Hapus mata pelajaran "${currentSettings.mapel}" di kelas "${clsObj?.nama_kelas || ''}" dari daftar ampuan Anda?`)) return;

    await db.from('teacher_settings').delete().eq('id', currentSettings.id);
    currentSettings = null;
    showToast('Mata pelajaran ampuan dihapus.');
    await fetchClassesAndAmpuan();
}

function copyStudentPortalLink() {
    const classId = document.getElementById('guru-active-class').value;
    const mapel = currentSettings ? encodeURIComponent(currentSettings.mapel) : '';
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const url = `${baseUrl}siswa.html?kelas=${classId}&guru=${currentUser.id}&mapel=${mapel}`;
    navigator.clipboard.writeText(url);
    showToast('Link Halaman Siswa berhasil disalin!');
}

// ============================================================================
// 3. DETEKSI KELAS BERSAMA, PILIH BANYAK SISWA & KONFIRMASI 2X HAPUS (TAB 1)
// ============================================================================
async function checkSharedClassPermission(classId) {
    isCurrentClassLockedForGuru = false;
    otherTeachersInCurrentClass = [];

    if (!classId || !currentUser) return;

    if (currentUser.role === 'admin') {
        document.getElementById('shared-class-lock-banner').classList.add('hidden');
        return;
    }

    const { data: settingsOther } = await db.from('teacher_settings')
        .select('teacher_id, mapel')
        .eq('class_id', classId)
        .neq('teacher_id', currentUser.id);

    const { data: assOther } = await db.from('assessments')
        .select('teacher_id, mapel')
        .eq('class_id', classId)
        .neq('teacher_id', currentUser.id);

    const otherTeacherIds = [...new Set([
        ...(settingsOther || []).map(s => s.teacher_id),
        ...(assOther || []).map(a => a.teacher_id)
    ])];

    if (otherTeacherIds.length > 0) {
        isCurrentClassLockedForGuru = true;
        const { data: tchUsers } = await db.from('app_users')
            .select('id, nama_lengkap')
            .in('id', otherTeacherIds);

        otherTeachersInCurrentClass = (tchUsers || []).map(u => u.nama_lengkap);
        const banner = document.getElementById('shared-class-lock-banner');
        const info = document.getElementById('shared-class-teachers-info');
        banner.classList.remove('hidden');
        info.innerHTML = `Kelas ini juga diampu oleh: <b>${otherTeachersInCurrentClass.join(', ')}</b>.`;
    } else {
        document.getElementById('shared-class-lock-banner').classList.add('hidden');
    }
}

async function createClass(e) {
    e.preventDefault();
    const nama_kelas = document.getElementById('new-class-name').value.trim();
    const { data, error } = await db.from('classes').insert([{ nama_kelas }]).select().single();
    if (error) return showToast('Kelas sudah ada atau gagal dibuat!', 'error');
    document.getElementById('new-class-name').value = '';
    showToast(`Kelas ${nama_kelas} berhasil dibuat!`);

    if (currentUser.role === 'admin') {
        await switchAdminMode('students');
        document.getElementById('guru-active-class').value = data.id;
        await fetchStudentsByClass(data.id);
    } else {
        await fetchClassesAndAmpuan();
        document.getElementById('guru-active-class').value = data.id;
        await populateMapelDropdownForClass(data.id);
    }
}

async function fetchStudentsByClass(classId) {
    selectedStudentIds.clear();
    await checkSharedClassPermission(classId);

    const { data } = await db.from('students').select('*').eq('class_id', classId).order('nama');
    studentsList = data || [];
    document.getElementById('stu-count-badge').innerText = `${studentsList.length} Siswa`;

    updateBulkDeleteToolbarUI();

    const tbody = document.getElementById('stu-tbody');
    tbody.innerHTML = '';
    if (!studentsList.length) {
        tbody.innerHTML = '<tr><td colspan="5" class="p-6 text-center text-slate-400">Belum ada siswa di kelas ini.</td></tr>';
        return;
    }

    studentsList.forEach((s, idx) => {
        const isChecked = selectedStudentIds.has(s.id);
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-3 text-center">
                    <input type="checkbox" value="${s.id}" 
                        ${isChecked ? 'checked' : ''} 
                        ${isCurrentClassLockedForGuru ? 'disabled title="Dikunci karena kelas diampu bersama guru lain"' : ''}
                        onchange="onStudentCheckboxChange(${s.id}, this.checked)"
                        class="stu-row-check w-4 h-4 accent-indigo-600 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
                </td>
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono font-semibold text-slate-700 whitespace-nowrap">${s.nisn}</td>
                <td class="p-3 font-semibold text-slate-900">${s.nama}</td>
                <td class="p-3 text-center space-x-1.5 whitespace-nowrap">
                    ${isCurrentClassLockedForGuru ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-bold">
                            🔒 Hanya Admin
                        </span>
                    ` : `
                        <button onclick="openEditStudentModal(${s.id})" class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100">
                            ✏️ Edit
                        </button>
                        <button onclick="initiateSingleStudentDelete(${s.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100">
                            🗑️ Hapus
                        </button>
                    `}
                </td>
            </tr>
        `;
    });
}

function onStudentCheckboxChange(studentId, checked) {
    if (isCurrentClassLockedForGuru) return;
    if (checked) {
        selectedStudentIds.add(studentId);
    } else {
        selectedStudentIds.delete(studentId);
    }
    updateBulkDeleteToolbarUI();
}

function toggleSelectAllStudents(checked) {
    if (isCurrentClassLockedForGuru) {
        showToast('Kelas ini diampu bersama guru lain. Hanya Admin yang dapat menghapus siswa!', 'error');
        return;
    }
    selectedStudentIds.clear();
    if (checked) {
        studentsList.forEach(s => selectedStudentIds.add(s.id));
    }
    document.querySelectorAll('.stu-row-check').forEach(cb => {
        cb.checked = checked;
    });
    updateBulkDeleteToolbarUI();
}

function updateBulkDeleteToolbarUI() {
    const count = selectedStudentIds.size;
    const total = studentsList.length;
    const allSelected = total > 0 && count === total;

    const topCheck = document.getElementById('stu-select-all-top');
    const thCheck = document.getElementById('stu-select-all-th');
    const btnSelected = document.getElementById('btn-bulk-delete-selected');
    const btnAll = document.getElementById('btn-bulk-delete-all');

    if (topCheck) {
        topCheck.checked = allSelected;
        topCheck.disabled = isCurrentClassLockedForGuru || total === 0;
    }
    if (thCheck) {
        thCheck.checked = allSelected;
        thCheck.disabled = isCurrentClassLockedForGuru || total === 0;
    }

    document.getElementById('selected-students-badge').innerText = `${count} dipilih`;
    document.getElementById('btn-selected-count').innerText = count;

    if (btnSelected) {
        btnSelected.disabled = isCurrentClassLockedForGuru || count === 0;
    }
    if (btnAll) {
        btnAll.disabled = isCurrentClassLockedForGuru || total === 0;
    }
}

function initiateSingleStudentDelete(studentId) {
    if (isCurrentClassLockedForGuru) {
        return showToast('Akses ditolak: Hanya Admin yang dapat menghapus siswa di kelas bersama!', 'error');
    }
    const stu = studentsList.find(s => s.id === studentId);
    if (!stu) return;
    openDoubleConfirmDeleteModal([stu]);
}

function initiateBulkDeleteSelected() {
    if (isCurrentClassLockedForGuru) {
        return showToast('Akses ditolak: Hanya Admin yang dapat menghapus siswa di kelas bersama!', 'error');
    }
    const selectedList = studentsList.filter(s => selectedStudentIds.has(s.id));
    if (!selectedList.length) return showToast('Pilih minimal 1 siswa terlebih dahulu!', 'error');
    openDoubleConfirmDeleteModal(selectedList);
}

function initiateDeleteAllInClass() {
    if (isCurrentClassLockedForGuru) {
        return showToast('Akses ditolak: Hanya Admin yang dapat menghapus siswa di kelas bersama!', 'error');
    }
    if (!studentsList.length) return showToast('Tidak ada siswa di kelas ini!', 'error');
    openDoubleConfirmDeleteModal([...studentsList], true);
}

function openDoubleConfirmDeleteModal(targetStudents, isFullClass = false) {
    pendingDeleteStudentIds = targetStudents.map(s => s.id);
    const classId = document.getElementById('guru-active-class').value;
    const clsObj = classesList.find(c => c.id == classId);
    const namaKelas = clsObj ? clsObj.nama_kelas : '-';

    document.getElementById('del-step-1').classList.remove('hidden');
    document.getElementById('del-step-2').classList.add('hidden');

    const desc1 = isFullClass
        ? `Anda memilih untuk menghapus SELURUH SISWA (${targetStudents.length} orang) di Kelas ${namaKelas}:`
        : `Anda akan menghapus ${targetStudents.length} siswa dari Kelas ${namaKelas}:`;
    document.getElementById('del-step1-desc').innerText = desc1;

    const previewBox = document.getElementById('del-names-preview');
    previewBox.innerHTML = targetStudents.map((s, idx) => `<div>${idx + 1}. [${s.nisn}] ${s.nama}</div>`).join('');

    document.getElementById('del-step2-desc').innerText = 
        `KONFIRMASI KE-2 (TERAKHIR): Sebanyak ${targetStudents.length} data siswa di Kelas ${namaKelas} akan dihapus secara permanen sekarang.`;

    const finalCheck = document.getElementById('del-final-check');
    finalCheck.checked = false;
    document.getElementById('btn-execute-delete').disabled = true;

    document.getElementById('modal-delete-confirm').classList.remove('hidden');
}

function proceedToDeleteStep2() {
    document.getElementById('del-step-1').classList.add('hidden');
    document.getElementById('del-step-2').classList.remove('hidden');
}

function toggleFinalDeleteButton() {
    const checked = document.getElementById('del-final-check').checked;
    document.getElementById('btn-execute-delete').disabled = !checked;
}

function closeDeleteConfirmModal() {
    pendingDeleteStudentIds = [];
    document.getElementById('modal-delete-confirm').classList.add('hidden');
}

async function executeConfirmedStudentDelete() {
    if (!pendingDeleteStudentIds.length) return;
    if (isCurrentClassLockedForGuru && currentUser.role !== 'admin') {
        closeDeleteConfirmModal();
        return showToast('Akses ditolak: Hanya Admin yang dapat menghapus siswa di kelas bersama!', 'error');
    }

    const { error } = await db.from('students')
        .delete()
        .in('id', pendingDeleteStudentIds);

    if (error) {
        return showToast('Gagal menghapus siswa: ' + error.message, 'error');
    }

    const deletedCount = pendingDeleteStudentIds.length;
    closeDeleteConfirmModal();
    showToast(`${deletedCount} data siswa berhasil dihapus secara permanen.`);
    await fetchStudentsByClass(document.getElementById('guru-active-class').value);
}

async function addStudentManual(e) {
    e.preventDefault();
    const class_id = document.getElementById('guru-active-class').value;
    if (!class_id) return showToast('Pilih atau buat kelas terlebih dahulu!', 'error');
    const nisn = document.getElementById('stu-nisn').value.trim();
    const nama = document.getElementById('stu-nama').value.trim();

    const { error } = await db.from('students').upsert([{ nisn, nama, class_id }], { onConflict: 'nisn' });
    if (error) return showToast('Gagal menyimpan siswa: ' + error.message, 'error');
    e.target.reset();
    showToast('Siswa berhasil ditambahkan!');
    await fetchStudentsByClass(class_id);
}

function openEditStudentModal(studentId) {
    if (isCurrentClassLockedForGuru && currentUser.role !== 'admin') {
        return showToast('Kelas ini diampu bersama guru lain. Hanya Admin yang dapat mengedit data siswa!', 'error');
    }
    const stu = studentsList.find(s => s.id === studentId);
    if (!stu) return;

    document.getElementById('edit-stu-id').value = stu.id;
    document.getElementById('edit-stu-nisn').value = stu.nisn;
    document.getElementById('edit-stu-nama').value = stu.nama;

    const selKelas = document.getElementById('edit-stu-kelas');
    selKelas.innerHTML = '';
    classesList.forEach(c => {
        selKelas.innerHTML += `<option value="${c.id}" ${c.id == stu.class_id ? 'selected' : ''}>${c.nama_kelas}</option>`;
    });

    document.getElementById('modal-edit-student').classList.remove('hidden');
}

function closeEditStudentModal() {
    document.getElementById('modal-edit-student').classList.add('hidden');
}

async function handleUpdateStudent(e) {
    e.preventDefault();
    if (isCurrentClassLockedForGuru && currentUser.role !== 'admin') {
        closeEditStudentModal();
        return showToast('Akses ditolak: Hanya Admin yang dapat mengedit siswa di kelas bersama!', 'error');
    }

    const id = Number(document.getElementById('edit-stu-id').value);
    const nisn = document.getElementById('edit-stu-nisn').value.trim();
    const nama = document.getElementById('edit-stu-nama').value.trim();
    const class_id = Number(document.getElementById('edit-stu-kelas').value);

    const { error } = await db.from('students')
        .update({ nisn, nama, class_id })
        .eq('id', id);

    if (error) return showToast('Gagal memperbarui data siswa: ' + error.message, 'error');

    closeEditStudentModal();
    showToast('Data siswa berhasil diperbarui!');
    await fetchStudentsByClass(document.getElementById('guru-active-class').value);
}

function downloadTemplateSiswa() {
    const ws = XLSX.utils.json_to_sheet([
        { NISN: "0081234561", Nama: "Andi Pratama", Kelas: "X.1" },
        { NISN: "0081234562", Nama: "Siti Aminah", Kelas: "X.1" }
    ]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar_Siswa");
    XLSX.writeFile(wb, "Template_Input_Siswa.xlsx");
}

async function importStudentsExcel() {
    const fileInput = document.getElementById('excel-students');
    if (!fileInput.files.length) return showToast('Pilih file Excel terlebih dahulu!', 'error');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        if (!rows.length) return showToast('File Excel kosong!', 'error');

        for (let r of rows) {
            const nisn = String(r.NISN || r.nisn || '').trim();
            const nama = String(r.Nama || r.nama || '').trim();
            const namaKelas = String(r.Kelas || r.kelas || '').trim();
            if (!nisn || !nama || !namaKelas) continue;

            let cls = classesList.find(c => c.nama_kelas.toLowerCase() === namaKelas.toLowerCase());
            if (!cls) {
                const { data: newCls } = await db.from('classes').insert([{ nama_kelas: namaKelas }]).select().single();
                if (newCls) {
                    cls = newCls;
                    classesList.push(newCls);
                }
            }
            if (cls) {
                await db.from('students').upsert([{ nisn, nama, class_id: cls.id }], { onConflict: 'nisn' });
            }
        }
        showToast('Import Excel Siswa selesai!');
        if (currentUser.role === 'admin') {
            await switchAdminMode('students');
        } else {
            await fetchClassesAndAmpuan();
        }
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

// ============================================================================
// 4. PENGATURAN BOBOT & KKM PER MAPEL (TAB 2)
// ============================================================================
function loadSettingsForm() {
    if (!currentSettings) return;
    document.getElementById('set-mapel').value = currentSettings.mapel || 'Mata Pelajaran';
    document.getElementById('set-kkm').value = currentSettings.kkm;
    document.getElementById('set-wtugas').value = currentSettings.w_tugas;
    document.getElementById('set-wbab').value = currentSettings.w_bab;
    document.getElementById('set-wuas').value = currentSettings.w_uas;
    document.getElementById('set-wabsen').value = currentSettings.w_absen;
    document.getElementById('set-phadir').value = currentSettings.p_hadir;
    document.getElementById('set-psakit').value = currentSettings.p_sakit;
    document.getElementById('set-pizin').value = currentSettings.p_izin;
    document.getElementById('set-palpa').value = currentSettings.p_alpa;
}

async function saveSettings(e) {
    e.preventDefault();
    if (!currentSettings) return showToast('Tambahkan kelas & mapel ampuan terlebih dahulu!', 'error');
    const oldMapel = currentSettings.mapel;
    const newMapel = document.getElementById('set-mapel').value.trim();

    const payload = {
        mapel: newMapel,
        kkm: Number(document.getElementById('set-kkm').value),
        w_tugas: Number(document.getElementById('set-wtugas').value),
        w_bab: Number(document.getElementById('set-wbab').value),
        w_uas: Number(document.getElementById('set-wuas').value),
        w_absen: Number(document.getElementById('set-wabsen').value),
        p_hadir: Number(document.getElementById('set-phadir').value),
        p_sakit: Number(document.getElementById('set-psakit').value),
        p_izin: Number(document.getElementById('set-pizin').value),
        p_alpa: Number(document.getElementById('set-palpa').value),
    };

    const { error } = await db.from('teacher_settings').update(payload).eq('id', currentSettings.id);
    if (error) return showToast('Gagal menyimpan pengaturan: ' + error.message, 'error');

    if (oldMapel !== newMapel) {
        const stuIds = studentsList.map(s => s.id);
        if (stuIds.length) {
            await db.from('attendance')
                .update({ mapel: newMapel })
                .eq('teacher_id', currentUser.id)
                .eq('mapel', oldMapel)
                .in('student_id', stuIds);
        }
        await db.from('attendance_logs')
            .update({ mapel: newMapel })
            .eq('teacher_id', currentUser.id)
            .eq('class_id', currentSettings.class_id)
            .eq('mapel', oldMapel);

        await db.from('assessments')
            .update({ mapel: newMapel })
            .eq('teacher_id', currentUser.id)
            .eq('class_id', currentSettings.class_id)
            .eq('mapel', oldMapel);
    }

    showToast('Pengaturan bobot & KKM berhasil disimpan!');
    await fetchClassesAndAmpuan(currentSettings.id);
}

// ============================================================================
// 5. KEHADIRAN HARIAN PER TANGGAL & REKAP ANTI-RESET (TAB 3)
// ============================================================================
function calcAttendanceScore(h, s, i, a) {
    const total = h + s + i + a;
    if (total === 0 || !currentSettings) return 100;
    const poin = (h * currentSettings.p_hadir) + (s * currentSettings.p_sakit) + (i * currentSettings.p_izin) + (a * currentSettings.p_alpa);
    return Math.min(100, Math.max(0, (poin / total))).toFixed(1);
}

async function loadAttendanceTab() {
    await loadRecordedDates();
    await loadDailyAttendanceForDate();
    await loadAttendanceTable();
}

async function loadRecordedDates() {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId || !currentSettings) return;

    const { data, error } = await db.from('attendance_logs')
        .select('tanggal, status')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('tanggal', { ascending: false });

    const sel = document.getElementById('abs-recorded-dates');
    const chipsContainer = document.getElementById('abs-date-chips');

    if (error) {
        sel.innerHTML = `<option value="">-- Error Memuat Riwayat --</option>`;
        chipsContainer.innerHTML = `<span class="text-xs text-rose-600 font-bold">⚠️ Gagal memuat riwayat tanggal.</span>`;
        return;
    }

    const uniqueDates = [...new Set((data || []).map(d => d.tanggal))];
    sel.innerHTML = `<option value="">-- ${uniqueDates.length} Pertemuan Tercatat --</option>`;
    chipsContainer.innerHTML = '';

    if (uniqueDates.length === 0) {
        chipsContainer.innerHTML = `<span class="text-xs text-slate-400 italic">Belum ada tanggal pertemuan yang disimpan pada mata pelajaran ini.</span>`;
    } else {
        const currentPicked = document.getElementById('abs-date-picker').value;
        uniqueDates.forEach(tgl => {
            sel.innerHTML += `<option value="${tgl}" ${tgl === currentPicked ? 'selected' : ''}>${tgl}</option>`;
            const logsOnDate = (data || []).filter(d => d.tanggal === tgl);
            const hCount = logsOnDate.filter(d => d.status === 'H').length;
            const isSelected = tgl === currentPicked;

            chipsContainer.innerHTML += `
                <button onclick="selectRecordedDate('${tgl}')" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                    isSelected 
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                    : 'bg-white text-slate-700 border-slate-300 hover:bg-indigo-50 hover:border-indigo-300'
                }">
                    <span>📅 ${tgl}</span>
                    <span class="px-1.5 py-0.5 rounded text-[10px] ${isSelected ? 'bg-indigo-800 text-indigo-100' : 'bg-emerald-50 text-emerald-700'}">H:${hCount}</span>
                </button>
            `;
        });
    }
}

function selectRecordedDate(val) {
    if (!val) return;
    document.getElementById('abs-date-picker').value = val;
    loadDailyAttendanceForDate();
    loadRecordedDates();
}

async function loadDailyAttendanceForDate() {
    const classId = document.getElementById('guru-active-class').value;
    const tanggal = document.getElementById('abs-date-picker').value;
    const tbody = document.getElementById('daily-absen-tbody');
    if (!classId || !tanggal || !currentSettings) return;

    const { data } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .eq('tanggal', tanggal);

    const logMap = {};
    (data || []).forEach(l => logMap[l.student_id] = l.status);

    tbody.innerHTML = '';
    studentsList.forEach((stu, idx) => {
        const st = logMap[stu.id] || 'H';
        const isSaved = logMap[stu.id] !== undefined;
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono whitespace-nowrap">${stu.nisn}</td>
                <td class="p-3 font-semibold">
                    ${stu.nama}
                    ${isSaved ? '<span class="ml-1 text-[10px] px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 font-bold border border-emerald-200 inline-block">Tersimpan</span>' : ''}
                </td>
                <td class="p-3 text-center whitespace-nowrap">
                    <div class="inline-flex rounded-xl border border-slate-300 overflow-hidden text-xs font-bold">
                        <label class="px-2.5 sm:px-3 py-1.5 cursor-pointer has-[:checked]:bg-emerald-600 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="H" ${st === 'H' ? 'checked' : ''} class="hidden"> Hadir
                        </label>
                        <label class="px-2.5 sm:px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-amber-500 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="S" ${st === 'S' ? 'checked' : ''} class="hidden"> Sakit
                        </label>
                        <label class="px-2.5 sm:px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-sky-600 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="I" ${st === 'I' ? 'checked' : ''} class="hidden"> Izin
                        </label>
                        <label class="px-2.5 sm:px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-rose-600 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="A" ${st === 'A' ? 'checked' : ''} class="hidden"> Alpa
                        </label>
                    </div>
                </td>
            </tr>
        `;
    });
}

function markAllPresentDaily() {
    studentsList.forEach(stu => {
        const radioH = document.querySelector(`input[name="dabs_${stu.id}"][value="H"]`);
        if (radioH) radioH.checked = true;
    });
}

async function saveDailyAttendance() {
    const class_id = Number(document.getElementById('guru-active-class').value);
    const tanggal = document.getElementById('abs-date-picker').value;
    if (!class_id || !tanggal || !currentSettings) return showToast('Pilih kelas, mapel, dan tanggal!', 'error');

    const upserts = studentsList.map(stu => {
        const checked = document.querySelector(`input[name="dabs_${stu.id}"]:checked`);
        return {
            teacher_id: currentUser.id,
            class_id,
            student_id: stu.id,
            tanggal,
            status: checked ? checked.value : 'H',
            mapel: currentSettings.mapel
        };
    });

    if (upserts.length) {
        const { error } = await db.from('attendance_logs').upsert(upserts, { onConflict: 'teacher_id,student_id,tanggal,mapel' });
        if (error) {
            return showToast('Gagal menyimpan log harian: ' + error.message, 'error');
        }
    }

    await recalculateAttendanceSummaryFromLogs(class_id, currentSettings.mapel);
    await loadRecordedDates();
    await loadDailyAttendanceForDate();
    await loadAttendanceTable();
    showToast(`Absensi tanggal ${tanggal} (${currentSettings.mapel}) berhasil disimpan!`);
}

async function deleteDailyAttendanceDate() {
    const class_id = Number(document.getElementById('guru-active-class').value);
    const tanggal = document.getElementById('abs-date-picker').value;
    if (!class_id || !tanggal || !currentSettings) return;
    if (!confirm(`Hapus catatan kehadiran tanggal ${tanggal} untuk mapel ${currentSettings.mapel}?`)) return;

    const { error } = await db.from('attendance_logs')
        .delete()
        .eq('teacher_id', currentUser.id)
        .eq('class_id', class_id)
        .eq('mapel', currentSettings.mapel)
        .eq('tanggal', tanggal);

    if (error) return showToast('Gagal menghapus tanggal: ' + error.message, 'error');

    await recalculateAttendanceSummaryFromLogs(class_id, currentSettings.mapel);
    await loadRecordedDates();
    await loadDailyAttendanceForDate();
    await loadAttendanceTable();
    showToast(`Absensi tanggal ${tanggal} dihapus.`);
}

async function recalculateAttendanceSummaryFromLogs(classId, mapelName) {
    const { data: logs, error } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', mapelName);

    if (error || !logs) return;

    const upserts = studentsList.map(stu => {
        const stuLogs = logs.filter(l => l.student_id === stu.id);
        return {
            teacher_id: currentUser.id,
            student_id: stu.id,
            mapel: mapelName,
            hadir: stuLogs.filter(l => l.status === 'H').length,
            sakit: stuLogs.filter(l => l.status === 'S').length,
            izin: stuLogs.filter(l => l.status === 'I').length,
            alpa: stuLogs.filter(l => l.status === 'A').length
        };
    });

    if (upserts.length) {
        await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id,mapel' });
    }
}

async function exportDailyAttendanceExcel() {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId || !currentSettings) return;
    const { data: logs } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('tanggal', { ascending: true });

    const dates = [...new Set((logs || []).map(l => l.tanggal))];
    const rows = studentsList.map((stu, idx) => {
        const rowObj = { No: idx + 1, NISN: stu.nisn, Nama: stu.nama, Mapel: currentSettings.mapel };
        let h = 0, s = 0, i = 0, a = 0;
        dates.forEach(d => {
            const found = (logs || []).find(l => l.student_id === stu.id && l.tanggal === d);
            const st = found ? found.status : '-';
            rowObj[d] = st;
            if (st === 'H') h++;
            if (st === 'S') s++;
            if (st === 'I') i++;
            if (st === 'A') a++;
        });
        rowObj['Total Hadir'] = h;
        rowObj['Total Sakit'] = s;
        rowObj['Total Izin'] = i;
        rowObj['Total Alpa'] = a;
        return rowObj;
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi_Harian");
    XLSX.writeFile(wb, `Matriks_Absensi_${currentSettings.mapel}.xlsx`);
}

async function loadAttendanceTable() {
    if (!currentSettings) return;
    const stuIds = studentsList.map(s => s.id);
    let data = [];
    if (stuIds.length) {
        const res = await db.from('attendance')
            .select('*')
            .eq('teacher_id', currentUser.id)
            .eq('mapel', currentSettings.mapel)
            .in('student_id', stuIds);
        data = res.data || [];
    }

    const mapAbsen = {};
    data.forEach(a => mapAbsen[a.student_id] = a);

    const tbody = document.getElementById('absen-tbody');
    tbody.innerHTML = '';
    studentsList.forEach(stu => {
        const rec = mapAbsen[stu.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        const nilaiAbsen = calcAttendanceScore(rec.hadir, rec.sakit, rec.izin, rec.alpa);
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 font-mono whitespace-nowrap">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-2"><input type="number" min="0" value="${rec.hadir}" class="abs-h w-full border rounded-lg p-1.5 text-center"></td>
                <td class="p-2"><input type="number" min="0" value="${rec.sakit}" class="abs-s w-full border rounded-lg p-1.5 text-center"></td>
                <td class="p-2"><input type="number" min="0" value="${rec.izin}" class="abs-i w-full border rounded-lg p-1.5 text-center"></td>
                <td class="p-2"><input type="number" min="0" value="${rec.alpa}" class="abs-a w-full border rounded-lg p-1.5 text-center"></td>
                <td class="p-3 text-center font-extrabold text-indigo-700">${nilaiAbsen}</td>
            </tr>
        `;
    });
}

async function saveAttendanceManual() {
    if (!currentSettings) return;
    const rows = document.querySelectorAll('#absen-tbody tr');
    const upserts = [];
    rows.forEach(r => {
        const student_id = Number(r.getAttribute('data-stuid'));
        upserts.push({
            teacher_id: currentUser.id,
            student_id,
            mapel: currentSettings.mapel,
            hadir: Number(r.querySelector('.abs-h').value) || 0,
            sakit: Number(r.querySelector('.abs-s').value) || 0,
            izin: Number(r.querySelector('.abs-i').value) || 0,
            alpa: Number(r.querySelector('.abs-a').value) || 0
        });
    });
    if (upserts.length) {
        const { error } = await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id,mapel' });
        if (error) return showToast('Gagal menyimpan rekap: ' + error.message, 'error');
    }
    showToast('Rekap kehadiran manual disimpan!');
    loadAttendanceTable();
}

function downloadTemplateAbsen() {
    const data = studentsList.map(s => ({ NISN: s.nisn, Nama: s.nama, Hadir: 12, Sakit: 1, Izin: 0, Alpa: 0 }));
    const ws = XLSX.utils.json_to_sheet(data.length ? data : [{ NISN: "0081234561", Nama: "Contoh Siswa", Hadir: 10, Sakit: 0, Izin: 0, Alpa: 0 }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");
    XLSX.writeFile(wb, "Template_Kehadiran.xlsx");
}

async function importAbsenExcel() {
    if (!currentSettings) return;
    const fileInput = document.getElementById('excel-absen');
    if (!fileInput.files.length) return showToast('Pilih file Excel kehadiran!', 'error');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        const upserts = [];
        rows.forEach(r => {
            const nisn = String(r.NISN || r.nisn || '').trim();
            const stu = studentsList.find(s => s.nisn === nisn);
            if (stu) {
                upserts.push({
                    teacher_id: currentUser.id,
                    student_id: stu.id,
                    mapel: currentSettings.mapel,
                    hadir: Number(r.Hadir || r.hadir || 0),
                    sakit: Number(r.Sakit || r.sakit || 0),
                    izin: Number(r.Izin || r.izin || 0),
                    alpa: Number(r.Alpa || r.alpa || 0)
                });
            }
        });
        if (upserts.length) {
            await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id,mapel' });
        }
        showToast('Import kehadiran selesai!');
        loadAttendanceTable();
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

// ============================================================================
// 6. TUGAS, VISIBILITAS PUBLIK, LINK PENGUMPULAN, EDIT JENIS TUGAS & DAFTAR KELOMPOK (TAB 4)
// ============================================================================

let classGroupPresets = {};
let activePresetKey = 'Kelompok Default';

function getGroupStorageKey() {
    const classId = document.getElementById('guru-active-class')?.value || 'none';
    const mapel = currentSettings?.mapel || 'umum';
    const teacherId = currentUser?.id || 'anon';
    return `sipantau_groups_${teacherId}_${classId}_${mapel}`;
}

async function loadClassGroupPresets() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId || !currentUser) return {};

    let presets = {};

    // 1. Muat dari localStorage
    try {
        const raw = localStorage.getItem(getGroupStorageKey());
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') presets = { ...parsed };
        }
    } catch (e) {
        console.warn('Gagal memuat preset kelompok lokal:', e);
    }

    // 2. Muat dari currentSettings.kelompok_template di Supabase (jika kolom tersedia)
    if (currentSettings && currentSettings.kelompok_template && typeof currentSettings.kelompok_template === 'object') {
        presets = { ...presets, ...currentSettings.kelompok_template };
    }

    // 3. Pindai otomatis riwayat kelompok dari tugas-tugas kelompok yang sudah ada di tabel scores
    try {
        const groupAssessments = (currentAssessments || []).filter(a => a.tipe_kerja === 'kelompok');
        if (groupAssessments.length > 0) {
            const assIds = groupAssessments.map(a => a.id);
            const { data: pastScores } = await db.from('scores')
                .select('assessment_id, student_id, nama_kelompok')
                .in('assessment_id', assIds);

            if (pastScores && pastScores.length > 0) {
                groupAssessments.forEach(ass => {
                    const rows = pastScores.filter(s => s.assessment_id === ass.id && s.nama_kelompok && s.nama_kelompok.trim() !== '');
                    if (rows.length > 0) {
                        const mapObj = {};
                        rows.forEach(r => { mapObj[r.student_id] = r.nama_kelompok.trim(); });
                        if (!presets['Kelompok Default'] || Object.keys(presets['Kelompok Default']).length === 0) {
                            presets['Kelompok Default'] = { ...mapObj };
                        }
                        presets[`[Riwayat] ${ass.judul}`] = mapObj;
                    }
                });
            }
        }
    } catch (e) {
        console.warn('Gagal memindai riwayat kelompok:', e);
    }

    if (Object.keys(presets).length === 0) {
        presets['Kelompok Default'] = {};
    }

    classGroupPresets = presets;
    if (!classGroupPresets[activePresetKey]) {
        activePresetKey = Object.keys(classGroupPresets)[0] || 'Kelompok Default';
    }

    refreshGroupPresetDropdown();
    updateGroupAutocompleteDatalist();
    return classGroupPresets;
}

async function persistClassGroupPresets() {
    const cleanPresets = {};
    Object.keys(classGroupPresets).forEach(k => {
        if (!k.startsWith('[Riwayat] ')) {
            cleanPresets[k] = classGroupPresets[k];
        }
    });

    try {
        localStorage.setItem(getGroupStorageKey(), JSON.stringify(cleanPresets));
    } catch (e) {
        console.warn('Gagal menyimpan preset kelompok ke localStorage:', e);
    }

    if (currentSettings && currentSettings.id) {
        try {
            const { error } = await db.from('teacher_settings')
                .update({ kelompok_template: cleanPresets })
                .eq('id', currentSettings.id);
            if (!error) {
                currentSettings.kelompok_template = cleanPresets;
            }
        } catch (e) {
            // Abaikan jika kolom kelompok_template belum dibuat di tabel teacher_settings
        }
    }

    refreshGroupPresetDropdown();
    updateGroupAutocompleteDatalist();
}

function refreshGroupPresetDropdown() {
    const sel = document.getElementById('select-group-preset');
    if (!sel) return;

    sel.innerHTML = '';
    Object.keys(classGroupPresets).forEach(k => {
        const countAssigned = Object.values(classGroupPresets[k] || {}).filter(v => v && v.trim() !== '').length;
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = `${k} (${countAssigned} siswa)`;
        if (k === activePresetKey) opt.selected = true;
        sel.appendChild(opt);
    });
}

function updateGroupAutocompleteDatalist(extraScores = []) {
    const dl = document.getElementById('datalist-kelompok-options');
    if (!dl) return;

    const names = new Set(['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4', 'Kelompok 5', 'Kelompok 6']);
    Object.values(classGroupPresets).forEach(mapObj => {
        Object.values(mapObj || {}).forEach(g => {
            if (g && g.trim()) names.add(g.trim());
        });
    });
    (extraScores || []).forEach(s => {
        if (s.nama_kelompok && s.nama_kelompok.trim()) names.add(s.nama_kelompok.trim());
    });

    dl.innerHTML = Array.from(names)
        .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }))
        .map(n => `<option value="${n.replace(/"/g, '&quot;')}">`)
        .join('');
}

async function loadAssessmentsDropdown(keepSelectedId = null) {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId || !currentSettings) return;

    const { data } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('id');

    currentAssessments = data || [];
    const sel = document.getElementById('active-assessment');
    const prevSelected = keepSelectedId || sel.value;

    sel.innerHTML = currentAssessments.length ? '' : '<option value="">-- Belum Ada Penilaian di Mapel Ini --</option>';
    currentAssessments.forEach(a => {
        const labelKat = a.kategori === 'tugas' ? 'Tugas' : (a.kategori === 'ujian_bab' ? 'Ujian Bab' : 'Ujian Smt');
        const labelTipe = a.tipe_kerja === 'kelompok' ? '👥 Kelompok' : '👤 Individu';
        const visIcon = (a.tampil_publik !== false) ? '🌐 Publik' : '🔒 Sembunyi';
        sel.innerHTML += `<option value="${a.id}">[${visIcon} | ${labelKat} • ${labelTipe}] ${a.judul}</option>`;
    });

    await loadClassGroupPresets();

    if (prevSelected && currentAssessments.some(a => a.id == prevSelected)) {
        sel.value = prevSelected;
    }

    await loadAssessmentScores();
}

async function createAssessment(e) {
    e.preventDefault();
    const class_id = document.getElementById('guru-active-class').value;
    if (!class_id || !currentSettings) return showToast('Pilih kelas & mapel terlebih dahulu!', 'error');
    const judul = document.getElementById('ass-judul').value.trim();
    const kategori = document.getElementById('ass-kategori').value;
    const tipe_kerja = document.getElementById('ass-tipe').value;
    const tampil_publik = document.getElementById('ass-publik').value === 'true';
    const link_pengumpulan = document.getElementById('ass-link').value.trim();

    let { data, error } = await db.from('assessments')
        .insert([{
            teacher_id: currentUser.id,
            class_id: Number(class_id),
            mapel: currentSettings.mapel,
            judul,
            kategori,
            tipe_kerja,
            tampil_publik,
            link_pengumpulan
        }])
        .select().single();

    if (error && String(error.message).includes('tampil_publik')) {
        const retry = await db.from('assessments')
            .insert([{
                teacher_id: currentUser.id,
                class_id: Number(class_id),
                mapel: currentSettings.mapel,
                judul,
                kategori,
                tipe_kerja,
                link_pengumpulan
            }])
            .select().single();
        data = retry.data;
        error = retry.error;
    }

    if (error) return showToast('Gagal membuat penilaian: ' + error.message, 'error');

    document.getElementById('ass-judul').value = '';
    document.getElementById('ass-link').value = '';
    showToast(`Penilaian "${judul}" berhasil dibuat!`);
    await loadAssessmentsDropdown(data.id);
}

async function updateAssessmentLink() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId) return;

    const assObj = currentAssessments.find(a => a.id == assId);
    if (!assObj) return;

    const judulEl = document.getElementById('edit-ass-judul');
    const katEl = document.getElementById('edit-ass-kategori');
    const tipeEl = document.getElementById('edit-ass-tipe');
    const linkEl = document.getElementById('edit-ass-link');

    const judul = judulEl ? judulEl.value.trim() : assObj.judul;
    const kategori = katEl ? katEl.value : assObj.kategori;
    const tipe_kerja = tipeEl ? tipeEl.value : assObj.tipe_kerja;
    const link_pengumpulan = linkEl ? linkEl.value.trim() : (assObj.link_pengumpulan || '');

    if (!judul) {
        return showToast('Nama / Judul penilaian tidak boleh kosong!', 'error');
    }

    const { error } = await db.from('assessments')
        .update({ judul, kategori, tipe_kerja, link_pengumpulan })
        .eq('id', assId);

    if (error) {
        return showToast('Gagal memperbarui penilaian: ' + error.message, 'error');
    }

    assObj.judul = judul;
    assObj.kategori = kategori;
    assObj.tipe_kerja = tipe_kerja;
    assObj.link_pengumpulan = link_pengumpulan;

    showToast('Detail penilaian (Nama, Kategori, Sistem Kerja & Link) berhasil diperbarui!');
    await loadAssessmentsDropdown(assId);
}

async function toggleAssessmentPublicVisibility() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId) return;
    const assObj = currentAssessments.find(a => a.id == assId);
    if (!assObj) return;

    const currentPub = assObj.tampil_publik !== false;
    const newPub = !currentPub;

    const { error } = await db.from('assessments')
        .update({ tampil_publik: newPub })
        .eq('id', assId);

    if (error) {
        return showToast('Gagal mengubah visibilitas! Pastikan kolom tampil_publik sudah dibuat di Supabase.', 'error');
    }

    assObj.tampil_publik = newPub;
    showToast(newPub ? '🌐 Tugas DITAMPILKAN di halaman publik siswa.' : '🔒 Tugas DISEMBUNYIKAN dari halaman publik siswa.');
    await loadAssessmentsDropdown(assId);
}

function renderAssLinkEditor(assObj) {
    const box = document.getElementById('ass-link-editor');
    const judulInput = document.getElementById('edit-ass-judul');
    const katSelect = document.getElementById('edit-ass-kategori');
    const tipeSelect = document.getElementById('edit-ass-tipe');
    const input = document.getElementById('edit-ass-link');
    const btnTest = document.getElementById('btn-test-ass-link');
    const btnToggle = document.getElementById('btn-toggle-public');

    if (!assObj) {
        box.classList.add('hidden');
        return;
    }
    box.classList.remove('hidden');

    if (judulInput) judulInput.value = assObj.judul || '';
    if (katSelect) katSelect.value = assObj.kategori || 'tugas';
    if (tipeSelect) tipeSelect.value = assObj.tipe_kerja || 'individu';
    if (input) input.value = assObj.link_pengumpulan || '';

    if (assObj.link_pengumpulan) {
        btnTest.href = assObj.link_pengumpulan;
        btnTest.classList.remove('hidden');
    } else {
        btnTest.classList.add('hidden');
    }

    const isPublic = assObj.tampil_publik !== false;
    if (btnToggle) {
        if (isPublic) {
            btnToggle.className = 'w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm text-center';
            btnToggle.innerHTML = '🌐 Ditampilkan di Siswa (Klik untuk Sembunyikan)';
        } else {
            btnToggle.className = 'w-full sm:w-auto px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-slate-700 text-white hover:bg-slate-800 transition shadow-sm text-center';
            btnToggle.innerHTML = '🔒 Disembunyikan dari Siswa (Klik untuk Tampilkan)';
        }
    }
}

async function deleteCurrentAssessment() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId || !confirm('Hapus penilaian beserta seluruh nilainya?')) return;
    await db.from('assessments').delete().eq('id', assId);
    showToast('Penilaian dihapus.');
    await loadAssessmentsDropdown();
}

async function loadAssessmentScores() {
    const assId = document.getElementById('active-assessment').value;
    const tbody = document.getElementById('scores-tbody');
    const tableEl = tbody ? tbody.closest('table') : null;
    const theadEl = tableEl ? tableEl.querySelector('thead') : null;

    if (!assId) {
        document.getElementById('ass-link-editor').classList.add('hidden');
        document.getElementById('group-mode-banner').classList.add('hidden');
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Silakan buat atau pilih penilaian di atas.</td></tr>';
        return;
    }

    const assObj = currentAssessments.find(a => a.id == assId);
    renderAssLinkEditor(assObj);

    const isGroup = assObj && assObj.tipe_kerja === 'kelompok';
    document.getElementById('group-mode-banner').classList.toggle('hidden', !isGroup);

    if (theadEl) {
        theadEl.innerHTML = `
            <tr class="bg-slate-100 text-slate-700">
                <th class="p-3 border-b text-left col-nisn">NISN</th>
                <th class="p-3 border-b text-left col-nama">Nama Siswa</th>
                <th id="th-kelompok" class="p-3 border-b text-left min-w-[140px] ${!isGroup ? 'hidden' : ''}">Kelompok</th>
                <th class="p-3 border-b text-center min-w-[115px]">Status Kumpul</th>
                <th class="p-3 border-b text-center min-w-[115px]">Nilai (0-100)</th>
                <th class="p-3 border-b text-left min-w-[190px]">Link Bukti Siswa</th>
            </tr>
        `;
    }

    const { data } = await db.from('scores').select('*').eq('assessment_id', assId);
    const scoreMap = {};
    let hasSavedGroupsInTask = false;
    (data || []).forEach(s => {
        scoreMap[s.student_id] = s;
        if (s.nama_kelompok && s.nama_kelompok.trim() !== '') {
            hasSavedGroupsInTask = true;
        }
    });

    updateGroupAutocompleteDatalist(data || []);

    // Jika tugas ini bertipe kelompok dan belum memiliki nama kelompok di database, otomatis gunakan daftar kelompok aktif
    const fallbackPresetMap = (isGroup && !hasSavedGroupsInTask && classGroupPresets[activePresetKey])
        ? classGroupPresets[activePresetKey]
        : {};

    tbody.innerHTML = '';
    studentsList.forEach(stu => {
        const sc = scoreMap[stu.id] || { nama_kelompok: '', status_kumpul: false, link_tugas_siswa: '', nilai: null };
        const valGroup = (sc.nama_kelompok && sc.nama_kelompok.trim() !== '')
            ? sc.nama_kelompok
            : (fallbackPresetMap[stu.id] || '');
        const valNilai = (sc.nilai !== null && sc.nilai !== undefined) ? sc.nilai : '';
        const valLink = sc.link_tugas_siswa || '';
        const safeGroup = String(valGroup).replace(/"/g, '&quot;');
        const safeLink = String(valLink).replace(/"/g, '&quot;');

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 font-mono text-xs whitespace-nowrap">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-2 ${!isGroup ? 'hidden' : ''}">
                    <input type="text" list="datalist-kelompok-options" value="${safeGroup}" placeholder="${isGroup ? 'Kelompok 1' : '-'}" 
                        ${!isGroup ? 'disabled' : ''} 
                        oninput="onStudentGroupNameInput(this)"
                        class="sc-group w-full border rounded-lg p-1.5 text-xs font-semibold text-indigo-950 bg-white">
                </td>
                <td class="p-2 text-center whitespace-nowrap">
                    <label class="inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" ${sc.status_kumpul ? 'checked' : ''} onchange="onStatusOrScoreChange(this)" class="sc-status w-4 h-4 accent-indigo-600 cursor-pointer">
                        <span class="text-xs ml-1.5 font-semibold">Sudah</span>
                    </label>
                </td>
                <td class="p-2">
                    <input type="number" step="0.1" min="0" max="100" value="${valNilai}" placeholder="-" oninput="onStatusOrScoreChange(this)" class="sc-nilai w-full border rounded-lg p-1.5 text-center font-bold">
                </td>
                <td class="p-2">
                    <div class="flex items-center gap-1">
                        <input type="url" value="${safeLink}" placeholder="https://..." oninput="onStatusOrScoreChange(this)" class="sc-link w-full border rounded-lg p-1.5 text-xs">
                        ${valLink ? `<a href="${safeLink}" target="_blank" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold shrink-0">↗</a>` : ''}
                    </div>
                </td>
            </tr>
        `;
    });
}

function onStudentGroupNameInput(groupInputEl) {
    const tr = groupInputEl.closest('tr');
    if (!tr) return;
    const targetGroup = groupInputEl.value.trim().toLowerCase();
    if (!targetGroup) return;

    // Jika siswa ini dimasukkan ke kelompok yang anggotanya sudah punya nilai/link/status di tabel, samakan otomatis
    const rows = document.querySelectorAll('#scores-tbody tr');
    for (const row of rows) {
        if (row === tr) continue;
        const g = row.querySelector('.sc-group')?.value.trim().toLowerCase();
        if (g === targetGroup) {
            const otherNilai = row.querySelector('.sc-nilai')?.value || '';
            const otherLink = row.querySelector('.sc-link')?.value || '';
            const otherStatus = row.querySelector('.sc-status')?.checked || false;

            if (otherNilai !== '' || otherLink !== '' || otherStatus) {
                tr.querySelector('.sc-nilai').value = otherNilai;
                tr.querySelector('.sc-link').value = otherLink;
                tr.querySelector('.sc-status').checked = otherStatus;
                break;
            }
        }
    }
}

function onStatusOrScoreChange(inputEl) {
    const tr = inputEl.closest('tr');
    const nilaiInput = tr.querySelector('.sc-nilai');
    const linkInput = tr.querySelector('.sc-link');
    const statusCheck = tr.querySelector('.sc-status');

    if ((inputEl === nilaiInput && nilaiInput.value !== '') || (inputEl === linkInput && linkInput.value.trim() !== '')) {
        statusCheck.checked = true;
    }
    syncGroupRow(tr);
}

function syncGroupRow(el) {
    const tr = el.closest('tr');
    const groupName = tr.querySelector('.sc-group').value.trim().toLowerCase();
    if (!groupName) return;

    const currentNilai = tr.querySelector('.sc-nilai').value;
    const currentLink = tr.querySelector('.sc-link').value;
    const currentStatus = tr.querySelector('.sc-status').checked;

    document.querySelectorAll('#scores-tbody tr').forEach(row => {
        if (row === tr) return;
        const g = row.querySelector('.sc-group').value.trim().toLowerCase();
        if (g === groupName) {
            row.querySelector('.sc-nilai').value = currentNilai;
            row.querySelector('.sc-link').value = currentLink;
            row.querySelector('.sc-status').checked = currentStatus;
        }
    });
}

function syncAllGroupsInCurrentTable() {
    const rows = document.querySelectorAll('#scores-tbody tr');
    const masterByGroup = {};

    rows.forEach(row => {
        const g = row.querySelector('.sc-group')?.value.trim().toLowerCase();
        if (!g) return;
        const valNilai = row.querySelector('.sc-nilai')?.value || '';
        const valLink = row.querySelector('.sc-link')?.value || '';
        const valStatus = row.querySelector('.sc-status')?.checked || false;

        if (!masterByGroup[g]) {
            masterByGroup[g] = { nilai: valNilai, link: valLink, status: valStatus };
        } else {
            if (masterByGroup[g].nilai === '' && valNilai !== '') masterByGroup[g].nilai = valNilai;
            if (masterByGroup[g].link === '' && valLink !== '') masterByGroup[g].link = valLink;
            if (!masterByGroup[g].status && valStatus) masterByGroup[g].status = true;
        }
    });

    rows.forEach(row => {
        const g = row.querySelector('.sc-group')?.value.trim().toLowerCase();
        if (!g || !masterByGroup[g]) return;
        const m = masterByGroup[g];
        if (m.nilai !== '' || m.link !== '' || m.status) {
            row.querySelector('.sc-nilai').value = m.nilai;
            row.querySelector('.sc-link').value = m.link;
            row.querySelector('.sc-status').checked = m.status;
        }
    });
}

function applySelectedGroupPreset() {
    const sel = document.getElementById('select-group-preset');
    const presetKey = sel ? sel.value : activePresetKey;
    if (!presetKey || !classGroupPresets[presetKey]) {
        return showToast('Pilih daftar kelompok terlebih dahulu!', 'error');
    }

    activePresetKey = presetKey;
    const mapObj = classGroupPresets[presetKey] || {};
    const rows = document.querySelectorAll('#scores-tbody tr');
    let count = 0;

    rows.forEach(r => {
        const stuId = r.getAttribute('data-stuid');
        const gInput = r.querySelector('.sc-group');
        if (gInput && mapObj[stuId] !== undefined) {
            gInput.value = mapObj[stuId];
            if (mapObj[stuId]) count++;
        }
    });

    syncAllGroupsInCurrentTable();
    showToast(`Daftar "${presetKey}" diterapkan (${count} siswa). Klik Simpan di bawah tabel untuk menyimpan nilai!`);
}

async function saveCurrentTableAsGroupPreset() {
    const rows = document.querySelectorAll('#scores-tbody tr');
    if (!rows.length) return;

    const defaultName = (activePresetKey && !activePresetKey.startsWith('[Riwayat] '))
        ? activePresetKey
        : 'Kelompok Default';
    const nameInput = prompt('Simpan susunan kelompok di tabel ini dengan nama:', defaultName);
    if (!nameInput || !nameInput.trim()) return;

    const cleanName = nameInput.trim();
    const mapObj = {};
    let filledCount = 0;

    rows.forEach(r => {
        const stuId = r.getAttribute('data-stuid');
        const gVal = r.querySelector('.sc-group')?.value.trim() || '';
        if (stuId) {
            mapObj[stuId] = gVal;
            if (gVal) filledCount++;
        }
    });

    if (filledCount === 0) {
        return showToast('Belum ada nama kelompok yang diisi pada tabel!', 'error');
    }

    classGroupPresets[cleanName] = mapObj;
    activePresetKey = cleanName;
    await persistClassGroupPresets();
    showToast(`Daftar kelompok "${cleanName}" (${filledCount} siswa) berhasil disimpan untuk tugas-tugas berikutnya!`);
}

async function openGroupManagerModal() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId) return showToast('Pilih kelas terlebih dahulu!', 'error');

    await loadClassGroupPresets();
    populateModalPresetSelect();
    loadPresetIntoModal();
    document.getElementById('modal-group-manager').classList.remove('hidden');
}

function closeGroupManagerModal() {
    document.getElementById('modal-group-manager').classList.add('hidden');
}

function populateModalPresetSelect() {
    const sel = document.getElementById('gm-preset-select');
    if (!sel) return;
    sel.innerHTML = '';
    Object.keys(classGroupPresets).forEach(k => {
        const opt = document.createElement('option');
        opt.value = k;
        opt.textContent = k;
        if (k === activePresetKey) opt.selected = true;
        sel.appendChild(opt);
    });
}

function loadPresetIntoModal() {
    const sel = document.getElementById('gm-preset-select');
    const nameInput = document.getElementById('gm-preset-name');
    const tbody = document.getElementById('gm-students-tbody');
    if (!tbody) return;

    const key = sel?.value || activePresetKey || 'Kelompok Default';
    activePresetKey = key;

    if (nameInput) {
        nameInput.value = key.replace(/^\[Riwayat\]\s*/, '');
    }

    const mapObj = classGroupPresets[key] || {};
    tbody.innerHTML = '';

    if (!studentsList.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada siswa di kelas ini.</td></tr>';
        renderModalGroupSummary();
        return;
    }

    studentsList.forEach((stu, idx) => {
        const gVal = String(mapObj[stu.id] || '').replace(/"/g, '&quot;');
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-gm-stuid="${stu.id}">
                <td class="p-2.5 text-center text-slate-500">${idx + 1}</td>
                <td class="p-2.5 font-mono text-slate-600">${stu.nisn}</td>
                <td class="p-2.5 font-semibold text-slate-800">${stu.nama}</td>
                <td class="p-2">
                    <input type="text" list="datalist-kelompok-options" value="${gVal}" placeholder="Contoh: Kelompok 1"
                        oninput="renderModalGroupSummary()"
                        class="gm-stu-group w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-indigo-500">
                </td>
            </tr>
        `;
    });

    renderModalGroupSummary();
}

function renderModalGroupSummary() {
    const box = document.getElementById('gm-summary-badges');
    if (!box) return;

    const inputs = document.querySelectorAll('#gm-students-tbody .gm-stu-group');
    const counts = {};
    let emptyCount = 0;

    inputs.forEach(inp => {
        const v = inp.value.trim();
        if (v) counts[v] = (counts[v] || 0) + 1;
        else emptyCount++;
    });

    const groups = Object.keys(counts).sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
    if (!groups.length) {
        box.innerHTML = `<span class="text-[11px] text-slate-500 italic">Belum ada siswa yang dikelompokkan (${emptyCount} siswa belum memiliki kelompok).</span>`;
        return;
    }

    let html = groups.map(g => `
        <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-indigo-100 text-indigo-800 border border-indigo-200">
            ${g}: ${counts[g]} siswa
        </span>
    `).join('');

    if (emptyCount > 0) {
        html += `
            <span class="px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-100 text-rose-700 border border-rose-200">
                Belum dikelompokkan: ${emptyCount} siswa
            </span>
        `;
    }
    box.innerHTML = html;
}

function createNewGroupPreset() {
    const newName = prompt('Masukkan nama Daftar Kelompok baru (Contoh: Kelompok Praktikum / Kelompok Diskusi):');
    if (!newName || !newName.trim()) return;
    const clean = newName.trim();
    if (!classGroupPresets[clean]) {
        classGroupPresets[clean] = {};
    }
    activePresetKey = clean;
    populateModalPresetSelect();
    loadPresetIntoModal();
}

async function deleteCurrentGroupPreset() {
    const sel = document.getElementById('gm-preset-select');
    const key = sel?.value;
    if (!key) return;

    if (Object.keys(classGroupPresets).length <= 1) {
        return showToast('Minimal harus ada 1 daftar kelompok. Gunakan tombol Kosongkan jika ingin mereset.', 'error');
    }
    if (!confirm(`Hapus daftar kelompok "${key}"?`)) return;

    delete classGroupPresets[key];
    activePresetKey = Object.keys(classGroupPresets)[0] || 'Kelompok Default';
    await persistClassGroupPresets();
    populateModalPresetSelect();
    loadPresetIntoModal();
    showToast(`Daftar kelompok "${key}" dihapus.`);
}

function autoGenerateGroups(mode = 'random') {
    const countInput = document.getElementById('gm-auto-count');
    const numGroups = Math.max(2, parseInt(countInput?.value || 5, 10));
    const rows = Array.from(document.querySelectorAll('#gm-students-tbody tr[data-gm-stuid]'));
    if (!rows.length) return;

    const indices = rows.map((_, i) => i);
    if (mode === 'random') {
        for (let i = indices.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [indices[i], indices[j]] = [indices[j], indices[i]];
        }
    }

    indices.forEach((rowIdx, pos) => {
        const groupNum = (pos % numGroups) + 1;
        const inp = rows[rowIdx].querySelector('.gm-stu-group');
        if (inp) inp.value = `Kelompok ${groupNum}`;
    });

    renderModalGroupSummary();
}

function clearAllModalGroups() {
    document.querySelectorAll('#gm-students-tbody .gm-stu-group').forEach(inp => {
        inp.value = '';
    });
    renderModalGroupSummary();
}

async function saveGroupPresetFromModal(applyNow = false) {
    const nameInput = document.getElementById('gm-preset-name');
    const presetName = (nameInput?.value || '').trim() || 'Kelompok Default';
    const rows = document.querySelectorAll('#gm-students-tbody tr[data-gm-stuid]');
    const mapObj = {};

    rows.forEach(r => {
        const stuId = r.getAttribute('data-gm-stuid');
        const gVal = r.querySelector('.gm-stu-group')?.value.trim() || '';
        if (stuId) mapObj[stuId] = gVal;
    });

    classGroupPresets[presetName] = mapObj;
    activePresetKey = presetName;
    await persistClassGroupPresets();
    populateModalPresetSelect();

    if (applyNow) {
        const assId = document.getElementById('active-assessment')?.value;
        const assObj = currentAssessments.find(a => a.id == assId);
        if (assObj && assObj.tipe_kerja === 'kelompok') {
            const selPreset = document.getElementById('select-group-preset');
            if (selPreset) selPreset.value = presetName;
            applySelectedGroupPreset();
        } else {
            showToast(`Daftar "${presetName}" disimpan! Pilih tugas bertipe Berkelompok untuk menerapkannya.`);
        }
        closeGroupManagerModal();
    } else {
        showToast(`Daftar kelompok "${presetName}" berhasil disimpan!`);
    }
}

async function saveAssessmentScores() {
    const assId = Number(document.getElementById('active-assessment').value);
    if (!assId) return;

    const assObj = currentAssessments.find(a => a.id == assId);
    const isGroup = assObj && assObj.tipe_kerja === 'kelompok';

    const rows = document.querySelectorAll('#scores-tbody tr');
    const upserts = [];
    const currentGroupMap = {};
    let hasGroupFilled = false;

    rows.forEach(r => {
        const student_id = Number(r.getAttribute('data-stuid'));
        const nama_kelompok = r.querySelector('.sc-group').value.trim();
        const link_tugas_siswa = r.querySelector('.sc-link').value.trim();
        const nilaiRaw = r.querySelector('.sc-nilai').value;
        const nilai = nilaiRaw === '' ? null : Number(nilaiRaw);
        const status_kumpul = (nilai !== null || link_tugas_siswa !== '') ? true : r.querySelector('.sc-status').checked;

        if (isGroup && nama_kelompok) {
            currentGroupMap[student_id] = nama_kelompok;
            hasGroupFilled = true;
        }

        upserts.push({ assessment_id: assId, student_id, nama_kelompok, link_tugas_siswa, status_kumpul, nilai });
    });

    if (upserts.length) {
        await db.from('scores').upsert(upserts, { onConflict: 'assessment_id,student_id' });
    }

    if (isGroup && hasGroupFilled) {
        if (!classGroupPresets['Kelompok Default'] || Object.keys(classGroupPresets['Kelompok Default']).length === 0) {
            classGroupPresets['Kelompok Default'] = currentGroupMap;
            await persistClassGroupPresets();
        }
    }

    showToast('Nilai & Status pengumpulan disimpan!');
    await loadAssessmentScores();
}

// ============================================================================
// 7. REKAP NILAI AKHIR, EKSPOR EXCEL & CETAK KARTU PDF (TAB 5)
// ============================================================================
async function calculateAndRenderRekap() {
    if (!currentSettings) return;
    const classId = document.getElementById('guru-active-class').value;
    const classObj = classesList.find(c => c.id == classId);
    const namaKelas = classObj ? classObj.nama_kelas : '-';

    document.getElementById('rekap-info-bobot').innerText = 
        `Mapel: ${currentSettings.mapel} | Kelas: ${namaKelas} | KKM: ${currentSettings.kkm} | Bobot: Absen (${currentSettings.w_absen}%), Tugas (${currentSettings.w_tugas}%), Ujian Bab (${currentSettings.w_bab}%), Ujian Smt (${currentSettings.w_uas}%)`;

    const stuIds = studentsList.map(s => s.id);
    let absData = [];
    if (stuIds.length) {
        const resAbs = await db.from('attendance')
            .select('*')
            .eq('teacher_id', currentUser.id)
            .eq('mapel', currentSettings.mapel)
            .in('student_id', stuIds);
        absData = resAbs.data || [];
    }
    const absMap = {};
    absData.forEach(a => absMap[a.student_id] = a);

    const { data: assList } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('id');

    const assIds = (assList || []).map(a => a.id);
    let scoresList = [];
    if (assIds.length) {
        const { data: scData } = await db.from('scores').select('*').in('assessment_id', assIds);
        scoresList = scData || [];
    }

    const tbody = document.getElementById('rekap-tbody');
    tbody.innerHTML = '';
    latestRekapData = [];

    studentsList.forEach((stu, idx) => {
        const recAbs = absMap[stu.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        const nAbsen = Number(calcAttendanceScore(recAbs.hadir, recAbs.sakit, recAbs.izin, recAbs.alpa));

        const avgCat = (kat) => {
            const katAss = (assList || []).filter(a => a.kategori === kat);
            if (!katAss.length) return 0;
            let total = 0;
            katAss.forEach(a => {
                const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
                total += (sc && sc.nilai !== null) ? Number(sc.nilai) : 0;
            });
            return total / katAss.length;
        };

        const nTugas = avgCat('tugas');
        const nBab = avgCat('ujian_bab');
        const nUas = avgCat('ujian_semester');

        const totalWeight = currentSettings.w_absen + currentSettings.w_tugas + currentSettings.w_bab + currentSettings.w_uas;
        const pembagi = totalWeight > 0 ? totalWeight : 100;

        const nilaiAkhir = (
            (nAbsen * currentSettings.w_absen) +
            (nTugas * currentSettings.w_tugas) +
            (nBab * currentSettings.w_bab) +
            (nUas * currentSettings.w_uas)
        ) / pembagi;

        const tuntas = nilaiAkhir >= currentSettings.kkm;

        const detailPenilaian = (assList || []).map(a => {
            const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
            return {
                judul: a.judul,
                kategori: a.kategori === 'tugas' ? 'Tugas' : (a.kategori === 'ujian_bab' ? 'Ujian Akhir Bab' : 'Ujian Semester'),
                tipe: a.tipe_kerja === 'kelompok' ? `Kelompok (${sc?.nama_kelompok || '-'})` : 'Individu',
                status: (sc && sc.status_kumpul) ? 'Sudah Kumpul' : 'Belum Kumpul',
                nilai: (sc && sc.nilai !== null) ? sc.nilai : '-'
            };
        });

        latestRekapData.push({
            no: idx + 1, id: stu.id, nisn: stu.nisn, nama: stu.nama, kelas: namaKelas,
            absen: recAbs, nAbsen, nTugas, nBab, nUas, nilaiAkhir, kkm: currentSettings.kkm, tuntas, detailPenilaian
        });

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono whitespace-nowrap">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-3 text-center">${nAbsen.toFixed(1)}</td>
                <td class="p-3 text-center">${nTugas.toFixed(1)}</td>
                <td class="p-3 text-center">${nBab.toFixed(1)}</td>
                <td class="p-3 text-center">${nUas.toFixed(1)}</td>
                <td class="p-3 text-center font-extrabold bg-indigo-50/70 text-indigo-950">${nilaiAkhir.toFixed(2)}</td>
                <td class="p-3 text-center">${currentSettings.kkm}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <span class="px-2.5 py-1 rounded-full text-xs font-extrabold ${tuntas ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        ${tuntas ? 'TUNTAS' : 'BELUM TUNTAS'}
                    </span>
                </td>
                <td class="p-3 text-center whitespace-nowrap">
                    <button onclick="printStudentCardPDF(${stu.id})" class="bg-indigo-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-indigo-700">
                        📄 Kartu PDF
                    </button>
                </td>
            </tr>
        `;
    });
}

function printStudentCardPDF(studentId) {
    const d = latestRekapData.find(item => item.id === studentId);
    if (!d || !currentSettings) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("KARTU LAPORAN HASIL BELAJAR SISWA", 105, 16, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Mata Pelajaran: ${currentSettings.mapel}  |  Guru: ${currentUser.nama_lengkap}`, 105, 22, { align: "center" });
    doc.line(14, 25, 196, 25);

    doc.text(`Nama Siswa : ${d.nama}`, 14, 33);
    doc.text(`NISN       : ${d.nisn}`, 14, 39);
    doc.text(`Kelas      : ${d.kelas}`, 130, 33);
    doc.text(`KKM Mapel  : ${d.kkm}`, 130, 39);

    doc.autoTable({
        startY: 45,
        head: [['Hadir', 'Sakit', 'Izin', 'Alpa', 'Nilai Absen', 'Rata2 Tugas', 'Rata2 Ujian Bab', 'Ujian Semester', 'NILAI AKHIR', 'Status KKM']],
        body: [[
            d.absen.hadir, d.absen.sakit, d.absen.izin, d.absen.alpa,
            d.nAbsen.toFixed(1), d.nTugas.toFixed(1), d.nBab.toFixed(1), d.nUas.toFixed(1),
            d.nilaiAkhir.toFixed(2), d.tuntas ? 'TUNTAS' : 'BELUM TUNTAS'
        ]],
        theme: 'grid',
        headStyles: { fillColor: [67, 56, 202], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 9, halign: 'center', fontStyle: 'bold' }
    });

    const startY2 = doc.lastAutoTable.finalY + 8;
    doc.setFont("helvetica", "bold");
    doc.text("Rincian Pengumpulan Tugas & Nilai Ujian:", 14, startY2);

    const detailRows = d.detailPenilaian.map((p, i) => [
        i + 1, p.judul, p.kategori, p.tipe, p.status, p.nilai
    ]);

    doc.autoTable({
        startY: startY2 + 3,
        head: [['No', 'Nama Tugas / Ujian', 'Kategori', 'Sistem Kerja', 'Status Pengumpulan', 'Nilai']],
        body: detailRows.length ? detailRows : [['-', 'Belum ada tugas/ujian', '-', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: [51, 65, 85], fontSize: 9 },
        bodyStyles: { fontSize: 9 }
    });

    const finalY = doc.lastAutoTable.finalY + 15;
    const tglCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFont("helvetica", "normal");
    doc.text(`Dicetak pada: ${tglCetak}`, 140, finalY);
    doc.text("Guru Mata Pelajaran,", 140, finalY + 6);
    doc.setFont("helvetica", "bold");
    doc.text(currentUser.nama_lengkap, 140, finalY + 26);

    doc.save(`Kartu_${currentSettings.mapel}_${d.nama.replace(/\s+/g, '_')}.pdf`);
}

function printClassRekapPDF() {
    if (!latestRekapData.length || !currentSettings) return showToast('Belum ada data rekap!', 'error');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');

    const kelas = latestRekapData[0].kelas;
    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text(`REKAPITULASI HASIL BELAJAR SISWA - KELAS ${kelas}`, 148, 15, { align: "center" });
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.text(`Mata Pelajaran: ${currentSettings.mapel} | Guru: ${currentUser.nama_lengkap} | KKM: ${currentSettings.kkm}`, 148, 21, { align: "center" });

    const bodyRows = latestRekapData.map(d => [
        d.no, d.nisn, d.nama,
        `${d.absen.hadir}H / ${d.absen.sakit}S / ${d.absen.izin}I / ${d.absen.alpa}A`,
        d.nAbsen.toFixed(1), d.nTugas.toFixed(1), d.nBab.toFixed(1), d.nUas.toFixed(1),
        d.nilaiAkhir.toFixed(2), d.tuntas ? 'TUNTAS' : 'BELUM TUNTAS'
    ]);

    doc.autoTable({
        startY: 27,
        head: [['No', 'NISN', 'Nama Siswa', 'Rekap Absen', 'Nilai Absen', 'Rata2 Tugas', 'Rata2 Bab', 'Ujian Smt', 'Nilai Akhir', 'Status']],
        body: bodyRows,
        theme: 'grid',
        headStyles: { fillColor: [67, 56, 202], fontSize: 9 },
        bodyStyles: { fontSize: 9 }
    });

    doc.save(`Rekap_Kelas_${kelas}_${currentSettings.mapel}.pdf`);
}

function exportRekapExcel() {
    const rows = latestRekapData.map(d => ({
        No: d.no, NISN: d.nisn, 'Nama Siswa': d.nama, Kelas: d.kelas,
        'Mata Pelajaran': currentSettings ? currentSettings.mapel : '-',
        Hadir: d.absen.hadir, Sakit: d.absen.sakit, Izin: d.absen.izin, Alpa: d.absen.alpa,
        'Nilai Kehadiran': Number(d.nAbsen.toFixed(1)),
        'Rata-rata Tugas': Number(d.nTugas.toFixed(1)),
        'Rata-rata Ujian Bab': Number(d.nBab.toFixed(1)),
        'Ujian Semester': Number(d.nUas.toFixed(1)),
        'Nilai Akhir': Number(d.nilaiAkhir.toFixed(2)),
        KKM: d.kkm,
        Status: d.tuntas ? 'TUNTAS' : 'BELUM TUNTAS'
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap_Nilai");
    XLSX.writeFile(wb, `Rekap_Nilai_${currentSettings ? currentSettings.mapel : 'Siswa'}.xlsx`);
}
app-guru.js
Displaying app-guru.js.
