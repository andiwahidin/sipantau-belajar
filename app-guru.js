// ============================================================================
// FILE: app-guru.js (v4.9 - Full Integration + Moderasi Pengajuan & Guru Wali)
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

function getInitials(name) {
    if (!name) return 'G';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}

// PERBAIKAN: Konten tidak tergeser di PC, tetap responsif di Mobile
function toggleMobileSidebar(forceClose = false) {
    const sidebar = document.getElementById('main-sidebar');
    if (!sidebar) return;

    if (window.innerWidth >= 1024) return;

    if (forceClose) {
        sidebar.classList.add('hidden');
    } else {
        sidebar.classList.toggle('hidden');
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

// 1. AUTH, ADMIN & NAVIGASI
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
    if (elAvatar)   elAvatar.innerText = getInitials(currentUser.nama_lengkap);

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
    if (!confirm(`Reset password guru ini kembali sama dengan username (${username})?`)) return;
    await db.from('app_users').update({ password: username }).eq('id', id);
    showToast(`Password direset menjadi: ${username}`);
}

async function deleteUser(id) {
    if (!confirm('Hapus akun guru ini beserta seluruh data penilaiannya?')) return;
    await db.from('app_users').delete().eq('id', id);
    showToast('Akun guru dihapus.');
    loadAdminUsers();
}

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
        if (tab === 'wali') loadGuruWaliDashboard();
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
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const url = `${baseUrl}siswa.html`;
    navigator.clipboard.writeText(url);
    showToast('Link Portal Siswa berhasil disalin!');
}

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
            if (sc && (sc.status_kumpul || sc.status_pengajuan === 'approved')) stuTasksDone++;
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
                            ${getInitials(stu.nama)}
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
                totalDone += scoresList.filter(s => s.assessment_id === a.id && (s.status_kumpul || s.status_pengajuan === 'approved')).length;
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

// 2. KELOLA SISWA & ABSENSI
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
                            ${getInitials(s.nama)}
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

// 3. TUGAS, KELOMPOK & MODERASI
async function loadAssessmentsDropdown() {
    const classId = document.getElementById('guru-active-class')?.value;
    const sel = document.getElementById('active-assessment');
    if (!classId || !currentSettings || !sel) return;

    const { data } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('id');

    currentAssessments = data || [];
    sel.innerHTML = currentAssessments.length ? '' : '<option value="">-- Belum Ada Penilaian --</option>';
    currentAssessments.forEach(a => {
        sel.innerHTML += `<option value="${a.id}">[${formatKategoriLabel(a)}] ${a.judul}</option>`;
    });

    await loadAssessmentScores();
    await loadGroupPresetsForCurrentClass();
}

function renderAssLinkEditor(assObj) {
    const box = document.getElementById('ass-link-editor');
    if (!box) return;

    if (!assObj) {
        box.classList.add('hidden');
        return;
    }

    box.classList.remove('hidden');
    const setVal = (id, val) => { const el = document.getElementById(id); if (el) el.value = val || ''; };
    setVal('edit-ass-judul', assObj.judul);
    setVal('edit-ass-kategori', assObj.kategori);
    setVal('edit-ass-tipe', assObj.tipe_kerja || 'individu');
    setVal('edit-ass-link', assObj.link_pengumpulan);

    const btnPub = document.getElementById('btn-toggle-public');
    if (btnPub) {
        const isPub = assObj.tampil_publik !== false;
        btnPub.innerText = isPub ? '🌐 Ditampilkan ke Siswa' : '🔒 Disembunyikan';
        btnPub.className = isPub 
            ? 'px-3 py-1 rounded-lg text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300' 
            : 'px-3 py-1 rounded-lg text-xs font-bold bg-slate-200 text-slate-700 border border-slate-300';
    }

    const testLink = document.getElementById('btn-test-ass-link');
    if (testLink) {
        if (assObj.link_pengumpulan) {
            testLink.href = assObj.link_pengumpulan;
            testLink.classList.remove('hidden');
        } else {
            testLink.classList.add('hidden');
        }
    }
}

async function createAssessment(e) {
    e.preventDefault();
    const class_id = document.getElementById('guru-active-class').value;
    if (!class_id || !currentSettings) return showToast('Pilih kelas & mapel aktif!', 'error');

    const judul = document.getElementById('ass-judul').value.trim();
    const kategori = document.getElementById('ass-kategori').value;
    const tipe_kerja = document.getElementById('ass-tipe').value;
    const tampil_publik = document.getElementById('ass-publik').value === 'true';
    const link_pengumpulan = document.getElementById('ass-link').value.trim();

    const { data, error } = await db.from('assessments').insert([{
        teacher_id: currentUser.id,
        class_id: Number(class_id),
        mapel: currentSettings.mapel,
        judul,
        kategori,
        tipe_kerja,
        tampil_publik,
        link_pengumpulan
    }]).select().single();

    if (error) return showToast('Gagal membuat penilaian: ' + error.message, 'error');

    document.getElementById('ass-judul').value = '';
    document.getElementById('ass-link').value = '';
    showToast(`Penilaian "${judul}" berhasil dibuat!`);
    await loadAssessmentsDropdown();
    if (data) document.getElementById('active-assessment').value = data.id;
    await loadAssessmentScores();
}

async function updateAssessmentLink() {
    const assId = document.getElementById('active-assessment')?.value;
    if (!assId) return;

    const judul = document.getElementById('edit-ass-judul').value.trim();
    const kategori = document.getElementById('edit-ass-kategori').value;
    const tipe_kerja = document.getElementById('edit-ass-tipe').value;
    const link_pengumpulan = document.getElementById('edit-ass-link').value.trim();

    const { error } = await db.from('assessments')
        .update({ judul, kategori, tipe_kerja, link_pengumpulan })
        .eq('id', assId);

    if (error) return showToast('Gagal memperbarui penilaian: ' + error.message, 'error');
    showToast('Perubahan penilaian berhasil disimpan!');
    await loadAssessmentsDropdown();
    document.getElementById('active-assessment').value = assId;
    await loadAssessmentScores();
}

async function toggleAssessmentPublicVisibility() {
    const assId = document.getElementById('active-assessment')?.value;
    if (!assId) return;
    const assObj = currentAssessments.find(a => a.id == assId);
    if (!assObj) return;

    const nextVal = assObj.tampil_publik === false ? true : false;
    const { error } = await db.from('assessments').update({ tampil_publik: nextVal }).eq('id', assId);
    if (error) return showToast('Gagal mengubah visibilitas: ' + error.message, 'error');

    showToast(nextVal ? 'Tugas sekarang ditampilkan ke portal siswa.' : 'Tugas disembunyikan dari portal siswa.');
    await loadAssessmentsDropdown();
    document.getElementById('active-assessment').value = assId;
    await loadAssessmentScores();
}

async function deleteCurrentAssessment() {
    const assId = document.getElementById('active-assessment')?.value;
    if (!assId) return;
    const assObj = currentAssessments.find(a => a.id == assId);
    if (!confirm(`Hapus penilaian "${assObj?.judul || ''}" beserta seluruh nilai siswa di dalamnya?`)) return;

    await db.from('assessments').delete().eq('id', assId);
    showToast('Penilaian dihapus.');
    await loadAssessmentsDropdown();
}

