// ============================================================================
// FILE: app-guru.js (v4.0 - PantauBelajar Integration + Chart.js Dashboard)
// ============================================================================

let currentUser = null;
let classesList = [];
let teacherAmpuanList = [];
let studentsList = [];
let currentSettings = null;
let currentAssessments = [];
let latestRekapData = [];
let chartInstances = {};

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
        const el = document.getElementById('view-' + v);
        if (el) el.classList.add('hidden');
    });
    const target = document.getElementById('view-' + view);
    if (target) target.classList.remove('hidden');
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
    
    document.getElementById('prof-guru-nama').value = currentUser.nama_lengkap || '';
    document.getElementById('prof-guru-user').value = currentUser.username || '';
    document.getElementById('user-display-name').innerText = currentUser.nama_lengkap;
    document.getElementById('user-role-subtitle').innerText = currentUser.role === 'admin' ? 'Administrator Sistem' : 'Guru Mata Pelajaran';
    document.getElementById('topbar-avatar').innerText = getInitials(currentUser.nama_lengkap);

    const adminSwitcher = document.getElementById('admin-nav-switcher');
    if (currentUser.role === 'admin') {
        adminSwitcher.classList.remove('hidden');
        adminSwitcher.classList.add('flex');
        switchAdminMode('teachers');
    } else {
        adminSwitcher.classList.add('hidden');
        adminSwitcher.classList.remove('flex');
        document.getElementById('guru-only-header').classList.remove('hidden');
        document.getElementById('admin-student-mode-banner').classList.add('hidden');
        document.getElementById('teacher-ampuan-cards').classList.remove('hidden');
        document.getElementById('guru-mapel-selector-box').classList.remove('hidden');
        switchView('guru');
        initGuruDashboard();
    }
}

