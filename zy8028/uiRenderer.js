const UIRenderer = (function() {
    let elements = {};
    let feedbackTimeout = null;

    function init() {
        elements = {
            score: document.getElementById('score'),
            combo: document.getElementById('combo'),
            timer: document.getElementById('timer'),
            patientCards: document.getElementById('patientCards'),
            queueArea: document.getElementById('queueArea'),
            undoBtn: document.getElementById('undoBtn'),
            pauseBtn: document.getElementById('pauseBtn'),
            restartBtn: document.getElementById('restartBtn'),
            levelIndicator: document.getElementById('levelIndicator'),
            levelName: document.getElementById('levelName'),
            levelProgress: document.getElementById('levelProgress'),
            overlay: document.getElementById('overlay'),
            menuModal: document.getElementById('menuModal'),
            pauseModal: document.getElementById('pauseModal'),
            resultModal: document.getElementById('resultModal'),
            leaderboardModal: document.getElementById('leaderboardModal'),
            feedbackPopup: document.getElementById('feedbackPopup'),
            feedbackIcon: document.getElementById('feedbackIcon'),
            feedbackText: document.getElementById('feedbackText'),
            feedbackReason: document.getElementById('feedbackReason'),
            feedbackPoints: document.getElementById('feedbackPoints'),
            startBtn: document.getElementById('startBtn'),
            continueBtn: document.getElementById('continueBtn'),
            leaderboardBtn: document.getElementById('leaderboardBtn'),
            resumeBtn: document.getElementById('resumeBtn'),
            resultStats: document.getElementById('resultStats'),
            resultTitle: document.getElementById('resultTitle'),
            nextLevelBtn: document.getElementById('nextLevelBtn'),
            replayBtn: document.getElementById('replayBtn'),
            closeLeaderboardBtn: document.getElementById('closeLeaderboardBtn'),
            leaderboardList: document.getElementById('leaderboardList'),
            redCount: document.getElementById('redCount'),
            yellowCount: document.getElementById('yellowCount'),
            greenCount: document.getElementById('greenCount'),
            observeCount: document.getElementById('observeCount'),
            redPatients: document.getElementById('redPatients'),
            yellowPatients: document.getElementById('yellowPatients'),
            greenPatients: document.getElementById('greenPatients'),
            observePatients: document.getElementById('observePatients')
        };

        initDragAndDrop();
        return elements;
    }

    function initDragAndDrop() {
        document.addEventListener('dragstart', handleDragStart);
        document.addEventListener('dragend', handleDragEnd);
        document.addEventListener('dragover', handleDragOver);
        document.addEventListener('dragleave', handleDragLeave);
        document.addEventListener('drop', handleDrop);
    }

    let draggedElement = null;
    let draggedPatient = null;

    function handleDragStart(e) {
        if (!e.target.classList.contains('patient-card')) return;
        draggedElement = e.target;
        draggedPatient = GameState.getPatientQueue().find(p => p.id === e.target.dataset.patientId);
        e.target.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', e.target.dataset.patientId);
    }

    function handleDragEnd(e) {
        if (!e.target.classList.contains('patient-card')) return;
        e.target.classList.remove('dragging');
        document.querySelectorAll('.queue-zone').forEach(zone => {
            zone.classList.remove('drag-over');
        });
        draggedElement = null;
        draggedPatient = null;
    }

    function handleDragOver(e) {
        if (!e.target.closest('.queue-zone')) return;
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        e.target.closest('.queue-zone').classList.add('drag-over');
    }

    function handleDragLeave(e) {
        if (!e.target.closest('.queue-zone')) return;
        e.target.closest('.queue-zone').classList.remove('drag-over');
    }

    function handleDrop(e) {
        e.preventDefault();
        const queueZone = e.target.closest('.queue-zone');
        if (!queueZone || !draggedPatient) return;

        queueZone.classList.remove('drag-over');
        const queue = queueZone.dataset.queue;
        handlePatientDrop(draggedPatient, queue);
    }

    function handlePatientDrop(patient, queue) {
        const result = GameState.triagePatient(queue);
        if (result) {
            renderTriageResult(result);
            updateAll();
        }
    }

    function renderTriageResult(result) {
        const { evaluation, points } = result;

        if (evaluation.isCorrect) {
            showFeedback(true, evaluation.reasons, points);
        } else {
            showFeedback(false, [evaluation.penaltyReason], points);
        }
    }

    function showFeedback(isCorrect, reasons, points) {
        hideFeedback();

        elements.feedbackIcon.textContent = isCorrect ? '✓' : '✗';
        elements.feedbackText.textContent = isCorrect ? '分诊正确!' : '分诊错误';
        elements.feedbackReason.textContent = reasons.slice(0, 2).join(' | ') || '';
        elements.feedbackPoints.textContent = (points >= 0 ? '+' : '') + points;
        elements.feedbackPoints.className = 'feedback-points ' + (points >= 0 ? 'positive' : 'negative');
        elements.feedbackPopup.classList.add('show');

        if (feedbackTimeout) clearTimeout(feedbackTimeout);
        feedbackTimeout = setTimeout(hideFeedback, 2000);
    }

    function hideFeedback() {
        elements.feedbackPopup.classList.remove('show');
    }

    function updateScore(score) {
        elements.score.textContent = score.toLocaleString();
    }

    function updateCombo(combo, multiplier) {
        elements.combo.textContent = `x${multiplier.toFixed(1)}`;
    }

    function updateTimer(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        elements.timer.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;

        if (seconds <= 30) {
            elements.timer.style.color = '#DC3545';
        } else if (seconds <= 60) {
            elements.timer.style.color = '#FFC107';
        } else {
            elements.timer.style.color = '#00D9FF';
        }
    }

    function renderPatientCards(patients) {
        elements.patientCards.innerHTML = '';

        if (patients.length === 0) {
            elements.patientCards.innerHTML = '<p style="color: #888; text-align: center; padding: 40px;">所有患者已分诊完毕</p>';
            return;
        }

        patients.forEach(patient => {
            const card = createPatientCard(patient);
            elements.patientCards.appendChild(card);
        });
    }

    function createPatientCard(patient) {
        const card = document.createElement('div');
        card.className = 'patient-card';
        card.draggable = true;
        card.dataset.patientId = patient.id;

        const genderText = patient.gender === 'M' ? '男' : '女';
        const ageText = patient.age !== null && patient.age !== undefined ? `${patient.age}岁` : '年龄不详';

        let vitalsHtml = '';
        const vitals = patient.vitalSigns || {};

        if (vitals.hr !== null && vitals.hr !== undefined) {
            const hrClass = vitals.hr > 100 || vitals.hr < 60 ? 'alert' : '';
            vitalsHtml += `<div class="info-row"><span class="info-label">心率</span><span class="info-value ${hrClass}">${vitals.hr} bpm</span></div>`;
        }

        if (vitals.bp) {
            const [sys] = vitals.bp.split('/').map(Number);
            const bpClass = sys > 140 || sys < 90 ? 'alert' : '';
            vitalsHtml += `<div class="info-row"><span class="info-label">血压</span><span class="info-value ${bpClass}">${vitals.bp} mmHg</span></div>`;
        }

        if (vitals.spo2 !== null && vitals.spo2 !== undefined) {
            const spo2Class = vitals.spo2 < 94 ? 'alert' : '';
            vitalsHtml += `<div class="info-row"><span class="info-label">血氧</span><span class="info-value ${spo2Class}">${vitals.spo2}%</span></div>`;
        }

        if (vitals.temp !== null && vitals.temp !== undefined) {
            const tempClass = vitals.temp >= 39 || vitals.temp < 36 ? 'alert' : '';
            vitalsHtml += `<div class="info-row"><span class="info-label">体温</span><span class="info-value ${tempClass}">${vitals.temp}°C</span></div>`;
        }

        if (vitals.respRate !== null && vitals.respRate !== undefined) {
            const rrClass = vitals.respRate > 24 || vitals.respRate < 12 ? 'alert' : '';
            vitalsHtml += `<div class="info-row"><span class="info-label">呼吸</span><span class="info-value ${rrClass}">${vitals.respRate}/min</span></div>`;
        }

        let allergyHtml = '';
        if (patient.allergies && patient.allergies.length > 0) {
            allergyHtml = `<div class="allergy-warning">⚠️ 过敏史: ${patient.allergies.join(', ')}</div>`;
        }

        let badgeHtml = '';
        if (patient._hasMissingInfo || patient._hasContradiction) {
            const badges = [];
            if (patient._hasMissingInfo) badges.push('信息缺失');
            if (patient._hasContradiction) badges.push('症状矛盾');
            badgeHtml = `<span class="edge-case-badge">${badges.join(' | ')}</span>`;
        }

        card.innerHTML = `
            ${badgeHtml}
            <div class="patient-card-header">
                <span class="patient-name">${patient.name}</span>
                <span class="patient-age">${genderText} ${ageText}</span>
            </div>
            <div class="chief-complaint">${patient.chiefComplaint || '暂无主诉'}</div>
            <div class="patient-info">
                ${vitalsHtml}
            </div>
            ${allergyHtml}
        `;

        card.addEventListener('dblclick', () => {
            showPatientDetail(patient);
        });

        return card;
    }

    function showPatientDetail(patient) {
        const evalResult = TriageRules.triage(patient);
        const reasons = evalResult.reasons.join('\n');
        const warnings = evalResult.warnings.join('\n');

        alert(`正确分诊: ${TriageRules.QUEUES[evalResult.correctQueue].name}\n\n理由:\n${reasons}\n\n警告:\n${warnings || '无'}`);
    }

    function updateQueueCounts(counts, history = []) {
        elements.redCount.textContent = counts.red || 0;
        elements.yellowCount.textContent = counts.yellow || 0;
        elements.greenCount.textContent = counts.green || 0;
        elements.observeCount.textContent = counts.observe || 0;

        const queues = ['red', 'yellow', 'green', 'observe'];
        queues.forEach(queue => {
            const container = elements[`${queue}Patients`];
            container.innerHTML = '';

            history.filter(h => h.selectedQueue === queue).forEach(entry => {
                const chip = document.createElement('span');
                chip.className = 'queue-patient-chip';
                chip.textContent = entry.patient.name;
                container.appendChild(chip);
            });
        });
    }

    function updateLevelInfo(levelName, current, total) {
        elements.levelName.textContent = levelName;
        elements.levelProgress.textContent = `患者 ${current}/${total}`;
    }

    function showModal(modalName) {
        elements.overlay.classList.add('show');
        const modal = elements[`${modalName}Modal`];
        if (modal) modal.classList.add('show');
    }

    function hideModal(modalName) {
        elements.overlay.classList.remove('show');
        const modal = elements[`${modalName}Modal`];
        if (modal) modal.classList.remove('show');
    }

    function hideAllModals() {
        elements.overlay.classList.remove('show');
        document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    }

    function showMenu(hasSavedGame) {
        hideAllModals();
        elements.startBtn.style.display = 'inline-block';
        elements.continueBtn.style.display = hasSavedGame ? 'inline-block' : 'none';
        elements.menuModal.classList.add('show');
    }

    function showPauseMenu() {
        showModal('pause');
    }

    function showResultModal(results, hasNextLevel) {
        elements.resultTitle.textContent = results.timeRemaining <= 0 ? '时间到!' : '关卡完成!';

        let accuracyColor = '#28A745';
        if (results.accuracy < 60) accuracyColor = '#DC3545';
        else if (results.accuracy < 80) accuracyColor = '#FFC107';

        elements.resultStats.innerHTML = `
            <div class="modal-stat">
                <div class="modal-stat-label">最终得分</div>
                <div class="modal-stat-value" style="color: #FFD700;">${results.score.toLocaleString()}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">分诊正确率</div>
                <div class="modal-stat-value" style="color: ${accuracyColor};">${results.accuracy}%</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">正确/总数</div>
                <div class="modal-stat-value">${results.correctTriages}/${results.totalPatients}</div>
            </div>
            <div class="modal-stat">
                <div class="modal-stat-label">最高连击</div>
                <div class="modal-stat-value" style="color: #E94560;">x${results.maxCombo}</div>
            </div>
        `;

        elements.nextLevelBtn.style.display = hasNextLevel ? 'inline-block' : 'none';
        showModal('result');
    }

    function showLeaderboard(entries) {
        if (entries.length === 0) {
            elements.leaderboardList.innerHTML = '<p style="color: #888; text-align: center;">暂无记录</p>';
        } else {
            elements.leaderboardList.innerHTML = entries.map((entry, index) => `
                <div class="leaderboard-item">
                    <span class="leaderboard-rank">#${index + 1}</span>
                    <span class="leaderboard-name">${entry.name}</span>
                    <span class="leaderboard-score">${entry.score.toLocaleString()}</span>
                </div>
            `).join('');
        }
        showModal('leaderboard');
    }

    function updateAll() {
        const snapshot = GameState.getStateSnapshot();

        updateScore(snapshot.score);
        updateCombo(snapshot.combo, snapshot.comboMultiplier);
        updateTimer(snapshot.timeRemaining);
        renderPatientCards(snapshot.patientQueue);
        updateQueueCounts(snapshot.queueCounts, GameState.getTriageHistory());
        updateLevelInfo(
            snapshot.level ? snapshot.level.name : '',
            snapshot.triagedPatients,
            snapshot.totalPatients
        );

        elements.undoBtn.disabled = snapshot.historyLength === 0;
    }

    function enableControls(enabled) {
        elements.pauseBtn.disabled = !enabled;
        elements.restartBtn.disabled = !enabled;
    }

    return {
        init,
        updateScore,
        updateCombo,
        updateTimer,
        renderPatientCards,
        updateQueueCounts,
        updateLevelInfo,
        updateAll,
        showMenu,
        showPauseMenu,
        showResultModal,
        showLeaderboard,
        hideAllModals,
        hideModal,
        showFeedback,
        enableControls,
        handlePatientDrop
    };
})();
