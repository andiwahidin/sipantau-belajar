// ============================================================================
// FILE: app-guru.js
// Logika Panel Admin & Dashboard Guru
// ============================================================================

let currentUser = null;
let classesList = [];
let studentsList = [];
let currentSettings = null;
let currentAssessments = [];
let latestRekapData = [];

window.onload = async () => {
    const today = new Date().toISOString().split('T')[0];
    const dp = document.getElementById('abs-date-picker');
    if (dp) dp.value = today;

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
// 1. AUTENTIKASI, UBAH PASSWORD & PANEL ADMIN (PASSWORD DISEMBUNYIKAN)
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

    if (currentUser.role === 'admin') {
        switchView('admin');
        loadAdminUsers();
    } else {
        switchView('guru');
        initGuruDashboard();
    }
}

function logout() {
    localStorage.removeItem('sipantau_user');
    currentUser = null;
    document.getElementById('user-badge').classList.add('hidden');
    switchView('login');
}

// Fitur Ubah Password Mandiri oleh Guru / Admin
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

    // Verifikasi password lama ke database
    const { data: verify } = await db.from('app_users')
        .select('id')
        .eq('id', currentUser.id)
        .eq('password', oldPass)
        .single();

    if (!verify) {
        return showToast('Password saat ini salah!', 'error');
    }

    const { error } = await db.from('app_users')
        .update({ password: newPass })
        .eq('id', currentUser.id);

    if (error) return showToast('Gagal mengubah password: ' + error.message, 'error');

    currentUser.password = newPass;
    localStorage.setItem('sipantau_user', JSON.stringify(currentUser));
    closePasswordModal();
    showToast('Password Anda berhasil diperbarui!');
}