async function loadGroupPresetsForCurrentClass() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId) return;

    const { data } = await db.from('group_presets')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .order('id');

    classGroupPresets = {};
    (data || []).forEach(p => {
        try {
            classGroupPresets[p.preset_name] = JSON.parse(p.mapping_json || '{}');
        } catch (e) {}
    });

    const keys = Object.keys(classGroupPresets);
    if (keys.length === 0) {
        classGroupPresets['Kelompok Default'] = {};
        activePresetKey = 'Kelompok Default';
    } else {
        activePresetKey = keys[0];
    }

    const sel = document.getElementById('select-group-preset');
    if (sel) {
        sel.innerHTML = '';
        Object.keys(classGroupPresets).forEach(k => {
            sel.innerHTML += `<option value="${k}" ${k === activePresetKey ? 'selected' : ''}>${k}</option>`;
        });
    }
}

function updateGroupAutocompleteDatalist(scoresData = []) {
    const datalist = document.getElementById('datalist-kelompok-options');
    if (!datalist) return;

    const groups = new Set();
    Object.values(classGroupPresets[activePresetKey] || {}).forEach(g => { if (g) groups.add(g); });
    scoresData.forEach(s => { if (s.nama_kelompok) groups.add(s.nama_kelompok); });

    datalist.innerHTML = '';
    groups.forEach(g => {
        datalist.innerHTML += `<option value="${g}">`;
    });
}

function onStudentGroupNameInput(inputEl) {
    const row = inputEl.closest('tr');
    if (!row) return;
    const groupVal = inputEl.value.trim();
    const assId = document.getElementById('active-assessment')?.value;
    const assObj = currentAssessments.find(a => a.id == assId);
    const isGroup = assObj && (assObj.tipe_kerja === 'kelompok' || assObj.kategori === 'tugas_kelompok');
    if (!isGroup || !groupVal) return;

    const groupInputs = document.querySelectorAll('#scores-tbody tr');
    groupInputs.forEach(r => {
        const otherGroupInput = r.querySelector('.sc-group');
        const otherStuId = Number(r.getAttribute('data-stuid'));
        const thisStuId = Number(row.getAttribute('data-stuid'));
        if (otherGroupInput && otherStuId !== thisStuId && otherGroupInput.value.trim().toLowerCase() === groupVal.toLowerCase()) {
            const sourceStatus = row.querySelector('.sc-status')?.checked;
            const sourceNilai = row.querySelector('.sc-nilai')?.value;
            const sourceLink = row.querySelector('.sc-link')?.value;

            if (sourceStatus !== undefined) r.querySelector('.sc-status').checked = sourceStatus;
            if (sourceNilai !== undefined) r.querySelector('.sc-nilai').value = sourceNilai;
            if (sourceLink !== undefined) r.querySelector('.sc-link').value = sourceLink;
        }
    });
}

function applySelectedGroupPreset() {
    const sel = document.getElementById('select-group-preset');
    if (!sel) return;
    activePresetKey = sel.value;
    const map = classGroupPresets[activePresetKey] || {};

    document.querySelectorAll('#scores-tbody tr').forEach(r => {
        const stuId = Number(r.getAttribute('data-stuid'));
        const groupInput = r.querySelector('.sc-group');
        if (groupInput && map[stuId]) {
            groupInput.value = map[stuId];
        }
    });
    showToast(`Daftar kelompok "${activePresetKey}" diterapkan!`);
}

async function saveCurrentTableAsGroupPreset() {
    const classId = document.getElementById('guru-active-class')?.value;
    if (!classId) return;

    const presetName = prompt('Simpan tabel kelompok ini dengan nama:', `Kelompok Bab ${Date.now().toString().slice(-4)}`);
    if (!presetName) return;

    const mapping = {};
    document.querySelectorAll('#scores-tbody tr').forEach(r => {
        const stuId = Number(r.getAttribute('data-stuid'));
        const g = (r.querySelector('.sc-group')?.value || '').trim();
        if (g) mapping[stuId] = g;
    });

    classGroupPresets[presetName] = mapping;
    activePresetKey = presetName;

    const jsonStr = JSON.stringify(mapping);
    await db.from('group_presets').insert([{
        teacher_id: currentUser.id,
        class_id: Number(classId),
        preset_name: presetName,
        mapping_json: jsonStr
    }]);

    await loadGroupPresetsForCurrentClass();
    showToast(`Daftar kelompok "${presetName}" berhasil disimpan permanen!`);
}

function openGroupManagerModal() {
    const sel = document.getElementById('gm-preset-select');
    if (!sel) return;
    sel.innerHTML = '';
    Object.keys(classGroupPresets).forEach(k => {
        sel.innerHTML += `<option value="${k}" ${k === activePresetKey ? 'selected' : ''}>${k}</option>`;
    });

    document.getElementById('gm-preset-name').value = activePresetKey;
    loadPresetIntoModal();
    document.getElementById('modal-group-manager').classList.remove('hidden');
}

function closeGroupManagerModal() {
    document.getElementById('modal-group-manager').classList.add('hidden');
}