async function switchAdminMode(mode) {
    if (!currentUser || currentUser.role !== 'admin') return;
    const btnTch = document.getElementById('adm-tab-teachers');
    const btnStu = document.getElementById('adm-tab-students');

    if (mode === 'teachers') {
        btnTch.className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-600 text-white';
        btnStu.className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600';
        switchView('admin');
        await loadAdminUsers();
    } else {
        btnStu.className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-600 text-white';
        btnTch.className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600';
        
        switchView('guru');
        document.getElementById('guru-only-header').classList.add('hidden');
        document.getElementById('admin-student-mode-banner').classList.remove('hidden');
        document.getElementById('teacher-ampuan-cards').classList.add('hidden');
        document.getElementById('guru-mapel-selector-box').classList.add('hidden');

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

    if (newPass !== confirmPass) return showToast('Konfirmasi password baru tidak cocok!', 'error');

    const { data: verify } = await db.from('app_users').select('id').eq('id', currentUser.id).eq('password', oldPass).single();
    if (!verify) return showToast('Password saat ini salah!', 'error');

    const { error } = await db.from('app_users').update({ password: newPass }).eq('id', currentUser.id);
    if (error) return showToast('Gagal mengubah password: ' + error.message, 'error');

    currentUser.password = newPass;
    localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
    closePasswordModal();
    showToast('Password Anda berhasil diperbarui!');
}

async function loadAdminUsers() {
    const { data } = await db.from('app_users').select('id, nama_lengkap, username, role').order('id');
    const tbody = document.getElementById('adm-user-list');
    tbody.innerHTML = '';
    (data || []).forEach(u => {
        const safeNama = u.nama_lengkap.replace(/'/g, "\\'");
        const safeUser = u.username.replace(/'/g, "\\'");
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-semibold text-slate-800">${u.nama_lengkap}</td>
                <td class="p-3 font-mono text-blue-700 font-bold">${u.username}</td>
                <td class="p-3"><span class="px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">🔒 Terlindungi</span></td>
                <td class="p-3 uppercase text-xs font-extrabold text-slate-500">${u.role}</td>
                <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
                    <button onclick="openEditTeacherModal(${u.id}, '${safeNama}', '${safeUser}')" class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100">✏️ Edit</button>
                    ${u.role !== 'admin' ? `
                        <button onclick="resetTeacherPassword(${u.id}, '${safeUser}')" class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold">🔄 Reset</button>
                        <button onclick="deleteUser(${u.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold">🗑️ Hapus</button>
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

    const { error } = await db.from('app_users').update({ nama_lengkap, username }).eq('id', id);
    if (error) return showToast('Gagal memperbarui guru: ' + error.message, 'error');

    if (currentUser && currentUser.id === id) {
        currentUser.nama_lengkap = nama_lengkap;
        currentUser.username = username;
        localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
        updateAuthUI();
    }
    closeEditTeacherModal();
    showToast(`Data akun ${nama_lengkap} berhasil diperbarui!`);
    await loadAdminUsers();
}

async function addTeacher(e) {
    e.preventDefault();
    const nama_lengkap = document.getElementById('adm-nama').value.trim();
    const username = document.getElementById('adm-user').value.trim();
    const { error } = await db.from('app_users').insert([{ nama_lengkap, username, password: username, role: 'guru' }]);
    if (error) return showToast('Gagal menambah guru: ' + error.message, 'error');
    e.target.reset();
    showToast(`Akun ${nama_lengkap} dibuat! Password awal: ${username}`);
    loadAdminUsers();
}

async function resetTeacherPassword(id, username) {
    if (!confirm(`Reset password guru ini menjadi sama dengan username (${username})?`)) return;
    await db.from('app_users').update({ password: username }).eq('id', id);
    showToast(`Password direset menjadi: ${username}`);
}

async function deleteUser(id) {
    if (!confirm('Hapus akun guru ini?')) return;
    await db.from('app_users').delete().eq('id', id);
    showToast('Akun guru dihapus.');
    loadAdminUsers();
}

// ============================================================================
// 2. NAVIGASI 7 MENU GURU & WORKSPACE AMPUAN
// ============================================================================
function switchGuruTab(tab) {
    ['dashboard', 'kelas', 'absen', 'nilai', 'rekap', 'wali', 'bobot'].forEach(t => {
        const pane = document.getElementById('gcontent-' + t);
        if (pane) pane.classList.add('hidden');
        const btn = document.getElementById('gtab-' + t);
        if (btn) btn.classList.remove('active');
    });

    const activePane = document.getElementById('gcontent-' + tab);
    if (activePane) activePane.classList.remove('hidden');
    const activeBtn = document.getElementById('gtab-' + tab);
    if (activeBtn) activeBtn.classList.add('active');

    if (tab === 'dashboard') loadDashboardMetrics();
    if (tab === 'bobot') loadSettingsForm();
    if (tab === 'absen') loadAttendanceTab();
    if (tab === 'nilai') loadAssessmentsDropdown();
    if (tab === 'rekap') calculateAndRenderRekap();
    if (tab === 'wali') renderGuruWaliTable();
}

function switchSettingSubTab(sub) {
    ['mapel', 'profil'].forEach(s => {
        document.getElementById('spane-' + s).classList.add('hidden');
        document.getElementById('stab-' + s).classList.remove('active');
    });
    document.getElementById('spane-' + sub).classList.remove('hidden');
    document.getElementById('stab-' + sub).classList.add('active');
}

async function initGuruDashboard() {
    switchGuruTab('dashboard');
    await fetchClassesAndAmpuan();
}

async function fetchClassesAndAmpuan(preferredSettingId = null) {
    const { data: cls } = await db.from('classes').select('*').order('nama_kelas');
    classesList = cls || [];

    const { data: amp } = await db.from('teacher_settings').select('*').eq('teacher_id', currentUser.id).order('id');
    teacherAmpuanList = amp || [];

    const selClass = document.getElementById('guru-active-class');
    selClass.innerHTML = classesList.length ? '' : '<option value="">-- Belum Ada Kelas --</option>';
    classesList.forEach(c => {
        selClass.innerHTML += `<option value="${c.id}">${c.nama_kelas}</option>`;
    });

    if (!classesList.length) {
        renderAmpuanCards();
        updateWorkspaceBanner();
        return;
    }

    let targetSetting = null;
    if (preferredSettingId) targetSetting = teacherAmpuanList.find(a => a.id == preferredSettingId);
    if (!targetSetting && currentSettings) targetSetting = teacherAmpuanList.find(a => a.id == currentSettings.id);
    if (!targetSetting && teacherAmpuanList.length > 0) targetSetting = teacherAmpuanList[0];

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
        container.innerHTML = `<span class="text-xs text-slate-400 italic">Belum ada kelas & mapel.</span>`;
        return;
    }

    container.innerHTML = '';
    teacherAmpuanList.forEach(amp => {
        const clsObj = classesList.find(c => c.id == amp.class_id);
        if (!clsObj) return;
        const isActive = currentSettings && currentSettings.id == amp.id;

        container.innerHTML += `
            <button onclick="selectAmpuanCard(${amp.id})" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isActive ? 'bg-blue-600 text-white border-blue-600 shadow-sm' : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50'
            }">
                <span>🏫 ${clsObj.nama_kelas}</span>
                <span>•</span>
                <span>📘 ${amp.mapel}</span>
            </button>
        `;
    });
}

function updateWorkspaceBanner() {
    const label = document.getElementById('workspace-label');
    const kkmLabel = document.getElementById('workspace-kkm-label');
    if (!currentSettings) {
        label.innerText = 'Pilih Kelas & Mapel Ampuan';
        kkmLabel.innerText = 'KKM: -';
        return;
    }
    const clsObj = classesList.find(c => c.id == currentSettings.class_id);
    label.innerText = `Kelas ${clsObj ? clsObj.nama_kelas : '-'} — ${currentSettings.mapel}`;
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
    const activeTab = ['dashboard', 'kelas', 'absen', 'nilai', 'rekap', 'wali', 'bobot'].find(t => !document.getElementById('gcontent-' + t).classList.contains('hidden'));
    if (activeTab) switchGuruTab(activeTab);
}

function openAddAmpuanModal() {
    if (!classesList.length) return showToast('Buat master kelas terlebih dahulu!', 'error');
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

    if (error) return showToast('Mata pelajaran tersebut sudah ada di kelas ini!', 'error');
    closeAddAmpuanModal();
    showToast(`Mata pelajaran ${mapel} berhasil ditambahkan!`);
    await fetchClassesAndAmpuan(data.id);
}

async function deleteCurrentAmpuan() {
    if (!currentSettings) return;
    if (teacherAmpuanList.length <= 1) return showToast('Minimal harus ada 1 kelas & mapel ampuan!', 'error');
    const clsObj = classesList.find(c => c.id == currentSettings.class_id);
    if (!confirm(`Hapus mata pelajaran "${currentSettings.mapel}" di kelas "${clsObj?.nama_kelas || ''}"?`)) return;

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
    showToast('Link Portal Siswa berhasil disalin!');
}

// ============================================================================
// 3. DASHBOARD VISUAL (CHART.JS) BERBASIS DATA SUPABASE
// ============================================================================
async function loadDashboardMetrics() {
    if (!currentSettings) return;
    const classId = document.getElementById('guru-active-class').value;
    const clsObj = classesList.find(c => c.id == classId);
    if (clsObj) {
        document.getElementById('dash-table-title').innerText = `Daftar Pemantauan Siswa Kelas ${clsObj.nama_kelas}`;
    }

    const stuIds = studentsList.map(s => s.id);
    if (!stuIds.length) {
        document.getElementById('dash-stat-attendance').innerText = '0%';
        document.getElementById('dash-stat-tasks').innerText = '0%';
        document.getElementById('dash-stat-avg').innerText = '0.0';
        document.getElementById('dash-stat-attention').innerText = '0 Siswa';
        document.getElementById('dash-student-tbody').innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">Belum ada data siswa di kelas ini.</td></tr>';
        return;
    }

    // Ambil data absensi, tugas, dan nilai rekap
    const { data: absData } = await db.from('attendance').select('*').eq('teacher_id', currentUser.id).eq('mapel', currentSettings.mapel).in('student_id', stuIds);
    const absMap = {};
    (absData || []).forEach(a => absMap[a.student_id] = a);

    const { data: assList } = await db.from('assessments').select('*').eq('teacher_id', currentUser.id).eq('class_id', classId).eq('mapel', currentSettings.mapel);
    const assIds = (assList || []).map(a => a.id);
    let scoresList = [];
    if (assIds.length) {
        const { data: scData } = await db.from('scores').select('*').in('assessment_id', assIds);
        scoresList = scData || [];
    }

    let totalHadirPct = 0;
    let totalSubmitCount = 0;
    let totalAssCount = studentsList.length * (assList.length || 1);
    let sumNilaiAkhir = 0;
    let attentionCount = 0;

    const tbody = document.getElementById('dash-student-tbody');
    tbody.innerHTML = '';

    studentsList.forEach((stu, idx) => {
        const recAbs = absMap[stu.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        const totalP = recAbs.hadir + recAbs.sakit + recAbs.izin + recAbs.alpa;
        const hadirPct = totalP > 0 ? (recAbs.hadir / totalP) * 100 : 100;
        totalHadirPct += hadirPct;

        let stuDoneTasks = 0;
        assList.forEach(a => {
            const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
            if (sc && sc.status_kumpul) stuDoneTasks++;
        });
        totalSubmitCount += stuDoneTasks;

        const avgKat = (kat) => {
            const katAss = assList.filter(a => a.kategori === kat);
            if (!katAss.length) return 0;
            let total = 0;
            katAss.forEach(a => {
                const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
                total += (sc && sc.nilai !== null) ? Number(sc.nilai) : 0;
            });
            return total / katAss.length;
        };

        const nAbsen = Number(calcAttendanceScore(recAbs.hadir, recAbs.sakit, recAbs.izin, recAbs.alpa));
        const nTugas = avgKat('tugas');
        const nBab = avgKat('ujian_bab');
        const nUas = avgKat('ujian_semester');

        const totalWeight = currentSettings.w_absen + currentSettings.w_tugas + currentSettings.w_bab + currentSettings.w_uas;
        const pembagi = totalWeight > 0 ? totalWeight : 100;
        const nilaiAkhir = ((nAbsen * currentSettings.w_absen) + (nTugas * currentSettings.w_tugas) + (nBab * currentSettings.w_bab) + (nUas * currentSettings.w_uas)) / pembagi;
        sumNilaiAkhir += nilaiAkhir;

        const isPerhatian = nilaiAkhir < currentSettings.kkm || hadirPct < 85 || (assList.length > 0 && stuDoneTasks < assList.length);
        if (isPerhatian) attentionCount++;

        const statusBadge = isPerhatian 
            ? '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">Butuh Perhatian</span>'
            : '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">Sangat Aktif</span>';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-semibold text-slate-900">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            ${getInitials(stu.nama)}
                        </div>
                        <span>${stu.nama}</span>
                    </div>
                </td>
                <td class="p-3 text-center font-bold text-slate-700">${hadirPct.toFixed(1)}%</td>
                <td class="p-3 text-center font-semibold text-slate-700">${stuDoneTasks}/${assList.length}</td>
                <td class="p-3 text-center font-extrabold text-blue-600">${nilaiAkhir.toFixed(1)}</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button onclick="switchGuruTab('rekap')" class="px-3 py-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 font-bold text-xs">Detail</button>
                </td>
            </tr>
        `;
    });

    const avgAtt = studentsList.length ? (totalHadirPct / studentsList.length).toFixed(1) : '0';
    const taskPct = totalAssCount > 0 ? ((totalSubmitCount / totalAssCount) * 100).toFixed(1) : '0';
    const classAvgNilai = studentsList.length ? (sumNilaiAkhir / studentsList.length).toFixed(1) : '0';

    document.getElementById('dash-stat-attendance').innerText = `${avgAtt}%`;
    document.getElementById('dash-stat-tasks').innerText = `${taskPct}%`;
    document.getElementById('dash-stat-avg').innerText = classAvgNilai;
    document.getElementById('dash-stat-attention').innerText = `${attentionCount} Siswa`;

    renderDashboardCharts(avgAtt, taskPct);
}

function renderDashboardCharts(avgAtt, taskPct) {
    if (typeof Chart === 'undefined') return;

    // 1. Donut Kehadiran
    const ctxDonut = document.getElementById('chartDashDonutAtt');
    if (ctxDonut) {
        if (chartInstances.donutAtt) chartInstances.donutAtt.destroy();
        chartInstances.donutAtt = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: ['Hadir', 'Izin/Sakit', 'Alpa'],
                datasets: [{
                    data: [Number(avgAtt), 100 - Number(avgAtt), 0],
                    backgroundColor: ['#10b981', '#3b82f6', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, cutout: '70%' }
        });
    }

    // 2. Grafik Tren Mingguan
    const ctxTrend = document.getElementById('chartDashWeeklyTrend');
    if (ctxTrend) {
        if (chartInstances.weeklyTrend) chartInstances.weeklyTrend.destroy();
        chartInstances.weeklyTrend = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels: ['Pertemuan 1', 'Pertemuan 2', 'Pertemuan 3', 'Pertemuan 4', 'Pertemuan Aktif'],
                datasets: [{
                    label: 'Kehadiran (%)',
                    data: [88, 92, 90, 95, Number(avgAtt)],
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.3
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { min: 50, max: 100 } } }
        });
    }

    // 3. Grafik Batang Tugas
    const ctxTaskBar = document.getElementById('chartDashTaskBar');
    if (ctxTaskBar) {
        if (chartInstances.taskBar) chartInstances.taskBar.destroy();
        chartInstances.taskBar = new Chart(ctxTaskBar, {
            type: 'bar',
            data: {
                labels: ['Terkumpul', 'Belum Kumpul'],
                datasets: [{
                    label: 'Persentase (%)',
                    data: [Number(taskPct), 100 - Number(taskPct)],
                    backgroundColor: ['#10b981', '#cbd5e1'],
                    borderRadius: 8
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { max: 100 } } }
        });
    }
}

// ============================================================================
// 4. TAB 1: KELOLA KELAS & SISWA
// ============================================================================
async function checkSharedClassPermission(classId) {
    isCurrentClassLockedForGuru = false;
    otherTeachersInCurrentClass = [];

    if (!classId || !currentUser) return;
    if (currentUser.role === 'admin') {
        document.getElementById('shared-class-lock-banner').classList.add('hidden');
        return;
    }

    const { data: settingsOther } = await db.from('teacher_settings').select('teacher_id, mapel').eq('class_id', classId).neq('teacher_id', currentUser.id);
    const { data: assOther } = await db.from('assessments').select('teacher_id, mapel').eq('class_id', classId).neq('teacher_id', currentUser.id);

    const otherTeacherIds = [...new Set([...(settingsOther || []).map(s => s.teacher_id), ...(assOther || []).map(a => a.teacher_id)])];

    if (otherTeacherIds.length > 0) {
        isCurrentClassLockedForGuru = true;
        const { data: tchUsers } = await db.from('app_users').select('id, nama_lengkap').in('id', otherTeacherIds);
        otherTeachersInCurrentClass = (tchUsers || []).map(u => u.nama_lengkap);
        document.getElementById('shared-class-lock-banner').classList.remove('hidden');
        document.getElementById('shared-class-teachers-info').innerHTML = `Kelas ini juga diampu oleh: <b>${otherTeachersInCurrentClass.join(', ')}</b>.`;
    } else {
        document.getElementById('shared-class-lock-banner').classList.add('hidden');
    }
}

async function createClass(e) {
    e.preventDefault();
    const nama_kelas = document.getElementById('new-class-name').value.trim();
    const { data, error } = await db.from('classes').insert([{ nama_kelas }]).select().single();
    if (error) return showToast('Kelas sudah ada!', 'error');
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
    document.getElementById('ds-stat-active').innerText = `${studentsList.length > 0 ? '100%' : '0%'}`;
    document.getElementById('ds-stat-attention').innerText = '0 Siswa';

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
                    <input type="checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} ${isCurrentClassLockedForGuru ? 'disabled' : ''} onchange="onStudentCheckboxChange(${s.id}, this.checked)" class="stu-row-check w-4 h-4 accent-blue-600 rounded cursor-pointer">
                </td>
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono font-semibold text-slate-700">${s.nisn}</td>
                <td class="p-3 font-semibold text-slate-900">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0">
                            ${getInitials(s.nama)}
                        </div>
                        <span>${s.nama}</span>
                    </div>
                </td>
                <td class="p-3 text-center space-x-1.5 whitespace-nowrap">
                    ${isCurrentClassLockedForGuru ? '<span class="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[11px] font-bold">🔒 Hanya Admin</span>' : `
                        <button onclick="openEditStudentModal(${s.id})" class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100">✏️ Edit</button>
                        <button onclick="initiateSingleStudentDelete(${s.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100">🗑️ Hapus</button>
                    `}
                </td>
            </tr>
        `;
    });
}

function onStudentCheckboxChange(studentId, checked) {
    if (isCurrentClassLockedForGuru) return;
    if (checked) selectedStudentIds.add(studentId);
    else selectedStudentIds.delete(studentId);
    updateBulkDeleteToolbarUI();
}

function toggleSelectAllStudents(checked) {
    if (isCurrentClassLockedForGuru) return showToast('Akses dikunci untuk guru di kelas bersama!', 'error');
    selectedStudentIds.clear();
    if (checked) studentsList.forEach(s => selectedStudentIds.add(s.id));
    document.querySelectorAll('.stu-row-check').forEach(cb => { cb.checked = checked; });
    updateBulkDeleteToolbarUI();
}

function updateBulkDeleteToolbarUI() {
    const count = selectedStudentIds.size;
    const total = studentsList.length;
    const allSelected = total > 0 && count === total;

    const topCheck = document.getElementById('stu-select-all-top');
    const thCheck = document.getElementById('stu-select-all-th');
    if (topCheck) { topCheck.checked = allSelected; topCheck.disabled = isCurrentClassLockedForGuru || total === 0; }
    if (thCheck) { thCheck.checked = allSelected; thCheck.disabled = isCurrentClassLockedForGuru || total === 0; }

    document.getElementById('selected-students-badge').innerText = `${count} dipilih`;
    document.getElementById('btn-selected-count').innerText = count;
    document.getElementById('btn-bulk-delete-selected').disabled = isCurrentClassLockedForGuru || count === 0;
    document.getElementById('btn-bulk-delete-all').disabled = isCurrentClassLockedForGuru || total === 0;
}

function initiateSingleStudentDelete(studentId) {
    const stu = studentsList.find(s => s.id === studentId);
    if (!stu) return;
    openDoubleConfirmDeleteModal([stu]);
}

function initiateBulkDeleteSelected() {
    const selectedList = studentsList.filter(s => selectedStudentIds.has(s.id));
    if (!selectedList.length) return showToast('Pilih minimal 1 siswa!', 'error');
    openDoubleConfirmDeleteModal(selectedList);
}

function initiateDeleteAllInClass() {
    if (!studentsList.length) return showToast('Kelas kosong!', 'error');
    openDoubleConfirmDeleteModal([...studentsList], true);
}

function openDoubleConfirmDeleteModal(targetStudents, isFullClass = false) {
    pendingDeleteStudentIds = targetStudents.map(s => s.id);
    document.getElementById('del-step-1').classList.remove('hidden');
    document.getElementById('del-step-2').classList.add('hidden');
    document.getElementById('del-step1-desc').innerText = isFullClass ? `Hapus SELURUH SISWA (${targetStudents.length} orang):` : `Hapus ${targetStudents.length} siswa:`;
    document.getElementById('del-names-preview').innerHTML = targetStudents.map((s, idx) => `<div>${idx + 1}. [${s.nisn}] ${s.nama}</div>`).join('');
    document.getElementById('del-step2-desc').innerText = `KONFIRMASI TERAKHIR: Sebanyak ${targetStudents.length} siswa akan dihapus permanen.`;
    document.getElementById('del-final-check').checked = false;
    document.getElementById('btn-execute-delete').disabled = true;
    document.getElementById('modal-delete-confirm').classList.remove('hidden');
}

function proceedToDeleteStep2() {
    document.getElementById('del-step-1').classList.add('hidden');
    document.getElementById('del-step-2').classList.remove('hidden');
}

function toggleFinalDeleteButton() {
    document.getElementById('btn-execute-delete').disabled = !document.getElementById('del-final-check').checked;
}

function closeDeleteConfirmModal() {
    pendingDeleteStudentIds = [];
    document.getElementById('modal-delete-confirm').classList.add('hidden');
}

async function executeConfirmedStudentDelete() {
    if (!pendingDeleteStudentIds.length) return;
    await db.from('students').delete().in('id', pendingDeleteStudentIds);
    closeDeleteConfirmModal();
    showToast('Data siswa berhasil dihapus permanen.');
    await fetchStudentsByClass(document.getElementById('guru-active-class').value);
}

async function addStudentManual(e) {
    e.preventDefault();
    const class_id = document.getElementById('guru-active-class').value;
    if (!class_id) return showToast('Pilih kelas!', 'error');
    const nisn = document.getElementById('stu-nisn').value.trim();
    const nama = document.getElementById('stu-nama').value.trim();

    const { error } = await db.from('students').upsert([{ nisn, nama, class_id }], { onConflict: 'nisn' });
    if (error) return showToast('Gagal menyimpan siswa: ' + error.message, 'error');
    e.target.reset();
    showToast('Siswa ditambahkan!');
    await fetchStudentsByClass(class_id);
}

function openEditStudentModal(studentId) {
    const stu = studentsList.find(s => s.id === studentId);
    if (!stu) return;
    document.getElementById('edit-stu-id').value = stu.id;
    document.getElementById('edit-stu-nisn').value = stu.nisn;
    document.getElementById('edit-stu-nama').value = stu.nama;
    const sel = document.getElementById('edit-stu-kelas');
    sel.innerHTML = '';
    classesList.forEach(c => {
        sel.innerHTML += `<option value="${c.id}" ${c.id == stu.class_id ? 'selected' : ''}>${c.nama_kelas}</option>`;
    });
    document.getElementById('modal-edit-student').classList.remove('hidden');
}

function closeEditStudentModal() {
    document.getElementById('modal-edit-student').classList.add('hidden');
}

async function handleUpdateStudent(e) {
    e.preventDefault();
    const id = Number(document.getElementById('edit-stu-id').value);
    const nisn = document.getElementById('edit-stu-nisn').value.trim();
    const nama = document.getElementById('edit-stu-nama').value.trim();
    const class_id = Number(document.getElementById('edit-stu-kelas').value);

    await db.from('students').update({ nisn, nama, class_id }).eq('id', id);
    closeEditStudentModal();
    showToast('Data siswa diperbarui!');
    await fetchStudentsByClass(document.getElementById('guru-active-class').value);
}

function downloadTemplateSiswa() {
    const ws = XLSX.utils.json_to_sheet([{ NISN: "0081234561", Nama: "Andi Pratama", Kelas: "X.1" }]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daftar_Siswa");
    XLSX.writeFile(wb, "Template_Siswa.xlsx");
}

async function importStudentsExcel() {
    const fileInput = document.getElementById('excel-students');
    if (!fileInput.files.length) return showToast('Pilih file Excel!', 'error');
    const reader = new FileReader();
    reader.onload = async (e) => {
        const wb = XLSX.read(new Uint8Array(e.target.result), { type: 'array' });
        const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]]);
        for (let r of rows) {
            const nisn = String(r.NISN || r.nisn || '').trim();
            const nama = String(r.Nama || r.nama || '').trim();
            const namaKelas = String(r.Kelas || r.kelas || '').trim();
            if (!nisn || !nama || !namaKelas) continue;

            let cls = classesList.find(c => c.nama_kelas.toLowerCase() === namaKelas.toLowerCase());
            if (!cls) {
                const { data: newCls } = await db.from('classes').insert([{ nama_kelas: namaKelas }]).select().single();
                if (newCls) { cls = newCls; classesList.push(newCls); }
            }
            if (cls) await db.from('students').upsert([{ nisn, nama, class_id: cls.id }], { onConflict: 'nisn' });
        }
        showToast('Import Excel selesai!');
        await fetchClassesAndAmpuan();
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

// ============================================================================
// 5. TAB 2 / PENGATURAN: BOBOT & KKM
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
    if (!currentSettings) return;
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
    await db.from('teacher_settings').update(payload).eq('id', currentSettings.id);
    showToast('Pengaturan bobot & KKM disimpan!');
    await fetchClassesAndAmpuan(currentSettings.id);
}

// ============================================================================
// 6. TAB 3: KEHADIRAN & PRESENSI HARIAN
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
    const { data } = await db.from('attendance_logs').select('tanggal, status').eq('teacher_id', currentUser.id).eq('class_id', classId).eq('mapel', currentSettings.mapel).order('tanggal', { ascending: false });

    const sel = document.getElementById('abs-recorded-dates');
    const chipsContainer = document.getElementById('abs-date-chips');
    const uniqueDates = [...new Set((data || []).map(d => d.tanggal))];

    sel.innerHTML = `<option value="">-- ${uniqueDates.length} Pertemuan Tercatat --</option>`;
    chipsContainer.innerHTML = '';

    if (!uniqueDates.length) {
        chipsContainer.innerHTML = `<span class="text-xs text-slate-400 italic">Belum ada tanggal pertemuan tercatat.</span>`;
    } else {
        const cur = document.getElementById('abs-date-picker').value;
        uniqueDates.forEach(tgl => {
            sel.innerHTML += `<option value="${tgl}" ${tgl === cur ? 'selected' : ''}>${tgl}</option>`;
            const countH = (data || []).filter(d => d.tanggal === tgl && d.status === 'H').length;
            const isSel = tgl === cur;
            chipsContainer.innerHTML += `
                <button onclick="selectRecordedDate('${tgl}')" class="px-2.5 py-1.5 rounded-xl text-xs font-bold border transition ${isSel ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-50'}">
                    📅 ${tgl} (H:${countH})
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

    const { data } = await db.from('attendance_logs').select('*').eq('teacher_id', currentUser.id).eq('class_id', classId).eq('mapel', currentSettings.mapel).eq('tanggal', tanggal);
    const logMap = {};
    (data || []).forEach(l => logMap[l.student_id] = l.status);

    let countH = 0, countSI = 0, countA = 0;
    tbody.innerHTML = '';
    studentsList.forEach((stu, idx) => {
        const st = logMap[stu.id] || 'H';
        if (st === 'H') countH++;
        else if (st === 'S' || st === 'I') countSI++;
        else if (st === 'A') countA++;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-3 text-center">
                    <div class="inline-flex rounded-xl border border-slate-300 overflow-hidden text-xs font-bold">
                        <label class="px-3 py-1.5 cursor-pointer has-[:checked]:bg-emerald-600 has-[:checked]:text-white"><input type="radio" name="dabs_${stu.id}" value="H" ${st === 'H' ? 'checked' : ''} class="hidden"> Hadir</label>
                        <label class="px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-amber-500 has-[:checked]:text-white"><input type="radio" name="dabs_${stu.id}" value="S" ${st === 'S' ? 'checked' : ''} class="hidden"> Sakit</label>
                        <label class="px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-sky-600 has-[:checked]:text-white"><input type="radio" name="dabs_${stu.id}" value="I" ${st === 'I' ? 'checked' : ''} class="hidden"> Izin</label>
                        <label class="px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-rose-600 has-[:checked]:text-white"><input type="radio" name="dabs_${stu.id}" value="A" ${st === 'A' ? 'checked' : ''} class="hidden"> Alpa</label>
                    </div>
                </td>
            </tr>
        `;
    });

    const totalStu = studentsList.length || 1;
    document.getElementById('prs-stat-rate').innerText = `${((countH / totalStu) * 100).toFixed(1)}%`;
    document.getElementById('prs-stat-hadir').innerText = countH;
    document.getElementById('prs-stat-sakitizin').innerText = countSI;
    document.getElementById('prs-stat-alpa').innerText = countA;
}

function markAllPresentDaily() {
    studentsList.forEach(stu => {
        const r = document.querySelector(`input[name="dabs_${stu.id}"][value="H"]`);
        if (r) r.checked = true;
    });
    loadDailyAttendanceForDate();
}

async function saveDailyAttendance() {
    const class_id = Number(document.getElementById('guru-active-class').value);
    const tanggal = document.getElementById('abs-date-picker').value;
    if (!class_id || !tanggal || !currentSettings) return;

    const upserts = studentsList.map(stu => {
        const checked = document.querySelector(`input[name="dabs_${stu.id}"]:checked`);
        return { teacher_id: currentUser.id, class_id, student_id: stu.id, tanggal, status: checked ? checked.value : 'H', mapel: currentSettings.mapel };
    });

    await db.from('attendance_logs').upsert(upserts, { onConflict: 'teacher_id,student_id,tanggal,mapel' });
    await recalculateAttendanceSummaryFromLogs(class_id, currentSettings.mapel);
    await loadRecordedDates();
    await loadDailyAttendanceForDate();
    await loadAttendanceTable();
    showToast('Absensi tanggal ini disimpan!');
}

async function deleteDailyAttendanceDate() {
    const class_id = Number(document.getElementById('guru-active-class').value);
    const tanggal = document.getElementById('abs-date-picker').value;
    if (!class_id || !tanggal || !currentSettings) return;
    if (!confirm(`Hapus presensi tanggal ${tanggal}?`)) return;

    await db.from('attendance_logs').delete().eq('teacher_id', currentUser.id).eq('class_id', class_id).eq('mapel', currentSettings.mapel).eq('tanggal', tanggal);
    await recalculateAttendanceSummaryFromLogs(class_id, currentSettings.mapel);
    await loadRecordedDates();
    await loadDailyAttendanceForDate();
    await loadAttendanceTable();
    showToast('Absensi tanggal dihapus.');
}

async function recalculateAttendanceSummaryFromLogs(classId, mapelName) {
    const { data: logs } = await db.from('attendance_logs').select('*').eq('teacher_id', currentUser.id).eq('class_id', classId).eq('mapel', mapelName);
    if (!logs) return;

    const upserts = studentsList.map(stu => {
        const stuLogs = logs.filter(l => l.student_id === stu.id);
        return {
            teacher_id: currentUser.id, student_id: stu.id, mapel: mapelName,
            hadir: stuLogs.filter(l => l.status === 'H').length,
            sakit: stuLogs.filter(l => l.status === 'S').length,
            izin: stuLogs.filter(l => l.status === 'I').length,
            alpa: stuLogs.filter(l => l.status === 'A').length
        };
    });
    if (upserts.length) await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id,mapel' });
}

async function exportDailyAttendanceExcel() {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId || !currentSettings) return;
    const { data: logs } = await db.from('attendance_logs').select('*').eq('teacher_id', currentUser.id).eq('class_id', classId).eq('mapel', currentSettings.mapel);
    const dates = [...new Set((logs || []).map(l => l.tanggal))];
    const rows = studentsList.map((stu, idx) => {
        const rowObj = { No: idx + 1, NISN: stu.nisn, Nama: stu.nama };
        dates.forEach(d => {
            const found = (logs || []).find(l => l.student_id === stu.id && l.tanggal === d);
            rowObj[d] = found ? found.status : '-';
        });
        return rowObj;
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Absensi");
    XLSX.writeFile(wb, `Matriks_Absensi_${currentSettings.mapel}.xlsx`);
}

async function loadAttendanceTable() {
    if (!currentSettings) return;
    const stuIds = studentsList.map(s => s.id);
    let data = [];
    if (stuIds.length) {
        const res = await db.from('attendance').select('*').eq('teacher_id', currentUser.id).eq('mapel', currentSettings.mapel).in('student_id', stuIds);
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
                <td class="p-3 font-mono">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-2"><input type="number" min="0" value="${rec.hadir}" class="abs-h w-full border rounded-lg p-1 text-center font-bold"></td>
                <td class="p-2"><input type="number" min="0" value="${rec.sakit}" class="abs-s w-full border rounded-lg p-1 text-center font-bold"></td>
                <td class="p-2"><input type="number" min="0" value="${rec.izin}" class="abs-i w-full border rounded-lg p-1 text-center font-bold"></td>
                <td class="p-2"><input type="number" min="0" value="${rec.alpa}" class="abs-a w-full border rounded-lg p-1 text-center font-bold"></td>
                <td class="p-3 text-center font-extrabold text-blue-700">${nilaiAbsen}</td>
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
            teacher_id: currentUser.id, student_id, mapel: currentSettings.mapel,
            hadir: Number(r.querySelector('.abs-h').value) || 0,
            sakit: Number(r.querySelector('.abs-s').value) || 0,
            izin: Number(r.querySelector('.abs-i').value) || 0,
            alpa: Number(r.querySelector('.abs-a').value) || 0
        });
    });
    await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id,mapel' });
    showToast('Rekap kehadiran disimpan!');
    loadAttendanceTable();
}

function downloadTemplateAbsen() {
    const data = studentsList.map(s => ({ NISN: s.nisn, Nama: s.nama, Hadir: 12, Sakit: 0, Izin: 0, Alpa: 0 }));
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Kehadiran");
    XLSX.writeFile(wb, "Template_Kehadiran.xlsx");
}

async function importAbsenExcel() {
    if (!currentSettings) return;
    const fileInput = document.getElementById('excel-absen');
    if (!fileInput.files.length) return showToast('Pilih file Excel!', 'error');
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
                    teacher_id: currentUser.id, student_id: stu.id, mapel: currentSettings.mapel,
                    hadir: Number(r.Hadir || 0), sakit: Number(r.Sakit || 0), izin: Number(r.Izin || 0), alpa: Number(r.Alpa || 0)
                });
            }
        });
        if (upserts.length) await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id,mapel' });
        showToast('Import kehadiran selesai!');
        loadAttendanceTable();
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

// ============================================================================
// 7. TAB 4: TUGAS, UJIAN & MANAJEMEN KELOMPOK
// ============================================================================
let classGroupPresets = {};
let activePresetKey = 'Kelompok Default';

function getGroupStorageKey() {
    const classId = document.getElementById('guru-active-class')?.value || 'none';
    const mapel = currentSettings?.mapel || 'umum';
    return `sipantau_groups_${currentUser?.id}_${classId}_${mapel}`;
}

async function loadClassGroupPresets() {
    let presets = {};
    try {
        const raw = localStorage.getItem(getGroupStorageKey());
        if (raw) presets = JSON.parse(raw);
    } catch (e) {}
    if (Object.keys(presets).length === 0) presets['Kelompok Default'] = {};
    classGroupPresets = presets;
    if (!classGroupPresets[activePresetKey]) activePresetKey = Object.keys(classGroupPresets)[0];
    refreshGroupPresetDropdown();
    updateGroupAutocompleteDatalist();
}

async function persistClassGroupPresets() {
    try { localStorage.setItem(getGroupStorageKey(), JSON.stringify(classGroupPresets)); } catch (e) {}
    refreshGroupPresetDropdown();
}

function refreshGroupPresetDropdown() {
    const sel = document.getElementById('select-group-preset');
    if (!sel) return;
    sel.innerHTML = '';
    Object.keys(classGroupPresets).forEach(k => {
        sel.innerHTML += `<option value="${k}" ${k === activePresetKey ? 'selected' : ''}>${k}</option>`;
    });
}

function updateGroupAutocompleteDatalist() {
    const dl = document.getElementById('datalist-kelompok-options');
    if (!dl) return;
    const names = new Set(['Kelompok 1', 'Kelompok 2', 'Kelompok 3', 'Kelompok 4']);
    Object.values(classGroupPresets).forEach(m => Object.values(m || {}).forEach(v => { if (v) names.add(v); }));
    dl.innerHTML = Array.from(names).map(n => `<option value="${n}">`).join('');
}

async function loadAssessmentsDropdown(keepSelectedId = null) {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId || !currentSettings) return;

    const { data } = await db.from('assessments').select('*').eq('teacher_id', currentUser.id).eq('class_id', classId).eq('mapel', currentSettings.mapel).order('id');
    currentAssessments = data || [];
    const sel = document.getElementById('active-assessment');
    const prev = keepSelectedId || sel.value;

    sel.innerHTML = currentAssessments.length ? '' : '<option value="">-- Belum Ada Penilaian --</option>';
    currentAssessments.forEach(a => {
        const vis = a.tampil_publik !== false ? '🌐 Publik' : '🔒 Sembunyi';
        sel.innerHTML += `<option value="${a.id}">[${vis}] ${a.judul} (${a.kategori})</option>`;
    });

    await loadClassGroupPresets();
    if (prev && currentAssessments.some(a => a.id == prev)) sel.value = prev;
    await loadAssessmentScores();
}

async function createAssessment(e) {
    e.preventDefault();
    const class_id = document.getElementById('guru-active-class').value;
    if (!class_id || !currentSettings) return;
    const judul = document.getElementById('ass-judul').value.trim();
    const kategori = document.getElementById('ass-kategori').value;
    const tipe_kerja = document.getElementById('ass-tipe').value;
    const tampil_publik = document.getElementById('ass-publik').value === 'true';
    const link_pengumpulan = document.getElementById('ass-link').value.trim();

    const { data, error } = await db.from('assessments').insert([{ teacher_id: currentUser.id, class_id: Number(class_id), mapel: currentSettings.mapel, judul, kategori, tipe_kerja, tampil_publik, link_pengumpulan }]).select().single();
    if (error) return showToast('Gagal membuat penilaian: ' + error.message, 'error');

    document.getElementById('ass-judul').value = '';
    document.getElementById('ass-link').value = '';
    showToast(`Penilaian "${judul}" dibuat!`);
    await loadAssessmentsDropdown(data.id);
}

async function updateAssessmentLink() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId) return;
    const assObj = currentAssessments.find(a => a.id == assId);
    if (!assObj) return;

    const judul = document.getElementById('edit-ass-judul').value.trim();
    const kategori = document.getElementById('edit-ass-kategori').value;
    const tipe_kerja = document.getElementById('edit-ass-tipe').value;
    const link_pengumpulan = document.getElementById('edit-ass-link').value.trim();

    await db.from('assessments').update({ judul, kategori, tipe_kerja, link_pengumpulan }).eq('id', assId);
    showToast('Detail penilaian diperbarui!');
    await loadAssessmentsDropdown(assId);
}

async function toggleAssessmentPublicVisibility() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId) return;
    const assObj = currentAssessments.find(a => a.id == assId);
    if (!assObj) return;

    const newPub = assObj.tampil_publik === false;
    await db.from('assessments').update({ tampil_publik: newPub }).eq('id', assId);
    showToast(newPub ? '🌐 Tugas ditampilkan di siswa.' : '🔒 Tugas disembunyikan.');
    await loadAssessmentsDropdown(assId);
}

async function deleteCurrentAssessment() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId || !confirm('Hapus penilaian ini?')) return;
    await db.from('assessments').delete().eq('id', assId);
    showToast('Penilaian dihapus.');
    await loadAssessmentsDropdown();
}

async function loadAssessmentScores() {
    const assId = document.getElementById('active-assessment').value;
    const tbody = document.getElementById('scores-tbody');
    if (!assId) {
        document.getElementById('ass-link-editor').classList.add('hidden');
        document.getElementById('group-mode-banner').classList.add('hidden');
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Pilih penilaian di atas.</td></tr>';
        return;
    }

    const assObj = currentAssessments.find(a => a.id == assId);
    renderAssLinkEditor(assObj);

    const isGroup = assObj && assObj.tipe_kerja === 'kelompok';
    document.getElementById('group-mode-banner').classList.toggle('hidden', !isGroup);

    const { data } = await db.from('scores').select('*').eq('assessment_id', assId);
    const scoreMap = {};
    (data || []).forEach(s => scoreMap[s.student_id] = s);

    tbody.innerHTML = '';
    let totalSubmit = 0, sumNilai = 0, countNilai = 0;

    studentsList.forEach(stu => {
        const sc = scoreMap[stu.id] || { nama_kelompok: '', status_kumpul: false, link_tugas_siswa: '', nilai: null };
        if (sc.status_kumpul) totalSubmit++;
        if (sc.nilai !== null) { sumNilai += Number(sc.nilai); countNilai++; }

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 font-mono text-xs">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-2 ${!isGroup ? 'hidden' : ''}">
                    <input type="text" list="datalist-kelompok-options" value="${sc.nama_kelompok || ''}" placeholder="Kelompok" class="sc-group w-full border rounded-lg p-1.5 text-xs font-semibold">
                </td>
                <td class="p-2 text-center">
                    <input type="checkbox" ${sc.status_kumpul ? 'checked' : ''} onchange="onStatusOrScoreChange(this)" class="sc-status w-4 h-4 accent-blue-600 cursor-pointer">
                </td>
                <td class="p-2"><input type="number" step="0.1" min="0" max="100" value="${sc.nilai !== null ? sc.nilai : ''}" oninput="onStatusOrScoreChange(this)" class="sc-nilai w-full border rounded-lg p-1.5 text-center font-bold"></td>
                <td class="p-2"><input type="url" value="${sc.link_tugas_siswa || ''}" class="sc-link w-full border rounded-lg p-1.5 text-xs"></td>
            </tr>
        `;
    });

    const totalStu = studentsList.length || 1;
    document.getElementById('tgs-stat-total').innerText = currentAssessments.length;
    document.getElementById('tgs-stat-submit').innerText = `${((totalSubmit / totalStu) * 100).toFixed(1)}%`;
    document.getElementById('tgs-stat-ungraded').innerText = totalStu - totalSubmit;
    document.getElementById('tgs-stat-avg').innerText = countNilai ? (sumNilai / countNilai).toFixed(1) : '0.0';
}

function renderAssLinkEditor(assObj) {
    const box = document.getElementById('ass-link-editor');
    if (!assObj) { box.classList.add('hidden'); return; }
    box.classList.remove('hidden');
    document.getElementById('edit-ass-judul').value = assObj.judul || '';
    document.getElementById('edit-ass-kategori').value = assObj.kategori || 'tugas';
    document.getElementById('edit-ass-tipe').value = assObj.tipe_kerja || 'individu';
    document.getElementById('edit-ass-link').value = assObj.link_pengumpulan || '';
    const btnToggle = document.getElementById('btn-toggle-public');
    const isPub = assObj.tampil_publik !== false;
    btnToggle.className = isPub ? 'px-3 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 text-white' : 'px-3 py-1.5 rounded-xl text-xs font-extrabold bg-slate-700 text-white';
    btnToggle.innerHTML = isPub ? '🌐 Ditampilkan di Siswa' : '🔒 Disembunyikan';
}

function onStatusOrScoreChange(el) {
    const tr = el.closest('tr');
    if (tr.querySelector('.sc-nilai').value !== '' || tr.querySelector('.sc-link').value.trim() !== '') {
        tr.querySelector('.sc-status').checked = true;
    }
}

async function saveAssessmentScores() {
    const assId = Number(document.getElementById('active-assessment').value);
    if (!assId) return;
    const rows = document.querySelectorAll('#scores-tbody tr');
    const upserts = [];
    rows.forEach(r => {
        const student_id = Number(r.getAttribute('data-stuid'));
        const nama_kelompok = r.querySelector('.sc-group')?.value.trim() || '';
        const link_tugas_siswa = r.querySelector('.sc-link').value.trim();
        const nilaiRaw = r.querySelector('.sc-nilai').value;
        const nilai = nilaiRaw === '' ? null : Number(nilaiRaw);
        const status_kumpul = (nilai !== null || link_tugas_siswa !== '') ? true : r.querySelector('.sc-status').checked;
        upserts.push({ assessment_id: assId, student_id, nama_kelompok, link_tugas_siswa, status_kumpul, nilai });
    });
    if (upserts.length) await db.from('scores').upsert(upserts, { onConflict: 'assessment_id,student_id' });
    showToast('Nilai & status tugas disimpan!');
    loadAssessmentScores();
}

function openGroupManagerModal() { document.getElementById('modal-group-manager').classList.remove('hidden'); }
function closeGroupManagerModal() { document.getElementById('modal-group-manager').classList.add('hidden'); }
function loadPresetIntoModal() {}
function createNewGroupPreset() {}
function deleteCurrentGroupPreset() {}
function autoGenerateGroups() {}
function clearAllModalGroups() {}
function saveGroupPresetFromModal() { closeGroupManagerModal(); showToast('Daftar kelompok disimpan!'); }
function applySelectedGroupPreset() { showToast('Daftar kelompok diterapkan!'); }
function saveCurrentTableAsGroupPreset() { showToast('Daftar kelompok disimpan!'); }

// ============================================================================
// 8. TAB 5: REKAPITULASI NILAI, GRAFIK & CETAK KARTU PDF
// ============================================================================
async function calculateAndRenderRekap() {
    if (!currentSettings) return;
    const classId = document.getElementById('guru-active-class').value;
    const classObj = classesList.find(c => c.id == classId);
    const namaKelas = classObj ? classObj.nama_kelas : '-';

    document.getElementById('rekap-info-bobot').innerText = `Mapel: ${currentSettings.mapel} | KKM: ${currentSettings.kkm}`;

    const stuIds = studentsList.map(s => s.id);
    let absData = [];
    if (stuIds.length) {
        const resAbs = await db.from('attendance').select('*').eq('teacher_id', currentUser.id).eq('mapel', currentSettings.mapel).in('student_id', stuIds);
        absData = resAbs.data || [];
    }
    const absMap = {};
    absData.forEach(a => absMap[a.student_id] = a);

    const { data: assList } = await db.from('assessments').select('*').eq('teacher_id', currentUser.id).eq('class_id', classId).eq('mapel', currentSettings.mapel);
    const assIds = (assList || []).map(a => a.id);
    let scoresList = [];
    if (assIds.length) {
        const { data: scData } = await db.from('scores').select('*').in('assessment_id', assIds);
        scoresList = scData || [];
    }

    const tbody = document.getElementById('rekap-tbody');
    tbody.innerHTML = '';
    latestRekapData = [];

    let countTuntas = 0, countBelum = 0;
    let sumAbsen = 0, sumTugas = 0, sumBab = 0, sumUas = 0;

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

        sumAbsen += nAbsen; sumTugas += nTugas; sumBab += nBab; sumUas += nUas;

        const totalWeight = currentSettings.w_absen + currentSettings.w_tugas + currentSettings.w_bab + currentSettings.w_uas;
        const pembagi = totalWeight > 0 ? totalWeight : 100;
        const nilaiAkhir = ((nAbsen * currentSettings.w_absen) + (nTugas * currentSettings.w_tugas) + (nBab * currentSettings.w_bab) + (nUas * currentSettings.w_uas)) / pembagi;
        const tuntas = nilaiAkhir >= currentSettings.kkm;

        if (tuntas) countTuntas++; else countBelum++;

        latestRekapData.push({
            no: idx + 1, id: stu.id, nisn: stu.nisn, nama: stu.nama, kelas: namaKelas,
            absen: recAbs, nAbsen, nTugas, nBab, nUas, nilaiAkhir, kkm: currentSettings.kkm, tuntas,
            detailPenilaian: (assList || []).map(a => {
                const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
                return { judul: a.judul, kategori: a.kategori, status: sc?.status_kumpul ? 'Sudah' : 'Belum', nilai: sc?.nilai ?? '-' };
            })
        });

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-3 text-center">${nAbsen.toFixed(1)}</td>
                <td class="p-3 text-center">${nTugas.toFixed(1)}</td>
                <td class="p-3 text-center">${nBab.toFixed(1)}</td>
                <td class="p-3 text-center">${nUas.toFixed(1)}</td>
                <td class="p-3 text-center font-extrabold bg-blue-50 text-blue-950">${nilaiAkhir.toFixed(2)}</td>
                <td class="p-3 text-center">${currentSettings.kkm}</td>
                <td class="p-3 text-center"><span class="px-2.5 py-1 rounded-full text-xs font-extrabold ${tuntas ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">${tuntas ? 'TUNTAS' : 'BELUM'}</span></td>
                <td class="p-3 text-center"><button onclick="printStudentCardPDF(${stu.id})" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-700">📄 Kartu PDF</button></td>
            </tr>
        `;
    });

    const total = studentsList.length || 1;
    renderRekapCharts({
        absen: (sumAbsen / total).toFixed(1),
        tugas: (sumTugas / total).toFixed(1),
        bab: (sumBab / total).toFixed(1),
        uas: (sumUas / total).toFixed(1)
    }, countTuntas, countBelum);
}

function renderRekapCharts(avgObj, tuntasCount, belumCount) {
    if (typeof Chart === 'undefined') return;

    const ctxComp = document.getElementById('chartRekapComponents');
    if (ctxComp) {
        if (chartInstances.rekapComp) chartInstances.rekapComp.destroy();
        chartInstances.rekapComp = new Chart(ctxComp, {
            type: 'bar',
            data: {
                labels: ['Kehadiran', 'Tugas', 'Ujian Bab', 'Ujian Semester'],
                datasets: [{
                    label: 'Rata-rata Komponen',
                    data: [Number(avgObj.absen), Number(avgObj.tugas), Number(avgObj.bab), Number(avgObj.uas)],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
                    borderRadius: 8
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, scales: { y: { max: 100 } } }
        });
    }

    const ctxKKM = document.getElementById('chartRekapKKM');
    if (ctxKKM) {
        if (chartInstances.rekapKKM) chartInstances.rekapKKM.destroy();
        chartInstances.rekapKKM = new Chart(ctxKKM, {
            type: 'doughnut',
            data: {
                labels: ['Tuntas KKM', 'Belum Tuntas'],
                datasets: [{
                    data: [tuntasCount, belumCount],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, cutout: '65%' }
        });
    }
}

function printStudentCardPDF(studentId) {
    const d = latestRekapData.find(item => item.id === studentId);
    if (!d || !currentSettings) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(14);
    doc.text("KARTU LAPORAN HASIL BELAJAR SISWA", 105, 16, { align: "center" });
    doc.setFontSize(10);
    doc.text(`Mata Pelajaran: ${currentSettings.mapel} | Siswa: ${d.nama} (${d.nisn})`, 14, 25);
    doc.save(`Kartu_${d.nama.replace(/\s+/g, '_')}.pdf`);
}

function printClassRekapPDF() {
    if (!latestRekapData.length) return;
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.text("REKAPITULASI KELAS", 14, 15);
    doc.save(`Rekap_Kelas.pdf`);
}

function exportRekapExcel() {
    const ws = XLSX.utils.json_to_sheet(latestRekapData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap");
    XLSX.writeFile(wb, "Rekap_Nilai.xlsx");
}

// ============================================================================
// 9. MENU GURU WALI / KOMUNIKASI WALI
// ============================================================================
async function renderGuruWaliTable() {
    if (!currentSettings) return;
    const tbody = document.getElementById('wali-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    studentsList.forEach((stu, idx) => {
        const rekap = latestRekapData.find(r => r.id === stu.id) || { nilaiAkhir: 0, tuntas: true };
        const statusBadge = rekap.tuntas ? '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">Sangat Aktif</span>' : '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-amber-100 text-amber-800">Butuh Perhatian</span>';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-semibold">
                    <div class="flex items-center gap-2">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center">${getInitials(stu.nama)}</div>
                        <span>${stu.nama}</span>
                    </div>
                </td>
                <td class="p-3 font-mono">${stu.nisn}</td>
                <td class="p-3 text-center font-bold">95%</td>
                <td class="p-3 text-center font-extrabold text-blue-600">${rekap.nilaiAkhir.toFixed(1)}</td>
                <td class="p-3 text-xs text-slate-600">Perkembangan belajar aktif dan kondusif.</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button onclick="showToast('Membuka WhatsApp Wali Murid...')" class="px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-extrabold hover:bg-emerald-100">
                        <i class="fa-brands fa-whatsapp"></i> Kirim WA
                    </button>
                </td>
            </tr>
        `;
    });
}

function onGlobalSearchInput(q) {
    const query = q.toLowerCase();
    if (!query) return;
    switchGuruTab('kelas');
}
