// ============================================================================
// PEMBAHARUAN CARTA DASHBOARD: KATEGORI TUGAS, UJIAN AKHIR BAB & UJIAN SEMESTER
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

    if (!currentSettings || !stuIds.length) {
        document.getElementById('dash-stat-attendance').innerText = '0%';
        document.getElementById('dash-stat-tasks').innerText = '0%';
        document.getElementById('dash-bar-tasks').style.width = '0%';
        document.getElementById('dash-stat-avg').innerText = '0.0';
        document.getElementById('dash-stat-attention').innerText = '0 Siswa';
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" class="p-6 text-center text-slate-400">Belum ada siswa atau mata pelajaran aktif di kelas ini.</td></tr>';
        }
        renderDashboardCharts(100, 0, 0, 0, 0, [], [], []);
        return;
    }

    // 1. Ambil data rekap kehadiran
    const { data: absData } = await db.from('attendance')
        .select('*')
        .eq('teacher_id', currentUser.id)
        .eq('mapel', currentSettings.mapel)
        .in('student_id', stuIds);
    const absMap = {};
    (absData || []).forEach(a => absMap[a.student_id] = a);

    // 2. Ambil seluruh log harian untuk tren kehadiran
    const { data: logsData } = await db.from('attendance_logs')
        .select('tanggal, status')
        .eq('teacher_id', currentUser.id)
        .eq('class_id', classId)
        .eq('mapel', currentSettings.mapel)
        .order('tanggal', { ascending: true });

    // 3. Ambil daftar tugas & nilai
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

        const avgCat = (katArray) => {
            const katAss = safeAssList.filter(a => katArray.includes(a.kategori));
            if (!katAss.length) return 0;
            let total = 0;
            katAss.forEach(a => {
                const sc = scoresList.find(s => s.assessment_id === a.id && s.student_id === stu.id);
                total += (sc && sc.nilai !== null) ? Number(sc.nilai) : 0;
            });
            return total / katAss.length;
        };

        const nAbsen = Number(calcAttendanceScore(recAbs.hadir, recAbs.sakit, recAbs.izin, recAbs.alpa));
        const nTugas = avgCat(['tugas', 'tugas_individu', 'tugas_kelompok']);
        const nBab   = avgCat(['ujian_bab']);
        const nSmt   = avgCat(['ujian_semester', 'ujian_sumatif']);

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
    const avgClassScore = studentsList.length > 0 ? (sumFinalScore / studentsList.length).toFixed(1) : '0.0';

    document.getElementById('dash-stat-attendance').innerText = `${pctHadir}%`;
    document.getElementById('dash-stat-att-detail').innerHTML = `
        <div><span class="inline-block w-2 h-2 rounded-full bg-emerald-500 mr-1"></span>Hadir: ${pctHadir}%</div>
        <div><span class="inline-block w-2 h-2 rounded-full bg-blue-500 mr-1"></span>Izin/Sakit: ${pctSI}%</div>
        <div><span class="inline-block w-2 h-2 rounded-full bg-rose-500 mr-1"></span>Alpa: ${pctAlpa}%</div>
    `;

    document.getElementById('dash-stat-tasks').innerText = `${pctTasks}%`;
    document.getElementById('dash-bar-tasks').style.width = `${pctTasks}%`;

    document.getElementById('dash-stat-avg').innerText = avgClassScore;
    document.getElementById('dash-stat-attention').innerText = `${attentionCount} Siswa`;

    renderDashboardCharts(Number(pctHadir), Number(pctSI), Number(pctAlpa), logsData || [], safeAssList, scoresList);
}

function renderDashboardCharts(pctHadir, pctSI, pctAlpa, logsData, assList, scoresList = []) {
    if (typeof Chart === 'undefined') return;

    // 1. Donut Kehadiran
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

    // 2. Line Chart Tren Kehadiran Berdasarkan Semua Tanggal Tercatat
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

    // 3. Bar Chart Pengumpulan Berdasarkan Kategori: Tugas, Ujian Akhir Bab, Ujian Semester
    const ctxTaskBar = document.getElementById('chartDashTaskBar');
    if (ctxTaskBar) {
        if (chartInstances.taskBar) chartInstances.taskBar.destroy();

        // Hitung peratusan mengikut kategori
        const hitungKategori = (katArray) => {
            const filteredAss = (assList || []).filter(a => katArray.includes(a.kategori));
            if (!filteredAss.length) return 0;
            let totalMax = filteredAss.length * studentsList.length;
            let totalDone = 0;
            filteredAss.forEach(a => {
                totalDone += scoresList.filter(s => s.assessment_id === a.id && s.status_kumpul).length;
            });
            return totalMax > 0 ? Math.round((totalDone / totalMax) * 100) : 0;
        };

        const pctTugas = hitungKategori(['tugas', 'tugas_individu', 'tugas_kelompok']);
        const pctBab   = hitungKategori(['ujian_bab']);
        const pctSmt   = hitungKategori(['ujian_semester', 'ujian_sumatif']);

        chartInstances.taskBar = new Chart(ctxTaskBar, {
            type: 'bar',
            data: {
                labels: ['Tugas', 'Ujian Akhir Bab', 'Ujian Semester'],
                datasets: [{
                    label: 'Pengumpulan (%)',
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