function loadPresetIntoModal() {
    const sel = document.getElementById('gm-preset-select');
    if (!sel) return;
    activePresetKey = sel.value;
    document.getElementById('gm-preset-name').value = activePresetKey;
    const map = classGroupPresets[activePresetKey] || {};

    const tbody = document.getElementById('gm-students-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';

    studentsList.forEach((s, idx) => {
        const gVal = map[s.id] || '';
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${s.id}">
                <td class="p-2 text-center text-slate-500">${idx + 1}</td>
                <td class="p-2 font-mono">${s.nisn}</td>
                <td class="p-2 font-semibold">${s.nama}</td>
                <td class="p-2">
                    <input type="text" value="${gVal.replace(/"/g, '&quot;')}" placeholder="Kelompok 1" class="gm-stu-group w-full border rounded-lg p-1.5 text-xs font-semibold">
                </td>
            </tr>
        `;
    });
    updateGroupSummaryBadgesInModal();
}

function updateGroupSummaryBadgesInModal() {
    const container = document.getElementById('gm-summary-badges');
    if (!container) return;
    const counts = {};
    document.querySelectorAll('#gm-students-tbody tr').forEach(r => {
        const g = (r.querySelector('.gm-stu-group')?.value || '').trim();
        if (g) counts[g] = (counts[g] || 0) + 1;
    });

    container.innerHTML = '';
    const keys = Object.keys(counts);
    if (!keys.length) {
        container.innerHTML = `<span class="text-xs text-slate-400 italic">Belum ada kelompok yang terisi.</span>`;
        return;
    }
    keys.forEach(k => {
        container.innerHTML += `<span class="px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-100 text-blue-800">👥 ${k}: <b>${counts[k]} siswa</b></span>`;
    });
}

function autoGenerateGroups(mode) {
    const countInput = document.getElementById('gm-auto-count');
    const numGroups = Number(countInput?.value) || 5;
    const rows = Array.from(document.querySelectorAll('#gm-students-tbody tr'));
    if (!rows.length) return;

    let targetRows = [...rows];
    if (mode === 'random') {
        targetRows.sort(() => Math.random() - 0.5);
    }

    targetRows.forEach((r, idx) => {
        const groupNum = (idx % numGroups) + 1;
        const input = r.querySelector('.gm-stu-group');
        if (input) input.value = `Kelompok ${groupNum}`;
    });
    updateGroupSummaryBadgesInModal();
}

function clearAllModalGroups() {
    document.querySelectorAll('.gm-stu-group').forEach(i => i.value = '');
    updateGroupSummaryBadgesInModal();
}

async function createNewGroupPreset() {
    const name = prompt('Nama daftar kelompok baru:', `Kelompok Baru ${Date.now().toString().slice(-4)}`);
    if (!name) return;
    classGroupPresets[name] = {};
    activePresetKey = name;
    openGroupManagerModal();
}

async function deleteCurrentGroupPreset() {
    const sel = document.getElementById('gm-preset-select');
    if (!sel) return;
    const name = sel.value;
    if (Object.keys(classGroupPresets).length <= 1) {
        return showToast('Minimal harus ada 1 daftar kelompok!', 'error');
    }
    if (!confirm(`Hapus daftar kelompok "${name}"?`)) return;

    const classId = document.getElementById('guru-active-class').value;
    await db.from('group_presets')
        .delete()
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('preset_name', name);

    delete classGroupPresets[name];
    activePresetKey = Object.keys(classGroupPresets)[0];
    openGroupManagerModal();
    showToast(`Daftar kelompok "${name}" dihapus.`);
}

async function saveGroupPresetFromModal(andApply = false) {
    const classId = document.getElementById('guru-active-class').value;
    const nameInput = document.getElementById('gm-preset-name');
    const newName = nameInput ? nameInput.value.trim() : activePresetKey;
    if (!newName) return showToast('Nama daftar kelompok tidak boleh kosong!', 'error');

    const mapping = {};
    document.querySelectorAll('#gm-students-tbody tr').forEach(r => {
        const stuId = Number(r.getAttribute('data-stuid'));
        const g = (r.querySelector('.gm-stu-group')?.value || '').trim();
        if (g) mapping[stuId] = g;
    });

    if (newName !== activePresetKey) {
        await db.from('group_presets')
            .delete()
            .eq('teacher_id', currentUser.id)
            .eq('class_id', classId)
            .eq('preset_name', activePresetKey);
        delete classGroupPresets[activePresetKey];
    }

    classGroupPresets[newName] = mapping;
    activePresetKey = newName;

    const jsonStr = JSON.stringify(mapping);
    await db.from('group_presets').upsert([{
        teacher_id: currentUser.id,
        class_id: Number(classId),
        preset_name: newName,
        mapping_json: jsonStr
    }], { onConflict: 'teacher_id,class_id,preset_name' });

    await loadGroupPresetsForCurrentClass();
    closeGroupManagerModal();
    showToast(`Daftar kelompok "${newName}" berhasil disimpan!`);

    if (andApply) {
        applySelectedGroupPreset();
        await loadAssessmentScores();
    }
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
        tbody.innerHTML = '<tr><td colspan="7" class="p-4 text-center text-slate-400">Silakan buat atau pilih penilaian di atas.</td></tr>';
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
                <th class="p-3 border-b text-center min-w-[140px]">Status Pengajuan Siswa</th>
                <th class="p-3 border-b text-center min-w-[110px]">Status Kumpul</th>
                <th class="p-3 border-b text-center min-w-[110px]">Nilai (0-100)</th>
                <th class="p-3 border-b text-left min-w-[190px]">Link Bukti / Catatan</th>
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
        const sc = scoreMap[stu.id] || { nama_kelompok: '', status_kumpul: false, status_pengajuan: 'none', link_tugas_siswa: '', nilai: null };
        if (sc.status_kumpul || sc.status_pengajuan === 'approved') submittedCount++;
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

        let pengajuanBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500">Belum Mengajukan</span>`;
        if (sc.status_pengajuan === 'pending') {
            pengajuanBadgeHtml = `
                <div class="flex flex-col items-center gap-1">
                    <span class="px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">Menunggu Review</span>
                    <div class="flex gap-1">
                        <button type="button" onclick="moderateStudentSubmission(${stu.id}, ${assId}, 'approved')" class="px-2 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-extrabold shadow-sm">✔ Terima</button>
                        <button type="button" onclick="moderateStudentSubmission(${stu.id}, ${assId}, 'rejected')" class="px-2 py-0.5 rounded bg-rose-600 text-white text-[10px] font-extrabold shadow-sm">✖ Tolak</button>
                    </div>
                </div>
            `;
        } else if (sc.status_pengajuan === 'approved' || sc.status_kumpul) {
            pengajuanBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">✅ Disetujui Guru</span>`;
        } else if (sc.status_pengajuan === 'rejected') {
            pengajuanBadgeHtml = `<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">❌ Ditolak / Revisi</span>`;
        }

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
                <td class="p-2 text-center align-middle">${pengajuanBadgeHtml}</td>
                <td class="p-2 text-center whitespace-nowrap">
                    <label class="inline-flex items-center cursor-pointer select-none">
                        <input type="checkbox" ${sc.status_kumpul || sc.status_pengajuan === 'approved' ? 'checked' : ''} onchange="onStatusOrScoreChange(this)" class="sc-status w-4 h-4 accent-blue-600 cursor-pointer">
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

function onStatusOrScoreChange(inputEl) {
    const row = inputEl.closest('tr');
    if (!row) return;
    const assId = document.getElementById('active-assessment')?.value;
    const assObj = currentAssessments.find(a => a.id == assId);
    const isGroup = assObj && (assObj.tipe_kerja === 'kelompok' || assObj.kategori === 'tugas_kelompok');
    if (!isGroup) return;

    const groupVal = (row.querySelector('.sc-group')?.value || '').trim().toLowerCase();
    if (!groupVal) return;

    const isChecked = row.querySelector('.sc-status')?.checked;
    const valNilai = row.querySelector('.sc-nilai')?.value;
    const valLink = row.querySelector('.sc-link')?.value;
    const thisStuId = row.getAttribute('data-stuid');

    document.querySelectorAll('#scores-tbody tr').forEach(r => {
        if (r.getAttribute('data-stuid') === thisStuId) return;
        const g = (r.querySelector('.sc-group')?.value || '').trim().toLowerCase();
        if (g === groupVal) {
            if (isChecked !== undefined) r.querySelector('.sc-status').checked = isChecked;
            if (valNilai !== undefined) r.querySelector('.sc-nilai').value = valNilai;
            if (valLink !== undefined) r.querySelector('.sc-link').value = valLink;
        }
    });
}

async function moderateStudentSubmission(studentId, assessmentId, decision) {
    const { data: existing } = await db.from('scores')
        .select('*')
        .eq('assessment_id', assessmentId)
        .eq('student_id', studentId)
        .single();

    const isApproved = decision === 'approved';
    let error = null;

    if (existing) {
        const res = await db.from('scores')
            .update({
                status_pengajuan: decision,
                status_kumpul: isApproved
            })
            .eq('id', existing.id);
        error = res.error;
    } else {
        const res = await db.from('scores')
            .insert([{
                assessment_id: assessmentId,
                student_id: studentId,
                status_pengajuan: decision,
                status_kumpul: isApproved
            }]);
        error = res.error;
    }

    if (error) {
        return showToast('Gagal memproses moderasi: ' + error.message, 'error');
    }

    showToast(isApproved ? '✅ Pengajuan diterima! Status siswa tuntas.' : '❌ Pengajuan ditolak / minta revisi.');
    await loadAssessmentScores();
}

async function saveAssessmentScores() {
    const assId = document.getElementById('active-assessment')?.value;
    if (!assId) return showToast('Pilih penilaian terlebih dahulu!', 'error');

    const rows = document.querySelectorAll('#scores-tbody tr');
    const upserts = [];

    rows.forEach(r => {
        const student_id = Number(r.getAttribute('data-stuid'));
        const nama_kelompok = r.querySelector('.sc-group')?.value || '';
        const status_kumpul = r.querySelector('.sc-status')?.checked || false;
        const rawNilai = r.querySelector('.sc-nilai')?.value;
        const nilai = rawNilai !== '' && rawNilai !== null ? Number(rawNilai) : null;
        const link_tugas_siswa = r.querySelector('.sc-link')?.value || '';

        const payload = {
            assessment_id: Number(assId),
            student_id,
            nama_kelompok,
            status_kumpul,
            nilai,
            link_tugas_siswa
        };
        if (status_kumpul) {
            payload.status_pengajuan = 'approved';
        }
        upserts.push(payload);
    });

    const { error } = await db.from('scores').upsert(upserts, { onConflict: 'assessment_id,student_id' });
    if (error) return showToast('Gagal menyimpan nilai: ' + error.message, 'error');

    showToast('Semua nilai, link & status tugas berhasil disimpan!');
    await loadAssessmentScores();
}

// 4. REKAPITULASI & LAPORAN
async function calculateAndRenderRekap() {
    const classId = document.getElementById('guru-active-class')?.value;
    const tbody = document.getElementById('rekap-tbody');
    if (!classId || !currentSettings || !tbody) return;

    const stuIds = studentsList.map(s => s.id);
    if (!stuIds.length) {
        tbody.innerHTML = '<tr><td colspan="11" class="p-6 text-center text-slate-400">Belum ada siswa.</td></tr>';
        return;
    }

    const { data: attData } = await db.from('attendance')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('mapel', currentSettings.mapel)
        .in('student_id', stuIds);
    const attMap = {};
    (attData || []).forEach(a => attMap[a.student_id] = a);

    const { data: assList } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel);
    const safeAss = assList || [];
    const assIds = safeAss.map(a => a.id);

    let scoresList = [];
    if (assIds.length) {
        const { data: sc } = await db.from('scores').select('*').in('assessment_id', assIds);
        scoresList = sc || [];
    }

    latestRekapData = [];
    tbody.innerHTML = '';

    let sumAbsen = 0, sumTugas = 0, sumBab = 0, sumSmt = 0;
    let tuntasCount = 0;

    studentsList.forEach((stu, idx) => {
        const att = attMap[stu.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        const nAbsen = Number(calcAttendanceScore(att.hadir, att.sakit, att.izin, att.alpa));

        const getAvgCat = (filterFn) => {
            const f = safeAss.filter(filterFn);
            if (!f.length) return 0;
            let tot = 0;
            f.forEach(a => {
                const s = scoresList.find(sc => sc.assessment_id === a.id && sc.student_id === stu.id);
                tot += (s && s.nilai !== null) ? Number(s.nilai) : 0;
            });
            return tot / f.length;
        };

        const nTugas = getAvgCat(a => isKategoriTugas(a.kategori));
        const nBab   = getAvgCat(a => isKategoriUjianBab(a.kategori));
        const nSmt   = getAvgCat(a => isKategoriUjianSemester(a.kategori));

        sumAbsen += nAbsen;
        sumTugas += nTugas;
        sumBab += nBab;
        sumSmt += nSmt;

        const totalW = currentSettings.w_absen + currentSettings.w_tugas + currentSettings.w_bab + currentSettings.w_uas;
        const div = totalW > 0 ? totalW : 100;
        const nilaiAkhir = ((nAbsen * currentSettings.w_absen) + (nTugas * currentSettings.w_tugas) + (nBab * currentSettings.w_bab) + (nSmt * currentSettings.w_uas)) / div;

        const isTuntas = nilaiAkhir >= currentSettings.kkm;
        if (isTuntas) tuntasCount++;

        latestRekapData.push({
            student: stu,
            nAbsen, nTugas, nBab, nSmt, nilaiAkhir, isTuntas
        });

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono">${stu.nisn}</td>
                <td class="p-3 font-semibold text-slate-900">${stu.nama}</td>
                <td class="p-3 text-center font-bold">${nAbsen.toFixed(1)}</td>
                <td class="p-3 text-center font-bold">${nTugas.toFixed(1)}</td>
                <td class="p-3 text-center font-bold">${nBab.toFixed(1)}</td>
                <td class="p-3 text-center font-bold">${nSmt.toFixed(1)}</td>
                <td class="p-3 text-center font-extrabold text-blue-700 bg-blue-50/50">${nilaiAkhir.toFixed(1)}</td>
                <td class="p-3 text-center font-semibold text-slate-600">${currentSettings.kkm}</td>
                <td class="p-3 text-center">
                    ${isTuntas ? '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-emerald-100 text-emerald-800">Tuntas</span>' : '<span class="px-2.5 py-1 rounded-full text-xs font-extrabold bg-rose-100 text-rose-800">Belum Tuntas</span>'}
                </td>
                <td class="p-3 text-center">
                    <button type="button" onclick="printSingleStudentCardPDF(${stu.id})" class="px-2.5 py-1 bg-rose-50 text-rose-600 border border-rose-200 rounded-lg text-xs font-bold hover:bg-rose-100">🖨️ PDF</button>
                </td>
            </tr>
        `;
    });

    const totalStu = studentsList.length || 1;
    renderRekapCharts(sumAbsen/totalStu, sumTugas/totalStu, sumBab/totalStu, sumSmt/totalStu, tuntasCount, totalStu - tuntasCount);
}

function renderRekapCharts(avgAbs, avgTug, avgBab, avgSmt, tuntas, belum) {
    if (typeof Chart === 'undefined') return;

    const ctxComp = document.getElementById('chartRekapComponents');
    if (ctxComp) {
        if (chartInstances.rekapComp) chartInstances.rekapComp.destroy();
        chartInstances.rekapComp = new Chart(ctxComp, {
            type: 'bar',
            data: {
                labels: ['Absensi', 'Tugas', 'Ujian Bab', 'Ujian Semester'],
                datasets: [{
                    label: 'Rata-rata',
                    data: [avgAbs, avgTug, avgBab, avgSmt],
                    backgroundColor: ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'],
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

    const ctxKKM = document.getElementById('chartRekapKKM');
    if (ctxKKM) {
        if (chartInstances.rekapKKM) chartInstances.rekapKKM.destroy();
        chartInstances.rekapKKM = new Chart(ctxKKM, {
            type: 'doughnut',
            data: {
                labels: ['Tuntas KKM', 'Belum Tuntas'],
                datasets: [{
                    data: [tuntas, belum],
                    backgroundColor: ['#10b981', '#f43f5e'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                cutout: '68%',
                plugins: { legend: { position: 'bottom' } }
            }
        });
    }
}

async function exportRekapExcel() {
    if (!latestRekapData.length) return showToast('Belum ada data rekap!', 'error');
    const rows = latestRekapData.map((d, idx) => ({
        No: idx + 1,
        NISN: d.student.nisn,
        Nama: d.student.nama,
        "Nilai Absen": Number(d.nAbsen.toFixed(1)),
        "Rata2 Tugas": Number(d.nTugas.toFixed(1)),
        "Rata2 Bab": Number(d.nBab.toFixed(1)),
        "Ujian Semester": Number(d.nSmt.toFixed(1)),
        "Nilai Akhir": Number(d.nilaiAkhir.toFixed(1)),
        KKM: currentSettings.kkm,
        Status: d.isTuntas ? 'Tuntas' : 'Belum Tuntas'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Rekap_Nilai");
    XLSX.writeFile(wb, `Rekap_Nilai_${currentSettings.mapel}.xlsx`);
}

async function printClassRekapPDF() {
    if (typeof window.jspdf === 'undefined') return showToast('Library jsPDF belum termuat!', 'error');
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    const classId = document.getElementById('guru-active-class').value;
    const clsObj = classesList.find(c => c.id == classId);

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('LAPORAN REKAPITULASI HASIL BELAJAR SISWA', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Kelas: ${clsObj ? clsObj.nama_kelas : '-'} | Mata Pelajaran: ${currentSettings?.mapel || '-'} | Guru: ${currentUser.nama_lengkap}`, 14, 25);
    doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { dateStyle: 'full' })}`, 14, 30);

    const tableRows = latestRekapData.map((d, idx) => [
        idx + 1,
        d.student.nisn,
        d.student.nama,
        d.nAbsen.toFixed(1),
        d.nTugas.toFixed(1),
        d.nBab.toFixed(1),
        d.nSmt.toFixed(1),
        d.nilaiAkhir.toFixed(1),
        currentSettings.kkm,
        d.isTuntas ? 'TUNTAS' : 'BELUM'
    ]);

    doc.autoTable({
        startY: 36,
        head: [['No', 'NISN', 'Nama Siswa', 'Absen', 'Tugas', 'Bab', 'Smt', 'Akhir', 'KKM', 'Status']],
        body: tableRows,
        theme: 'grid',
        headStyles: { fillColor: [37, 99, 235], fontSize: 9 },
        bodyStyles: { fontSize: 8 },
        columnStyles: { 0: { halign: 'center' }, 7: { fontStyle: 'bold' } }
    });

    doc.save(`Rekap_Nilai_${clsObj?.nama_kelas || 'Kelas'}_${currentSettings?.mapel || 'Mapel'}.pdf`);
}

async function printSingleStudentCardPDF(studentId) {
    if (typeof window.jspdf === 'undefined') return showToast('Library jsPDF belum termuat!', 'error');
    const stu = studentsList.find(s => s.id === studentId);
    if (!stu || !currentSettings) return;

    const dataRec = latestRekapData.find(d => d.student.id === studentId);
    if (!dataRec) return;

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'mm', 'a4');

    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('KARTU LAPORAN HASIL BELAJAR SISWA', 14, 18);

    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(`Nama: ${stu.nama} | NISN: ${stu.nisn} | Mapel: ${currentSettings.mapel}`, 14, 25);

    doc.autoTable({
        startY: 32,
        head: [['Komponen Penilaian', 'Capaian Skor', 'Bobot (%)', 'Kontribusi']],
        body: [
            ['Kehadiran & Presensi', dataRec.nAbsen.toFixed(1), `${currentSettings.w_absen}%`, ((dataRec.nAbsen * currentSettings.w_absen)/100).toFixed(1)],
            ['Penugasan (Tugas)', dataRec.nTugas.toFixed(1), `${currentSettings.w_tugas}%`, ((dataRec.nTugas * currentSettings.w_tugas)/100).toFixed(1)],
            ['Ujian Akhir Bab', dataRec.nBab.toFixed(1), `${currentSettings.w_bab}%`, ((dataRec.nBab * currentSettings.w_bab)/100).toFixed(1)],
            ['Ujian Semester', dataRec.nSmt.toFixed(1), `${currentSettings.w_uas}%`, ((dataRec.nSmt * currentSettings.w_uas)/100).toFixed(1)],
        ],
        theme: 'striped',
        headStyles: { fillColor: [37, 99, 235] }
    });

    const finalY = doc.lastAutoTable.finalY + 10;
    doc.setFontSize(12);
    doc.setTextColor(15, 23, 42);
    doc.text(`Nilai Akhir Rapor: ${dataRec.nilaiAkhir.toFixed(1)} (KKM: ${currentSettings.kkm})`, 14, finalY);
    doc.text(`Status Kelulusan Mapel: ${dataRec.isTuntas ? 'TUNTAS' : 'BELUM TUNTAS'}`, 14, finalY + 7);

    doc.save(`Rapor_${stu.nama.replace(/\s+/g, '_')}_${currentSettings.mapel}.pdf`);
}

// 5. GURU WALI & BIMBINGAN AKADEMIK (PA 360°)
let waliBinaanList = [];
let activeWaliStudent360 = null;

async function loadGuruWaliDashboard() {
    const { data: bData } = await db.from('wali_binaan')
        .select('*')
        .eq('teacher_id', currentUser.id);

    const binaanStudentIds = (bData || []).map(b => b.student_id);
    if (!binaanStudentIds.length) {
        waliBinaanList = [];
        renderGuruWaliRows();
        return;
    }

    const { data: stuData } = await db.from('students')
        .select('*, classes(nama_kelas)')
        .in('id', binaanStudentIds);

    waliBinaanList = stuData || [];
    renderGuruWaliRows();
}

async function renderGuruWaliRows() {
    const tbody = document.getElementById('wali-tbody');
    if (!tbody) return;

    if (!waliBinaanList.length) {
        document.getElementById('wali-stat-total').innerText = '0 Siswa';
        document.getElementById('wali-stat-classes').innerText = 'Lintas Kelas';
        document.getElementById('wali-stat-aman').innerText = '0 Siswa';
        document.getElementById('wali-stat-waspada').innerText = '0 Siswa';
        document.getElementById('wali-stat-kritis').innerText = '0 Siswa';
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">Belum ada siswa binaan yang dipilih. Klik <b>"Pilih / Kelola Siswa Binaan"</b> di atas.</td></tr>`;
        return;
    }

    const stuIds = waliBinaanList.map(s => s.id);
    const classIds = [...new Set(waliBinaanList.map(s => s.class_id))];

    const [attRes, settingsRes, assRes, scoresRes, logsRes] = await Promise.all([
        db.from('attendance').select('*').eq('teacher_id', currentUser.id).in('student_id', stuIds),
        db.from('teacher_settings').select('*').in('class_id', classIds),
        db.from('assessments').select('*').in('class_id', classIds),
        db.from('scores').select('*').in('student_id', stuIds),
        db.from('attendance_logs').select('*').in('class_id', classIds).in('student_id', stuIds)
    ]);

    const attMap = {};
    (attRes.data || []).forEach(a => {
        if (!attMap[a.student_id]) attMap[a.student_id] = {};
        attMap[a.student_id][a.mapel] = a;
    });

    const settingsList = settingsRes.data || [];
    const assessmentsList = assRes.data || [];
    const scoresList = scoresRes.data || [];
    const logsList = logsRes.data || [];

    const filterEws = document.getElementById('wali-filter-ews')?.value || 'all';
    const searchQ = (document.getElementById('wali-search-input')?.value || '').toLowerCase();

    let countAman = 0, countWaspada = 0, countKritis = 0;
    const uniqueClasses = new Set();
    tbody.innerHTML = '';

    let displayedCount = 0;

    waliBinaanList.forEach((stu, idx) => {
        uniqueClasses.add(stu.class_id);
        const nameMatch = stu.nama.toLowerCase().includes(searchQ) || (stu.classes?.nama_kelas || '').toLowerCase().includes(searchQ);
        if (!nameMatch) return;

        const stuLogs = logsList.filter(l => l.student_id === stu.id);
        const totalAlpa = stuLogs.filter(l => l.status === 'A').length;
        const totalHadir = stuLogs.filter(l => l.status === 'H').length;

        const stuSettings = settingsList.filter(ts => ts.class_id === stu.class_id);
        let totalUnfinishedTasks = 0;
        let sumAllFinalScores = 0;
        let countMapelGraded = 0;

        stuSettings.forEach(ts => {
            const mapelAss = assessmentsList.filter(a => a.class_id === stu.class_id && a.mapel === ts.mapel);
            mapelAss.forEach(a => {
                const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
                if (!sc || (!sc.status_kumpul && sc.status_pengajuan !== 'approved')) {
                    totalUnfinishedTasks++;
                }
            });

            const mapelAtt = (attMap[stu.id] && attMap[stu.id][ts.mapel]) || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
            const nAbsen = Number(calcAttendanceScore(mapelAtt.hadir, mapelAtt.sakit, mapelAtt.izin, mapelAtt.alpa));

            const getAvgCat = (filterFn) => {
                const f = mapelAss.filter(filterFn);
                if (!f.length) return 0;
                let tot = 0;
                f.forEach(a => {
                    const s = scoresList.find(sc => sc.assessment_id === a.id && sc.student_id === stu.id);
                    tot += (s && s.nilai !== null) ? Number(s.nilai) : 0;
                });
                return tot / f.length;
            };

            const nTugas = getAvgCat(a => isKategoriTugas(a.kategori));
            const nBab   = getAvgCat(a => isKategoriUjianBab(a.kategori));
            const nSmt   = getAvgCat(a => isKategoriUjianSemester(a.kategori));

            const totalW = ts.w_absen + ts.w_tugas + ts.w_bab + ts.w_uas;
            const div = totalW > 0 ? totalW : 100;
            const na = ((nAbsen * ts.w_absen) + (nTugas * ts.w_tugas) + (nBab * ts.w_bab) + (nSmt * ts.w_uas)) / div;
            sumAllFinalScores += na;
            countMapelGraded++;
        });

        const avgOverall = countMapelGraded > 0 ? (sumAllFinalScores / countMapelGraded) : 0;

        let ewsStatus = 'aman';
        if (totalAlpa >= 3 || totalUnfinishedTasks >= 4 || avgOverall < 70) {
            ewsStatus = 'kritis';
        } else if (totalAlpa >= 1 || totalUnfinishedTasks >= 1 || avgOverall < 75) {
            ewsStatus = 'waspada';
        }

        if (ewsStatus === 'kritis') countKritis++;
        else if (ewsStatus === 'waspada') countWaspada++;
        else countAman++;

        if (filterEws !== 'all' && filterEws !== ewsStatus) return;
        displayedCount++;

        let ewsBadge = '';
        if (ewsStatus === 'kritis') ewsBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-rose-100 text-rose-800">🔴 Kritis</span>`;
        else if (ewsStatus === 'waspada') ewsBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-amber-100 text-amber-800">🟡 Waspada</span>`;
        else ewsBadge = `<span class="px-2.5 py-1 rounded-full text-[10px] font-extrabold bg-emerald-100 text-emerald-800">🟢 Aman</span>`;

        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">${displayedCount}</td>
                <td class="p-3">
                    <div class="font-bold text-slate-900">${stu.nama}</div>
                    <div class="text-[11px] text-slate-500">Kelas: <b>${stu.classes?.nama_kelas || '-'}</b> | NISN: ${stu.nisn}</div>
                </td>
                <td class="p-3 text-center">
                    <div class="font-bold text-slate-800">${totalHadir} Hari</div>
                    <div class="text-[10px] text-rose-600 font-semibold">${totalAlpa} Alpa</div>
                </td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-1 rounded-lg font-bold text-xs ${totalUnfinishedTasks > 0 ? 'bg-amber-50 text-amber-800 border border-amber-200' : 'bg-slate-50 text-slate-600'}">
                        ${totalUnfinishedTasks} Tugas
                    </span>
                </td>
                <td class="p-3 text-center font-extrabold text-blue-700">${avgOverall.toFixed(1)}</td>
                <td class="p-3 text-center">${ewsBadge}</td>
                <td class="p-3 text-center">
                    <button type="button" onclick="openWali360Modal(${stu.id})" class="px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-extrabold hover:bg-indigo-100 shadow-sm">
                        🔍 Bedah 360°
                    </button>
                </td>
                <td class="p-3 text-center">
                    <button type="button" onclick="openWali360Modal(${stu.id})" class="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 text-xs font-bold hover:bg-slate-200">
                        💬 Jurnal
                    </button>
                </td>
            </tr>
        `;
    });

    document.getElementById('wali-stat-total').innerText = `${waliBinaanList.length} Siswa`;
    document.getElementById('wali-stat-classes').innerText = `${uniqueClasses.size} Lintas Kelas`;
    document.getElementById('wali-stat-aman').innerText = `${countAman} Siswa`;
    document.getElementById('wali-stat-waspada').innerText = `${countWaspada} Siswa`;
    document.getElementById('wali-stat-kritis').innerText = `${countKritis} Siswa`;
}

async function openManageBinaanModal() {
    const { data: cls } = await db.from('classes').select('*').order('nama_kelas');
    const sel = document.getElementById('wali-pick-class');
    if (sel) {
        sel.innerHTML = '<option value="all">-- Semua Kelas --</option>';
        (cls || []).forEach(c => {
            sel.innerHTML += `<option value="${c.id}">${c.nama_kelas}</option>`;
        });
    }

    const { data: allStu } = await db.from('students').select('*, classes(nama_kelas)').order('nama');
    window._allStudentsCache = allStu || [];

    renderBinaanPickerList();
    document.getElementById('modal-wali-manage').classList.remove('hidden');
}

function closeManageBinaanModal() {
    document.getElementById('modal-wali-manage').classList.add('hidden');
}

async function renderBinaanPickerList() {
    const classId = document.getElementById('wali-pick-class')?.value;
    const q = (document.getElementById('wali-pick-search')?.value || '').toLowerCase();
    const tbody = document.getElementById('wali-picker-tbody');
    if (!tbody) return;

    const { data: currentBinaan } = await db.from('wali_binaan')
        .select('student_id')
        .eq('teacher_id', currentUser.id);
    const binaanSet = new Set((currentBinaan || []).map(b => b.student_id));

    let list = window._allStudentsCache || [];
    if (classId && classId !== 'all') {
        list = list.filter(s => s.class_id == classId);
    }
    if (q) {
        list = list.filter(s => s.nama.toLowerCase().includes(q) || String(s.nisn).includes(q));
    }

    let pickedCount = binaanSet.size;
    const badge = document.getElementById('wali-picked-count-badge');
    if (badge) badge.innerText = `${pickedCount} Siswa Dipilih`;

    tbody.innerHTML = '';
    if (!list.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Tidak ada siswa ditemukan.</td></tr>';
        return;
    }

    list.forEach(s => {
        const isChecked = binaanSet.has(s.id);
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-2.5 text-center">
                    <input type="checkbox" value="${s.id}" ${isChecked ? 'checked' : ''} onchange="toggleWaliBinaanStudent(${s.id}, this.checked)" class="w-4 h-4 accent-blue-600 rounded cursor-pointer">
                </td>
                <td class="p-2.5 font-semibold text-slate-900">${s.nama}</td>
                <td class="p-2.5 font-mono text-xs">${s.nisn}</td>
                <td class="p-2.5 text-center font-bold text-slate-600">${s.classes?.nama_kelas || '-'}</td>
            </tr>
        `;
    });
}