// Panel Admin: Hanya mengambil id, nama_lengkap, username, role (TIDAK mengambil kolom password)
async function loadAdminUsers() {
    const { data } = await db.from('app_users')
        .select('id, nama_lengkap, username, role')
        .order('id');

    const tbody = document.getElementById('adm-user-list');
    tbody.innerHTML = '';
    (data || []).forEach(u => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3.5 font-semibold text-slate-800">${u.nama_lengkap}</td>
                <td class="p-3.5 font-mono text-indigo-700 font-bold">${u.username}</td>
                <td class="p-3.5">
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-600">
                        🔒 Terlindungi (Hanya Guru Ybs yang Tahu)
                    </span>
                </td>
                <td class="p-3.5 uppercase text-xs font-extrabold text-slate-500">${u.role}</td>
                <td class="p-3.5 text-right space-x-2">
                    ${u.role !== 'admin' ? `
                        <button onclick="resetTeacherPassword(${u.id}, '${u.username}')" class="px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-bold hover:bg-amber-100" title="Kembalikan password sama dengan username">
                            🔄 Reset Password
                        </button>
                        <button onclick="deleteUser(${u.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100">
                            🗑️ Hapus
                        </button>
                    ` : '<span class="text-xs text-slate-400">Akun Utama</span>'}
                </td>
            </tr>
        `;
    });
}

// Tambah Guru: Otomatis Password = Username
async function addTeacher(e) {
    e.preventDefault();
    const nama_lengkap = document.getElementById('adm-nama').value.trim();
    const username = document.getElementById('adm-user').value.trim();
    const password = username; // Otomatis sama dengan username

    const { error } = await db.from('app_users').insert([{ nama_lengkap, username, password, role: 'guru' }]);
    if (error) return showToast('Gagal menambah guru (Username mungkin sudah dipakai): ' + error.message, 'error');

    e.target.reset();
    showToast(`Akun ${nama_lengkap} dibuat! Password awal otomatis: ${username}`);
    loadAdminUsers();
}

async function resetTeacherPassword(id, username) {
    if (!confirm(`Reset password guru ini kembali menjadi sama dengan username (${username})?`)) return;
    await db.from('app_users').update({ password: username }).eq('id', id);
    showToast(`Password berhasil direset ke: ${username}`);
}

async function deleteUser(id) {
    if (!confirm('Hapus akun guru ini beserta seluruh data penilaiannya?')) return;
    await db.from('app_users').delete().eq('id', id);
    showToast('Akun guru dihapus.');
    loadAdminUsers();
}

// ============================================================================
// 2. DASHBOARD GURU: KELAS & EDIT DATA SISWA
// ============================================================================
function switchGuruTab(tab) {
    ['kelas', 'bobot', 'absen', 'nilai', 'rekap'].forEach(t => {
        document.getElementById('gcontent-' + t).classList.add('hidden');
        const btn = document.getElementById('gtab-' + t);
        btn.className = 'px-3.5 py-2 rounded-xl text-xs font-bold text-slate-600 hover:text-slate-900 transition';
    });
    document.getElementById('gcontent-' + tab).classList.remove('hidden');
    document.getElementById('gtab-' + tab).className = 'px-3.5 py-2 rounded-xl text-xs font-bold bg-indigo-600 text-white shadow-sm transition';

    if (tab === 'bobot') loadSettingsForm();
    if (tab === 'absen') loadAttendanceTab();
    if (tab === 'nilai') loadAssessmentsDropdown();
    if (tab === 'rekap') calculateAndRenderRekap();
}

async function initGuruDashboard() {
    switchGuruTab('kelas');
    await fetchClasses();
    await onGuruClassChange();
}

function copyStudentPortalLink() {
    const classId = document.getElementById('guru-active-class').value;
    const baseUrl = window.location.href.substring(0, window.location.href.lastIndexOf('/') + 1);
    const url = `${baseUrl}siswa.html?kelas=${classId}&guru=${currentUser.id}`;
    navigator.clipboard.writeText(url);
    showToast('Link Halaman Siswa berhasil disalin!');
}

async function fetchClasses() {
    const { data } = await db.from('classes').select('*').order('nama_kelas');
    classesList = data || [];
    const sel = document.getElementById('guru-active-class');
    sel.innerHTML = classesList.length ? '' : '<option value="">-- Belum Ada Kelas --</option>';
    classesList.forEach(c => {
        sel.innerHTML += `<option value="${c.id}">${c.nama_kelas}</option>`;
    });
}

async function onGuruClassChange() {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId) {
        document.getElementById('stu-tbody').innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Silakan buat kelas terlebih dahulu.</td></tr>';
        return;
    }
    await fetchStudentsByClass(classId);
    await ensureTeacherSettings(classId);
    const activeTab = ['kelas', 'bobot', 'absen', 'nilai', 'rekap'].find(t => !document.getElementById('gcontent-' + t).classList.contains('hidden'));
    if (activeTab) switchGuruTab(activeTab);
}

async function createClass(e) {
    e.preventDefault();
    const nama_kelas = document.getElementById('new-class-name').value.trim();
    const { data, error } = await db.from('classes').insert([{ nama_kelas }]).select().single();
    if (error) return showToast('Kelas sudah ada atau gagal dibuat!', 'error');
    document.getElementById('new-class-name').value = '';
    showToast(`Kelas ${nama_kelas} berhasil dibuat!`);
    await fetchClasses();
    document.getElementById('guru-active-class').value = data.id;
    await onGuruClassChange();
}

async function fetchStudentsByClass(classId) {
    const { data } = await db.from('students').select('*').eq('class_id', classId).order('nama');
    studentsList = data || [];
    document.getElementById('stu-count-badge').innerText = `${studentsList.length} Siswa`;

    const tbody = document.getElementById('stu-tbody');
    tbody.innerHTML = '';
    if (!studentsList.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-4 text-center text-slate-400">Belum ada siswa di kelas ini.</td></tr>';
        return;
    }

    studentsList.forEach((s, idx) => {
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono font-semibold text-slate-700">${s.nisn}</td>
                <td class="p-3 font-semibold text-slate-900">${s.nama}</td>
                <td class="p-3 text-center space-x-1.5">
                    <button onclick="openEditStudentModal(${s.id})" class="px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-bold hover:bg-indigo-100">
                        ✏️ Edit
                    </button>
                    <button onclick="deleteStudent(${s.id})" class="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-600 border border-rose-200 text-xs font-bold hover:bg-rose-100">
                        🗑️ Hapus
                    </button>
                </td>
            </tr>
        `;
    });
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

