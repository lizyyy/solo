const EmergencyTriageGame = (function() {
    const CONFIG = {
        GAME_DURATION: 120,
        INITIAL_LIVES: 3,
        PATIENT_SPAWN_INTERVAL: 8000,
        MAX_PATIENTS: 6,
        COMBO_TIMEOUT: 10000,
        LEVEL_THRESHOLDS: [100, 300, 600, 1000, 1500]
    };

    const PATIENT_TYPES = {
        red: {
            name: '危急',
            color: 'red',
            maxTime: 30,
            correctPoints: 50,
            wrongPoints: -30,
            timeoutPoints: -100,
            timeoutLife: true,
            probability: 0.2
        },
        yellow: {
            name: '紧急',
            color: 'yellow',
            maxTime: 60,
            correctPoints: 30,
            wrongPoints: -20,
            timeoutPoints: -50,
            timeoutLife: false,
            probability: 0.3
        },
        orange: {
            name: '较重',
            color: 'orange',
            maxTime: 90,
            correctPoints: 20,
            wrongPoints: -15,
            timeoutPoints: -30,
            timeoutLife: false,
            probability: 0.3
        },
        green: {
            name: '一般',
            color: 'green',
            maxTime: 120,
            correctPoints: 10,
            wrongPoints: -10,
            timeoutPoints: -20,
            timeoutLife: false,
            probability: 0.2
        }
    };

    const PATIENT_NAMES = [
        '张三', '李四', '王五', '赵六', '陈七', '周八', '吴九', '郑十',
        '孙一', '刘二', '王小明', '李小红', '张伟', '李娜', '王芳', '刘洋'
    ];

    const SYMPTOMS = {
        red: [
            '急性胸痛、呼吸困难',
            '意识丧失、呼吸骤停',
            '严重外伤大出血',
            '急性中风症状',
            '急性心肌梗死',
            '严重过敏反应',
            '休克状态'
        ],
        yellow: [
            '严重头痛伴呕吐',
            '高热伴抽搐',
            '骨折伴畸形',
            '急性腹痛难忍',
            '呼吸困难但意识清醒',
            '严重烧伤',
            '药物过量'
        ],
        orange: [
            '持续发热3天以上',
            '急性肠胃炎伴脱水',
            '中度外伤出血',
            '疑似肺炎',
            '严重尿路感染',
            '急性扭伤',
            '偏头痛发作'
        ],
        green: [
            '普通感冒症状',
            '轻度腹泻',
            '皮肤过敏皮疹',
            '慢性疾病常规复诊',
            '轻微外伤',
            '头痛但症状较轻',
            '常规体检'
        ]
    };

    let gameState = {
        isRunning: false,
        isPaused: false,
        timeRemaining: CONFIG.GAME_DURATION,
        score: 0,
        lives: CONFIG.INITIAL_LIVES,
        level: 1,
        combo: 0,
        lastCriticalTime: 0,
        patients: [],
        stations: {
            red: null,
            yellow: null,
            orange: null,
            green: null
        },
        currentPatientId: null,
        gameTimer: null,
        patientTimer: null,
        replayHistory: [],
        scoreDetails: [],
        stats: {
            totalPatients: 0,
            correctTriages: 0,
            wrongTriages: 0,
            timeouts: 0,
            criticalPatients: 0,
            criticalCorrect: 0
        }
    };

    let elements = {};

    function init() {
        cacheElements();
        bindEvents();
        updateUI();
    }

    function cacheElements() {
        elements = {
            timer: document.getElementById('timer'),
            score: document.getElementById('score'),
            lives: document.getElementById('lives'),
            level: document.getElementById('level'),
            startBtn: document.getElementById('start-btn'),
            pauseBtn: document.getElementById('pause-btn'),
            restartBtn: document.getElementById('restart-btn'),
            replayBtn: document.getElementById('replay-btn'),
            scoreDetailsBtn: document.getElementById('score-details-btn'),
            patientQueue: document.getElementById('patient-queue'),
            patientModal: document.getElementById('patient-modal'),
            patientDetails: document.getElementById('patient-details'),
            closeModal: document.getElementById('close-modal'),
            triageButtons: document.querySelectorAll('.triage-btn'),
            gameOverModal: document.getElementById('game-over-modal'),
            gameOverTitle: document.getElementById('game-over-title'),
            gameOverDetails: document.getElementById('game-over-details'),
            playAgain: document.getElementById('play-again'),
            replayModal: document.getElementById('replay-modal'),
            replayContent: document.getElementById('replay-content'),
            replayStep: document.getElementById('replay-step'),
            replayPrev: document.getElementById('replay-prev'),
            replayNext: document.getElementById('replay-next'),
            replayPlay: document.getElementById('replay-play'),
            closeReplay: document.getElementById('close-replay'),
            scoreDetailsModal: document.getElementById('score-details-modal'),
            scoreDetailsContent: document.getElementById('score-details-content'),
            closeScoreDetails: document.getElementById('close-score-details')
        };
    }

    function bindEvents() {
        elements.startBtn.addEventListener('click', startGame);
        elements.pauseBtn.addEventListener('click', togglePause);
        elements.restartBtn.addEventListener('click', restartGame);
        elements.replayBtn.addEventListener('click', showReplay);
        elements.scoreDetailsBtn.addEventListener('click', showScoreDetails);
        elements.closeModal.addEventListener('click', closePatientModal);
        elements.triageButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const level = btn.dataset.level;
                triagePatient(level);
            });
        });
        elements.playAgain.addEventListener('click', () => {
            elements.gameOverModal.style.display = 'none';
            restartGame();
        });
        elements.closeReplay.addEventListener('click', () => {
            elements.replayModal.style.display = 'none';
            stopAutoReplay();
        });
        elements.replayPrev.addEventListener('click', replayPrevStep);
        elements.replayNext.addEventListener('click', replayNextStep);
        elements.replayPlay.addEventListener('click', toggleAutoReplay);
        elements.closeScoreDetails.addEventListener('click', () => {
            elements.scoreDetailsModal.style.display = 'none';
        });

        elements.patientModal.addEventListener('click', (e) => {
            if (e.target === elements.patientModal) {
                closePatientModal();
            }
        });
        elements.gameOverModal.addEventListener('click', (e) => {
            if (e.target === elements.gameOverModal) {
                elements.gameOverModal.style.display = 'none';
            }
        });
        elements.replayModal.addEventListener('click', (e) => {
            if (e.target === elements.replayModal) {
                elements.replayModal.style.display = 'none';
                stopAutoReplay();
            }
        });
        elements.scoreDetailsModal.addEventListener('click', (e) => {
            if (e.target === elements.scoreDetailsModal) {
                elements.scoreDetailsModal.style.display = 'none';
            }
        });
    }

    function startGame() {
        resetGameState();
        gameState.isRunning = true;
        elements.startBtn.disabled = true;
        elements.pauseBtn.disabled = false;
        elements.restartBtn.disabled = false;
        elements.replayBtn.style.display = 'none';
        elements.scoreDetailsBtn.style.display = 'none';
        
        startGameTimers();
        addReplayStep({
            type: 'start',
            message: '游戏开始',
            time: Date.now()
        });
    }

    function resetGameState() {
        gameState = {
            isRunning: false,
            isPaused: false,
            timeRemaining: CONFIG.GAME_DURATION,
            score: 0,
            lives: CONFIG.INITIAL_LIVES,
            level: 1,
            combo: 0,
            lastCriticalTime: 0,
            patients: [],
            stations: {
                red: null,
                yellow: null,
                orange: null,
                green: null
            },
            currentPatientId: null,
            gameTimer: null,
            patientTimer: null,
            replayHistory: [],
            scoreDetails: [],
            stats: {
                totalPatients: 0,
                correctTriages: 0,
                wrongTriages: 0,
                timeouts: 0,
                criticalPatients: 0,
                criticalCorrect: 0
            }
        };
        updateUI();
        renderPatients();
        renderStations();
    }

    function startGameTimers() {
        gameState.gameTimer = setInterval(() => {
            if (!gameState.isPaused && gameState.isRunning) {
                gameState.timeRemaining--;
                updatePatientsTimers();
                updateUI();
                
                if (gameState.timeRemaining <= 0) {
                    endGame('time');
                }
            }
        }, 1000);

        gameState.patientTimer = setInterval(() => {
            if (!gameState.isPaused && gameState.isRunning) {
                spawnPatient();
            }
        }, CONFIG.PATIENT_SPAWN_INTERVAL);

        setTimeout(() => {
            if (gameState.isRunning) {
                spawnPatient();
                setTimeout(() => {
                    if (gameState.isRunning) spawnPatient();
                }, 2000);
            }
        }, 1000);
    }

    function stopGameTimers() {
        if (gameState.gameTimer) {
            clearInterval(gameState.gameTimer);
            gameState.gameTimer = null;
        }
        if (gameState.patientTimer) {
            clearInterval(gameState.patientTimer);
            gameState.patientTimer = null;
        }
    }

    function togglePause() {
        if (!gameState.isRunning) return;
        
        gameState.isPaused = !gameState.isPaused;
        elements.pauseBtn.textContent = gameState.isPaused ? '继续' : '暂停';
        
        addReplayStep({
            type: 'pause',
            message: gameState.isPaused ? '游戏暂停' : '游戏继续',
            time: Date.now()
        });
    }

    function restartGame() {
        stopGameTimers();
        closePatientModal();
        startGame();
    }

    function spawnPatient() {
        if (gameState.patients.length >= CONFIG.MAX_PATIENTS) return;
        
        const type = getRandomPatientType();
        const patient = createPatient(type);
        gameState.patients.push(patient);
        gameState.stats.totalPatients++;
        
        if (type === 'red') {
            gameState.stats.criticalPatients++;
        }

        addReplayStep({
            type: 'spawn',
            message: `新病人到达: ${patient.name} (${PATIENT_TYPES[type].name})`,
            patient: { ...patient },
            time: Date.now()
        });

        renderPatients();
    }

    function getRandomPatientType() {
        const rand = Math.random();
        let cumulative = 0;
        
        for (const [type, config] of Object.entries(PATIENT_TYPES)) {
            cumulative += config.probability;
            if (rand <= cumulative) {
                return type;
            }
        }
        return 'green';
    }

    function createPatient(type) {
        const config = PATIENT_TYPES[type];
        const name = PATIENT_NAMES[Math.floor(Math.random() * PATIENT_NAMES.length)];
        const symptoms = SYMPTOMS[type][Math.floor(Math.random() * SYMPTOMS[type].length)];
        
        return {
            id: `patient_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name: name,
            type: type,
            symptoms: symptoms,
            timeRemaining: config.maxTime,
            maxTime: config.maxTime,
            arrivalTime: Date.now(),
            age: Math.floor(Math.random() * 60) + 18,
            isBeingTriaged: false
        };
    }

    function updatePatientsTimers() {
        const toRemove = [];
        
        gameState.patients.forEach(patient => {
            if (!patient.isBeingTriaged) {
                patient.timeRemaining--;
                
                if (patient.timeRemaining <= 0) {
                    toRemove.push(patient);
                }
            }
        });

        toRemove.forEach(patient => {
            handlePatientTimeout(patient);
        });

        renderPatients();
    }

    function handlePatientTimeout(patient) {
        const config = PATIENT_TYPES[patient.type];
        const index = gameState.patients.findIndex(p => p.id === patient.id);
        
        if (index !== -1) {
            gameState.patients.splice(index, 1);
        }

        gameState.score += config.timeoutPoints;
        gameState.stats.timeouts++;
        gameState.combo = 0;

        if (config.timeoutLife) {
            gameState.lives--;
        }

        addScoreDetail({
            type: 'timeout',
            patient: patient.name,
            patientType: PATIENT_TYPES[patient.type].name,
            change: config.timeoutPoints,
            message: `${patient.name} 等待超时 (${PATIENT_TYPES[patient.type].name})`,
            time: Date.now()
        });

        addReplayStep({
            type: 'timeout',
            message: `${patient.name} 等待超时`,
            patient: { ...patient },
            pointsChange: config.timeoutPoints,
            lifeLost: config.timeoutLife,
            time: Date.now()
        });

        if (gameState.lives <= 0) {
            endGame('lives');
        }
    }

    function renderPatients() {
        elements.patientQueue.innerHTML = '';
        
        const sortedPatients = [...gameState.patients].sort((a, b) => {
            const typeOrder = { red: 0, yellow: 1, orange: 2, green: 3 };
            if (typeOrder[a.type] !== typeOrder[b.type]) {
                return typeOrder[a.type] - typeOrder[b.type];
            }
            return a.timeRemaining - b.timeRemaining;
        });

        sortedPatients.forEach(patient => {
            const card = createPatientCard(patient);
            elements.patientQueue.appendChild(card);
        });
    }

    function createPatientCard(patient) {
        const card = document.createElement('div');
        card.className = `patient-card ${patient.type}`;
        card.dataset.patientId = patient.id;
        
        const config = PATIENT_TYPES[patient.type];
        const isCritical = patient.timeRemaining <= 10 && patient.type === 'red';
        
        card.innerHTML = `
            <div class="patient-name">${patient.name} (${patient.age}岁)</div>
            <div class="patient-symptoms">${patient.symptoms}</div>
            <div class="timer ${isCritical ? 'critical' : ''}">
                ⏱️ ${patient.timeRemaining}秒
            </div>
        `;

        card.addEventListener('click', () => {
            if (gameState.isRunning && !gameState.isPaused && !patient.isBeingTriaged) {
                openPatientModal(patient);
            }
        });

        return card;
    }

    function renderStations() {
        Object.keys(gameState.stations).forEach(level => {
            const stationElement = document.querySelector(`.station[data-level="${level}"] .station-patient`);
            if (stationElement) {
                stationElement.innerHTML = '';
                if (gameState.stations[level]) {
                    const patient = gameState.stations[level];
                    const card = document.createElement('div');
                    card.className = `patient-card ${level}`;
                    card.innerHTML = `
                        <div class="patient-name">${patient.name}</div>
                        <div class="patient-symptoms">正在处理...</div>
                    `;
                    stationElement.appendChild(card);
                }
            }
        });
    }

    function openPatientModal(patient) {
        gameState.currentPatientId = patient.id;
        patient.isBeingTriaged = true;
        
        const config = PATIENT_TYPES[patient.type];
        
        elements.patientDetails.innerHTML = `
            <p><strong>姓名:</strong> ${patient.name}</p>
            <p><strong>年龄:</strong> ${patient.age}岁</p>
            <p><strong>症状:</strong> ${patient.symptoms}</p>
            <p><strong>剩余时间:</strong> ${patient.timeRemaining}秒</p>
            <p><strong>提示:</strong> 根据症状判断病情严重程度，选择正确的分诊级别！</p>
        `;

        elements.patientModal.style.display = 'flex';
    }

    function closePatientModal() {
        if (gameState.currentPatientId) {
            const patient = gameState.patients.find(p => p.id === gameState.currentPatientId);
            if (patient) {
                patient.isBeingTriaged = false;
            }
            gameState.currentPatientId = null;
        }
        elements.patientModal.style.display = 'none';
    }

    function triagePatient(selectedLevel) {
        if (!gameState.currentPatientId) return;
        
        const patient = gameState.patients.find(p => p.id === gameState.currentPatientId);
        if (!patient) {
            closePatientModal();
            return;
        }

        if (gameState.stations[selectedLevel] !== null) {
            addScoreDetail({
                type: 'station_busy',
                patient: patient.name,
                selectedLevel: PATIENT_TYPES[selectedLevel].name,
                change: 0,
                message: `分诊台 (${PATIENT_TYPES[selectedLevel].name}) 正在使用中`,
                time: Date.now()
            });
            return;
        }

        const isCorrect = patient.type === selectedLevel;
        const config = PATIENT_TYPES[patient.type];
        const selectedConfig = PATIENT_TYPES[selectedLevel];
        
        let pointsChange = 0;
        let isCriticalCorrect = false;

        if (isCorrect) {
            pointsChange = config.correctPoints;
            gameState.stats.correctTriages++;
            gameState.combo++;

            if (patient.type === 'red') {
                gameState.stats.criticalCorrect++;
                isCriticalCorrect = true;
                
                const now = Date.now();
                if (now - gameState.lastCriticalTime <= CONFIG.COMBO_TIMEOUT) {
                    pointsChange += 20;
                }
                gameState.lastCriticalTime = now;
            }

            gameState.stations[selectedLevel] = patient;
            setTimeout(() => {
                gameState.stations[selectedLevel] = null;
                renderStations();
            }, 3000);
        } else {
            pointsChange = selectedConfig.wrongPoints;
            gameState.stats.wrongTriages++;
            gameState.combo = 0;
        }

        gameState.score = Math.max(0, gameState.score + pointsChange);

        const index = gameState.patients.findIndex(p => p.id === patient.id);
        if (index !== -1) {
            gameState.patients.splice(index, 1);
        }

        addScoreDetail({
            type: isCorrect ? 'correct' : 'wrong',
            patient: patient.name,
            patientType: PATIENT_TYPES[patient.type].name,
            selectedLevel: PATIENT_TYPES[selectedLevel].name,
            isCorrect: isCorrect,
            change: pointsChange,
            combo: gameState.combo,
            message: `${patient.name} 分诊到 ${PATIENT_TYPES[selectedLevel].name} ${isCorrect ? '正确' : '错误'}`,
            time: Date.now()
        });

        addReplayStep({
            type: isCorrect ? 'correct' : 'wrong',
            message: `${patient.name} 分诊到 ${PATIENT_TYPES[selectedLevel].name}`,
            patient: { ...patient },
            selectedLevel: selectedLevel,
            isCorrect: isCorrect,
            pointsChange: pointsChange,
            time: Date.now()
        });

        closePatientModal();
        updateLevel();
        updateUI();
        renderPatients();
        renderStations();
    }

    function updateLevel() {
        let newLevel = 1;
        for (let i = 0; i < CONFIG.LEVEL_THRESHOLDS.length; i++) {
            if (gameState.score >= CONFIG.LEVEL_THRESHOLDS[i]) {
                newLevel = i + 2;
            }
        }
        if (newLevel !== gameState.level) {
            gameState.level = newLevel;
            addReplayStep({
                type: 'level',
                message: `升级到等级 ${gameState.level}`,
                level: gameState.level,
                time: Date.now()
            });
        }
    }

    function addScoreDetail(detail) {
        gameState.scoreDetails.push(detail);
    }

    function addReplayStep(step) {
        gameState.replayHistory.push(step);
    }

    function updateUI() {
        elements.timer.textContent = gameState.timeRemaining;
        elements.score.textContent = gameState.score;
        elements.lives.textContent = gameState.lives;
        elements.level.textContent = gameState.level;
    }

    function endGame(reason) {
        gameState.isRunning = false;
        stopGameTimers();
        closePatientModal();

        elements.startBtn.disabled = false;
        elements.pauseBtn.disabled = true;
        elements.restartBtn.disabled = true;
        elements.pauseBtn.textContent = '暂停';
        elements.replayBtn.style.display = 'inline-block';
        elements.scoreDetailsBtn.style.display = 'inline-block';

        let title = '';
        if (reason === 'time') {
            title = '⏰ 时间耗尽！游戏结束';
        } else if (reason === 'lives') {
            title = '💔 生命耗尽！游戏结束';
        }

        elements.gameOverTitle.textContent = title;
        
        const accuracy = gameState.stats.totalPatients > 0 
            ? Math.round((gameState.stats.correctTriages / (gameState.stats.correctTriages + gameState.stats.wrongTriages + gameState.stats.timeouts)) * 100) 
            : 0;
        const criticalAccuracy = gameState.stats.criticalPatients > 0
            ? Math.round((gameState.stats.criticalCorrect / gameState.stats.criticalPatients) * 100)
            : 0;

        elements.gameOverDetails.innerHTML = `
            <div class="final-score">${gameState.score} 分</div>
            <div class="stats">
                <div class="stat-item">
                    <div class="stat-label">总病人数</div>
                    <div class="stat-value">${gameState.stats.totalPatients}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">正确分诊</div>
                    <div class="stat-value">${gameState.stats.correctTriages}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">错误分诊</div>
                    <div class="stat-value">${gameState.stats.wrongTriages}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">超时人数</div>
                    <div class="stat-value">${gameState.stats.timeouts}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">总准确率</div>
                    <div class="stat-value">${accuracy}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">危急病人处理</div>
                    <div class="stat-value">${gameState.stats.criticalCorrect}/${gameState.stats.criticalPatients}</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">危急准确率</div>
                    <div class="stat-value">${criticalAccuracy}%</div>
                </div>
                <div class="stat-item">
                    <div class="stat-label">最高等级</div>
                    <div class="stat-value">${gameState.level}</div>
                </div>
            </div>
        `;

        addReplayStep({
            type: 'end',
            message: `游戏结束 - ${title}`,
            finalScore: gameState.score,
            reason: reason,
            time: Date.now()
        });

        elements.gameOverModal.style.display = 'flex';
    }

    let replayCurrentStep = 0;
    let autoReplayTimer = null;

    function showReplay() {
        if (gameState.replayHistory.length === 0) {
            return;
        }
        
        replayCurrentStep = 0;
        renderReplayStep();
        elements.replayModal.style.display = 'flex';
    }

    function renderReplayStep() {
        if (replayCurrentStep < 0 || replayCurrentStep >= gameState.replayHistory.length) {
            return;
        }

        const step = gameState.replayHistory[replayCurrentStep];
        elements.replayStep.textContent = `${replayCurrentStep + 1}/${gameState.replayHistory.length}`;
        
        let html = `
            <div class="replay-item ${step.type}">
                <h4>步骤 ${replayCurrentStep + 1}: ${step.message}</h4>
                <p>时间: ${new Date(step.time).toLocaleTimeString()}</p>
        `;

        if (step.patient) {
            html += `<p>病人: ${step.patient.name}</p>`;
            html += `<p>症状: ${step.patient.symptoms}</p>`;
            html += `<p>级别: ${PATIENT_TYPES[step.patient.type].name}</p>`;
        }

        if (step.pointsChange !== undefined) {
            const sign = step.pointsChange >= 0 ? '+' : '';
            html += `<p>分数变化: ${sign}${step.pointsChange}</p>`;
        }

        if (step.selectedLevel) {
            html += `<p>分诊到: ${PATIENT_TYPES[step.selectedLevel].name}</p>`;
        }

        if (step.lifeLost) {
            html += `<p>⚠️ 失去一条生命</p>`;
        }

        if (step.combo) {
            html += `<p>连击: ${step.combo}</p>`;
        }

        if (step.level) {
            html += `<p>当前等级: ${step.level}</p>`;
        }

        if (step.finalScore !== undefined) {
            html += `<p>最终分数: ${step.finalScore}</p>`;
        }

        html += `</div>`;
        elements.replayContent.innerHTML = html;
    }

    function replayPrevStep() {
        if (replayCurrentStep > 0) {
            replayCurrentStep--;
            renderReplayStep();
        }
    }

    function replayNextStep() {
        if (replayCurrentStep < gameState.replayHistory.length - 1) {
            replayCurrentStep++;
            renderReplayStep();
        }
    }

    function toggleAutoReplay() {
        if (autoReplayTimer) {
            stopAutoReplay();
        } else {
            startAutoReplay();
        }
    }

    function startAutoReplay() {
        elements.replayPlay.textContent = '停止播放';
        autoReplayTimer = setInterval(() => {
            if (replayCurrentStep < gameState.replayHistory.length - 1) {
                replayNextStep();
            } else {
                stopAutoReplay();
            }
        }, 1500);
    }

    function stopAutoReplay() {
        if (autoReplayTimer) {
            clearInterval(autoReplayTimer);
            autoReplayTimer = null;
        }
        elements.replayPlay.textContent = '自动播放';
    }

    function showScoreDetails() {
        if (gameState.scoreDetails.length === 0) {
            return;
        }

        let html = '';
        const sortedDetails = [...gameState.scoreDetails].reverse();
        
        sortedDetails.forEach((detail, index) => {
            const className = detail.change >= 0 ? 'positive' : 'negative';
            const sign = detail.change >= 0 ? '+' : '';
            
            html += `
                <div class="score-item">
                    <h4>${gameState.scoreDetails.length - index}. ${detail.message}</h4>
                    <p>时间: ${new Date(detail.time).toLocaleTimeString()}</p>
                    <div class="score-change ${className}">
                        ${sign}${detail.change} 分
                    </div>
                </div>
            `;
        });

        elements.scoreDetailsContent.innerHTML = html;
        elements.scoreDetailsModal.style.display = 'flex';
    }

    document.addEventListener('DOMContentLoaded', init);

    return {
        getState: () => ({ ...gameState }),
        resetGame: resetGameState,
        startGame: startGame,
        togglePause: togglePause,
        restartGame: restartGame,
        endGame: endGame,
        spawnPatient: spawnPatient,
        createPatient: createPatient,
        triagePatient: triagePatient,
        getConfig: () => ({ ...CONFIG }),
        getPatientTypes: () => ({ ...PATIENT_TYPES }),
        addTestPatient: function(type) {
            const patient = createPatient(type);
            gameState.patients.push(patient);
            gameState.stats.totalPatients++;
            if (type === 'red') {
                gameState.stats.criticalPatients++;
            }
            return patient;
        }
    };
})();
