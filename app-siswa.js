// ============================================================================
// FILE: app-siswa.js (v3.1)
// Logika Halaman Publik Siswa dengan Filter Kelas, Guru, dan Mata Pelajaran
// ============================================================================

let pubStudents = [];
let pubAssessments = [];
let pubScores = [];
let pubTeachersMap = {};
let pubClassesMap = {};
let allSettingsInClass = [];

window.onload = async () => {
    await loadInitialPublicDropdowns();
};

async function loadInitialPublicDropdowns() {
    const { data: cls } = await db.from('classes').select('*').order('nama_kelas');
    const selClass = document.getElementById('pub-class');
    selClass.innerHTML = '<option value="">-- Pilih Kelas --</option>';
    (cls || []).forEach(c => {
        pubClassesMap[c.id] = c.nama_kelas;
        selClass.innerHTML += `<option value="${c.id}">${c.nama_kelas}</option>`;
    });

    const { data: teachers } = await db.from('app_users').select('id, nama_lengkap').eq('role', 'guru');
    const selTeacher = document.getElementById('pub-teacher');
    selTeacher.innerHTML = '<option value="all">-- Semua Guru --</option>';
    (teachers || []).forEach(t => {
        pubTeachersMap[t.id] = t.nama_lengkap;
        selTeacher.innerHTML += `<option value="${t.id}">${t.nama_lengkap}</option>`;
    });

    const params = new URLSearchParams(window.location.search);
    if (params.get('kelas')) {
        selClass.value = params.get('kelas');
        if (params.get('guru')) selTeacher.value = params.get('guru');
        await populatePublicMapelDropdown(params.get('mapel'));
        await loadPublicData();
    }
}

async function onPublicClassChange() {
    await populatePublicMapelDropdown();
    await loadPublicData();
}

async function onPublicTeacherChange() {
    await populatePublicMapelDropdown();
    await loadPublicData();
}

async function populatePublicMapelDropdown(preferredMapel = null) {
    const classId = document.getElementById('pub-class').value;
    const teacherId = document.getElementById('pub-teacher').value;
    const selMapel = document.getElementById('pub-mapel');

    if (!classId) {
        selMapel.innerHTML = '<option value="all">-- Semua Mata Pelajaran --</option>';
        return;
    }

    let q = db.from('teacher_settings').select('*').eq('class_id', classId);
    if (teacherId !== 'all') q = q.eq('teacher_id', teacherId);
    const { data } = await q;
    allSettingsInClass = data || [];

    const uniqueMapels = [...new Set(allSettingsInClass.map(s => s.mapel))];
    selMapel.innerHTML = '<option value="all">-- Semua Mata Pelajaran --</option>';
    uniqueMapels.forEach(m => {
        selMapel.innerHTML += `<option value="${m}">${m}</option>`;
    });

    if (preferredMapel && uniqueMapels.includes(preferredMapel)) {
        selMapel.value = preferredMapel;
    }
}

function copyPublicLink() {
    const k = document.getElementById('pub-class').value;
    const g = document.getElementById('pub-teacher').value;
    const m = encodeURIComponent(document.getElementById('pub-mapel').value);
    const url = `${window.location.origin}${window.location.pathname}?kelas=${k}&guru=${g}&mapel=${m}`;
    navigator.clipboard.writeText(url);
    showToast('Link Halaman Siswa berhasil disalin!');
}