// Fitur Edit Siswa (Nama, NISN, Kelas)
function openEditStudentModal(studentId) {
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
    const id = Number(document.getElementById('edit-stu-id').value);
    const nisn = document.getElementById('edit-stu-nisn').value.trim();
    const nama = document.getElementById('edit-stu-nama').value.trim();
    const class_id = Number(document.getElementById('edit-stu-kelas').value);

    const { error } = await db.from('students')
        .update({ nisn, nama, class_id })
        .eq('id', id);

    if (error) return showToast('Gagal memperbarui data siswa (NISN mungkin bentrok): ' + error.message, 'error');

    closeEditStudentModal();
    showToast('Data siswa berhasil diperbarui!');
    await fetchStudentsByClass(document.getElementById('guru-active-class').value);
}

async function deleteStudent(id) {
    if (!confirm('Hapus siswa ini dari kelas?')) return;
    await db.from('students').delete().eq('id', id);
    showToast('Siswa dihapus.');
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
        await fetchClasses();
        await onGuruClassChange();
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

// ============================================================================
// 3. PENGATURAN BOBOT & KKM
// ============================================================================
async function ensureTeacherSettings(classId) {
    const { data } = await db.from('teacher_settings')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .single();

    if (data) {
        currentSettings = data;
    } else {
        const { data: created } = await db.from('teacher_settings')
            .insert([{ teacher_id: currentUser.id, class_id: classId }])
            .select().single();
        currentSettings = created;
    }
}

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
    const payload = {
        mapel: document.getElementById('set-mapel').value.trim(),
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
    currentSettings = { ...currentSettings, ...payload };
    showToast('Pengaturan bobot & KKM disimpan!');
}

// ============================================================================
// 4. KEHADIRAN HARIAN PER TANGGAL & REKAP TOTAL
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
    if (!classId) return;
    const { data } = await db.from('attendance_logs')
        .select('tanggal')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .order('tanggal', { ascending: false });

    const uniqueDates = [...new Set((data || []).map(d => d.tanggal))];
    const sel = document.getElementById('abs-recorded-dates');
    sel.innerHTML = `<option value="">-- ${uniqueDates.length} Tanggal Tersimpan --</option>`;
    uniqueDates.forEach(tgl => {
        sel.innerHTML += `<option value="${tgl}">${tgl}</option>`;
    });
}

function selectRecordedDate(val) {
    if (!val) return;
    document.getElementById('abs-date-picker').value = val;
    loadDailyAttendanceForDate();
}