async function toggleWaliBinaanStudent(studentId, checked) {
    if (!currentUser) return;

    if (checked) {
        await db.from('wali_binaan').insert([{ 
            teacher_id: currentUser.id, 
            student_id: Number(studentId) 
        }]);
    } else {
        await db.from('wali_binaan')
            .delete()
            .eq('teacher_id', currentUser.id)
            .eq('student_id', Number(studentId));
    }

    const { data } = await db.from('wali_binaan').select('student_id').eq('teacher_id', currentUser.id);
    const badge = document.getElementById('wali-picked-count-badge');
    if (badge) badge.innerText = `${(data || []).length} Siswa Dipilih`;
}

async function saveWaliBinaanSelection() {
    closeManageBinaanModal();
    showToast('✅ Daftar siswa binaan berhasil diperbarui!');
    await loadGuruWaliDashboard();
}

async function openWali360Modal(studentId) {
    const stu = waliBinaanList.find(s => s.id === studentId);
    if (!stu) return;
    activeWaliStudent360 = stu;

    document.getElementById('w360-nama').innerText = stu.nama;
    document.getElementById('w360-kelas').innerText = `Kelas ${stu.classes?.nama_kelas || '-'}`;
    document.getElementById('w360-nisn').innerText = `NISN: ${stu.nisn}`;
    if (document.getElementById('w360-avatar')) {
        document.getElementById('w360-avatar').innerText = getInitials(stu.nama);
    }

    const [logsRes, targetRes, settingsRes, assRes, scoresRes, attRes, counselingRes] = await Promise.all([
        db.from('attendance_logs').select('*').eq('class_id', stu.class_id).eq('student_id', stu.id),
        db.from('wali_targets').select('*').eq('student_id', stu.id).single(),
        db.from('teacher_settings').select('*').eq('class_id', stu.class_id),
        db.from('assessments').select('*').eq('class_id', stu.class_id),
        db.from('scores').select('*').eq('student_id', stu.id),
        db.from('attendance').select('*').eq('student_id', stu.id),
        db.from('wali_counseling_logs').select('*').eq('student_id', stu.id).order('tanggal', { ascending: false })
    ]);

    const logs = logsRes.data || [];
    const hCount = logs.filter(l => l.status === 'H').length;
    const sCount = logs.filter(l => l.status === 'S').length;
    const iCount = logs.filter(l => l.status === 'I').length;
    const aCount = logs.filter(l => l.status === 'A').length;

    const pillsContainer = document.getElementById('w360-att-pills');
    if (pillsContainer) {
        pillsContainer.innerHTML = `
            <div class="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200"><div class="text-[10px] font-bold text-emerald-800 uppercase">Hadir</div><div class="text-lg font-extrabold text-emerald-700">${hCount}</div></div>
            <div class="p-2.5 rounded-xl bg-amber-50 border border-amber-200"><div class="text-[10px] font-bold text-amber-800 uppercase">Sakit</div><div class="text-lg font-extrabold text-amber-700">${sCount}</div></div>
            <div class="p-2.5 rounded-xl bg-sky-50 border border-sky-200"><div class="text-[10px] font-bold text-sky-800 uppercase">Izin</div><div class="text-lg font-extrabold text-sky-700">${iCount}</div></div>
            <div class="p-2.5 rounded-xl bg-rose-50 border border-rose-200"><div class="text-[10px] font-bold text-rose-800 uppercase">Alpa</div><div class="text-lg font-extrabold text-rose-700">${aCount}</div></div>
        `;
    }

    const absenceDatesBox = document.getElementById('w360-absence-dates');
    if (absenceDatesBox) {
        const notPresent = logs.filter(l => l.status !== 'H');
        absenceDatesBox.innerHTML = notPresent.length 
            ? `<b>Catatan Ketidakhadiran:</b><br>` + notPresent.map(l => `• ${l.tanggal} (${l.mapel}): <b>${l.status}</b>`).join('<br>')
            : `<i>Tidak ada catatan sakit/izin/alpa pada log kehadiran.</i>`;
    }

    const targetInput = document.getElementById('w360-target-input');
    if (targetInput) targetInput.value = targetRes.data?.target_teks || '';

    const settings = settingsRes.data || [];
    const assessments = assRes.data || [];
    const scores = scoresRes.data || [];
    const attMap = {};
    (attRes.data || []).forEach(a => { attMap[a.mapel] = a; });

    const subjectsTbody = document.getElementById('w360-subjects-tbody');
    const pendingListContainer = document.getElementById('w360-pending-list');
    if (subjectsTbody) subjectsTbody.innerHTML = '';
    if (pendingListContainer) pendingListContainer.innerHTML = '';

    let totalPendingCount = 0;

    settings.forEach(ts => {
        const mapelAss = assessments.filter(a => a.mapel === ts.mapel);
        let completedTugas = 0;

        mapelAss.forEach(a => {
            const sc = scores.find(s => s.assessment_id === a.id && s.student_id === stu.id);
            const isDone = sc && (sc.status_kumpul || sc.status_pengajuan === 'approved');
            if (isDone) {
                completedTugas++;
            } else {
                totalPendingCount++;
                if (pendingListContainer) {
                    pendingListContainer.innerHTML += `
                        <div class="p-2.5 rounded-xl bg-rose-50/70 border border-rose-200 text-xs flex justify-between items-center">
                            <div>
                                <span class="font-extrabold text-rose-950 block">${a.judul}</span>
                                <span class="text-[10px] text-slate-500">${ts.mapel}</span>
                            </div>
                            <span class="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">Belum Kumpul</span>
                        </div>
                    `;
                }
            }
        });

        const att = attMap[ts.mapel] || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        const nAbsen = Number(calcAttendanceScore(att.hadir, att.sakit, att.izin, att.alpa));

        const getAvgCat = (filterFn) => {
            const f = mapelAss.filter(filterFn);
            if (!f.length) return 0;
            let tot = 0;
            f.forEach(a => {
                const s = scores.find(sc => sc.assessment_id === a.id && sc.student_id === stu.id);
                tot += (s && s.nilai !== null) ? Number(s.nilai) : 0;
            });
            return tot / f.length;
        };

        const nTugas = getAvgCat(a => isKategoriTugas(a.kategori));
        const nBab   = getAvgCat(a => isKategoriUjianBab(a.kategori));
        const nSmt   = getAvgCat(a => isKategoriUjianSemester(a.kategori));

        const totalW = ts.w_absen + ts.w_tugas + ts.w_bab + ts.w_uas;
        const div = totalW > 0 ? totalW : 100;
        const nilaiAkhir = ((nAbsen * ts.w_absen) + (nTugas * ts.w_tugas) + (nBab * ts.w_bab) + (nSmt * ts.w_uas)) / div;
        const isTuntas = nilaiAkhir >= ts.kkm;

        if (subjectsTbody) {
            subjectsTbody.innerHTML += `
                <tr class="hover:bg-slate-50">
                    <td class="p-2.5 font-bold text-slate-800">${ts.mapel}</td>
                    <td class="p-2.5 text-slate-600">-</td>
                    <td class="p-2.5 text-center font-bold">${att.hadir}H / ${att.alpa}A</td>
                    <td class="p-2.5 text-center font-bold">${completedTugas}/${mapelAss.length}</td>
                    <td class="p-2.5 text-center">${nTugas.toFixed(1)}</td>
                    <td class="p-2.5 text-center">${nBab.toFixed(1)}</td>
                    <td class="p-2.5 text-center">${nSmt.toFixed(1)}</td>
                    <td class="p-2.5 text-center font-extrabold text-blue-700 bg-blue-50/50">${nilaiAkhir.toFixed(1)}</td>
                    <td class="p-2.5 text-center font-semibold text-slate-500">${ts.kkm}</td>
                    <td class="p-2.5 text-center">
                        ${isTuntas ? '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-emerald-100 text-emerald-800">Tuntas</span>' : '<span class="px-2 py-0.5 rounded text-[10px] font-extrabold bg-rose-100 text-rose-800">Remedial</span>'}
                    </td>
                </tr>
            `;
        }
    });

    if (pendingListContainer && totalPendingCount === 0) {
        pendingListContainer.innerHTML = `<div class="p-4 text-center text-emerald-700 text-xs font-bold bg-emerald-50 rounded-xl border border-emerald-200">🎉 Luar biasa! Seluruh tugas lintas mapel sudah tuntas dikumpulkan.</div>`;
    }
    if (document.getElementById('w360-pending-badge')) {
        document.getElementById('w360-pending-badge').innerText = `${totalPendingCount} Tunggakan`;
    }

    renderWaliCounselingLogs(counselingRes.data || []);
    document.getElementById('modal-wali-360').classList.remove('hidden');
}

