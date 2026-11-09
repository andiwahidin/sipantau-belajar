// ============================================================================
// FILE: app-guru.js (v4.7 - Full Integration + Guru Wali 360 PA + Mobile Sidebar)
// BAGIAN 1 DARI 3: State, Helper Semester, Auth, Admin, Navigasi & Dashboard
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

let classGroupPresets = {};
let activePresetKey = 'Kelompok Default';

function getLocalTodayString() {
    const d = new Date();
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// Helper: Menentukan rentang tanggal semester aktif (Ganjil: Juli-Des, Genap: Jan-Jun)
function getActiveSemesterDateRange() {
    const d = new Date();
    const currentMonth = d.getMonth() + 1;
    const currentYear = d.getFullYear();
    const isGanjil = currentMonth >= 7 && currentMonth <= 12;

    if (isGanjil) {
        return {
            label: `Semester Ganjil ${currentYear}`,
            start: `${currentYear}-07-01`,
            end: `${currentYear}-12-31`
        };
    } else {
        return {
            label: `Semester Genap ${currentYear}`,
            start: `${currentYear}-01-01`,
            end: `${currentYear}-06-30`
        };
    }
}

// Helper: Normalisasi Kategori Database (tugas, ujian_bab, ujian_semester)
function isKategoriTugas(kat) {
    return kat === 'tugas' || kat === 'tugas_individu' || kat === 'tugas_kelompok';
}
function isKategoriUjianBab(kat) {
    return kat === 'ujian_bab';
}
function isKategoriUjianSemester(kat) {
    return kat === 'ujian_semester' || kat === 'ujian_sumatif';
}
function formatKategoriLabel(ass) {
    if (!ass) return '-';
    if (ass.kategori === 'tugas_individu') return 'Tugas Individu';
    if (ass.kategori === 'tugas_kelompok') return 'Tugas Kelompok';
    if (ass.kategori === 'tugas') {
        return ass.tipe_kerja === 'kelompok' ? 'Tugas Kelompok' : 'Tugas Individu';
    }
    if (ass.kategori === 'ujian_bab') return 'Ujian Akhir Bab';
    if (ass.kategori === 'ujian_semester' || ass.kategori === 'ujian_sumatif') return 'Ujian Semester';
    return 'Tugas';
}

// Toggle Sidebar Vertikal di Layar HP (Mobile)
function toggleMobileSidebar(forceClose = false) {
    const sidebar = document.getElementById('main-sidebar');
    if (!sidebar) return;

    if (forceClose || !sidebar.classList.contains('hidden')) {
        sidebar.classList.add('hidden');
        sidebar.classList.remove('flex', 'fixed', 'inset-y-0', 'left-0', 'shadow-2xl');
    } else {
        sidebar.classList.remove('hidden');
        sidebar.classList.add('flex', 'fixed', 'inset-y-0', 'left-0', 'shadow-2xl');
    }
}

window.onload = async () => {
    const dp = document.getElementById('abs-date-picker');
    if (dp) dp.value = getLocalTodayString();

    const savedUser = localStorage.getItem('sipantau_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            updateAuthUI();
        } catch (e) {
            localStorage.removeItem('sipantau_user');
            switchView('login');
        }
    } else {
        switchView('login');
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

    const badge = document.getElementById('user-badge');
    if (badge) {
        badge.classList.remove('hidden');
        badge.classList.add('flex');
    }

    const elDispName = document.getElementById('user-display-name');
    const elRoleSub  = document.getElementById('user-role-subtitle');
    const elAvatar   = document.getElementById('topbar-avatar');

    if (elDispName) elDispName.innerText = currentUser.nama_lengkap || 'Guru';
    if (elRoleSub)  elRoleSub.innerText = currentUser.role === 'admin' ? 'Administrator Sistem' : 'Guru & Pembimbing';
    if (elAvatar && typeof getInitials === 'function') {
        elAvatar.innerText = getInitials(currentUser.nama_lengkap);
    }

    const navSidebar = document.getElementById('guru-tabs-nav');
    if (navSidebar) navSidebar.classList.remove('hidden');

    const adminSwitcher = document.getElementById('admin-nav-switcher');
    if (currentUser.role === 'admin') {
        if (adminSwitcher) {
            adminSwitcher.classList.remove('hidden');
            adminSwitcher.classList.add('flex');
        }
        switchAdminMode('teachers');
    } else {
        if (adminSwitcher) {
            adminSwitcher.classList.add('hidden');
            adminSwitcher.classList.remove('flex');
        }
        document.getElementById('guru-only-header')?.classList.remove('hidden');
        document.getElementById('admin-student-mode-banner')?.classList.add('hidden');
        document.getElementById('teacher-ampuan-cards')?.classList.remove('hidden');
        document.getElementById('guru-mapel-selector-box')?.classList.remove('hidden');
        document.getElementById('active-workspace-banner')?.classList.remove('hidden');
        switchView('guru');
        initGuruDashboard();
    }
}

async function switchAdminMode(mode) {
    if (!currentUser || currentUser.role !== 'admin') return;
    const btnTch = document.getElementById('adm-tab-teachers');
    const btnStu = document.getElementById('adm-tab-students');

    if (mode === 'teachers') {
        if (btnTch) btnTch.className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-600 text-white';
        if (btnStu) btnStu.className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600';
        switchView('admin');
        await loadAdminUsers();
    } else {
        if (btnStu) btnStu.className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold bg-blue-600 text-white';
        if (btnTch) btnTch.className = 'px-2.5 py-1 rounded-lg text-[11px] font-extrabold text-slate-600';

        switchView('guru');
        document.getElementById('guru-only-header')?.classList.remove('hidden');
        document.getElementById('admin-student-mode-banner')?.classList.remove('hidden');
        document.getElementById('teacher-ampuan-cards')?.classList.add('hidden');
        document.getElementById('guru-mapel-selector-box')?.classList.add('hidden');
        document.getElementById('active-workspace-banner')?.classList.add('hidden');

        switchGuruTab('kelas');
        const { data: cls } = await db.from('classes').select('*').order('nama_kelas');
        classesList = cls || [];
        const selClass = document.getElementById('guru-active-class');
        if (selClass) {
            selClass.innerHTML = classesList.length ? '' : '<option value="">-- Belum Ada Kelas --</option>';
            classesList.forEach(c => {
                selClass.innerHTML += `<option value="${c.id}">${c.nama_kelas}</option>`;
            });
        }

        if (classesList.length && selClass) {
            await fetchStudentsByClass(selClass.value);
        } else {
            const stuTbody = document.getElementById('stu-tbody');
            if (stuTbody) stuTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Belum ada kelas.</td></tr>';
        }
    }
}

function logout() {
    localStorage.removeItem('sipantau_user');
    currentUser = null;
    document.getElementById('admin-nav-switcher')?.classList.add('hidden');
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
    if (!tbody) return;
    tbody.innerHTML = '';
    (data || []).forEach(u => {
        const safeNama = u.nama_lengkap.replace(/'/g, "\\'");
        const safeUser = u.username.replace(/'/g, "\\'");
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-semibold text-slate-800">${u.nama_lengkap}</td>
                <td class="p-3 font-mono text-blue-700 font-bold">${u.username}</td>
                <td class="p-3">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600 whitespace-nowrap">
                        🔒 Terlindungi
                    </span>
                </td>
                <td class="p-3 uppercase text-xs font-extrabold text-slate-500">${u.role}</td>
                <td class="p-3 text-right space-x-1.5 whitespace-nowrap">
                    <button type="button" onclick="openEditTeacherModal(${u.id}, '${safeNama}', '${safeUser}')" class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100">
                        ✏️ Edit
                    </button>
                    ${u.role !== 'admin' ? `
                        <button type="button" onclick="resetTeacherPassword(${u.id}, '${safeUser}')" class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold hover:bg-amber-100">
                            🔄 Reset
                        </button>
                        <button type="button" onclick="deleteUser(${u.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100">
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
        return showToast('Gagal memperbarui guru: ' + error.message, 'error');
    }

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
// 2. NAVIGASI MENU & MANAJEMEN KELAS/MAPEL AMPUAN
// ============================================================================
function switchGuruTab(tab) {
    const allTabs = ['dashboard', 'kelas', 'absen', 'nilai', 'rekap', 'wali', 'bobot'];

    allTabs.forEach(t => {
        const pane = document.getElementById('gcontent-' + t);
        if (pane) pane.classList.add('hidden');

        const btn = document.getElementById('gtab-' + t);
        if (btn) {
            btn.classList.remove('active', 'bg-blue-50', 'text-blue-700');
            btn.classList.add('text-slate-600', 'hover:bg-slate-100');
        }
    });

    const activePane = document.getElementById('gcontent-' + tab);
    if (activePane) activePane.classList.remove('hidden');

    const activeBtn = document.getElementById('gtab-' + tab);
    if (activeBtn) {
        activeBtn.classList.add('active', 'bg-blue-50', 'text-blue-700');
        activeBtn.classList.remove('text-slate-600', 'hover:bg-slate-100');
    }

    try {
        if (tab === 'dashboard') loadDashboardMetrics();
        if (tab === 'bobot') loadSettingsForm();
        if (tab === 'absen') loadAttendanceTab();
        if (tab === 'nilai') loadAssessmentsDropdown();
        if (tab === 'rekap') calculateAndRenderRekap();
        if (tab === 'wali') renderGuruWaliTable();
    } catch (err) {
        console.error('Error saat berpindah tab:', err);
    }
}

async function initGuruDashboard() {
    switchGuruTab('dashboard');
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
    if (selClass) {
        selClass.innerHTML = classesList.length ? '' : '<option value="">-- Belum Ada Kelas --</option>';
        classesList.forEach(c => {
            selClass.innerHTML += `<option value="${c.id}">${c.nama_kelas}</option>`;
        });
    }

    if (!classesList.length) {
        renderAmpuanCards();
        updateWorkspaceBanner();
        const stuTbody = document.getElementById('stu-tbody');
        if (stuTbody) stuTbody.innerHTML = '<tr><td colspan="5" class="p-4 text-center text-slate-400">Silakan buat kelas terlebih dahulu di menu Data Siswa.</td></tr>';
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
        if (selClass) selClass.value = targetSetting.class_id;
        await populateMapelDropdownForClass(targetSetting.class_id, targetSetting.id);
    } else {
        const firstClassId = classesList[0].id;
        if (selClass) selClass.value = firstClassId;
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

    if (selMapel) {
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
            <button type="button" onclick="selectAmpuanCard(${amp.id})" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                isActive 
                ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-blue-50 hover:border-blue-200'
            }">
                <span>🏫 ${clsObj.nama_kelas}</span>
                <span class="${isActive ? 'text-blue-200' : 'text-slate-300'}">•</span>
                <span>📘 ${amp.mapel}</span>
            </button>
        `;
    });
}

function updateWorkspaceBanner() {
    const label = document.getElementById('workspace-label');
    const kkmLabel = document.getElementById('workspace-kkm-label');
    if (!label || !kkmLabel) return;

    if (!currentSettings) {
        label.innerText = 'Kelas Ini Belum Anda Ampu (Klik "+ Kelas/Mapel")';
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
    const allTabs = ['dashboard', 'kelas', 'absen', 'nilai', 'rekap', 'wali', 'bobot'];
    const activeTab = allTabs.find(t => {
        const el = document.getElementById('gcontent-' + t);
        return el && !el.classList.contains('hidden');
    });
    if (activeTab) switchGuruTab(activeTab);
}

function openAddAmpuanModal() {
    if (!classesList.length) {
        switchGuruTab('kelas');
        return showToast('Buat master kelas terlebih dahulu di menu Data Siswa!', 'error');
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
// 3. MENU 1: DASHBOARD PEMANTAUAN & CHART (SESUAI KATEGORI DATABASE)
// ============================================================================
async function loadDashboardMetrics() {
    const classId = document.getElementById('guru-active-class')?.value;
    const clsObj = classesList.find(c => c.id == classId);
    const titleEl = document.getElementById('dash-table-title');
    if (titleEl) {
        titleEl.innerText = `Daftar Pemantauan Siswa ${clsObj ? 'Kelas ' + clsObj.nama_kelas : ''}`;
    }

    const stuIds = studentsList.map(s => s.id);
    const tbody = document.getElementById('dash-student-tbody');
    if (!tbody) return;

    if (!currentSettings || !stuIds.length) {
        if (document.getElementById('dash-stat-attendance')) document.getElementById('dash-stat-attendance').innerText = '0%';
        if (document.getElementById('dash-stat-tasks')) document.getElementById('dash-stat-tasks').innerText = '0%';
        if (document.getElementById('dash-bar-tasks')) document.getElementById('dash-bar-tasks').style.width = '0%';
        if (document.getElementById('dash-stat-avg')) document.getElementById('dash-stat-avg').innerText = '0.0';
        if (document.getElementById('dash-stat-attention')) document.getElementById('dash-stat-attention').innerText = '0 Siswa';
        tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">Belum ada siswa atau mata pelajaran aktif di kelas ini.</td></tr>';
        renderDashboardCharts(100, 0, 0, [], [], []);
        return;
    }

    const semesterRange = getActiveSemesterDateRange();

    const { data: absData } = await db.from('attendance')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('mapel', currentSettings.mapel)
        .in('student_id', stuIds);
    const absMap = {};
    (absData || []).forEach(a => absMap[a.student_id] = a);

    const { data: logsData } = await db.from('attendance_logs')
        .select('tanggal, status')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .gte('tanggal', semesterRange.start)
        .lte('tanggal', semesterRange.end)
        .order('tanggal', { ascending: true });

    const { data: assList } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('id');

    const safeAssList = assList || [];
    const assIds = safeAssList.map(a => a.id);
    let scoresList = [];
    if (assIds.length) {
        const { data: scData } = await db.from('scores').select('*').in('assessment_id', assIds);
        scoresList = scData || [];
    }

    let sumHadir = 0, sumSakitIzin = 0, sumAlpa = 0;
    let totalSubmitted = 0;
    const totalPossibleTasks = studentsList.length * safeAssList.length;
    let sumFinalScore = 0;
    let attentionCount = 0;

    tbody.innerHTML = '';

    studentsList.forEach(stu => {
        const recAbs = absMap[stu.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        sumHadir += recAbs.hadir;
        sumSakitIzin += (recAbs.sakit + recAbs.izin);
        sumAlpa += recAbs.alpa;

        const stuTotalMeet = recAbs.hadir + recAbs.sakit + recAbs.izin + recAbs.alpa;
        const stuHadirPct = stuTotalMeet > 0 ? (recAbs.hadir / stuTotalMeet) * 100 : 100;

        let stuTasksDone = 0;
        safeAssList.forEach(a => {
            const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
            if (sc && sc.status_kumpul) stuTasksDone++;
        });
        totalSubmitted += stuTasksDone;

        const avgByFilter = (filterFn) => {
            const katAss = safeAssList.filter(filterFn);
            if (!katAss.length) return 0;
            let total = 0;
            katAss.forEach(a => {
                const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
                total += (sc && sc.nilai !== null) ? Number(sc.nilai) : 0;
            });
            return total / katAss.length;
        };

        const nAbsen = Number(calcAttendanceScore(recAbs.hadir, recAbs.sakit, recAbs.izin, recAbs.alpa));
        const nTugas = avgByFilter(a => isKategoriTugas(a.kategori));
        const nBab   = avgByFilter(a => isKategoriUjianBab(a.kategori));
        const nSmt   = avgByFilter(a => isKategoriUjianSemester(a.kategori));

        const totalWeight = currentSettings.w_absen + currentSettings.w_tugas + currentSettings.w_bab + currentSettings.w_uas;
        const pembagi = totalWeight > 0 ? totalWeight : 100;
        const nilaiAkhir = ((nAbsen * currentSettings.w_absen) + (nTugas * currentSettings.w_tugas) + (nBab * currentSettings.w_bab) + (nSmt * currentSettings.w_uas)) / pembagi;
        sumFinalScore += nilaiAkhir;

        const isAttention = (nilaiAkhir < currentSettings.kkm && safeAssList.length > 0) || stuHadirPct < 85 || (safeAssList.length > 0 && stuTasksDone < safeAssList.length);
        if (isAttention) attentionCount++;

        let statusBadge = isAttention 
            ? '<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800">Butuh Perhatian</span>'
            : '<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800">Sangat Aktif</span>';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 font-semibold text-slate-900">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            ${typeof getInitials === 'function' ? getInitials(stu.nama) : 'S'}
                        </div>
                        <div>
                            <span class="block text-slate-900 font-bold">${stu.nama}</span>
                            <span class="block text-[11px] font-mono text-slate-400">${stu.nisn}</span>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-center font-bold text-slate-700">${stuHadirPct.toFixed(0)}%</td>
                <td class="p-3 text-center font-semibold text-slate-700">${stuTasksDone}/${safeAssList.length}</td>
                <td class="p-3 text-center font-extrabold text-blue-700">${nilaiAkhir.toFixed(1)}</td>
                <td class="p-3 text-center">${statusBadge}</td>
                <td class="p-3 text-center">
                    <button type="button" onclick="switchGuruTab('rekap')" class="px-3 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs">Detail</button>
                </td>
            </tr>
        `;
    });

    const grandTotalMeet = sumHadir + sumSakitIzin + sumAlpa;
    const pctHadir = grandTotalMeet > 0 ? ((sumHadir / grandTotalMeet) * 100).toFixed(1) : '100.0';
    const pctSI    = grandTotalMeet > 0 ? ((sumSakitIzin / grandTotalMeet) * 100).toFixed(1) : '0.0';
    const pctAlpa  = grandTotalMeet > 0 ? ((sumAlpa / grandTotalMeet) * 100).toFixed(1) : '0.0';

    const pctTasks = totalPossibleTasks > 0 ? ((totalSubmitted / totalPossibleTasks) * 100).toFixed(1) : '0.0';
    const pctTasksPending = totalPossibleTasks > 0 ? (100 - Number(pctTasks)).toFixed(1) : '0.0';
    const avgClassScore = studentsList.length > 0 ? (sumFinalScore / studentsList.length).toFixed(1) : '0.0';

    if (document.getElementById('dash-stat-attendance')) document.getElementById('dash-stat-attendance').innerText = `${pctHadir}%`;
    if (document.getElementById('dash-stat-att-detail')) {
        document.getElementById('dash-stat-att-detail').innerHTML = `
            <div><span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>Hadir: ${pctHadir}%</div>
            <div><span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>Izin/Sakit: ${pctSI}%</div>
            <div><span class="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1"></span>Alpa: ${pctAlpa}%</div>
        `;
    }

    if (document.getElementById('dash-stat-tasks')) document.getElementById('dash-stat-tasks').innerText = `${pctTasks}%`;
    if (document.getElementById('dash-bar-tasks')) document.getElementById('dash-bar-tasks').style.width = `${pctTasks}%`;
    if (document.getElementById('dash-stat-tasks-detail')) {
        document.getElementById('dash-stat-tasks-detail').innerHTML = `
            <span><b class="text-emerald-600">●</b> Terkumpul: ${pctTasks}%</span>
            <span><b class="text-rose-500">●</b> Belum: ${pctTasksPending}%</span>
        `;
    }

    if (document.getElementById('dash-stat-avg')) document.getElementById('dash-stat-avg').innerText = avgClassScore;
    if (document.getElementById('dash-stat-attention')) document.getElementById('dash-stat-attention').innerText = `${attentionCount} Siswa`;

    renderDashboardCharts(Number(pctHadir), Number(pctSI), Number(pctAlpa), logsData || [], safeAssList, scoresList);
}

function renderDashboardCharts(pctHadir, pctSI, pctAlpa, logsData, assList, scoresList = []) {
    if (typeof Chart === 'undefined') return;

    const ctxDonut = document.getElementById('chartDashDonutAtt');
    if (ctxDonut) {
        if (chartInstances.donutAtt) chartInstances.donutAtt.destroy();
        chartInstances.donutAtt = new Chart(ctxDonut, {
            type: 'doughnut',
            data: {
                labels: ['Hadir', 'Sakit/Izin', 'Alpa'],
                datasets: [{
                    data: [pctHadir || 100, pctSI || 0, pctAlpa || 0],
                    backgroundColor: ['#10b981', '#3b82f6', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: { legend: { display: false } }
            }
        });
    }

    const ctxTrend = document.getElementById('chartDashWeeklyTrend');
    if (ctxTrend) {
        if (chartInstances.weeklyTrend) chartInstances.weeklyTrend.destroy();

        const uniqueDates = [...new Set(logsData.map(l => l.tanggal))].sort();
        const labels = uniqueDates.length ? uniqueDates : ['Belum Ada Pertemuan'];
        const dataPts = uniqueDates.length ? uniqueDates.map(d => {
            const onDate = logsData.filter(l => l.tanggal === d);
            const h = onDate.filter(l => l.status === 'H').length;
            return onDate.length ? Math.round((h / onDate.length) * 100) : 100;
        }) : [pctHadir];

        chartInstances.weeklyTrend = new Chart(ctxTrend, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Kehadiran (%)',
                    data: dataPts,
                    borderColor: '#2563eb',
                    backgroundColor: 'rgba(37, 99, 235, 0.12)',
                    borderWidth: 2.5,
                    fill: true,
                    tension: 0.2,
                    pointRadius: 4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100 } }
            }
        });
    }

    const ctxTaskBar = document.getElementById('chartDashTaskBar');
    if (ctxTaskBar) {
        if (chartInstances.taskBar) chartInstances.taskBar.destroy();

        const hitungKategori = (filterFn) => {
            const filteredAss = (assList || []).filter(filterFn);
            if (!filteredAss.length || !studentsList.length) return 0;
            const totalMax = filteredAss.length * studentsList.length;
            let totalDone = 0;
            filteredAss.forEach(a => {
                totalDone += scoresList.filter(s => s.assessment_id === a.id && s.status_kumpul).length;
            });
            return totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0;
        };

        const pctTugas = hitungKategori(a => isKategoriTugas(a.kategori));
        const pctBab   = hitungKategori(a => isKategoriUjianBab(a.kategori));
        const pctSmt   = hitungKategori(a => isKategoriUjianSemester(a.kategori));

        chartInstances.taskBar = new Chart(ctxTaskBar, {
            type: 'bar',
            data: {
                labels: ['Tugas', 'Ujian Akhir Bab', 'Ujian Semester'],
                datasets: [{
                    label: 'Terkumpul (%)',
                    data: [pctTugas, pctBab, pctSmt],
                    backgroundColor: ['#3b82f6', '#10b981', '#8b5cf6'],
                    borderRadius: 8,
                    barPercentage: 0.5
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100 } }
            }
        });
    }
}
// ============================================================================
// BAGIAN 2 DARI 3: Kelola Siswa, Bobot/KKM, Kehadiran Semester & Tugas/Kelompok
// ============================================================================

// ============================================================================
// 4. TAB KELOLA KELAS & SISWA
// ============================================================================
async function checkSharedClassPermission(classId) {
    isCurrentClassLockedForGuru = false;
    otherTeachersInCurrentClass = [];

    if (!classId || !currentUser) return;

    if (currentUser.role === 'admin') {
        document.getElementById('shared-class-lock-banner')?.classList.add('hidden');
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
        if (banner) banner.classList.remove('hidden');
        if (info) info.innerHTML = `Kelas ini juga diampu oleh: <b>${otherTeachersInCurrentClass.join(', ')}</b>. Hanya Admin yang dapat mengedit/menghapus siswa.`;
    } else {
        document.getElementById('shared-class-lock-banner')?.classList.add('hidden');
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
    const badge = document.getElementById('stu-count-badge');
    if (badge) badge.innerText = `${studentsList.length} Siswa`;

    updateBulkDeleteToolbarUI();
    renderStudentsTableRows(studentsList);
}

function renderStudentsTableRows(listToRender) {
    const tbody = document.getElementById('stu-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const hasCheckboxCol = document.getElementById('stu-select-all-th') !== null;
    const colSpanCount = hasCheckboxCol ? 5 : 4;

    if (!listToRender.length) {
        tbody.innerHTML = `<tr><td colspan="${colSpanCount}" class="p-6 text-center text-slate-400">Belum ada siswa di kelas ini.</td></tr>`;
        return;
    }

    listToRender.forEach((s, idx) => {
        const isChecked = selectedStudentIds.has(s.id);
        const checkboxCell = hasCheckboxCol ? `
            <td class="p-3 text-center">
                <input type="checkbox" value="${s.id}" 
                    ${isChecked ? 'checked' : ''} 
                    ${isCurrentClassLockedForGuru ? 'disabled title="Dikunci karena kelas diampu bersama guru lain"' : ''}
                    onchange="onStudentCheckboxChange(${s.id}, this.checked)"
                    class="stu-row-check w-4 h-4 accent-blue-600 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed">
            </td>
        ` : '';

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                ${checkboxCell}
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono font-semibold text-slate-700 whitespace-nowrap">${s.nisn}</td>
                <td class="p-3 font-semibold text-slate-900">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            ${typeof getInitials === 'function' ? getInitials(s.nama) : 'S'}
                        </div>
                        <span>${s.nama}</span>
                    </div>
                </td>
                <td class="p-3 text-center space-x-1.5 whitespace-nowrap">
                    ${isCurrentClassLockedForGuru ? `
                        <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-500 border border-slate-200 text-[11px] font-bold">
                            🔒 Hanya Admin
                        </span>
                    ` : `
                        <button type="button" onclick="openEditStudentModal(${s.id})" class="px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 border border-blue-200 text-xs font-bold hover:bg-blue-100">
                            ✏️ Edit
                        </button>
                        <button type="button" onclick="initiateSingleStudentDelete(${s.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100">
                            🗑️ Hapus
                        </button>
                    `}
                </td>
            </tr>
        `;
    });
}

function onGlobalSearchInput(val) {
    const q = (val || '').trim().toLowerCase();
    if (!q) {
        renderStudentsTableRows(studentsList);
        return;
    }
    switchGuruTab('kelas');
    const filtered = studentsList.filter(s => 
        s.nama.toLowerCase().includes(q) || String(s.nisn).toLowerCase().includes(q)
    );
    renderStudentsTableRows(filtered);
}

function onStudentCheckboxChange(studentId, checked) {
    if (isCurrentClassLockedForGuru) return;
    if (checked) selectedStudentIds.add(studentId);
    else selectedStudentIds.delete(studentId);
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

    const selBadge = document.getElementById('selected-students-badge');
    const selCount = document.getElementById('btn-selected-count');
    if (selBadge) selBadge.innerText = `${count} dipilih`;
    if (selCount) selCount.innerText = count;

    if (btnSelected) btnSelected.disabled = isCurrentClassLockedForGuru || count === 0;
    if (btnAll) btnAll.disabled = isCurrentClassLockedForGuru || total === 0;
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
    if (!fileInput || !fileInput.files.length) return showToast('Pilih file Excel terlebih dahulu!', 'error');
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
// 5. TAB PENGATURAN BOBOT & KKM PER MAPEL
// ============================================================================
function loadSettingsForm() {
    if (!currentSettings) return;
    const setVal = (id, val) => {
        const el = document.getElementById(id);
        if (el && val !== undefined && val !== null) el.value = val;
    };
    setVal('set-mapel', currentSettings.mapel || 'Mata Pelajaran');
    setVal('set-kkm', currentSettings.kkm);
    setVal('set-wtugas', currentSettings.w_tugas);
    setVal('set-wbab', currentSettings.w_bab);
    setVal('set-wuas', currentSettings.w_uas);
    setVal('set-wabsen', currentSettings.w_absen);
    setVal('set-phadir', currentSettings.p_hadir);
    setVal('set-psakit', currentSettings.p_sakit);
    setVal('set-pizin', currentSettings.p_izin);
    setVal('set-palpa', currentSettings.p_alpa);
}

async function saveSettings(e) {
    e.preventDefault();
    if (!currentSettings) return showToast('Tambahkan kelas & mapel ampuan terlebih dahulu!', 'error');
    const oldMapel = currentSettings.mapel;
    const newMapel = document.getElementById('set-mapel').value.trim();

    const getNum = (id, fallback) => {
        const el = document.getElementById(id);
        return el && el.value !== '' ? Number(el.value) : fallback;
    };

    const payload = {
        mapel: newMapel,
        kkm: getNum('set-kkm', currentSettings.kkm),
        w_tugas: getNum('set-wtugas', currentSettings.w_tugas),
        w_bab: getNum('set-wbab', currentSettings.w_bab),
        w_uas: getNum('set-wuas', currentSettings.w_uas),
        w_absen: getNum('set-wabsen', currentSettings.w_absen),
        p_hadir: getNum('set-phadir', currentSettings.p_hadir ?? 100),
        p_sakit: getNum('set-psakit', currentSettings.p_sakit ?? 80),
        p_izin: getNum('set-pizin', currentSettings.p_izin ?? 80),
        p_alpa: getNum('set-palpa', currentSettings.p_alpa ?? 0),
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
// 6. TAB KEHADIRAN HARIAN & REKAP PERIODE SEMESTER AKTIF
// ============================================================================
function calcAttendanceScore(h, s, i, a) {
    const total = h + s + i + a;
    if (total === 0 || !currentSettings) return 100;
    const pH = currentSettings.p_hadir ?? 100;
    const pS = currentSettings.p_sakit ?? 80;
    const pI = currentSettings.p_izin ?? 80;
    const pA = currentSettings.p_alpa ?? 0;
    const poin = (h * pH) + (s * pS) + (i * pI) + (a * pA);
    return Math.min(100, Math.max(0, (poin / total))).toFixed(1);
}

async function loadAttendanceTab() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (classId && currentSettings) {
        await recalculateAttendanceSummaryFromLogs(classId, currentSettings.mapel);
    }
    await loadRecordedDates();
    await loadDailyAttendanceForDate();
    await loadAttendanceTable();
}

async function loadRecordedDates() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId || !currentSettings) return;

    const semesterRange = getActiveSemesterDateRange();

    const { data, error } = await db.from('attendance_logs')
        .select('tanggal, status')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .gte('tanggal', semesterRange.start)
        .lte('tanggal', semesterRange.end)
        .order('tanggal', { ascending: false });

    const sel = document.getElementById('abs-recorded-dates');
    const chipsContainer = document.getElementById('abs-date-chips');

    if (error) {
        if (sel) sel.innerHTML = `<option value="">-- Error Memuat Riwayat --</option>`;
        if (chipsContainer) chipsContainer.innerHTML = `<span class="text-xs text-rose-600 font-bold">⚠️ Gagal memuat riwayat tanggal.</span>`;
        return;
    }

    const uniqueDates = [...new Set((data || []).map(d => d.tanggal))];
    if (sel) sel.innerHTML = `<option value="">-- ${uniqueDates.length} Pertemuan (${semesterRange.label}) --</option>`;
    if (chipsContainer) chipsContainer.innerHTML = '';

    if (uniqueDates.length === 0) {
        if (chipsContainer) {
            chipsContainer.innerHTML = `<span class="text-xs text-slate-400 italic">Belum ada tanggal pertemuan tercatat pada periode <b>${semesterRange.label}</b>.</span>`;
        }
    } else {
        const currentPicked = document.getElementById('abs-date-picker')?.value || '';
        uniqueDates.forEach(tgl => {
            if (sel) sel.innerHTML += `<option value="${tgl}" ${tgl === currentPicked ? 'selected' : ''}>${tgl}</option>`;
            const logsOnDate = (data || []).filter(d => d.tanggal === tgl);
            const hCount = logsOnDate.filter(d => d.status === 'H').length;
            const isSelected = tgl === currentPicked;

            if (chipsContainer) {
                chipsContainer.innerHTML += `
                    <button type="button" onclick="selectRecordedDate('${tgl}')" class="px-3 py-1.5 rounded-xl text-xs font-bold border transition flex items-center gap-1.5 ${
                        isSelected 
                        ? 'bg-blue-600 text-white border-blue-600 shadow-sm' 
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-blue-50 hover:border-blue-300'
                    }">
                        <span>📅 ${tgl}</span>
                        <span class="px-1.5 py-0.5 rounded text-[10px] ${isSelected ? 'bg-blue-800 text-blue-100' : 'bg-emerald-50 text-emerald-700'}">H:${hCount}</span>
                    </button>
                `;
            }
        });
    }
}

function selectRecordedDate(val) {
    if (!val) return;
    const dp = document.getElementById('abs-date-picker');
    if (dp) dp.value = val;
    loadDailyAttendanceForDate();
    loadRecordedDates();
}

async function loadDailyAttendanceForDate() {
    const classId = document.getElementById('guru-active-class')?.value;
    const tanggal = document.getElementById('abs-date-picker')?.value;
    const tbody = document.getElementById('daily-absen-tbody');
    if (!classId || !tanggal || !currentSettings || !tbody) return;

    const { data } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .eq('tanggal', tanggal);

    const logMap = {};
    (data || []).forEach(l => logMap[l.student_id] = l.status);

    let countH = 0, countSI = 0, countA = 0;
    tbody.innerHTML = '';

    studentsList.forEach((stu, idx) => {
        const st = logMap[stu.id] || 'H';
        const isSaved = logMap[stu.id] !== undefined;
        if (st === 'H') countH++;
        else if (st === 'S' || st === 'I') countSI++;
        else if (st === 'A') countA++;

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
                            <input type="radio" name="dabs_${stu.id}" value="H" ${st === 'H' ? 'checked' : ''} onchange="recalcDailyStatPills()" class="hidden"> Hadir
                        </label>
                        <label class="px-2.5 sm:px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-amber-500 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="S" ${st === 'S' ? 'checked' : ''} onchange="recalcDailyStatPills()" class="hidden"> Sakit
                        </label>
                        <label class="px-2.5 sm:px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-sky-600 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="I" ${st === 'I' ? 'checked' : ''} onchange="recalcDailyStatPills()" class="hidden"> Izin
                        </label>
                        <label class="px-2.5 sm:px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-rose-600 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="A" ${st === 'A' ? 'checked' : ''} onchange="recalcDailyStatPills()" class="hidden"> Alpa
                        </label>
                    </div>
                </td>
            </tr>
        `;
    });

    const totalStu = studentsList.length || 1;
    if (document.getElementById('prs-stat-rate')) document.getElementById('prs-stat-rate').innerText = `${((countH / totalStu) * 100).toFixed(1)}%`;
    if (document.getElementById('prs-stat-hadir')) document.getElementById('prs-stat-hadir').innerText = countH;
    if (document.getElementById('prs-stat-sakitizin')) document.getElementById('prs-stat-sakitizin').innerText = countSI;
    if (document.getElementById('prs-stat-alpa')) document.getElementById('prs-stat-alpa').innerText = countA;
}

function recalcDailyStatPills() {
    let h = 0, si = 0, a = 0;
    studentsList.forEach(stu => {
        const checked = document.querySelector(`input[name="dabs_${stu.id}"]:checked`);
        const val = checked ? checked.value : 'H';
        if (val === 'H') h++;
        else if (val === 'S' || val === 'I') si++;
        else if (val === 'A') a++;
    });
    const total = studentsList.length || 1;
    if (document.getElementById('prs-stat-rate')) document.getElementById('prs-stat-rate').innerText = `${((h / total) * 100).toFixed(1)}%`;
    if (document.getElementById('prs-stat-hadir')) document.getElementById('prs-stat-hadir').innerText = h;
    if (document.getElementById('prs-stat-sakitizin')) document.getElementById('prs-stat-sakitizin').innerText = si;
    if (document.getElementById('prs-stat-alpa')) document.getElementById('prs-stat-alpa').innerText = a;
}

function markAllPresentDaily() {
    studentsList.forEach(stu => {
        const radioH = document.querySelector(`input[name="dabs_${stu.id}"][value="H"]`);
        if (radioH) radioH.checked = true;
    });
    recalcDailyStatPills();
}

async function saveDailyAttendance() {
    const class_id = Number(document.getElementById('guru-active-class').value);
    const tanggal = document.getElementById('abs-date-picker')?.value;
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
    const tanggal = document.getElementById('abs-date-picker')?.value;
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
    const semesterRange = getActiveSemesterDateRange();

    const { data: logs, error } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', mapelName)
        .gte('tanggal', semesterRange.start)
        .lte('tanggal', semesterRange.end);

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
    const semesterRange = getActiveSemesterDateRange();

    const { data: logs } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .gte('tanggal', semesterRange.start)
        .lte('tanggal', semesterRange.end)
        .order('tanggal', { ascending: true });

    const dates = [...new Set((logs || []).map(l => l.tanggal))];
    const rows = studentsList.map((stu, idx) => {
        const rowObj = { No: idx + 1, NISN: stu.nisn, Nama: stu.nama, Mapel: currentSettings.mapel, Periode: semesterRange.label };
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
    XLSX.utils.book_append_sheet(wb, ws, "Absensi_Semester");
    XLSX.writeFile(wb, `Matriks_Absensi_${currentSettings.mapel}_${semesterRange.label.replace(/\s+/g, '_')}.xlsx`);
}

async function loadAttendanceTable() {
    if (!currentSettings) return;
    const stuIds = studentsList.map(s => s.id);
    const semesterRange = getActiveSemesterDateRange();

    const periodBadge = document.getElementById('abs-semester-period-badge');
    if (periodBadge) {
        periodBadge.innerText = `Periode Aktif: ${semesterRange.label}`;
    }

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
    if (!tbody) return;
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
    if (!fileInput || !fileInput.files.length) return showToast('Pilih file Excel kehadiran!', 'error');
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
// 7. TAB TUGAS, SISTEM INDIVIDU/KELOMPOK, VISIBILITAS & PRESET KELOMPOK
// ============================================================================
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

    try {
        const raw = localStorage.getItem(getGroupStorageKey());
        if (raw) {
            const parsed = JSON.parse(raw);
            if (parsed && typeof parsed === 'object') presets = { ...parsed };
        }
    } catch (e) {}

    if (currentSettings && currentSettings.kelompok_template && typeof currentSettings.kelompok_template === 'object') {
        presets = { ...presets, ...currentSettings.kelompok_template };
    }

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
    } catch (e) {}

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
    } catch (e) {}

    if (currentSettings && currentSettings.id) {
        try {
            const { error } = await db.from('teacher_settings')
                .update({ kelompok_template: cleanPresets })
                .eq('id', currentSettings.id);
            if (!error) {
                currentSettings.kelompok_template = cleanPresets;
            }
        } catch (e) {}
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
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId || !currentSettings) return;

    const { data } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('id');

    currentAssessments = data || [];
    const sel = document.getElementById('active-assessment');
    if (!sel) return;
    const prevSelected = keepSelectedId || sel.value;

    sel.innerHTML = currentAssessments.length ? '' : '<option value="">-- Belum Ada Penilaian di Mapel Ini --</option>';
    currentAssessments.forEach(a => {
        const labelKat = formatKategoriLabel(a);
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
    const kategori = document.getElementById('ass-kategori').value; // 'tugas', 'ujian_bab', 'ujian_semester'
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
    const assId = document.getElementById('active-assessment')?.value;
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

    showToast('Detail penilaian (Judul, Kategori, Individu/Kelompok & Link) berhasil diperbarui!');
    await loadAssessmentsDropdown(assId);
}

async function toggleAssessmentPublicVisibility() {
    const assId = document.getElementById('active-assessment')?.value;
    if (!assId) return;
    const assObj = currentAssessments.find(a => a.id == assId);
    if (!assObj) return;

    const currentPub = assObj.tampil_publik !== false;
    const newPub = !currentPub;

    const { error } = await db.from('assessments')
        .update({ tampil_publik: newPub })
        .eq('id', assId);

    if (error) {
        return showToast('Gagal mengubah visibilitas!', 'error');
    }

    assObj.tampil_publik = newPub;
    showToast(newPub ? '🌐 Tugas DITAMPILKAN di halaman publik siswa.' : '🔒 Tugas DISEMBUNYIKAN dari halaman publik siswa.');
    await loadAssessmentsDropdown(assId);
}

function renderAssLinkEditor(assObj) {
    const box = document.getElementById('ass-link-editor');
    if (!box) return;
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
    if (katSelect) {
        let valKat = assObj.kategori || 'tugas';
        if (valKat === 'tugas_individu' || valKat === 'tugas_kelompok') valKat = 'tugas';
        if (valKat === 'ujian_sumatif') valKat = 'ujian_semester';
        katSelect.value = valKat;
    }
    if (tipeSelect) {
        let valTipe = assObj.tipe_kerja || 'individu';
        if (assObj.kategori === 'tugas_kelompok') valTipe = 'kelompok';
        tipeSelect.value = valTipe;
    }
    if (input) input.value = assObj.link_pengumpulan || '';

    if (btnTest) {
        if (assObj.link_pengumpulan) {
            btnTest.href = assObj.link_pengumpulan;
            btnTest.classList.remove('hidden');
        } else {
            btnTest.classList.add('hidden');
        }
    }

    const isPublic = assObj.tampil_publik !== false;
    if (btnToggle) {
        if (isPublic) {
            btnToggle.className = 'px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-emerald-600 text-white hover:bg-emerald-700 transition shadow-sm';
            btnToggle.innerHTML = '🌐 Ditampilkan (Klik Sembunyi)';
        } else {
            btnToggle.className = 'px-3.5 py-1.5 rounded-xl text-xs font-extrabold bg-slate-700 text-white hover:bg-slate-800 transition shadow-sm';
            btnToggle.innerHTML = '🔒 Disembunyikan (Klik Tampilkan)';
        }
    }
}

async function deleteCurrentAssessment() {
    const assId = document.getElementById('active-assessment')?.value;
    if (!assId || !confirm('Hapus penilaian beserta seluruh nilainya?')) return;
    await db.from('assessments').delete().eq('id', assId);
    showToast('Penilaian dihapus.');
    await loadAssessmentsDropdown();
}

async function loadAssessmentScores() {
    const assId = document.getElementById('active-assessment')?.value;
    const tbody = document.getElementById('scores-tbody');
    if (!tbody) return;
    const tableEl = tbody.closest('table');
    const theadEl = tableEl ? tableEl.querySelector('thead') : null;

    if (document.getElementById('tgs-stat-total')) {
        document.getElementById('tgs-stat-total').innerText = currentAssessments.length;
    }

    if (!assId) {
        document.getElementById('ass-link-editor')?.classList.add('hidden');
        document.getElementById('group-mode-banner')?.classList.add('hidden');
        if (document.getElementById('tgs-stat-submit')) document.getElementById('tgs-stat-submit').innerText = '0%';
        if (document.getElementById('tgs-stat-ungraded')) document.getElementById('tgs-stat-ungraded').innerText = '0';
        if (document.getElementById('tgs-stat-avg')) document.getElementById('tgs-stat-avg').innerText = '0.0';
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Silakan buat atau pilih penilaian di atas.</td></tr>';
        return;
    }

    const assObj = currentAssessments.find(a => a.id == assId);
    renderAssLinkEditor(assObj);

    const isGroup = assObj && (assObj.tipe_kerja === 'kelompok' || assObj.kategori === 'tugas_kelompok');
    document.getElementById('group-mode-banner')?.classList.toggle('hidden', !isGroup);

    if (theadEl) {
        theadEl.innerHTML = `
            <tr class="bg-slate-100 text-slate-700">
                <th class="p-3 border-b text-left col-nisn">NISN</th>
                <th class="p-3 border-b text-left col-nama">Nama Siswa</th>
                <th id="th-kelompok" class="p-3 border-b text-left min-w-[130px] ${!isGroup ? 'hidden' : ''}">Kelompok</th>
                <th class="p-3 border-b text-center min-w-[110px]">Status Kumpul</th>
                <th class="p-3 border-b text-center min-w-[110px]">Nilai (0-100)</th>
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

    const fallbackPresetMap = (isGroup && !hasSavedGroupsInTask && classGroupPresets[activePresetKey])
        ? classGroupPresets[activePresetKey]
        : {};

    tbody.innerHTML = '';
    let submittedCount = 0, sumScore = 0, gradedCount = 0;

    studentsList.forEach(stu => {
        const sc = scoreMap[stu.id] || { nama_kelompok: '', status_kumpul: false, link_tugas_siswa: '', nilai: null };
        if (sc.status_kumpul) submittedCount++;
        if (sc.nilai !== null && sc.nilai !== undefined) {
            sumScore += Number(sc.nilai);
            gradedCount++;
        }

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
                        class="sc-group w-full border rounded-lg p-1.5 text-xs font-semibold text-blue-950 bg-white">
                </td>
                <td class="p-2 text-center whitespace-nowrap">
                    <label class="inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" ${sc.status_kumpul ? 'checked' : ''} onchange="onStatusOrScoreChange(this)" class="sc-status w-4 h-4 accent-blue-600 cursor-pointer">
                        <span class="text-xs ml-1.5 font-semibold">Sudah</span>
                    </label>
                </td>
                <td class="p-2">
                    <input type="number" step="0.1" min="0" max="100" value="${valNilai}" placeholder="-" oninput="onStatusOrScoreChange(this)" class="sc-nilai w-full border rounded-lg p-1.5 text-center font-bold">
                </td>
                <td class="p-2">
                    <div class="flex items-center gap-1">
                        <input type="url" value="${safeLink}" placeholder="https://..." oninput="onStatusOrScoreChange(this)" class="sc-link w-full border rounded-lg p-1.5 text-xs">
                        ${valLink ? `<a href="${safeLink}" target="_blank" class="px-2 py-1 bg-blue-50 text-blue-700 rounded-lg text-xs font-bold shrink-0">↗</a>` : ''}
                    </div>
                </td>
            </tr>
        `;
    });

    const totalStu = studentsList.length || 1;
    if (document.getElementById('tgs-stat-submit')) document.getElementById('tgs-stat-submit').innerText = `${((submittedCount / totalStu) * 100).toFixed(1)}%`;
    if (document.getElementById('tgs-stat-ungraded')) document.getElementById('tgs-stat-ungraded').innerText = studentsList.length - gradedCount;
    if (document.getElementById('tgs-stat-avg')) document.getElementById('tgs-stat-avg').innerText = gradedCount > 0 ? (sumScore / gradedCount).toFixed(1) : '0.0';
}
// ============================================================================
// BAGIAN 3 DARI 3: Sinkronisasi Kelompok, Rekap/Grafik & Guru Wali 360° (PA)
// ============================================================================

function onStudentGroupNameInput(groupInputEl) {
    const tr = groupInputEl.closest('tr');
    if (!tr) return;
    const targetGroup = groupInputEl.value.trim().toLowerCase();
    if (!targetGroup) return;

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
    const groupName = tr.querySelector('.sc-group')?.value.trim().toLowerCase();
    if (!groupName) return;

    const currentNilai = tr.querySelector('.sc-nilai').value;
    const currentLink = tr.querySelector('.sc-link').value;
    const currentStatus = tr.querySelector('.sc-status').checked;

    document.querySelectorAll('#scores-tbody tr').forEach(row => {
        if (row === tr) return;
        const g = row.querySelector('.sc-group')?.value.trim().toLowerCase();
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
    showToast(`Daftar "${presetKey}" diterapkan (${count} siswa).`);
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
    showToast(`Daftar kelompok "${cleanName}" (${filledCount} siswa) berhasil disimpan!`);
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
                        class="gm-stu-group w-full border border-slate-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold outline-none focus:ring-2 focus:ring-blue-500">
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
        <span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-blue-100 text-blue-800 border border-blue-200">
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
    const newName = prompt('Masukkan nama Daftar Kelompok baru:');
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
        return showToast('Minimal harus ada 1 daftar kelompok.', 'error');
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
        if (assObj && (assObj.tipe_kerja === 'kelompok' || assObj.kategori === 'tugas_kelompok')) {
            const selPreset = document.getElementById('select-group-preset');
            if (selPreset) selPreset.value = presetName;
            applySelectedGroupPreset();
        } else {
            showToast(`Daftar "${presetName}" disimpan! Pilih tugas bertipe Berkelompok.`);
        }
        closeGroupManagerModal();
    } else {
        showToast(`Daftar kelompok "${presetName}" berhasil disimpan!`);
    }
}

async function saveAssessmentScores() {
    const assId = Number(document.getElementById('active-assessment')?.value);
    if (!assId) return;

    const assObj = currentAssessments.find(a => a.id == assId);
    const isGroup = assObj && (assObj.tipe_kerja === 'kelompok' || assObj.kategori === 'tugas_kelompok');

    const rows = document.querySelectorAll('#scores-tbody tr');
    const upserts = [];
    const currentGroupMap = {};
    let hasGroupFilled = false;

    rows.forEach(r => {
        const student_id = Number(r.getAttribute('data-stuid'));
        const nama_kelompok = r.querySelector('.sc-group')?.value.trim() || '';
        const link_tugas_siswa = r.querySelector('.sc-link')?.value.trim() || '';
        const nilaiRaw = r.querySelector('.sc-nilai')?.value;
        const nilai = nilaiRaw === '' || nilaiRaw === undefined ? null : Number(nilaiRaw);
        const status_kumpul = (nilai !== null || link_tugas_siswa !== '') ? true : (r.querySelector('.sc-status')?.checked || false);

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
// 8. TAB REKAP NILAI AKHIR, GRAFIK KOMPONEN, EKSPOR & CETAK KARTU PDF
// ============================================================================
async function calculateAndRenderRekap() {
    if (!currentSettings) return;
    const classId = document.getElementById('guru-active-class').value;
    const classObj = classesList.find(c => c.id == classId);
    const namaKelas = classObj ? classObj.nama_kelas : '-';

    const infoBobot = document.getElementById('rekap-info-bobot');
    if (infoBobot) {
        infoBobot.innerText = `Mapel: ${currentSettings.mapel} | Kelas: ${namaKelas} | KKM: ${currentSettings.kkm} | Bobot: Absen (${currentSettings.w_absen}%), Tugas (${currentSettings.w_tugas}%), Ujian Bab (${currentSettings.w_bab}%), Ujian Smt (${currentSettings.w_uas}%)`;
    }

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
    if (!tbody) return;
    tbody.innerHTML = '';
    latestRekapData = [];

    let countTuntas = 0, countBelum = 0;
    let sumAbs = 0, sumTgs = 0, sumBab = 0, sumUas = 0;

    studentsList.forEach((stu, idx) => {
        const recAbs = absMap[stu.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        const nAbsen = Number(calcAttendanceScore(recAbs.hadir, recAbs.sakit, recAbs.izin, recAbs.alpa));

        const avgByFilter = (filterFn) => {
            const katAss = (assList || []).filter(filterFn);
            if (!katAss.length) return 0;
            let total = 0;
            katAss.forEach(a => {
                const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
                total += (sc && sc.nilai !== null) ? Number(sc.nilai) : 0;
            });
            return total / katAss.length;
        };

        const nTugas = avgByFilter(a => isKategoriTugas(a.kategori));
        const nBab   = avgByFilter(a => isKategoriUjianBab(a.kategori));
        const nUas   = avgByFilter(a => isKategoriUjianSemester(a.kategori));

        sumAbs += nAbsen;
        sumTgs += nTugas;
        sumBab += nBab;
        sumUas += nUas;

        const totalWeight = currentSettings.w_absen + currentSettings.w_tugas + currentSettings.w_bab + currentSettings.w_uas;
        const pembagi = totalWeight > 0 ? totalWeight : 100;

        const nilaiAkhir = (
            (nAbsen * currentSettings.w_absen) +
            (nTugas * currentSettings.w_tugas) +
            (nBab * currentSettings.w_bab) +
            (nUas * currentSettings.w_uas)
        ) / pembagi;

        const tuntas = nilaiAkhir >= currentSettings.kkm;
        if (tuntas) countTuntas++; else countBelum++;

        const detailPenilaian = (assList || []).map(a => {
            const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
            return {
                judul: a.judul,
                kategori: formatKategoriLabel(a),
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
                <td class="p-3 text-center font-extrabold bg-blue-50/70 text-blue-950">${nilaiAkhir.toFixed(2)}</td>
                <td class="p-3 text-center">${currentSettings.kkm}</td>
                <td class="p-3 text-center whitespace-nowrap">
                    <span class="px-2.5 py-1 rounded-full text-xs font-extrabold ${tuntas ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        ${tuntas ? 'TUNTAS' : 'BELUM TUNTAS'}
                    </span>
                </td>
                <td class="p-3 text-center whitespace-nowrap">
                    <button type="button" onclick="printStudentCardPDF(${stu.id})" class="bg-blue-600 text-white px-3 py-1 rounded-lg text-xs font-bold hover:bg-blue-700">
                        📄 Kartu PDF
                    </button>
                </td>
            </tr>
        `;
    });

    const nStu = studentsList.length || 1;
    renderRekapCharts({
        absen: (sumAbs / nStu).toFixed(1),
        tugas: (sumTgs / nStu).toFixed(1),
        bab: (sumBab / nStu).toFixed(1),
        uas: (sumUas / nStu).toFixed(1)
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
                labels: ['Kehadiran', 'Rata2 Tugas', 'Ujian Akhir Bab', 'Ujian Semester'],
                datasets: [{
                    label: 'Rata-rata Kelas',
                    data: [Number(avgObj.absen), Number(avgObj.tugas), Number(avgObj.bab), Number(avgObj.uas)],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#6366f1'],
                    borderRadius: 6
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: { y: { min: 0, max: 100 } }
            }
        });
    }

    const ctxKKM = document.getElementById('chartRekapKKM');
    if (ctxKKM) {
        if (chartInstances.rekapKKM) chartInstances.rekapKKM.destroy();
        chartInstances.rekapKKM = new Chart(ctxKKM, {
            type: 'doughnut',
            data: {
                labels: ['Tuntas (≥ KKM)', 'Belum Tuntas (< KKM)'],
                datasets: [{
                    data: [tuntasCount, belumCount],
                    backgroundColor: ['#2563eb', '#f97316'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '65%',
                plugins: { legend: { position: 'bottom', labels: { boxWidth: 12 } } }
            }
        });
    }
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
        headStyles: { fillColor: [37, 99, 235], fontSize: 8, halign: 'center' },
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
    if (!latestRekapData.length || !currentSettings) return showToast('Buka menu Grafik & Laporan terlebih dahulu!', 'error');
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
        headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
        bodyStyles: { fontSize: 9 }
    });

    doc.save(`Rekap_Kelas_${kelas}_${currentSettings.mapel}.pdf`);
}

function exportRekapExcel() {
    if (!latestRekapData.length) return showToast('Belum ada data rekap untuk diekspor!', 'error');
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

// ============================================================================
// 9. GURU WALI (PEMBIMBING AKADEMIK 360° LINTAS MAPEL & LINTAS KELAS)
// ============================================================================

let waliAllStudents = [];
let waliAllClassesMap = {};
let waliAllTeachersMap = {};
let waliMenteeRecords = {};
let waliComputedList = [];
let activeWaliStudentId = null;
let tempPickedMenteeIds = new Set();

function getWaliLocalStorageKey() {
    return `sipantau_guru_wali_v1_${currentUser ? currentUser.id : 'anon'}`;
}

async function renderGuruWaliTable() {
    await loadGuruWaliDashboard();
}

async function loadGuruWaliDashboard() {
    if (!currentUser) return;
    const tbody = document.getElementById('wali-tbody');
    if (tbody) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">Sedang memindai data akademik lintas mata pelajaran untuk siswa binaan Anda...</td></tr>`;
    }

    const semesterRange = getActiveSemesterDateRange();
    const semBadge = document.getElementById('wali-semester-badge');
    if (semBadge) semBadge.innerText = semesterRange.label;

    const [clsRes, tchRes, stuRes] = await Promise.all([
        db.from('classes').select('*').order('nama_kelas'),
        db.from('app_users').select('id, nama_lengkap').eq('role', 'guru'),
        db.from('students').select('*').order('nama')
    ]);

    waliAllClassesMap = {};
    (clsRes.data || []).forEach(c => { waliAllClassesMap[c.id] = c.nama_kelas; });

    waliAllTeachersMap = {};
    (tchRes.data || []).forEach(t => { waliAllTeachersMap[t.id] = t.nama_lengkap; });

    waliAllStudents = stuRes.data || [];

    await loadWaliMenteeRecords();

    const menteeIds = Object.keys(waliMenteeRecords).map(Number).filter(id => waliAllStudents.some(s => s.id === id));

    if (menteeIds.length === 0) {
        updateWaliSummaryCards(0, 0, 0, 0, 0);
        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="8" class="p-10 text-center space-y-3">
                        <div class="text-slate-500 font-bold text-sm">Anda belum memilih Siswa Binaan Akademik.</div>
                        <p class="text-xs text-slate-400 max-w-md mx-auto">Sebagai Guru Wali (Pembimbing Akademik), Anda dapat memilih siswa binaan dari berbagai kelas dan memantau nilai serta kehadiran mereka di seluruh mata pelajaran.</p>
                        <button type="button" onclick="openManageBinaanModal()" class="px-4 py-2 rounded-xl bg-blue-600 text-white text-xs font-extrabold shadow-sm hover:bg-blue-700">
                            + Pilih Siswa Binaan Sekarang
                        </button>
                    </td>
                </tr>
            `;
        }
        return;
    }

    const mentees = waliAllStudents.filter(s => menteeIds.includes(s.id));
    const menteeClassIds = [...new Set(mentees.map(s => s.class_id))];

    const [settingsRes, assRes, attSumRes, attLogsRes] = await Promise.all([
        db.from('teacher_settings').select('*').in('class_id', menteeClassIds),
        db.from('assessments').select('*').in('class_id', menteeClassIds),
        db.from('attendance').select('*').in('student_id', menteeIds),
        db.from('attendance_logs').select('*')
            .in('student_id', menteeIds)
            .gte('tanggal', semesterRange.start)
            .lte('tanggal', semesterRange.end)
            .order('tanggal', { ascending: false })
    ]);

    const allSettings = settingsRes.data || [];
    const allAssessments = assRes.data || [];
    const allAttSum = attSumRes.data || [];
    const allAttLogs = attLogsRes.data || [];

    const allAssIds = allAssessments.map(a => a.id);
    let allScores = [];
    if (allAssIds.length > 0) {
        const { data: scData } = await db.from('scores')
            .select('*')
            .in('student_id', menteeIds)
            .in('assessment_id', allAssIds);
        allScores = scData || [];
    }

    waliComputedList = mentees.map(stu => {
        return computeStudent360Profile(stu, allSettings, allAssessments, allScores, allAttSum, allAttLogs);
    });

    const amanCount = waliComputedList.filter(d => d.ewsStatus === 'aman').length;
    const waspadaCount = waliComputedList.filter(d => d.ewsStatus === 'waspada').length;
    const kritisCount = waliComputedList.filter(d => d.ewsStatus === 'kritis').length;

    updateWaliSummaryCards(waliComputedList.length, menteeClassIds.length, amanCount, waspadaCount, kritisCount);
    renderGuruWaliRows();
}

async function loadWaliMenteeRecords() {
    let records = {};

    try {
        const raw = localStorage.getItem(getWaliLocalStorageKey());
        if (raw) records = JSON.parse(raw) || {};
    } catch (e) {}

    try {
        const { data, error } = await db.from('guru_wali_binaan')
            .select('*')
            .eq('teacher_id', currentUser.id);
        if (!error && data) {
            const dbRecords = {};
            data.forEach(row => {
                dbRecords[row.student_id] = {
                    target_akademik: row.target_akademik || '',
                    jurnal_konseling: Array.isArray(row.jurnal_konseling) ? row.jurnal_konseling : []
                };
            });
            if (Object.keys(dbRecords).length > 0 || Object.keys(records).length === 0) {
                records = { ...records, ...dbRecords };
            }
        }
    } catch (e) {}

    waliMenteeRecords = records;
    saveWaliToLocalCache();
}

function saveWaliToLocalCache() {
    try {
        localStorage.setItem(getWaliLocalStorageKey(), JSON.stringify(waliMenteeRecords));
    } catch (e) {}
}

async function syncSingleMenteeToSupabase(studentId) {
    saveWaliToLocalCache();
    const rec = waliMenteeRecords[studentId];
    if (!rec) return;
    try {
        await db.from('guru_wali_binaan').upsert([{
            teacher_id: currentUser.id,
            student_id: Number(studentId),
            target_akademik: rec.target_akademik || '',
            jurnal_konseling: rec.jurnal_konseling || []
        }], { onConflict: 'teacher_id,student_id' });
    } catch (e) {}
}

function computeStudent360Profile(stu, allSettings, allAssessments, allScores, allAttSum, allAttLogs) {
    const namaKelas = waliAllClassesMap[stu.class_id] || '-';
    const stuLogs = allAttLogs.filter(l => l.student_id === stu.id);

    const dateMap = new Map();
    stuLogs.forEach(l => {
        if (!dateMap.has(l.tanggal)) dateMap.set(l.tanggal, []);
        dateMap.get(l.tanggal).push(l);
    });

    let hariHadir = 0, hariSakit = 0, hariIzin = 0, hariAlpa = 0;
    const absenceDatesList = [];

    dateMap.forEach((logsOnDay, tgl) => {
        const statuses = logsOnDay.map(x => x.status);
        const mapelNames = [...new Set(logsOnDay.map(x => x.mapel || 'Mapel'))].join(', ');
        if (statuses.includes('A')) {
            hariAlpa++;
            absenceDatesList.push({ tanggal: tgl, status: 'Alpa', mapel: mapelNames });
        } else if (statuses.includes('S')) {
            hariSakit++;
            absenceDatesList.push({ tanggal: tgl, status: 'Sakit', mapel: mapelNames });
        } else if (statuses.includes('I')) {
            hariIzin++;
            absenceDatesList.push({ tanggal: tgl, status: 'Izin', mapel: mapelNames });
        } else {
            hariHadir++;
        }
    });

    const classSettings = allSettings.filter(s => s.class_id === stu.class_id);
    const classAss = allAssessments.filter(a => a.class_id === stu.class_id);
    const stuAttSummaries = allAttSum.filter(a => a.student_id === stu.id);

    const subjectKeysMap = new Map();
    classSettings.forEach(s => {
        subjectKeysMap.set(`${s.teacher_id}__${s.mapel}`, { teacher_id: s.teacher_id, mapel: s.mapel, setting: s });
    });
    classAss.forEach(a => {
        const key = `${a.teacher_id}__${a.mapel}`;
        if (!subjectKeysMap.has(key)) {
            subjectKeysMap.set(key, { teacher_id: a.teacher_id, mapel: a.mapel, setting: null });
        }
    });

    const subjectsReport = [];
    const pendingTasksList = [];
    let totalTasksAll = 0;
    let doneTasksAll = 0;

    subjectKeysMap.forEach((info) => {
        const cfg = info.setting || {
            kkm: 75, w_absen: 10, w_tugas: 30, w_bab: 30, w_uas: 30,
            p_hadir: 100, p_sakit: 80, p_izin: 80, p_alpa: 0
        };
        const namaGuru = waliAllTeachersMap[info.teacher_id] || 'Guru Mapel';
        const subjAss = classAss.filter(a => a.teacher_id === info.teacher_id && a.mapel === info.mapel);

        const attRec = stuAttSummaries.find(a => a.teacher_id === info.teacher_id && a.mapel === info.mapel)
            || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        const totMeet = attRec.hadir + attRec.sakit + attRec.izin + attRec.alpa;
        const nAbsen = totMeet > 0
            ? Math.min(100, Math.max(0, ((attRec.hadir * (cfg.p_hadir ?? 100)) + (attRec.sakit * (cfg.p_sakit ?? 80)) + (attRec.izin * (cfg.p_izin ?? 80)) + (attRec.alpa * (cfg.p_alpa ?? 0))) / totMeet))
            : 100;

        let subjDone = 0;
        subjAss.forEach(ass => {
            totalTasksAll++;
            const sc = allScores.find(s => s.assessment_id === ass.id && s.student_id === stu.id);
            if (sc && sc.status_kumpul) {
                subjDone++;
                doneTasksAll++;
            } else {
                pendingTasksList.push({
                    judul: ass.judul,
                    mapel: info.mapel,
                    guru: namaGuru,
                    kategori: formatKategoriLabel(ass)
                });
            }
        });

        const avgCat = (filterFn) => {
            const list = subjAss.filter(filterFn);
            if (!list.length) return 0;
            let sum = 0;
            list.forEach(a => {
                const sc = allScores.find(s => s.assessment_id === a.id && s.student_id === stu.id);
                sum += (sc && sc.nilai !== null) ? Number(sc.nilai) : 0;
            });
            return sum / list.length;
        };

        const nTugas = avgCat(a => isKategoriTugas(a.kategori));
        const nBab   = avgCat(a => isKategoriUjianBab(a.kategori));
        const nSmt   = avgCat(a => isKategoriUjianSemester(a.kategori));

        const totalW = (cfg.w_absen || 0) + (cfg.w_tugas || 0) + (cfg.w_bab || 0) + (cfg.w_uas || 0);
        const divW = totalW > 0 ? totalW : 100;
        const nilaiAkhir = ((nAbsen * (cfg.w_absen || 0)) + (nTugas * (cfg.w_tugas || 0)) + (nBab * (cfg.w_bab || 0)) + (nSmt * (cfg.w_uas || 0))) / divW;
        const kkm = Number(cfg.kkm || 75);
        const tuntas = subjAss.length === 0 ? true : (nilaiAkhir >= kkm);

        subjectsReport.push({
            mapel: info.mapel,
            guru: namaGuru,
            attRec,
            nAbsen,
            tasksDone: subjDone,
            tasksTotal: subjAss.length,
            nTugas,
            nBab,
            nSmt,
            nilaiAkhir,
            kkm,
            tuntas
        });
    });

    const avgAllSubjects = subjectsReport.length > 0
        ? subjectsReport.reduce((acc, cur) => acc + cur.nilaiAkhir, 0) / subjectsReport.length
        : 0;
    const belowKkmCount = subjectsReport.filter(s => !s.tuntas).length;
    const pendingCount = pendingTasksList.length;

    let ewsStatus = 'aman';
    let ewsReason = 'Presensi & akademik terkendali';
    if (hariAlpa >= 3 || pendingCount >= 4 || belowKkmCount >= 2) {
        ewsStatus = 'kritis';
        const reasons = [];
        if (hariAlpa >= 3) reasons.push(`${hariAlpa} hr Alpa`);
        if (pendingCount >= 4) reasons.push(`${pendingCount} tugas belum kumpul`);
        if (belowKkmCount >= 2) reasons.push(`${belowKkmCount} mapel < KKM`);
        ewsReason = reasons.join(' • ');
    } else if (hariAlpa >= 1 || pendingCount >= 1 || belowKkmCount >= 1) {
        ewsStatus = 'waspada';
        const reasons = [];
        if (hariAlpa >= 1) reasons.push(`${hariAlpa} hr Alpa`);
        if (pendingCount >= 1) reasons.push(`${pendingCount} tunggakan tugas`);
        if (belowKkmCount >= 1) reasons.push(`${belowKkmCount} mapel < KKM`);
        ewsReason = reasons.join(' • ');
    }

    const menteeMeta = waliMenteeRecords[stu.id] || { target_akademik: '', jurnal_konseling: [] };

    return {
        id: stu.id,
        nisn: stu.nisn,
        nama: stu.nama,
        class_id: stu.class_id,
        kelas: namaKelas,
        hariHadir,
        hariSakit,
        hariIzin,
        hariAlpa,
        absenceDatesList,
        subjectsReport,
        pendingTasksList,
        totalTasksAll,
        doneTasksAll,
        pendingCount,
        avgAllSubjects,
        belowKkmCount,
        ewsStatus,
        ewsReason,
        target_akademik: menteeMeta.target_akademik || '',
        jurnal_konseling: Array.isArray(menteeMeta.jurnal_konseling) ? menteeMeta.jurnal_konseling : []
    };
}

function updateWaliSummaryCards(total, classCount, aman, waspada, kritis) {
    if (document.getElementById('wali-stat-total')) document.getElementById('wali-stat-total').innerText = `${total} Siswa`;
    if (document.getElementById('wali-stat-classes')) document.getElementById('wali-stat-classes').innerText = `Tersebar di ${classCount} Kelas`;
    if (document.getElementById('wali-stat-aman')) document.getElementById('wali-stat-aman').innerText = `${aman} Siswa`;
    if (document.getElementById('wali-stat-waspada')) document.getElementById('wali-stat-waspada').innerText = `${waspada} Siswa`;
    if (document.getElementById('wali-stat-kritis')) document.getElementById('wali-stat-kritis').innerText = `${kritis} Siswa`;
}

function renderGuruWaliRows() {
    const tbody = document.getElementById('wali-tbody');
    if (!tbody) return;

    const filterEws = document.getElementById('wali-filter-ews')?.value || 'all';
    const q = (document.getElementById('wali-search-input')?.value || '').trim().toLowerCase();

    const filtered = waliComputedList.filter(d => {
        const matchEws = filterEws === 'all' || d.ewsStatus === filterEws;
        const matchQ = !q || d.nama.toLowerCase().includes(q) || String(d.nisn).toLowerCase().includes(q) || d.kelas.toLowerCase().includes(q);
        return matchEws && matchQ;
    });

    if (!filtered.length) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">Tidak ada siswa binaan yang sesuai dengan filter.</td></tr>`;
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach((d, idx) => {
        let ewsBadge = '';
        if (d.ewsStatus === 'kritis') {
            ewsBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-rose-100 text-rose-800 border border-rose-200 block">🔴 Kritis</span><span class="text-[10px] text-rose-600 font-semibold block mt-0.5">${d.ewsReason}</span>`;
        } else if (d.ewsStatus === 'waspada') {
            ewsBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-amber-100 text-amber-800 border border-amber-200 block">🟡 Waspada</span><span class="text-[10px] text-amber-700 font-semibold block mt-0.5">${d.ewsReason}</span>`;
        } else {
            ewsBadge = `<span class="px-2.5 py-1 rounded-full text-[11px] font-extrabold bg-emerald-100 text-emerald-800 border border-emerald-200 block">🟢 Aman</span><span class="text-[10px] text-slate-400 block mt-0.5">Tuntas & Aktif</span>`;
        }

        const logCount = d.jurnal_konseling.length;
        const lastLog = logCount > 0 ? d.jurnal_konseling[0] : null;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50 transition">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3">
                    <div class="flex items-center gap-2.5">
                        <div class="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            ${typeof getInitials === 'function' ? getInitials(d.nama) : 'S'}
                        </div>
                        <div>
                            <span class="font-extrabold text-slate-900 block">${d.nama}</span>
                            <span class="text-[11px] text-slate-500 font-mono">Kelas <b>${d.kelas}</b> • NISN: ${d.nisn}</span>
                        </div>
                    </div>
                </td>
                <td class="p-3 text-center whitespace-nowrap">
                    <span class="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 font-bold text-xs">${d.hariHadir}H</span>
                    <span class="px-2 py-0.5 rounded bg-amber-50 text-amber-700 font-bold text-xs">${d.hariSakit}S</span>
                    <span class="px-2 py-0.5 rounded bg-sky-50 text-sky-700 font-bold text-xs">${d.hariIzin}I</span>
                    <span class="px-2 py-0.5 rounded ${d.hariAlpa > 0 ? 'bg-rose-600 text-white' : 'bg-rose-50 text-rose-700'} font-extrabold text-xs">${d.hariAlpa}A</span>
                </td>
                <td class="p-3 text-center">
                    ${d.pendingCount > 0
                        ? `<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-700">${d.pendingCount} Belum Kumpul</span>`
                        : `<span class="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-50 text-emerald-700">Lengkap (${d.doneTasksAll}/${d.totalTasksAll})</span>`
                    }
                </td>
                <td class="p-3 text-center">
                    <span class="font-extrabold text-sm text-blue-700 block">${d.avgAllSubjects.toFixed(1)}</span>
                    <span class="text-[10px] text-slate-400">${d.subjectsReport.length} Mapel</span>
                </td>
                <td class="p-3 text-center">${ewsBadge}</td>
                <td class="p-3 text-center">
                    <span class="font-bold text-xs text-slate-700 block">${logCount} Catatan</span>
                    <span class="text-[10px] text-slate-400 truncate max-w-[120px] block mx-auto">${lastLog ? lastLog.tanggal : 'Belum ada'}</span>
                </td>
                <td class="p-3 text-center whitespace-nowrap space-x-1">
                    <button type="button" onclick="openWali360Modal(${d.id})" class="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold shadow-sm">
                        🔍 Bedah 360° & Konseling
                    </button>
                    <button type="button" onclick="sendWhatsAppReport(${d.id})" class="px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-extrabold" title="Kirim WA ke Orang Tua">
                        <i class="fa-brands fa-whatsapp"></i> WA
                    </button>
                </td>
            </tr>
        `;
    });
}

function openManageBinaanModal() {
    tempPickedMenteeIds = new Set(Object.keys(waliMenteeRecords).map(Number));

    const selClass = document.getElementById('wali-pick-class');
    if (selClass) {
        selClass.innerHTML = '<option value="all">-- Semua Kelas --</option>';
        Object.keys(waliAllClassesMap).forEach(cid => {
            selClass.innerHTML += `<option value="${cid}">Kelas ${waliAllClassesMap[cid]}</option>`;
        });
    }

    renderBinaanPickerList();
    document.getElementById('modal-wali-manage')?.classList.remove('hidden');
}

function closeManageBinaanModal() {
    document.getElementById('modal-wali-manage')?.classList.add('hidden');
}

function renderBinaanPickerList() {
    const tbody = document.getElementById('wali-picker-tbody');
    if (!tbody) return;

    const classFilter = document.getElementById('wali-pick-class')?.value || 'all';
    const searchQ = (document.getElementById('wali-pick-search')?.value || '').trim().toLowerCase();

    const badge = document.getElementById('wali-picked-count-badge');
    if (badge) badge.innerText = `${tempPickedMenteeIds.size} Siswa Dipilih`;

    const list = waliAllStudents.filter(s => {
        const matchCls = classFilter === 'all' || String(s.class_id) === String(classFilter);
        const matchQ = !searchQ || s.nama.toLowerCase().includes(searchQ) || String(s.nisn).toLowerCase().includes(searchQ);
        return matchCls && matchQ;
    });

    if (!list.length) {
        tbody.innerHTML = `<tr><td colspan="4" class="p-6 text-center text-slate-400">Tidak ada siswa ditemukan.</td></tr>`;
        return;
    }

    tbody.innerHTML = list.map(s => {
        const checked = tempPickedMenteeIds.has(s.id);
        return `
            <tr class="hover:bg-blue-50/40 cursor-pointer" onclick="togglePickMentee(${s.id})">
                <td class="p-2.5 text-center">
                    <input type="checkbox" ${checked ? 'checked' : ''} onclick="event.stopPropagation(); togglePickMentee(${s.id});" class="w-4 h-4 accent-blue-600 rounded cursor-pointer">
                </td>
                <td class="p-2.5 font-bold text-slate-800">${s.nama}</td>
                <td class="p-2.5 font-mono text-slate-500">${s.nisn}</td>
                <td class="p-2.5 text-center"><span class="px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold">${waliAllClassesMap[s.class_id] || '-'}</span></td>
            </tr>
        `;
    }).join('');
}

function togglePickMentee(studentId) {
    if (tempPickedMenteeIds.has(studentId)) {
        tempPickedMenteeIds.delete(studentId);
    } else {
        tempPickedMenteeIds.add(studentId);
    }
    renderBinaanPickerList();
}

async function saveWaliBinaanSelection() {
    const newRecords = {};
    const removedIds = [];

    Object.keys(waliMenteeRecords).map(Number).forEach(oldId => {
        if (!tempPickedMenteeIds.has(oldId)) removedIds.push(oldId);
    });

    tempPickedMenteeIds.forEach(sid => {
        newRecords[sid] = waliMenteeRecords[sid] || { target_akademik: '', jurnal_konseling: [] };
    });

    waliMenteeRecords = newRecords;
    saveWaliToLocalCache();

    try {
        if (removedIds.length > 0) {
            await db.from('guru_wali_binaan')
                .delete()
                .eq('teacher_id', currentUser.id)
                .in('student_id', removedIds);
        }
        const upserts = Array.from(tempPickedMenteeIds).map(sid => ({
            teacher_id: currentUser.id,
            student_id: sid,
            target_akademik: waliMenteeRecords[sid].target_akademik || '',
            jurnal_konseling: waliMenteeRecords[sid].jurnal_konseling || []
        }));
        if (upserts.length > 0) {
            await db.from('guru_wali_binaan').upsert(upserts, { onConflict: 'teacher_id,student_id' });
        }
    } catch (e) {}

    closeManageBinaanModal();
    showToast(`Berhasil menyimpan ${tempPickedMenteeIds.size} siswa binaan!`);
    await loadGuruWaliDashboard();
}

function openWali360Modal(studentId) {
    const d = waliComputedList.find(x => x.id === studentId);
    if (!d) return;
    activeWaliStudentId = studentId;

    document.getElementById('w360-avatar').innerText = typeof getInitials === 'function' ? getInitials(d.nama) : 'S';
    document.getElementById('w360-nama').innerText = d.nama;
    document.getElementById('w360-kelas').innerText = `Kelas ${d.kelas}`;
    document.getElementById('w360-nisn').innerText = `NISN: ${d.nisn}`;
    document.getElementById('w360-target-input').value = d.target_akademik || '';

    const logDateInput = document.getElementById('w360-log-date');
    if (logDateInput) logDateInput.value = getLocalTodayString();

    const btnPdf = document.getElementById('w360-btn-pdf');
    if (btnPdf) btnPdf.onclick = () => printWali360PortfolioPDF(d.id);

    document.getElementById('w360-att-pills').innerHTML = `
        <div class="p-2 rounded-xl bg-emerald-50 border border-emerald-200"><span class="text-lg font-extrabold text-emerald-700 block">${d.hariHadir}</span><span class="text-[10px] font-bold text-emerald-800">Hari Hadir</span></div>
        <div class="p-2 rounded-xl bg-amber-50 border border-amber-200"><span class="text-lg font-extrabold text-amber-600 block">${d.hariSakit}</span><span class="text-[10px] font-bold text-amber-800">Hari Sakit</span></div>
        <div class="p-2 rounded-xl bg-sky-50 border border-sky-200"><span class="text-lg font-extrabold text-sky-600 block">${d.hariIzin}</span><span class="text-[10px] font-bold text-sky-800">Hari Izin</span></div>
        <div class="p-2 rounded-xl bg-rose-50 border border-rose-200"><span class="text-lg font-extrabold text-rose-600 block">${d.hariAlpa}</span><span class="text-[10px] font-bold text-rose-800">Hari Alpa</span></div>
    `;

    const absDatesEl = document.getElementById('w360-absence-dates');
    if (d.absenceDatesList.length === 0) {
        absDatesEl.innerHTML = `<span class="text-emerald-700 font-bold">✨ Bersih dari catatan ketidakhadiran (Sakit/Izin/Alpa) pada semester ini.</span>`;
    } else {
        absDatesEl.innerHTML = d.absenceDatesList.map(item =>
            `<div class="py-0.5 border-b last:border-b-0 border-slate-200 flex justify-between"><span>📅 <b>${item.tanggal}</b> — <b class="${item.status === 'Alpa' ? 'text-rose-600' : 'text-amber-700'}">${item.status}</b></span><span class="text-slate-500">${item.mapel}</span></div>`
        ).join('');
    }

    const subjTbody = document.getElementById('w360-subjects-tbody');
    if (!d.subjectsReport.length) {
        subjTbody.innerHTML = `<tr><td colspan="10" class="p-4 text-center text-slate-400">Belum ada data mata pelajaran di kelas siswa ini.</td></tr>`;
    } else {
        subjTbody.innerHTML = d.subjectsReport.map(s => `
            <tr class="hover:bg-slate-50">
                <td class="p-2.5 font-extrabold text-slate-900">📘 ${s.mapel}</td>
                <td class="p-2.5 text-slate-600">${s.guru}</td>
                <td class="p-2.5 text-center font-mono text-[11px]">${s.attRec.hadir}H/${s.attRec.sakit}S/${s.attRec.izin}I/${s.attRec.alpa}A</td>
                <td class="p-2.5 text-center font-bold ${s.tasksDone < s.tasksTotal ? 'text-rose-600' : 'text-emerald-700'}">${s.tasksDone}/${s.tasksTotal}</td>
                <td class="p-2.5 text-center">${s.nTugas.toFixed(1)}</td>
                <td class="p-2.5 text-center">${s.nBab.toFixed(1)}</td>
                <td class="p-2.5 text-center">${s.nSmt.toFixed(1)}</td>
                <td class="p-2.5 text-center font-extrabold text-blue-700 bg-blue-50/50">${s.nilaiAkhir.toFixed(1)}</td>
                <td class="p-2.5 text-center">${s.kkm}</td>
                <td class="p-2.5 text-center">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold ${s.tuntas ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        ${s.tuntas ? 'TUNTAS' : 'BELUM TUNTAS'}
                    </span>
                </td>
            </tr>
        `).join('');
    }

    document.getElementById('w360-pending-badge').innerText = `${d.pendingTasksList.length} Tugas`;
    const pendingBox = document.getElementById('w360-pending-list');
    if (d.pendingTasksList.length === 0) {
        pendingBox.innerHTML = `<div class="p-4 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">🎉 Luar biasa! Seluruh tugas dari semua guru telah dikumpulkan.</div>`;
    } else {
        pendingBox.innerHTML = d.pendingTasksList.map(t => `
            <div class="p-2.5 rounded-xl bg-rose-50/60 border border-rose-200 text-xs">
                <div class="flex justify-between font-bold text-rose-900">
                    <span>${t.mapel}</span>
                    <span class="text-[10px] px-1.5 py-0.5 rounded bg-rose-200 text-rose-900">${t.kategori}</span>
                </div>
                <div class="font-extrabold text-slate-900 mt-0.5">${t.judul}</div>
                <div class="text-[11px] text-slate-500">Guru: ${t.guru}</div>
            </div>
        `).join('');
    }

    renderWali360CounselingLogs(d);
    document.getElementById('modal-wali-360')?.classList.remove('hidden');
}

function closeWali360Modal() {
    document.getElementById('modal-wali-360')?.classList.add('hidden');
}

async function saveWaliTargetAkademik() {
    if (!activeWaliStudentId) return;
    const val = document.getElementById('w360-target-input').value.trim();
    if (!waliMenteeRecords[activeWaliStudentId]) {
        waliMenteeRecords[activeWaliStudentId] = { target_akademik: '', jurnal_konseling: [] };
    }
    waliMenteeRecords[activeWaliStudentId].target_akademik = val;

    const item = waliComputedList.find(x => x.id === activeWaliStudentId);
    if (item) item.target_akademik = val;

    await syncSingleMenteeToSupabase(activeWaliStudentId);
    showToast('Target & catatan akademik siswa binaan disimpan!');
}

async function addWaliCounselingLog(e) {
    e.preventDefault();
    if (!activeWaliStudentId) return;

    const tanggal = document.getElementById('w360-log-date').value;
    const topik = document.getElementById('w360-log-topic').value;
    const tindak = document.getElementById('w360-log-tindak').value.trim();
    const catatan = document.getElementById('w360-log-note').value.trim();

    if (!waliMenteeRecords[activeWaliStudentId]) {
        waliMenteeRecords[activeWaliStudentId] = { target_akademik: '', jurnal_konseling: [] };
    }

    const newEntry = {
        id: Date.now(),
        tanggal,
        topik,
        catatan,
        tindak_lanjut: tindak || '-'
    };

    waliMenteeRecords[activeWaliStudentId].jurnal_konseling.unshift(newEntry);

    const item = waliComputedList.find(x => x.id === activeWaliStudentId);
    if (item) {
        item.jurnal_konseling = waliMenteeRecords[activeWaliStudentId].jurnal_konseling;
        renderWali360CounselingLogs(item);
    }

    document.getElementById('w360-log-note').value = '';
    document.getElementById('w360-log-tindak').value = '';

    await syncSingleMenteeToSupabase(activeWaliStudentId);
    renderGuruWaliRows();
    showToast('Jurnal konseling berhasil dicatat!');
}

async function deleteWaliCounselingLog(logId) {
    if (!activeWaliStudentId || !waliMenteeRecords[activeWaliStudentId]) return;
    waliMenteeRecords[activeWaliStudentId].jurnal_konseling =
        waliMenteeRecords[activeWaliStudentId].jurnal_konseling.filter(l => l.id !== logId);

    const item = waliComputedList.find(x => x.id === activeWaliStudentId);
    if (item) {
        item.jurnal_konseling = waliMenteeRecords[activeWaliStudentId].jurnal_konseling;
        renderWali360CounselingLogs(item);
    }

    await syncSingleMenteeToSupabase(activeWaliStudentId);
    renderGuruWaliRows();
}

function renderWali360CounselingLogs(d) {
    const box = document.getElementById('w360-logs-list');
    if (!box) return;

    if (!d.jurnal_konseling.length) {
        box.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">Belum ada riwayat catatan bimbingan akademik.</p>`;
        return;
    }

    box.innerHTML = d.jurnal_konseling.map(l => `
        <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs flex justify-between items-start gap-2">
            <div class="space-y-1">
                <div class="flex items-center gap-2">
                    <span class="font-mono font-bold text-indigo-700">${l.tanggal}</span>
                    <span class="px-2 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-[10px]">${l.topik}</span>
                </div>
                <p class="font-semibold text-slate-800">${l.catatan}</p>
                <p class="text-[11px] text-slate-500"><b>Tindak Lanjut:</b> ${l.tindak_lanjut}</p>
            </div>
            <button type="button" onclick="deleteWaliCounselingLog(${l.id})" class="text-rose-500 hover:text-rose-700 font-bold text-xs">🗑️</button>
        </div>
    `).join('');
}

function printWali360PortfolioPDF(studentId) {
    const d = waliComputedList.find(x => x.id === studentId);
    if (!d) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    const semRange = getActiveSemesterDateRange();

    doc.setFontSize(13);
    doc.setFont("helvetica", "bold");
    doc.text("LAPORAN PEMANTAUAN & BIMBINGAN AKADEMIK (GURU WALI)", 105, 15, { align: "center" });
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.text(`Periode: ${semRange.label}  |  Guru Wali / Pembimbing Akademik: ${currentUser.nama_lengkap}`, 105, 21, { align: "center" });
    doc.line(14, 24, 196, 24);

    doc.text(`Nama Siswa : ${d.nama}`, 14, 31);
    doc.text(`NISN       : ${d.nisn}`, 14, 36);
    doc.text(`Kelas      : ${d.kelas}`, 130, 31);
    doc.text(`Status EWS : ${d.ewsStatus.toUpperCase()} (${d.ewsReason})`, 130, 36);

    doc.autoTable({
        startY: 41,
        head: [['Hadir (Hari)', 'Sakit (Hari)', 'Izin (Hari)', 'Alpa (Hari)', 'Tugas Selesai', 'Tunggakan Tugas', 'Rata2 Lintas Mapel']],
        body: [[
            `${d.hariHadir} Hari`, `${d.hariSakit} Hari`, `${d.hariIzin} Hari`, `${d.hariAlpa} Hari`,
            `${d.doneTasksAll}/${d.totalTasksAll}`, `${d.pendingCount} Tugas`, d.avgAllSubjects.toFixed(1)
        ]],
        theme: 'grid',
        headStyles: { fillColor: [30, 41, 59], fontSize: 8, halign: 'center' },
        bodyStyles: { fontSize: 8, halign: 'center', fontStyle: 'bold' }
    });

    let curY = doc.lastAutoTable.finalY + 7;
    doc.setFont("helvetica", "bold");
    doc.text("1. Capaian Akademik Lintas Mata Pelajaran:", 14, curY);

    const subjRows = d.subjectsReport.map((s, i) => [
        i + 1, s.mapel, s.guru, `${s.tasksDone}/${s.tasksTotal}`,
        s.nTugas.toFixed(1), s.nBab.toFixed(1), s.nSmt.toFixed(1),
        s.nilaiAkhir.toFixed(1), s.kkm, s.tuntas ? 'TUNTAS' : 'BELUM TUNTAS'
    ]);

    doc.autoTable({
        startY: curY + 2,
        head: [['No', 'Mata Pelajaran', 'Guru Pengampu', 'Tugas', 'Rata2 Tugas', 'Ujian Bab', 'Ujian Smt', 'Nilai Akhir', 'KKM', 'Status']],
        body: subjRows.length ? subjRows : [['-', 'Belum ada data', '-', '-', '-', '-', '-', '-', '-', '-']],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235], fontSize: 8 },
        bodyStyles: { fontSize: 8 }
    });

    curY = doc.lastAutoTable.finalY + 7;
    doc.setFont("helvetica", "bold");
    doc.text("2. Jurnal Konseling & Pembinaan Akademik:", 14, curY);

    const logRows = d.jurnal_konseling.map((l, i) => [i + 1, l.tanggal, l.topik, l.catatan, l.tindak_lanjut]);
    doc.autoTable({
        startY: curY + 2,
        head: [['No', 'Tanggal', 'Topik Pembinaan', 'Catatan Konseling', 'Tindak Lanjut']],
        body: logRows.length ? logRows : [['-', '-', '-', 'Belum ada catatan konseling', '-']],
        theme: 'grid',
        headStyles: { fillColor: [79, 70, 229], fontSize: 8 },
        bodyStyles: { fontSize: 8 }
    });

    const finalY = doc.lastAutoTable.finalY + 12;
    const tglCetak = new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
    doc.setFont("helvetica", "normal");
    doc.text(`Dicetak pada: ${tglCetak}`, 135, finalY);
    doc.text("Guru Wali / Pembimbing Akademik,", 135, finalY + 5);
    doc.setFont("helvetica", "bold");
    doc.text(currentUser.nama_lengkap, 135, finalY + 23);

    doc.save(`Portofolio_GuruWali_${d.nama.replace(/\s+/g, '_')}.pdf`);
}

function exportWaliBinaanExcel() {
    if (!waliComputedList.length) return showToast('Belum ada siswa binaan untuk diekspor!', 'error');
    const semRange = getActiveSemesterDateRange();

    const rows = waliComputedList.map((d, i) => ({
        No: i + 1,
        NISN: d.nisn,
        'Nama Siswa Binaan': d.nama,
        Kelas: d.kelas,
        Periode: semRange.label,
        'Hadir (Hari)': d.hariHadir,
        'Sakit (Hari)': d.hariSakit,
        'Izin (Hari)': d.hariIzin,
        'Alpa (Hari)': d.hariAlpa,
        'Tugas Terkumpul': `${d.doneTasksAll}/${d.totalTasksAll}`,
        'Tunggakan Tugas': d.pendingCount,
        'Rata2 Lintas Mapel': Number(d.avgAllSubjects.toFixed(1)),
        'Mapel Di Bawah KKM': d.belowKkmCount,
        'Status EWS': d.ewsStatus.toUpperCase(),
        'Keterangan EWS': d.ewsReason,
        'Target Akademik': d.target_akademik || '-',
        'Jumlah Sesi Konseling': d.jurnal_konseling.length
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap_Guru_Wali");
    XLSX.writeFile(wb, `Laporan_Guru_Wali_${currentUser.username}_${semRange.label.replace(/\s+/g, '_')}.xlsx`);
}

function sendWhatsAppReport(studentId) {
    let d = waliComputedList.find(item => item.id === studentId);

    // Fallback jika dipanggil dari luar menu Guru Wali
    if (!d) {
        const rekapItem = latestRekapData.find(item => item.id === studentId);
        if (!rekapItem || !currentSettings) return;
        const pesanMapel = `Assalamu'alaikum Wr. Wb.\nYth. Orang Tua/Wali dari *${rekapItem.nama}* (Kelas ${rekapItem.kelas} - NISN: ${rekapItem.nisn}),\n\nBerikut laporan perkembangan hasil belajar pada mata pelajaran *${currentSettings.mapel}*:\n• Rekap Kehadiran: ${rekapItem.absen.hadir}H, ${rekapItem.absen.sakit}S, ${rekapItem.absen.izin}I, ${rekapItem.absen.alpa}A\n• Rata-rata Tugas: *${rekapItem.nTugas.toFixed(1)}*\n• Nilai Akhir Sementara: *${rekapItem.nilaiAkhir.toFixed(2)}* (KKM: ${rekapItem.kkm})\n\nTerima kasih.\n— _${currentUser.nama_lengkap}_`;
        window.open(`https://wa.me/?text=${encodeURIComponent(pesanMapel)}`, '_blank');
        return;
    }

    const rincianMapel = d.subjectsReport.map(s =>
        `  • *${s.mapel}*: Nilai *${s.nilaiAkhir.toFixed(1)}* (Tugas: ${s.tasksDone}/${s.tasksTotal}) — _${s.tuntas ? 'Tuntas' : 'Perlu Perhatian'}_`
    ).join('\n') || '  • Belum ada data nilai mata pelajaran.';

    const rincianTunggakan = d.pendingTasksList.length > 0
        ? `\n*Daftar Tugas Belum Dikumpulkan (${d.pendingCount} Tugas):*\n` + d.pendingTasksList.slice(0, 5).map(t => `  - [${t.mapel}] ${t.judul}`).join('\n')
        : `\n✅ *Seluruh tugas mata pelajaran telah dikumpulkan dengan lengkap.*`;

    const pesan = `Assalamu'alaikum Wr. Wb.\nYth. Bapak/Ibu Orang Tua/Wali dari *${d.nama}* (Kelas ${d.kelas} — NISN: ${d.nisn}),\n\nSaya *${currentUser.nama_lengkap}* selaku *Guru Wali (Pembimbing Akademik)* menyampaikan laporan perkembangan belajar ananda secara menyeluruh:\n\n*1. Kehadiran Sekolah (Semester Aktif):*\n• Hadir: ${d.hariHadir} Hari | Sakit: ${d.hariSakit} Hari | Izin: ${d.hariIzin} Hari | Alpa: ${d.hariAlpa} Hari\n\n*2. Capaian Lintas Mata Pelajaran:*\n${rincianMapel}\n${rincianTunggakan}\n\nMohon kerja sama Bapak/Ibu untuk terus memotivasi ananda di rumah. Terima kasih.\n— _${currentUser.nama_lengkap} (Guru Wali - PantauBelajar)_`;

    window.open(`https://wa.me/?text=${encodeURIComponent(pesan)}`, '_blank');
}
