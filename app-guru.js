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