async function loadPublicData() {
    const classId = document.getElementById('pub-class').value;
    const teacherId = document.getElementById('pub-teacher').value;
    const mapelFilter = document.getElementById('pub-mapel').value;
    const tbody = document.getElementById('pub-tbody');
    const linksBox = document.getElementById('pub-links-box');
    const cardsContainer = document.getElementById('pub-assessment-cards');

    if (!classId) {
        linksBox.classList.add('hidden');
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400">Silakan pilih kelas terlebih dahulu.</td></tr>';
        return;
    }

    const { data: stus } = await db.from('students').select('*').eq('class_id', classId).order('nama');
    pubStudents = stus || [];

    let queryAss = db.from('assessments').select('*').eq('class_id', classId).order('id');
    if (teacherId !== 'all') queryAss = queryAss.eq('teacher_id', teacherId);
    if (mapelFilter && mapelFilter !== 'all') queryAss = queryAss.eq('mapel', mapelFilter);

    const { data: assessments } = await queryAss;
    pubAssessments = assessments || [];

    if (pubAssessments.length) {
        linksBox.classList.remove('hidden');
        cardsContainer.innerHTML = '';
        pubAssessments.forEach(a => {
            const labelKat = a.kategori === 'tugas' ? 'Tugas' : (a.kategori === 'ujian_bab' ? 'Ujian Akhir Bab' : 'Ujian Semester');
            const namaGuru = pubTeachersMap[a.teacher_id] || 'Guru Mapel';
            const namaMapel = a.mapel || 'Mata Pelajaran';
            cardsContainer.innerHTML += `
                <div class="bg-slate-50/80 p-4 rounded-2xl border border-slate-200 flex flex-col justify-between gap-3 hover:border-indigo-300 transition">
                    <div>
                        <div class="flex items-center justify-between gap-2">
                            <span class="text-[10px] font-extrabold uppercase px-2.5 py-0.5 rounded-full bg-indigo-100 text-indigo-800">${namaMapel} • ${labelKat}</span>
                            <span class="text-[11px] font-semibold text-slate-500 truncate">${namaGuru}</span>
                        </div>
                        <h4 class="font-extrabold text-sm text-slate-900 mt-2">${a.judul}</h4>
                    </div>
                    <div class="flex flex-wrap gap-2 pt-2 border-t border-slate-200/80">
                        ${a.link_pengumpulan ? `
                            <a href="${a.link_pengumpulan}" target="_blank" class="flex-1 text-center bg-indigo-600 text-white text-xs font-bold py-2 px-3 rounded-xl hover:bg-indigo-700 transition">
                                📤 Buka Folder/Link Guru
                            </a>
                        ` : `<span class="text-[11px] text-slate-400 italic py-1">Tidak ada link eksternal</span>`}
                        <button onclick="openSubmitModal(${a.id}, '${a.judul.replace(/'/g, "\\'")}', '')" class="bg-emerald-50 text-emerald-700 border border-emerald-300 text-xs font-bold py-2 px-3 rounded-xl hover:bg-emerald-100 transition">
                            🔗 Setor Link
                        </button>
                    </div>
                </div>
            `;
        });
    } else {
        linksBox.classList.add('hidden');
    }

    const assIds = pubAssessments.map(a => a.id);
    pubScores = [];
    if (assIds.length) {
        const { data: sc } = await db.from('scores')
            .select('assessment_id, student_id, status_kumpul, link_tugas_siswa')
            .in('assessment_id', assIds);
        pubScores = sc || [];
    }

    renderPublicTable();
}