async function loadDailyAttendanceForDate() {
    const classId = document.getElementById('guru-active-class').value;
    const tanggal = document.getElementById('abs-date-picker').value;
    const tbody = document.getElementById('daily-absen-tbody');
    if (!classId || !tanggal) return;

    const { data } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('tanggal', tanggal);

    const logMap = {};
    (data || []).forEach(l => logMap[l.student_id] = l.status);

    tbody.innerHTML = '';
    studentsList.forEach((stu, idx) => {
        const st = logMap[stu.id] || 'H';
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 text-center text-slate-500">${idx + 1}</td>
                <td class="p-3 font-mono">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-3 text-center">
                    <div class="inline-flex rounded-xl border border-slate-300 overflow-hidden text-xs font-bold">
                        <label class="px-3 py-1.5 cursor-pointer has-[:checked]:bg-emerald-600 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="H" ${st === 'H' ? 'checked' : ''} class="hidden"> Hadir
                        </label>
                        <label class="px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-amber-500 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="S" ${st === 'S' ? 'checked' : ''} class="hidden"> Sakit
                        </label>
                        <label class="px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-sky-600 has-[:checked]:text-white">
                            <input type="radio" name="dabs_${stu.id}" value="I" ${st === 'I' ? 'checked' : ''} class="hidden"> Izin
                        </label>
                        <label class="px-3 py-1.5 cursor-pointer border-l has-[:checked]:bg-rose-600 has-[:checked]:text-white">
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
    if (!class_id || !tanggal) return showToast('Pilih kelas dan tanggal!', 'error');

    const upserts = studentsList.map(stu => {
        const checked = document.querySelector(`input[name="dabs_${stu.id}"]:checked`);
        return {
            teacher_id: currentUser.id,
            class_id,
            student_id: stu.id,
            tanggal,
            status: checked ? checked.value : 'H'
        };
    });

    if (upserts.length) {
        await db.from('attendance_logs').upsert(upserts, { onConflict: 'teacher_id,student_id,tanggal' });
    }

    await recalculateAttendanceSummaryFromLogs(class_id);
    await loadRecordedDates();
    await loadAttendanceTable();
    showToast(`Absensi tanggal ${tanggal} disimpan!`);
}

async function deleteDailyAttendanceDate() {
    const class_id = Number(document.getElementById('guru-active-class').value);
    const tanggal = document.getElementById('abs-date-picker').value;
    if (!class_id || !tanggal || !confirm(`Hapus catatan kehadiran tanggal ${tanggal}?`)) return;

    await db.from('attendance_logs')
        .delete()
        .eq('teacher_id', currentUser.id)
        .eq('class_id', class_id)
        .eq('tanggal', tanggal);

    await recalculateAttendanceSummaryFromLogs(class_id);
    await loadRecordedDates();
    await loadDailyAttendanceForDate();
    await loadAttendanceTable();
    showToast(`Absensi tanggal ${tanggal} dihapus.`);
}

async function recalculateAttendanceSummaryFromLogs(classId) {
    const { data: logs } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId);

    const upserts = studentsList.map(stu => {
        const stuLogs = (logs || []).filter(l => l.student_id === stu.id);
        return {
            teacher_id: currentUser.id,
            student_id: stu.id,
            hadir: stuLogs.filter(l => l.status === 'H').length,
            sakit: stuLogs.filter(l => l.status === 'S').length,
            izin: stuLogs.filter(l => l.status === 'I').length,
            alpa: stuLogs.filter(l => l.status === 'A').length
        };
    });

    if (upserts.length) {
        await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id' });
    }
}

async function exportDailyAttendanceExcel() {
    const classId = document.getElementById('guru-active-class').value;
    if (!classId) return;
    const { data: logs } = await db.from('attendance_logs')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .order('tanggal', { ascending: true });

    const dates = [...new Set((logs || []).map(l => l.tanggal))];
    const rows = studentsList.map((stu, idx) => {
        const rowObj = { No: idx + 1, NISN: stu.nisn, Nama: stu.nama };
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
    XLSX.writeFile(wb, `Matriks_Absensi_Harian_${currentSettings ? currentSettings.mapel : 'Kelas'}.xlsx`);
}

async function loadAttendanceTable() {
    const { data } = await db.from('attendance').select('*').eq('teacher_id', currentUser.id);
    const mapAbsen = {};
    (data || []).forEach(a => mapAbsen[a.student_id] = a);

    const tbody = document.getElementById('absen-tbody');
    tbody.innerHTML = '';
    studentsList.forEach(stu => {
        const rec = mapAbsen[stu.id] || { hadir: 0, sakit: 0, izin: 0, alpa: 0 };
        const nilaiAbsen = calcAttendanceScore(rec.hadir, rec.sakit, rec.izin, rec.alpa);
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 font-mono">${stu.nisn}</td>
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
    const rows = document.querySelectorAll('#absen-tbody tr');
    const upserts = [];
    rows.forEach(r => {
        const student_id = Number(r.getAttribute('data-stuid'));
        upserts.push({
            teacher_id: currentUser.id,
            student_id,
            hadir: Number(r.querySelector('.abs-h').value) || 0,
            sakit: Number(r.querySelector('.abs-s').value) || 0,
            izin: Number(r.querySelector('.abs-i').value) || 0,
            alpa: Number(r.querySelector('.abs-a').value) || 0
        });
    });
    if (upserts.length) {
        await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id' });
    }
    showToast('Rekap kehadiran disimpan!');
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
                    hadir: Number(r.Hadir || r.hadir || 0),
                    sakit: Number(r.Sakit || r.sakit || 0),
                    izin: Number(r.Izin || r.izin || 0),
                    alpa: Number(r.Alpa || r.alpa || 0)
                });
            }
        });
        if (upserts.length) {
            await db.from('attendance').upsert(upserts, { onConflict: 'teacher_id,student_id' });
        }
        showToast('Import kehadiran selesai!');
        loadAttendanceTable();
    };
    reader.readAsArrayBuffer(fileInput.files[0]);
}