function closeWali360Modal() {
    activeWaliStudent360 = null;
    document.getElementById('modal-wali-360').classList.add('hidden');
}

async function saveWaliTargetAkademik() {
    if (!activeWaliStudent360) return;
    const target_teks = document.getElementById('w360-target-input')?.value.trim() || '';

    await db.from('wali_targets').upsert([{
        teacher_id: currentUser.id,
        student_id: activeWaliStudent360.id,
        target_teks
    }], { onConflict: 'teacher_id,student_id' });

    showToast('Target akademik siswa binaan berhasil disimpan!');
}

async function addWaliCounselingLog(e) {
    e.preventDefault();
    if (!activeWaliStudent360) return;

    const tanggal = document.getElementById('w360-log-date').value;
    const topik = document.getElementById('w360-log-topic').value;
    const catatan = document.getElementById('w360-log-note').value.trim();
    const tindak_lanjut = document.getElementById('w360-log-tindak').value.trim();

    const { error } = await db.from('wali_counseling_logs').insert([{
        teacher_id: currentUser.id,
        student_id: activeWaliStudent360.id,
        tanggal,
        topik,
        catatan,
        tindak_lanjut
    }]);

    if (error) return showToast('Gagal mencatat jurnal: ' + error.message, 'error');

    document.getElementById('w360-log-note').value = '';
    document.getElementById('w360-log-tindak').value = '';
    showToast('Jurnal bimbingan berhasil dicatat!');

    const { data } = await db.from('wali_counseling_logs')
        .select('*')
        .eq('student_id', activeWaliStudent360.id)
        .order('tanggal', { ascending: false });
    renderWaliCounselingLogs(data || []);
}

