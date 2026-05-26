const LEVELS = {
    1: {
        name: '新手入门',
        description: '基础流程，无迟到',
        totalPatients: 15,
        stations: 2,
        observationCapacity: 8,
        vaccineBatches: [
            { batch: 'A2024001', type: '新冠疫苗', count: 20 },
            { batch: 'A2024002', type: '新冠疫苗', count: 10 }
        ],
        lateRate: 0,
        vaccinationTime: 5000,
        observationTime: 15000,
        patientArrivalInterval: 4000,
        targetScore: 100,
        maxErrors: 5
    },
    2: {
        name: '迟到挑战',
        description: '处理迟到插队',
        totalPatients: 20,
        stations: 2,
        observationCapacity: 10,
        vaccineBatches: [
            { batch: 'B2024001', type: '流感疫苗', count: 15 },
            { batch: 'B2024002', type: '流感疫苗', count: 15 }
        ],
        lateRate: 0.3,
        vaccinationTime: 4000,
        observationTime: 12000,
        patientArrivalInterval: 3000,
        targetScore: 150,
        maxErrors: 4
    },
    3: {
        name: '批号危机',
        description: '多批号管理+留观饱和',
        totalPatients: 25,
        stations: 3,
        observationCapacity: 8,
        vaccineBatches: [
            { batch: 'C2024001', type: 'HPV疫苗', count: 8 },
            { batch: 'C2024002', type: '乙肝疫苗', count: 10 },
            { batch: 'C2024003', type: '流感疫苗', count: 12 }
        ],
        lateRate: 0.25,
        vaccinationTime: 3500,
        observationTime: 10000,
        patientArrivalInterval: 2500,
        targetScore: 200,
        maxErrors: 3
    }
};

const PATIENT_NAMES = [
    '张伟', '王芳', '李娜', '刘洋', '陈明', '杨静',
    '赵磊', '黄丽', '周杰', '吴敏', '徐强', '孙艳',
    '朱军', '马红', '胡勇', '郭燕', '林峰', '何秀',
    '高飞', '罗琳', '郑涛', '梁娟', '谢波', '宋梅'
];

class Game {
    constructor() {
        this.currentLevel = 1;
        this.gameState = 'idle';
        this.score = 0;
        this.time = 0;
        this.errors = 0;
        this.patients = [];
        this.vaccines = [];
        this.stations = [];
        this.observation = [];
        this.selectedVaccine = null;
        this.selectedStation = null;
        this.currentPatientIndex = 0;
        this.completedVaccinations = 0;
        this.completedObservation = 0;
        this.lateHandled = 0;
        this.eventLog = [];
        this.replayHistory = [];
        this.gameLoop = null;
        this.patientGenerator = null;
        this.arrivedCount = 0;
        
        this.initEventListeners();
    }