// ============================================================================
// 5. TUGAS, LINK PENGUMPULAN & PENILAIAN (INDIVIDU & KELOMPOK)
// ============================================================================
async function loadAssessmentsDropdown() {
    const classId = document.getElementById('guru-active-class').value;
    const { data } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .order('id');
    currentAssessments = data || [];
    const sel = document.getElementById('active-assessment');
    sel.innerHTML = currentAssessments.length ? '' : '<option value="">-- Belum Ada Penilaian --</option>';
    currentAssessments.forEach(a => {
        const labelKat = a.kategori === 'tugas' ? 'Tugas' : (a.kategori === 'ujian_bab' ? 'Ujian Bab' : 'Ujian Semester');
        sel.innerHTML += `<option value="${a.id}">[${labelKat} - ${a.tipe_kerja.toUpperCase()}] ${a.judul}</option>`;
    });
    await loadAssessmentScores();
}

async function createAssessment(e) {
    e.preventDefault();
    const class_id = document.getElementById('guru-active-class').value;
    if (!class_id) return showToast('Pilih kelas terlebih dahulu!', 'error');
    const judul = document.getElementById('ass-judul').value.trim();
    const kategori = document.getElementById('ass-kategori').value;
    const tipe_kerja = document.getElementById('ass-tipe').value;
    const link_pengumpulan = document.getElementById('ass-link').value.trim();

    const { data, error } = await db.from('assessments')
        .insert([{ teacher_id: currentUser.id, class_id, judul, kategori, tipe_kerja, link_pengumpulan }])
        .select().single();
    if (error) return showToast('Gagal membuat penilaian: ' + error.message, 'error');

    document.getElementById('ass-judul').value = '';
    document.getElementById('ass-link').value = '';
    showToast('Penilaian baru berhasil dibuat!');
    await loadAssessmentsDropdown();
    document.getElementById('active-assessment').value = data.id;
    await loadAssessmentScores();
}

async function updateAssessmentLink() {
    const assId = document.getElementById('active-assessment').value;
    if (!assId) return;
    const link_pengumpulan = document.getElementById('edit-ass-link').value.trim();
    await db.from('assessments').update({ link_pengumpulan }).eq('id', assId);

    const assObj = currentAssessments.find(a => a.id == assId);
    if (assObj) assObj.link_pengumpulan = link_pengumpulan;
    renderAssLinkEditor(assObj);
    showToast('Link pengumpulan tugas diperbarui!');
}