function renderPublicTable() {
    const tbody = document.getElementById('pub-tbody');
    const keyword = (document.getElementById('pub-search')?.value || '').trim().toLowerCase();

    if (!pubStudents.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400">Belum ada daftar siswa di kelas ini.</td></tr>';
        return;
    }

    const filtered = pubStudents.filter(s => 
        s.nama.toLowerCase().includes(keyword) || s.nisn.toLowerCase().includes(keyword)
    );

    if (!filtered.length) {
        tbody.innerHTML = '<tr><td colspan="4" class="p-8 text-center text-slate-400">Nama atau NISN siswa tidak ditemukan.</td></tr>';
        return;
    }

    tbody.innerHTML = '';
    filtered.forEach((s, idx) => {
        let badgesHtml = '';
        let pendingCount = 0;

        if (!pubAssessments.length) {
            badgesHtml = '<span class="text-xs text-slate-400">Belum ada tugas/ujian yang diberikan.</span>';
        } else {
            pubAssessments.forEach(a => {
                const rec = pubScores.find(sc => sc.assessment_id === a.id && sc.student_id === s.id);
                const sudah = rec && rec.status_kumpul;
                if (!sudah) pendingCount++;

                badgesHtml += `
                    <span class="inline-flex items-center gap-1 px-2.5 py-1 mr-1.5 mb-1.5 rounded-full text-xs font-bold border ${
                        sudah ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'
                    }">
                        ${sudah ? '✅' : '❌'} [${a.mapel || 'Mapel'}] ${a.judul}
                    </span>
                `;
            });
        }

        tbody.innerHTML += `
            <tr class="hover:bg-indigo-50/40 transition group">
                <td class="p-3.5 text-center text-slate-400 font-semibold">${idx + 1}</td>
                <td class="p-3.5 font-mono text-slate-600">${s.nisn}</td>
                <td class="p-3.5">
                    <button onclick="openStudentProfileModal(${s.id})" class="text-left group-hover:text-indigo-600 transition flex items-center gap-2.5 w-full">
                        <span class="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-700 font-extrabold text-xs flex items-center justify-center shrink-0">
                            ${getInitials(s.nama)}
                        </span>
                        <div>
                            <span class="font-extrabold text-slate-900 group-hover:text-indigo-600 underline decoration-dotted underline-offset-4 block">${s.nama}</span>
                            <span class="text-[11px] font-semibold ${pendingCount > 0 ? 'text-rose-600' : 'text-emerald-600'}">
                                ${pendingCount > 0 ? `⚠️ ${pendingCount} Tugas Belum Selesai — Klik Profil` : '🎉 Semua Tugas Selesai — Klik Profil'}
                            </span>
                        </div>
                    </button>
                </td>
                <td class="p-3.5">${badgesHtml}</td>
            </tr>
        `;
    });
}