function renderWaliCounselingLogs(logs) {
    const container = document.getElementById('w360-logs-list');
    if (!container) return;

    container.innerHTML = '';
    if (!logs.length) {
        container.innerHTML = `<p class="text-xs text-slate-400 italic text-center py-4">Belum ada catatan jurnal bimbingan.</p>`;
        return;
    }

    logs.forEach(l => {
        container.innerHTML += `
            <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 text-xs space-y-1">
                <div class="flex items-center justify-between">
                    <span class="font-extrabold text-blue-900">📌 ${l.topik}</span>
                    <span class="text-[10px] text-slate-400">${l.tanggal}</span>
                </div>
                <p class="text-slate-700">${l.catatan}</p>
                ${l.tindak_lanjut ? `<p class="text-[11px] text-indigo-700 font-semibold">Tindak Lanjut: ${l.tindak_lanjut}</p>` : ''}
            </div>
        `;
    });
}

async function exportWaliBinaanExcel() {
    if (!waliBinaanList.length) return showToast('Tidak ada data siswa binaan!', 'error');
    const rows = waliBinaanList.map((s, idx) => ({
        No: idx + 1,
        NISN: s.nisn,
        Nama: s.nama,
        Kelas: s.classes?.nama_kelas || '-'
    }));

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Siswa_Binaan");
    XLSX.writeFile(wb, "Daftar_Siswa_Binaan_PA.xlsx");
}

function showToast(msg, type = 'success') {
    const t = document.getElementById('toast');
    if (!t) return;
    t.innerText = msg;
    t.className = `fixed bottom-5 right-5 z-50 px-4 py-2.5 rounded-xl text-xs font-bold shadow-lg text-white transition-all duration-300 ${type === 'error' ? 'bg-rose-600' : 'bg-slate-900'}`;
    t.classList.remove('hidden');
    setTimeout(() => t.classList.add('hidden'), 3500);
}