function renderAssLinkEditor(assObj) {
    const box = document.getElementById('ass-link-editor');
    const input = document.getElementById('edit-ass-link');
    const btnTest = document.getElementById('btn-test-ass-link');
    if (!assObj) {
        box.classList.add('hidden');
        return;
    }
    box.classList.remove('hidden');
    input.value = assObj.link_pengumpulan || '';
    if (assObj.link_pengumpulan) {
        btnTest.href = assObj.link_pengumpulan;
        btnTest.classList.remove('hidden');
    } else {
        btnTest.classList.add('hidden');
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
    if (!assId) {
        document.getElementById('ass-link-editor').classList.add('hidden');
        tbody.innerHTML = '<tr><td colspan="6" class="p-4 text-center text-slate-400">Silakan buat atau pilih penilaian di atas.</td></tr>';
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
    studentsList.forEach(stu => {
        const sc = scoreMap[stu.id] || { nama_kelompok: '', status_kumpul: false, link_tugas_siswa: '', nilai: null };
        const valNilai = (sc.nilai !== null && sc.nilai !== undefined) ? sc.nilai : '';
        const valLink = sc.link_tugas_siswa || '';
        tbody.innerHTML += `
            <tr class="hover:bg-slate-50" data-stuid="${stu.id}">
                <td class="p-3 font-mono text-xs">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-2">
                    <input type="text" value="${sc.nama_kelompok || ''}" placeholder="${isGroup ? 'Kelompok 1' : '-'}" 
                        ${!isGroup ? 'disabled' : ''} 
                        oninput="syncGroupRow(this)"
                        class="sc-group w-full border rounded-lg p-1.5 text-xs ${!isGroup ? 'bg-slate-100 text-slate-400' : ''}">
                </td>
                <td class="p-2">
                    <div class="flex items-center gap-1">
                        <input type="url" value="${valLink}" placeholder="https://..." oninput="onStatusOrScoreChange(this)" class="sc-link w-full border rounded-lg p-1.5 text-xs">
                        ${valLink ? `<a href="${valLink}" target="_blank" class="px-2 py-1 bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold">↗</a>` : ''}
                    </div>
                </td>
                <td class="p-2 text-center">
                    <input type="checkbox" ${sc.status_kumpul ? 'checked' : ''} onchange="onStatusOrScoreChange(this)" class="sc-status w-4 h-4 accent-indigo-600 cursor-pointer">
                    <span class="text-xs ml-1 font-medium">Sudah</span>
                </td>
                <td class="p-2">
                    <input type="number" step="0.1" min="0" max="100" value="${valNilai}" placeholder="-" oninput="onStatusOrScoreChange(this)" class="sc-nilai w-full border rounded-lg p-1.5 text-center font-bold">
                </td>
            </tr>
        `;
    });
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

async function saveAssessmentScores() {
    const assId = Number(document.getElementById('active-assessment').value);
    if (!assId) return;

    const rows = document.querySelectorAll('#scores-tbody tr');
    const upserts = [];
    rows.forEach(r => {
        const student_id = Number(r.getAttribute('data-stuid'));
        const nama_kelompok = r.querySelector('.sc-group').value.trim();
        const link_tugas_siswa = r.querySelector('.sc-link').value.trim();
        const nilaiRaw = r.querySelector('.sc-nilai').value;
        const nilai = nilaiRaw === '' ? null : Number(nilaiRaw);
        const status_kumpul = (nilai !== null || link_tugas_siswa !== '') ? true : r.querySelector('.sc-status').checked;

        upserts.push({ assessment_id: assId, student_id, nama_kelompok, link_tugas_siswa, status_kumpul, nilai });
    });

    if (upserts.length) {
        await db.from('scores').upsert(upserts, { onConflict: 'assessment_id,student_id' });
    }
    showToast('Nilai & Status pengumpulan disimpan!');
    await loadAssessmentScores();
}

// ============================================================================
// 6. REKAP NILAI AKHIR, EKSPOR EXCEL & CETAK KARTU PDF
// ============================================================================
async function calculateAndRenderRekap() {
    if (!currentSettings) return;
    const classId = document.getElementById('guru-active-class').value;
    const classObj = classesList.find(c => c.id == classId);
    const namaKelas = classObj ? classObj.nama_kelas : '-';

    document.getElementById('rekap-info-bobot').innerText = 
        `Mapel: ${currentSettings.mapel} | Kelas: ${namaKelas} | KKM: ${currentSettings.kkm} | Bobot: Absen (${currentSettings.w_absen}%), Tugas (${currentSettings.w_tugas}%), Ujian Bab (${currentSettings.w_bab}%), Ujian Smt (${currentSettings.w_uas}%)`;

    const { data: absData } = await db.from('attendance').select('*').eq('teacher_id', currentUser.id);
    const absMap = {};
    (absData || []).forEach(a => absMap[a.student_id] = a);

    const { data: assList } = await db.from('assessments')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
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
                <td class="p-3 font-mono">${stu.nisn}</td>
                <td class="p-3 font-semibold">${stu.nama}</td>
                <td class="p-3 text-center">${nAbsen.toFixed(1)}</td>
                <td class="p-3 text-center">${nTugas.toFixed(1)}</td>
                <td class="p-3 text-center">${nBab.toFixed(1)}</td>
                <td class="p-3 text-center">${nUas.toFixed(1)}</td>
                <td class="p-3 text-center font-extrabold bg-indigo-50/70 text-indigo-950">${nilaiAkhir.toFixed(2)}</td>
                <td class="p-3 text-center">${currentSettings.kkm}</td>
                <td class="p-3 text-center">
                    <span class="px-2.5 py-1 rounded-full text-xs font-extrabold ${tuntas ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}">
                        ${tuntas ? 'TUNTAS' : 'BELUM TUNTAS'}
                    </span>
                </td>
                <td class="p-3 text-center">
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

    doc.save(`Kartu_Hasil_Belajar_${d.nama.replace(/\s+/g, '_')}.pdf`);
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