function openStudentProfileModal(studentId) {
    const stu = pubStudents.find(s => s.id === studentId);
    if (!stu) return;

    const classId = document.getElementById('pub-class').value;
    const namaKelas = pubClassesMap[classId] || '-';

    document.getElementById('prof-avatar').innerText = getInitials(stu.nama);
    document.getElementById('prof-nama').innerText = stu.nama;
    document.getElementById('prof-meta').innerText = `NISN: ${stu.nisn}  •  Kelas: ${namaKelas}`;

    const pendingTasks = [];
    const completedTasks = [];

    pubAssessments.forEach(a => {
        const rec = pubScores.find(sc => sc.assessment_id === a.id && sc.student_id === stu.id);
        const sudah = rec && rec.status_kumpul;
        if (sudah) {
            completedTasks.push({ ass: a, rec });
        } else {
            pendingTasks.push({ ass: a, rec });
        }
    });

    const total = pubAssessments.length;
    const done = completedTasks.length;
    const pct = total > 0 ? Math.round((done / total) * 100) : 100;

    document.getElementById('prof-progress-text').innerText = `${done} dari ${total} Tugas Selesai (${pct}%)`;
    document.getElementById('prof-progress-bar').style.width = `${pct}%`;
    document.getElementById('prof-pending-count').innerText = pendingTasks.length;
    document.getElementById('prof-done-count').innerText = completedTasks.length;

    const pendingContainer = document.getElementById('prof-pending-list');
    pendingContainer.innerHTML = '';
    if (!pendingTasks.length) {
        pendingContainer.innerHTML = `
            <div class="p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold text-center">
                🎉 Luar biasa! Tidak ada tanggungan tugas yang belum diselesaikan.
            </div>
        `;
    } else {
        pendingTasks.forEach(({ ass }) => {
            const labelKat = ass.kategori === 'tugas' ? 'Tugas' : (ass.kategori === 'ujian_bab' ? 'Ujian Akhir Bab' : 'Ujian Semester');
            const namaGuru = pubTeachersMap[ass.teacher_id] || 'Guru Mapel';
            const namaMapel = ass.mapel || 'Mata Pelajaran';
            pendingContainer.innerHTML += `
                <div class="p-3.5 rounded-2xl bg-rose-50/70 border border-rose-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                        <span class="text-[10px] font-extrabold uppercase px-2 py-0.5 rounded bg-rose-200/70 text-rose-900">${namaMapel} • ${labelKat} • ${namaGuru}</span>
                        <h5 class="font-extrabold text-sm text-slate-900 mt-1">${ass.judul}</h5>
                    </div>
                    <div class="flex flex-wrap gap-2 shrink-0">
                        ${ass.link_pengumpulan ? `
                            <a href="${ass.link_pengumpulan}" target="_blank" class="px-3 py-1.5 rounded-xl bg-white border border-rose-300 text-rose-700 text-xs font-bold hover:bg-rose-100">
                                📤 Buka Link Guru ↗
                            </a>
                        ` : ''}
                        <button onclick="openSubmitModal(${ass.id}, '${ass.judul.replace(/'/g, "\\'")}', '${stu.nisn}')" class="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-xs font-bold hover:bg-indigo-700 shadow-sm">
                            🔗 Setor Link Tugas
                        </button>
                    </div>
                </div>
            `;
        });
    }

    const doneContainer = document.getElementById('prof-done-list');
    doneContainer.innerHTML = '';
    if (!completedTasks.length) {
        doneContainer.innerHTML = `<p class="text-xs text-slate-400 italic">Belum ada riwayat tugas yang selesai.</p>`;
    } else {
        completedTasks.forEach(({ ass, rec }) => {
            const namaGuru = pubTeachersMap[ass.teacher_id] || 'Guru Mapel';
            const namaMapel = ass.mapel || 'Mata Pelajaran';
            doneContainer.innerHTML += `
                <div class="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between gap-2 text-xs">
                    <div>
                        <span class="font-bold text-slate-800">✅ [${namaMapel}] ${ass.judul}</span>
                        <span class="text-slate-400 ml-1">(${namaGuru})</span>
                    </div>
                    ${rec?.link_tugas_siswa ? `<a href="${rec.link_tugas_siswa}" target="_blank" class="text-indigo-600 font-bold hover:underline">Lihat Link Bukti ↗</a>` : '<span class="text-emerald-700 font-bold">Tercatat di Guru</span>'}
                </div>
            `;
        });
    }

    document.getElementById('modal-student-profile').classList.remove('hidden');
}

function closeStudentProfileModal() {
    document.getElementById('modal-student-profile').classList.add('hidden');
}

function openSubmitModal(assId, assTitle, prefilledNisn = '') {
    closeStudentProfileModal();
    document.getElementById('mod-ass-id').value = assId;
    document.getElementById('mod-ass-title').innerText = assTitle;
    document.getElementById('mod-nisn').value = prefilledNisn;
    document.getElementById('mod-link').value = '';
    document.getElementById('modal-submit-link').classList.remove('hidden');
}

function closeSubmitModal() {
    document.getElementById('modal-submit-link').classList.add('hidden');
}

async function submitStudentTaskLink(e) {
    e.preventDefault();
    const assessment_id = Number(document.getElementById('mod-ass-id').value);
    const nisn = document.getElementById('mod-nisn').value.trim();
    const link_tugas_siswa = document.getElementById('mod-link').value.trim();

    const stu = pubStudents.find(s => s.nisn === nisn);
    if (!stu) {
        return showToast('NISN tidak ditemukan di kelas ini! Periksa kembali NISN Anda.', 'error');
    }

    const { error } = await db.from('scores').upsert([{
        assessment_id,
        student_id: stu.id,
        link_tugas_siswa,
        status_kumpul: true
    }], { onConflict: 'assessment_id,student_id' });

    if (error) return showToast('Gagal menyimpan link tugas: ' + error.message, 'error');

    closeSubmitModal();
    showToast(`Terima kasih ${stu.nama}, tugas Anda berhasil ditandai selesai!`);
    await loadPublicData();
}