    initEventListeners() {
        document.querySelectorAll('.level-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const level = parseInt(e.currentTarget.dataset.level);
                this.startLevel(level);
            });
        });

        document.getElementById('btn-pause').addEventListener('click', () => this.pause());
        document.getElementById('btn-restart').addEventListener('click', () => this.restart());
        document.getElementById('btn-menu').addEventListener('click', () => this.goToMenu());

        document.getElementById('btn-resume').addEventListener('click', () => this.resume());
        document.getElementById('btn-restart-pause').addEventListener('click', () => this.restart());
        document.getElementById('btn-menu-pause').addEventListener('click', () => this.goToMenu());

        document.getElementById('btn-call-next').addEventListener('click', () => this.callNextPatient());
        document.getElementById('btn-vaccinate').addEventListener('click', () => this.startVaccination());
        document.getElementById('btn-finish-vaccine').addEventListener('click', () => this.finishVaccination());

        document.getElementById('btn-replay').addEventListener('click', () => this.showReplay());
        document.getElementById('btn-export').addEventListener('click', () => this.exportReport());
        document.getElementById('btn-next-level').addEventListener('click', () => this.nextLevel());
        document.getElementById('btn-menu-result').addEventListener('click', () => this.goToMenu());

        document.getElementById('btn-replay-play').addEventListener('click', () => this.playReplay());
        document.getElementById('btn-replay-pause').addEventListener('click', () => this.pauseReplay());
        document.getElementById('btn-replay-reset').addEventListener('click', () => this.resetReplay());
        document.getElementById('btn-close-replay').addEventListener('click', () => this.closeReplay());
    }

    startLevel(level) {
        this.currentLevel = level;
        this.resetGameState();
        this.initLevel();
        this.showScreen('game-screen');
        this.gameState = 'playing';
        this.startGameLoop();
        this.startPatientGenerator();
        this.addLog('info', `关卡 ${level} - ${LEVELS[level].name} 开始！`);
        this.recordReplay('START_LEVEL', { level, time: this.time });
    }

    resetGameState() {
        this.score = 0;
        this.time = 0;
        this.errors = 0;
        this.patients = [];
        this.vaccines = [];
        this.stations = [];
        this.observation = [];
        this.selectedVaccine = null;
        this.selectedStation = null;
        this.currentPatientIndex = 0;
        this.completedVaccinations = 0;
        this.completedObservation = 0;
        this.lateHandled = 0;
        this.eventLog = [];
        this.replayHistory = [];
        this.arrivedCount = 0;
        
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        if (this.patientGenerator) {
            clearInterval(this.patientGenerator);
            this.patientGenerator = null;
        }
    }

    initLevel() {
        const config = LEVELS[this.currentLevel];
        
        this.vaccines = config.vaccineBatches.map(v => ({ ...v }));
        
        for (let i = 0; i < config.stations; i++) {
            this.stations.push({
                id: i + 1,
                name: `接种台 ${i + 1}`,
                status: 'idle',
                patient: null,
                vaccine: null,
                progress: 0
            });
        }

        document.getElementById('observation-max').textContent = config.observationCapacity;
        document.getElementById('current-level').textContent = this.currentLevel;
        
        this.render();
    }

    startGameLoop() {
        this.gameLoop = setInterval(() => {
            if (this.gameState !== 'playing') return;
            
            this.time += 100;
            this.updateTimers();
            this.checkWinCondition();
            this.render();
        }, 100);
    }

    startPatientGenerator() {
        const config = LEVELS[this.currentLevel];
        
        this.generatePatient();
        
        this.patientGenerator = setInterval(() => {
            if (this.gameState !== 'playing') return;
            if (this.arrivedCount < config.totalPatients) {
                this.generatePatient();
            }
        }, config.patientArrivalInterval);
    }

    generatePatient() {
        const config = LEVELS[this.currentLevel];
        const isLate = Math.random() < config.lateRate;
        const nameIndex = this.arrivedCount % PATIENT_NAMES.length;
        const number = this.arrivedCount + 1;
        
        const availableBatches = config.vaccineBatches;
        const selectedBatch = availableBatches[Math.floor(Math.random() * availableBatches.length)];
        
        const patient = {
            id: number,
            name: PATIENT_NAMES[nameIndex] + (nameIndex < this.arrivedCount ? number : ''),
            number: number,
            status: 'waiting',
            isLate: isLate,
            lateHandled: !isLate,
            requiredVaccine: selectedBatch.type,
            requiredBatch: selectedBatch.batch,
            actualVaccine: null,
            actualBatch: null,
            arrivalTime: this.time
        };
        
        this.patients.push(patient);
        this.arrivedCount++;
        
        if (isLate) {
            this.addLog('warning', `${patient.name} (#${patient.number}) 迟到了！需接种${selectedBatch.type}(${selectedBatch.batch})`);
            this.recordReplay('PATIENT_LATE', { patientId: patient.id, time: this.time });
        } else {
            this.addLog('info', `${patient.name} (#${patient.number}) 到达，需接种${selectedBatch.type}(${selectedBatch.batch})`);
            this.recordReplay('PATIENT_ARRIVED', { patientId: patient.id, time: this.time });
        }
        
        this.render();
    }

    updateTimers() {
        const config = LEVELS[this.currentLevel];
        
        this.stations.forEach(station => {
            if (station.status === 'vaccinating') {
                station.progress += 100;
                if (station.progress >= config.vaccinationTime) {
                    station.status = 'completed';
                    this.addLog('success', `${station.patient.name} 在${station.name}接种完成`);
                }
            }
        });

        this.observation.forEach(p => {
            p.observationProgress += 100;
            if (p.observationProgress >= config.observationTime) {
                p.observationComplete = true;
            }
        });

        const completed = this.observation.filter(p => p.observationComplete);
        completed.forEach(p => {
            const index = this.observation.indexOf(p);
            if (index > -1) {
                this.observation.splice(index, 1);
                this.completedObservation++;
                this.score += 20;
                this.addLog('success', `${p.name} 留观完成，顺利离开！(+20分)`);
                this.recordReplay('OBSERVATION_COMPLETE', { patientId: p.id, time: this.time });
            }
        });
    }

    callNextPatient() {
        if (this.gameState !== 'playing') return;
        
        const waitingPatients = this.patients.filter(p => 
            p.status === 'waiting' && p.lateHandled
        );
        
        if (waitingPatients.length === 0) {
            this.addLog('warning', '当前没有可接种的患者');
            return;
        }

        const latePatients = this.patients.filter(p => 
            p.status === 'waiting' && !p.lateHandled
        );
        
        if (latePatients.length > 0) {
            this.addLog('warning', '还有迟到患者未处理，请先处理插队！');
            return;
        }

        const patient = waitingPatients[0];
        patient.status = 'called';
        this.currentPatientIndex++;
        this.addLog('info', `叫号：${patient.name} (#${patient.number})`);
        this.recordReplay('CALL_PATIENT', { patientId: patient.id, time: this.time });
        this.render();
        this.updateActionButtons();
    }

    handleLatePatient(patientId, insertPosition) {
        if (this.gameState !== 'playing') return;
        
        const patient = this.patients.find(p => p.id === patientId);
        if (!patient || patient.lateHandled) return;

        const originalIndex = this.patients.findIndex(p => p.id === patientId);
        const validRangeStart = Math.max(0, patient.number - 3);
        const validRangeEnd = Math.min(this.patients.length, patient.number + 1);
        
        if (insertPosition < validRangeStart || insertPosition > validRangeEnd) {
            this.addLog('error', '插队位置超出允许范围（±2位）');
            this.errors++;
            this.score -= 10;
            this.recordReplay('ERROR', { type: 'INVALID_INSERT', time: this.time });
            this.checkLoseCondition();
            this.render();
            return;
        }

        this.patients.splice(originalIndex, 1);
        this.patients.splice(insertPosition, 0, patient);
        patient.lateHandled = true;
        this.lateHandled++;
        this.score += 5;
        
        this.addLog('success', `${patient.name} 已安排到第${insertPosition + 1}位 (+5分)`);
        this.recordReplay('LATE_HANDLED', { patientId: patientId, position: insertPosition, time: this.time });
        this.render();
    }

    startVaccination() {
        if (this.gameState !== 'playing') return;
        if (!this.selectedStation || !this.selectedVaccine) return;
        
        const station = this.stations.find(s => s.id === this.selectedStation);
        const vaccine = this.vaccines.find(v => v.batch === this.selectedVaccine);
        
        if (!station || station.status !== 'idle') {
            this.addLog('error', '接种台不可用');
            return;
        }
        
        if (!vaccine || vaccine.count <= 0) {
            this.addLog('error', '疫苗库存不足');
            return;
        }

        const calledPatients = this.patients.filter(p => p.status === 'called');
        if (calledPatients.length === 0) {
            this.addLog('error', '没有已叫号的患者');
            return;
        }

        const patient = calledPatients[0];
        
        if (patient.requiredVaccine !== vaccine.type) {
            this.addLog('error', `疫苗类型不匹配！患者需要${patient.requiredVaccine}(${patient.requiredBatch})，选择了${vaccine.type}(${vaccine.batch})`);
            this.errors++;
            this.score -= 20;
            this.recordReplay('ERROR', { type: 'VACCINE_TYPE_MISMATCH', time: this.time });
            this.checkLoseCondition();
            this.render();
            return;
        }
        
        if (patient.requiredBatch !== vaccine.batch) {
            this.addLog('error', `疫苗批号不匹配！患者需要${patient.requiredVaccine}(${patient.requiredBatch})，选择了${vaccine.type}(${vaccine.batch})`);
            this.errors++;
            this.score -= 15;
            this.recordReplay('ERROR', { type: 'BATCH_MISMATCH', time: this.time });
            this.checkLoseCondition();
            this.render();
            return;
        }

        station.status = 'vaccinating';
        station.patient = patient;
        station.vaccine = vaccine;
        station.progress = 0;
        patient.status = 'vaccinating';
        patient.actualVaccine = vaccine.type;
        patient.actualBatch = vaccine.batch;
        vaccine.count--;

        this.addLog('info', `${patient.name} 开始在${station.name}接种${vaccine.type}(${vaccine.batch})`);
        this.recordReplay('START_VACCINATION', { 
            patientId: patient.id, 
            stationId: station.id, 
            vaccineBatch: vaccine.batch,
            time: this.time 
        });
        
        this.selectedVaccine = null;
        this.selectedStation = null;
        this.render();
        this.updateActionButtons();
    }

    finishVaccination() {
        if (this.gameState !== 'playing') return;
        if (!this.selectedStation) return;

        const station = this.stations.find(s => s.id === this.selectedStation);
        if (!station || station.status !== 'completed') {
            this.addLog('error', '该接种台没有可完成的接种');
            return;
        }

        const config = LEVELS[this.currentLevel];
        
        if (this.observation.length >= config.observationCapacity) {
            this.addLog('error', '留观区已满！患者无法进入留观，游戏失败');
            this.endGame(false, '留观区已满，患者无法进入留观');
            return;
        }

        const patient = station.patient;
        patient.status = 'observing';
        patient.observationProgress = 0;
        patient.observationComplete = false;
        this.observation.push(patient);
        this.completedVaccinations++;
        this.score += 15;

        station.status = 'idle';
        station.patient = null;
        station.vaccine = null;
        station.progress = 0;

        this.addLog('success', `${patient.name} 进入留观区 (+15分)`);
        this.recordReplay('FINISH_VACCINATION', { patientId: patient.id, time: this.time });
        
        this.selectedStation = null;
        this.render();
        this.updateActionButtons();
    }

    checkWinCondition() {
        const config = LEVELS[this.currentLevel];
        if (this.completedObservation >= config.totalPatients) {
            this.endGame(true);
        }
    }

    checkLoseCondition() {
        const config = LEVELS[this.currentLevel];
        
        if (this.errors >= config.maxErrors) {
            this.endGame(false, '错误次数过多');
            return;
        }

        if (this.observation.length > config.observationCapacity) {
            this.endGame(false, '留观区溢出');
        }
    }

    endGame(isWin, reason = '') {
        this.gameState = isWin ? 'won' : 'lost';
        
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
        if (this.patientGenerator) {
            clearInterval(this.patientGenerator);
            this.patientGenerator = null;
        }

        const config = LEVELS[this.currentLevel];
        const titleEl = document.getElementById('result-title');
        const statsEl = document.getElementById('result-stats');
        
        if (isWin) {
            titleEl.textContent = '🎉 关卡完成！';
            titleEl.style.color = '#48bb78';
        } else {
            titleEl.textContent = '😢 挑战失败';
            titleEl.style.color = '#fc8181';
        }

        const efficiency = Math.round((this.completedObservation / config.totalPatients) * 100);
        const accuracy = this.errors === 0 ? 100 : Math.round((1 - this.errors / config.maxErrors) * 100);

        statsEl.innerHTML = `
            <div class="result-stat"><span class="label">最终得分</span><span class="value">${this.score}</span></div>
            <div class="result-stat"><span class="label">完成接种</span><span class="value">${this.completedVaccinations}/${config.totalPatients}</span></div>
            <div class="result-stat"><span class="label">留观完成</span><span class="value">${this.completedObservation}</span></div>
            <div class="result-stat"><span class="label">处理迟到</span><span class="value">${this.lateHandled}</span></div>
            <div class="result-stat"><span class="label">错误次数</span><span class="value">${this.errors}/${config.maxErrors}</span></div>
            <div class="result-stat"><span class="label">完成效率</span><span class="value">${efficiency}%</span></div>
            <div class="result-stat"><span class="label">操作准确率</span><span class="value">${accuracy}%</span></div>
            ${!isWin ? `<div class="result-stat"><span class="label">失败原因</span><span class="value" style="color:#fc8181">${reason}</span></div>` : ''}
        `;

        const nextBtn = document.getElementById('btn-next-level');
        nextBtn.style.display = (isWin && this.currentLevel < 3) ? 'block' : 'none';

        this.showScreen('result-screen');
        this.recordReplay('GAME_END', { isWin, reason, time: this.time });
    }

    pause() {
        if (this.gameState === 'playing') {
            this.gameState = 'paused';
            this.showScreen('pause-screen');
        }
    }

    resume() {
        if (this.gameState === 'paused') {
            this.gameState = 'playing';
            this.hideScreen('pause-screen');
        }
    }

    restart() {
        this.hideScreen('pause-screen');
        this.hideScreen('result-screen');
        this.startLevel(this.currentLevel);
    }

    nextLevel() {
        if (this.currentLevel < 3) {
            this.hideScreen('result-screen');
            this.startLevel(this.currentLevel + 1);
        }
    }

    goToMenu() {
        this.resetGameState();
        this.hideScreen('pause-screen');
        this.hideScreen('result-screen');
        this.hideScreen('game-screen');
        this.showScreen('start-screen');
    }

    showScreen(screenId) {
        document.getElementById(screenId).classList.add('active');
    }

    hideScreen(screenId) {
        document.getElementById(screenId).classList.remove('active');
    }

    addLog(type, message) {
        const time = this.formatTime(this.time);
        this.eventLog.unshift({ type, message, time });
        if (this.eventLog.length > 50) {
            this.eventLog.pop();
        }
    }

    recordReplay(action, data) {
        this.replayHistory.push({
            action,
            data,
            timestamp: this.time
        });
    }

    showReplay() {
        this.showScreen('replay-screen');
        this.renderReplay();
    }

    closeReplay() {
        this.hideScreen('replay-screen');
        if (this.replayInterval) {
            clearInterval(this.replayInterval);
            this.replayInterval = null;
        }
    }

    renderReplay() {
        const view = document.getElementById('replay-view');
        view.innerHTML = this.replayHistory.map((step, index) => {
            const time = this.formatTime(step.timestamp);
            let actionText = '';
            
            switch (step.action) {
                case 'START_LEVEL':
                    actionText = `开始关卡 ${step.data.level}`;
                    break;
                case 'PATIENT_ARRIVED':
                    actionText = `患者 #${step.data.patientId} 到达`;
                    break;
                case 'PATIENT_LATE':
                    actionText = `患者 #${step.data.patientId} 迟到`;
                    break;
                case 'CALL_PATIENT':
                    actionText = `叫号：患者 #${step.data.patientId}`;
                    break;
                case 'LATE_HANDLED':
                    actionText = `处理迟到：患者 #${step.data.patientId} 插入位置 ${step.data.position + 1}`;
                    break;
                case 'START_VACCINATION':
                    actionText = `开始接种：患者 #${step.data.patientId} 在台 ${step.data.stationId}，疫苗 ${step.data.vaccineBatch}`;
                    break;
                case 'FINISH_VACCINATION':
                    actionText = `完成接种：患者 #${step.data.patientId} 进入留观`;
                    break;
                case 'OBSERVATION_COMPLETE':
                    actionText = `留观完成：患者 #${step.data.patientId}`;
                    break;
                case 'ERROR':
                    if (step.data.type === 'VACCINE_TYPE_MISMATCH') {
                        actionText = '错误：疫苗类型不匹配';
                    } else if (step.data.type === 'BATCH_MISMATCH') {
                        actionText = '错误：疫苗批号不匹配';
                    } else if (step.data.type === 'INVALID_INSERT') {
                        actionText = '错误：插队位置无效';
                    } else {
                        actionText = `错误：${step.data.type}`;
                    }
                    break;
                case 'GAME_END':
                    actionText = step.data.isWin ? '游戏胜利！' : `游戏失败：${step.data.reason}`;
                    break;
                default:
                    actionText = step.action;
            }
            
            return `<div class="replay-step" id="replay-step-${index}">
                <div class="time">${time}</div>
                <div class="action">${actionText}</div>
            </div>`;
        }).join('');
    }

    playReplay() {
        if (this.replayInterval) return;
        
        let currentStep = 0;
        this.replayInterval = setInterval(() => {
            if (currentStep >= this.replayHistory.length) {
                clearInterval(this.replayInterval);
                this.replayInterval = null;
                return;
            }
            
            document.querySelectorAll('.replay-step').forEach(el => el.classList.remove('current'));
            const stepEl = document.getElementById(`replay-step-${currentStep}`);
            if (stepEl) {
                stepEl.classList.add('current');
                stepEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }
            
            const progress = Math.round(((currentStep + 1) / this.replayHistory.length) * 100);
            document.getElementById('replay-progress').textContent = progress;
            
            currentStep++;
        }, 500);
    }

    pauseReplay() {
        if (this.replayInterval) {
            clearInterval(this.replayInterval);
            this.replayInterval = null;
        }
    }

    resetReplay() {
        this.pauseReplay();
        document.querySelectorAll('.replay-step').forEach(el => el.classList.remove('current'));
        document.getElementById('replay-progress').textContent = '0';
        const view = document.getElementById('replay-view');
        if (view) view.scrollTop = 0;
    }

    exportReport() {
        const config = LEVELS[this.currentLevel];
        const report = {
            level: this.currentLevel,
            levelName: config.name,
            score: this.score,
            completedVaccinations: this.completedVaccinations,
            completedObservation: this.completedObservation,
            lateHandled: this.lateHandled,
            errors: this.errors,
            totalPatients: config.totalPatients,
            efficiency: Math.round((this.completedObservation / config.totalPatients) * 100),
            accuracy: this.errors === 0 ? 100 : Math.round((1 - this.errors / config.maxErrors) * 100),
            vaccineUsage: this.vaccines.map(v => ({
                batch: v.batch,
                type: v.type,
                remaining: v.count
            })),
            eventLog: this.eventLog
        };

        const reportText = `
╔══════════════════════════════════════════════════════════════╗
║                社区疫苗接种模拟报告                          ║
╠══════════════════════════════════════════════════════════════╣
║  关卡: ${report.levelName.padEnd(50)}║
║  最终得分: ${String(report.score).padEnd(47)}║
╠══════════════════════════════════════════════════════════════╣
║  完成接种: ${report.completedVaccinations}/${report.totalPatients}${' '.repeat(41)}║
║  留观完成: ${String(report.completedObservation).padEnd(47)}║
║  处理迟到: ${String(report.lateHandled).padEnd(47)}║
║  错误次数: ${report.errors}/${config.maxErrors}${' '.repeat(43)}║
║  完成效率: ${report.efficiency}%${' '.repeat(45)}║
║  操作准确率: ${report.accuracy}%${' '.repeat(44)}║
╠══════════════════════════════════════════════════════════════╣
║  疫苗使用情况:                                               ║
${report.vaccineUsage.map(v => `║    ${v.batch} - ${v.type}: 剩余 ${v.remaining} 剂${' '.repeat(28 - String(v.remaining).length)}║`).join('\n')}
╠══════════════════════════════════════════════════════════════╣
║  事件日志:                                                   ║
${report.eventLog.slice(0, 15).map(e => `║  [${e.time}] ${e.message.substring(0, 40).padEnd(42)}║`).join('\n')}
╚══════════════════════════════════════════════════════════════╝
        `.trim();

        const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `疫苗接种报告_关卡${this.currentLevel}_${new Date().toLocaleDateString()}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.addLog('success', '报告已导出！');
    }

    selectVaccine(batch) {
        this.selectedVaccine = this.selectedVaccine === batch ? null : batch;
        this.render();
        this.updateActionButtons();
    }

    selectStation(stationId) {
        this.selectedStation = this.selectedStation === stationId ? null : stationId;
        this.render();
        this.updateActionButtons();
    }

    updateActionButtons() {
        const hasCalledPatient = this.patients.some(p => p.status === 'called');
        const hasIdleStation = this.stations.some(s => s.status === 'idle');
        const hasVaccine = this.vaccines.some(v => v.count > 0);
        
        const btnVaccinate = document.getElementById('btn-vaccinate');
        btnVaccinate.disabled = !(this.selectedStation && this.selectedVaccine && 
            hasCalledPatient && hasIdleStation && hasVaccine);

        const selectedStation = this.stations.find(s => s.id === this.selectedStation);
        const btnFinish = document.getElementById('btn-finish-vaccine');
        btnFinish.disabled = !(selectedStation && selectedStation.status === 'completed');

        const infoEl = document.getElementById('selected-info');
        if (this.selectedStation && this.selectedVaccine) {
            const station = this.stations.find(s => s.id === this.selectedStation);
            const vaccine = this.vaccines.find(v => v.batch === this.selectedVaccine);
            infoEl.innerHTML = `<p>已选择: <strong>${station.name}</strong> + <strong>${vaccine.type}(${vaccine.batch})</strong></p>`;
        } else if (this.selectedStation) {
            const station = this.stations.find(s => s.id === this.selectedStation);
            infoEl.innerHTML = `<p>已选择接种台: <strong>${station.name}</strong>，请选择疫苗</p>`;
        } else if (this.selectedVaccine) {
            const vaccine = this.vaccines.find(v => v.batch === this.selectedVaccine);
            infoEl.innerHTML = `<p>已选择疫苗: <strong>${vaccine.type}(${vaccine.batch})</strong>，请选择接种台</p>`;
        } else {
            infoEl.innerHTML = '<p>选择接种台和疫苗后开始接种</p>';
        }
    }

    formatTime(ms) {
        const seconds = Math.floor(ms / 1000);
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
    }

    render() {
        document.getElementById('game-time').textContent = this.formatTime(this.time);
        document.getElementById('game-score').textContent = this.score;
        document.getElementById('stat-completed').textContent = this.completedVaccinations;
        document.getElementById('stat-observed').textContent = this.completedObservation;
        document.getElementById('stat-late').textContent = this.lateHandled;
        document.getElementById('stat-errors').textContent = this.errors;

        this.renderVaccines();
        this.renderQueue();
        this.renderStations();
        this.renderObservation();
        this.renderEventLog();
    }

    renderVaccines() {
        const container = document.getElementById('vaccine-stock');
        container.innerHTML = this.vaccines.map(v => `
            <div class="vaccine-item ${this.selectedVaccine === v.batch ? 'selected' : ''} ${v.count === 0 ? 'disabled' : ''}"
                 onclick="game.selectVaccine('${v.batch}')">
                <span class="batch">${v.batch}</span>
                <span class="count">×${v.count}</span>
                <div class="type">${v.type}</div>
            </div>
        `).join('');
    }

    renderQueue() {
        const container = document.getElementById('appointment-queue');
        const config = LEVELS[this.currentLevel];
        
        container.innerHTML = this.patients.map((p, index) => {
            let statusClass = '';
            let statusText = '等待中';
            
            if (p.status === 'called') {
                statusClass = 'current';
                statusText = '已叫号';
            } else if (p.status === 'vaccinating') {
                statusClass = 'vaccinating';
                statusText = '接种中';
            } else if (p.status === 'observing' || p.status === 'completed') {
                return '';
            }
            
            const lateBadge = !p.lateHandled ? `<span class="late-badge">迟到</span>` : '';
            const lateClickHandler = !p.lateHandled ? `onclick="game.showLateInsertMenu(${p.id})"` : '';
            
            return `
                <div class="queue-item ${statusClass} ${!p.lateHandled ? 'late' : ''}" ${lateClickHandler}>
                    <div>
                        <span class="number">#${p.number}</span>
                        <span class="name">${p.name}</span>
                        ${lateBadge}
                    </div>
                    <div class="status">${p.requiredVaccine}<br><small>${p.requiredBatch}</small> | ${statusText}</div>
                </div>
            `;
        }).join('');
    }

    showLateInsertMenu(patientId) {
        const patient = this.patients.find(p => p.id === patientId);
        if (!patient || patient.lateHandled) return;

        const validRangeStart = Math.max(0, patient.number - 3);
        const validRangeEnd = Math.min(this.patients.filter(p => p.status === 'waiting').length, patient.number + 1);
        
        const positions = [];
        for (let i = validRangeStart; i <= validRangeEnd; i++) {
            positions.push(i);
        }
        
        const position = prompt(
            `迟到患者 ${patient.name}(#${patient.number}) 插队\n` +
            `允许范围: 第 ${validRangeStart + 1} - ${validRangeEnd + 1} 位\n` +
            `请输入插入位置 (1-${this.patients.filter(p => p.status === 'waiting').length + 1}):`,
            patient.number
        );
        
        if (position !== null) {
            const pos = parseInt(position) - 1;
            if (!isNaN(pos)) {
                this.handleLatePatient(patientId, pos);
            }
        }
    }

    renderStations() {
        const container = document.getElementById('vaccination-stations');
        const config = LEVELS[this.currentLevel];
        
        container.innerHTML = this.stations.map(s => {
            let statusClass = 'idle';
            let statusText = '空闲';
            let patientInfo = '-';
            let progress = 0;
            
            if (s.status === 'vaccinating') {
                statusClass = 'busy';
                statusText = '接种中';
                patientInfo = s.patient.name;
                progress = (s.progress / config.vaccinationTime) * 100;
            } else if (s.status === 'completed') {
                statusClass = 'completed';
                statusText = '待确认';
                patientInfo = s.patient.name + ' (完成)';
                progress = 100;
            }
            
            return `
                <div class="station ${statusClass} ${this.selectedStation === s.id ? 'selected' : ''}"
                     onclick="game.selectStation(${s.id})">
                    <div class="station-header">
                        <span class="station-name">${s.name}</span>
                        <span class="station-status ${statusClass}">${statusText}</span>
                    </div>
                    <div class="station-patient">患者: ${patientInfo}</div>
                    ${s.status !== 'idle' ? `
                        <div class="station-progress">
                            <div class="station-progress-bar" style="width: ${progress}%"></div>
                        </div>
                    ` : ''}
                </div>
            `;
        }).join('');
    }

    renderObservation() {
        const container = document.getElementById('observation-area');
        const config = LEVELS[this.currentLevel];
        
        document.getElementById('observation-count').textContent = this.observation.length;
        
        container.innerHTML = this.observation.map(p => {
            const progress = (p.observationProgress / config.observationTime) * 100;
            const remaining = Math.max(0, config.observationTime - p.observationProgress);
            const remainingSec = Math.ceil(remaining / 1000);
            
            return `
                <div class="observation-item">
                    <span class="name">${p.name}</span>
                    <span class="timer">${remainingSec}s</span>
                    <div class="progress">
                        <div class="progress-bar" style="width: ${progress}%"></div>
                    </div>
                </div>
            `;
        }).join('');
    }

    renderEventLog() {
        const container = document.getElementById('event-log');
        container.innerHTML = this.eventLog.map(e => `
            <div class="log-item ${e.type}">
                [${e.time}] ${e.message}
            </div>
        `).join('');
    }
}

const game = new Game();
