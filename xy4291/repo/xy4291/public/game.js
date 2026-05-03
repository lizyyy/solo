class EmergencyTriageGame {
    constructor() {
        this.gameState = {
            status: 'idle', // idle, playing, ended
            score: 0,
            warnings: 0,
            timer: 0,
            totalTime: 600, // 10分钟
            startTime: null,
            patients: [],
            vitals: {},
            schedule: {},
            zones: {
                emergency: { beds: 0, totalBeds: 0, doctors: 0, patients: [] },
                observation: { beds: 0, totalBeds: 0, doctors: 0, patients: [] },
                transfer: { beds: 0, totalBeds: 0, doctors: 0, patients: [] },
                waiting: { beds: 0, totalBeds: 0, doctors: 0, patients: [] }
            },
            decisions: [],
            mistakes: [],
            currentReplayStep: 0,
            replayInterval: null
        };
        
        this.initializeElements();
        this.bindEvents();
    }
    
    initializeElements() {
        // 界面元素
        this.startScreen = document.getElementById('start-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.endScreen = document.getElementById('end-screen');
        this.savesScreen = document.getElementById('saves-screen');
        this.replayScreen = document.getElementById('replay-screen');
        
        // 按钮
        this.startButton = document.getElementById('start-button');
        this.showSavesButton = document.getElementById('show-saves-button');
        this.playAgainButton = document.getElementById('play-again-button');
        this.replayButton = document.getElementById('replay-button');
        this.exportMdButton = document.getElementById('export-md-button');
        this.exportCsvButton = document.getElementById('export-csv-button');
        this.saveGameButton = document.getElementById('save-game-button');
        this.backButton = document.getElementById('back-button');
        this.replayPrevButton = document.getElementById('replay-prev');
        this.replayPlayButton = document.getElementById('replay-play');
        this.replayNextButton = document.getElementById('replay-next');
        this.replayExitButton = document.getElementById('replay-exit');
        
        // 游戏状态显示
        this.timerDisplay = document.getElementById('timer');
        this.scoreDisplay = document.getElementById('score');
        this.warningsDisplay = document.getElementById('warnings');
        
        // 病人区域
        this.patientsList = document.getElementById('patients-list');
        
        // 分诊区域
        this.emergencyZone = document.getElementById('emergency-zone');
        this.observationZone = document.getElementById('observation-zone');
        this.transferZone = document.getElementById('transfer-zone');
        this.waitingZone = document.getElementById('waiting-zone');
        
        // 分诊区域病人容器
        this.emergencyPatients = document.getElementById('emergency-patients');
        this.observationPatients = document.getElementById('observation-patients');
        this.transferPatients = document.getElementById('transfer-patients');
        this.waitingPatients = document.getElementById('waiting-patients');
        
        // 区域信息显示
        this.emergencyBeds = document.getElementById('emergency-beds');
        this.emergencyTotalBeds = document.getElementById('emergency-total-beds');
        this.emergencyDoctors = document.getElementById('emergency-doctors');
        
        this.observationBeds = document.getElementById('observation-beds');
        this.observationTotalBeds = document.getElementById('observation-total-beds');
        this.observationDoctors = document.getElementById('observation-doctors');
        
        this.transferBeds = document.getElementById('transfer-beds');
        this.transferTotalBeds = document.getElementById('transfer-total-beds');
        this.transferDoctors = document.getElementById('transfer-doctors');
        
        this.waitingBeds = document.getElementById('waiting-beds');
        this.waitingTotalBeds = document.getElementById('waiting-total-beds');
        this.waitingDoctors = document.getElementById('waiting-doctors');
        
        // 结果显示
        this.finalScore = document.getElementById('final-score');
        this.accuracy = document.getElementById('accuracy');
        this.warningsCount = document.getElementById('warnings-count');
        this.timeUsed = document.getElementById('time-used');
        
        // 存档列表
        this.savesList = document.getElementById('saves-list');
        
        // 回放信息
        this.replayStep = document.getElementById('replay-step');
        this.replayTotal = document.getElementById('replay-total');
        this.replayTime = document.getElementById('replay-time');
        this.replayContent = document.getElementById('replay-content');
    }
    
    bindEvents() {
        // 按钮事件
        this.startButton.addEventListener('click', () => this.startGame());
        this.showSavesButton.addEventListener('click', () => this.showSaves());
        this.playAgainButton.addEventListener('click', () => this.startGame());
        this.replayButton.addEventListener('click', () => this.startReplay());
        this.exportMdButton.addEventListener('click', () => this.exportMarkdown());
        this.exportCsvButton.addEventListener('click', () => this.exportCsv());
        this.saveGameButton.addEventListener('click', () => this.saveGame());
        this.backButton.addEventListener('click', () => this.showStartScreen());
        
        // 回放控制
        this.replayPrevButton.addEventListener('click', () => this.replayPrev());
        this.replayPlayButton.addEventListener('click', () => this.toggleReplayPlay());
        this.replayNextButton.addEventListener('click', () => this.replayNext());
        this.replayExitButton.addEventListener('click', () => this.exitReplay());
        
        // 拖拽事件
        this.setupDragAndDrop();
    }
    
    setupDragAndDrop() {
        // 拖拽开始
        document.addEventListener('dragstart', (e) => {
            if (e.target.classList.contains('patient-card')) {
                e.target.classList.add('dragging');
                e.dataTransfer.setData('text/plain', e.target.dataset.patientId);
            }
        });
        
        // 拖拽结束
        document.addEventListener('dragend', (e) => {
            if (e.target.classList.contains('patient-card')) {
                e.target.classList.remove('dragging');
            }
        });
        
        // 拖拽经过
        document.addEventListener('dragover', (e) => {
            if (e.target.closest('.triage-zone')) {
                e.preventDefault();
                const zone = e.target.closest('.triage-zone');
                zone.style.backgroundColor = 'rgba(102, 126, 234, 0.1)';
            }
        });
        
        // 拖拽离开
        document.addEventListener('dragleave', (e) => {
            if (e.target.closest('.triage-zone')) {
                const zone = e.target.closest('.triage-zone');
                zone.style.backgroundColor = '';
            }
        });
        
        // 放置
        document.addEventListener('drop', (e) => {
            if (e.target.closest('.triage-zone')) {
                e.preventDefault();
                const zone = e.target.closest('.triage-zone');
                zone.style.backgroundColor = '';
                
                const patientId = e.dataTransfer.getData('text/plain');
                const zoneType = zone.dataset.zone;
                
                this.triagePatient(patientId, zoneType);
            }
        });
    }
    
    async loadData() {
        try {
            // 加载病人数据
            const patientsResponse = await fetch('/api/data/patients');
            this.gameState.patients = await patientsResponse.json();
            
            // 加载生命体征数据
            const vitalsResponse = await fetch('/api/data/vitals');
            this.gameState.vitals = await vitalsResponse.json();
            
            // 加载排班数据
            const scheduleResponse = await fetch('/api/data/schedule');
            this.gameState.schedule = await scheduleResponse.json();
            
            // 初始化区域数据
            this.initializeZones();
            
            // 合并病人数据和生命体征
            this.mergePatientData();
            
            return true;
        } catch (error) {
            console.error('加载数据失败:', error);
            this.showMessage('加载游戏数据失败，请检查数据文件', 'error');
            return false;
        }
    }
    
    initializeZones() {
        const zones = this.gameState.schedule.zones || {};
        
        // 抢救区
        this.gameState.zones.emergency.totalBeds = zones.emergency?.beds || 5;
        this.gameState.zones.emergency.beds = zones.emergency?.beds || 5;
        this.gameState.zones.emergency.doctors = zones.emergency?.doctors || 2;
        
        // 留观区
        this.gameState.zones.observation.totalBeds = zones.observation?.beds || 10;
        this.gameState.zones.observation.beds = zones.observation?.beds || 10;
        this.gameState.zones.observation.doctors = zones.observation?.doctors || 3;
        
        // 转诊区
        this.gameState.zones.transfer.totalBeds = zones.transfer?.beds || 5;
        this.gameState.zones.transfer.beds = zones.transfer?.beds || 5;
        this.gameState.zones.transfer.doctors = zones.transfer?.doctors || 1;
        
        // 等待区
        this.gameState.zones.waiting.totalBeds = zones.waiting?.beds || 20;
        this.gameState.zones.waiting.beds = zones.waiting?.beds || 20;
        this.gameState.zones.waiting.doctors = zones.waiting?.doctors || 1;
        
        // 更新界面显示
        this.updateZoneDisplay();
    }
    
    mergePatientData() {
        this.gameState.patients.forEach(patient => {
            const patientVitals = this.gameState.vitals[patient.id];
            if (patientVitals) {
                patient.vitals = patientVitals;
            }
            
            // 计算分诊优先级
            patient.correctZone = this.calculateCorrectZone(patient);
            patient.priority = this.getPriorityFromZone(patient.correctZone);
        });
    }
    
    calculateCorrectZone(patient) {
        const vitals = patient.vitals || {};
        
        // 1级: 抢救区 - 紧急生命危险情况
        if (this.isEmergency(patient, vitals)) {
            return 'emergency';
        }
        
        // 2级: 留观区 - 需要进一步观察治疗
        if (this.isObservation(patient, vitals)) {
            return 'observation';
        }
        
        // 3级: 转诊区 - 需要转往其他科室
        if (this.isTransfer(patient, vitals)) {
            return 'transfer';
        }
        
        // 4级: 等待区 - 病情稳定，可以等待
        return 'waiting';
    }
    
    isEmergency(patient, vitals) {
        // 呼吸骤停或心跳骤停
        if (vitals.heartRate === 0 || vitals.respiratoryRate === 0) {
            return true;
        }
        
        // 严重呼吸急促或过缓
        if (vitals.respiratoryRate < 8 || vitals.respiratoryRate > 30) {
            return true;
        }
        
        // 严重心动过速或过缓
        if (vitals.heartRate < 40 || vitals.heartRate > 180) {
            return true;
        }
        
        // 严重低血压
        if (vitals.systolicBP < 70) {
            return true;
        }
        
        // 意识不清
        if (vitals.glasgowComaScale && vitals.glasgowComaScale < 9) {
            return true;
        }
        
        // 严重缺氧
        if (vitals.oxygenSaturation && vitals.oxygenSaturation < 90) {
            return true;
        }
        
        // 严重胸痛、呼吸困难、意识改变等主诉
        const emergencyComplaints = ['胸痛', '呼吸困难', '意识不清', '严重出血', '过敏性休克', '抽搐'];
        for (const complaint of emergencyComplaints) {
            if (patient.complaint && patient.complaint.includes(complaint)) {
                return true;
            }
        }
        
        return false;
    }
    
    isObservation(patient, vitals) {
        // 中度呼吸急促
        if (vitals.respiratoryRate > 20 && vitals.respiratoryRate <= 30) {
            return true;
        }
        
        // 中度心动过速
        if (vitals.heartRate > 100 && vitals.heartRate <= 180) {
            return true;
        }
        
        // 中度低血压
        if (vitals.systolicBP >= 70 && vitals.systolicBP < 90) {
            return true;
        }
        
        // 中度高血压
        if (vitals.systolicBP > 180) {
            return true;
        }
        
        // 中度缺氧
        if (vitals.oxygenSaturation && vitals.oxygenSaturation >= 90 && vitals.oxygenSaturation < 95) {
            return true;
        }
        
        // 发热
        if (vitals.temperature && vitals.temperature > 38.5) {
            return true;
        }
        
        // 中等程度的主诉
        const observationComplaints = ['腹痛', '呕吐', '头痛', '外伤', '发热', '咳嗽'];
        for (const complaint of observationComplaints) {
            if (patient.complaint && patient.complaint.includes(complaint)) {
                return true;
            }
        }
        
        return false;
    }
    
    isTransfer(patient, vitals) {
        // 需要专科处理的情况
        const transferComplaints = ['骨折', '烧伤', '眼科急诊', '耳鼻喉急诊', '妇产科急诊', '精神科急诊'];
        for (const complaint of transferComplaints) {
            if (patient.complaint && patient.complaint.includes(complaint)) {
                return true;
            }
        }
        
        // 生命体征稳定但需要专科处理
        if (patient.department && patient.department !== '急诊科') {
            return true;
        }
        
        return false;
    }
    
    getPriorityFromZone(zone) {
        const priorityMap = {
            'emergency': 1,
            'observation': 2,
            'transfer': 3,
            'waiting': 4
        };
        return priorityMap[zone] || 4;
    }
    
    updateZoneDisplay() {
        // 抢救区
        this.emergencyBeds.textContent = this.gameState.zones.emergency.beds;
        this.emergencyTotalBeds.textContent = this.gameState.zones.emergency.totalBeds;
        this.emergencyDoctors.textContent = this.gameState.zones.emergency.doctors;
        
        // 留观区
        this.observationBeds.textContent = this.gameState.zones.observation.beds;
        this.observationTotalBeds.textContent = this.gameState.zones.observation.totalBeds;
        this.observationDoctors.textContent = this.gameState.zones.observation.doctors;
        
        // 转诊区
        this.transferBeds.textContent = this.gameState.zones.transfer.beds;
        this.transferTotalBeds.textContent = this.gameState.zones.transfer.totalBeds;
        this.transferDoctors.textContent = this.gameState.zones.transfer.doctors;
        
        // 等待区
        this.waitingBeds.textContent = this.gameState.zones.waiting.beds;
        this.waitingTotalBeds.textContent = this.gameState.zones.waiting.totalBeds;
        this.waitingDoctors.textContent = this.gameState.zones.waiting.doctors;
    }
    
    async startGame() {
        // 重置游戏状态
        this.resetGameState();
        
        // 加载数据
        const dataLoaded = await this.loadData();
        if (!dataLoaded) {
            return;
        }
        
        // 显示游戏界面
        this.showGameScreen();
        
        // 渲染病人列表
        this.renderPatientQueue();
        
        // 开始计时
        this.gameState.status = 'playing';
        this.gameState.startTime = Date.now();
        this.startTimer();
        
        this.showMessage('游戏开始！请快速正确分诊病人', 'success');
    }
    
    resetGameState() {
        this.gameState.score = 0;
        this.gameState.warnings = 0;
        this.gameState.timer = this.gameState.totalTime;
        this.gameState.decisions = [];
        this.gameState.mistakes = [];
        this.gameState.currentReplayStep = 0;
        
        // 重置区域
        Object.keys(this.gameState.zones).forEach(zone => {
            this.gameState.zones[zone].beds = this.gameState.zones[zone].totalBeds;
            this.gameState.zones[zone].patients = [];
        });
        
        // 清空病人容器
        this.emergencyPatients.innerHTML = '';
        this.observationPatients.innerHTML = '';
        this.transferPatients.innerHTML = '';
        this.waitingPatients.innerHTML = '';
        
        // 更新显示
        this.updateGameStatusDisplay();
    }
    
    renderPatientQueue() {
        this.patientsList.innerHTML = '';
        
        // 按优先级排序
        const sortedPatients = [...this.gameState.patients].sort((a, b) => a.priority - b.priority);
        
        sortedPatients.forEach(patient => {
            const patientCard = this.createPatientCard(patient);
            this.patientsList.appendChild(patientCard);
        });
    }
    
    createPatientCard(patient) {
        const card = document.createElement('div');
        card.className = 'patient-card';
        card.dataset.patientId = patient.id;
        card.draggable = true;
        
        // 优先级指示器颜色
        const priorityClass = `priority-${patient.priority}`;
        
        // 格式化生命体征
        const vitalsText = this.formatVitals(patient.vitals);
        
        card.innerHTML = `
            <div class="priority-indicator ${priorityClass}"></div>
            <div class="patient-name">${patient.name}</div>
            <div class="patient-age">${patient.age}岁 ${patient.gender}</div>
            <div class="patient-complaint">${patient.complaint}</div>
            <div class="patient-vitals">${vitalsText}</div>
        `;
        
        return card;
    }
    
    formatVitals(vitals) {
        if (!vitals) return '生命体征: 未记录';
        
        const parts = [];
        
        if (vitals.heartRate) parts.push(`心率: ${vitals.heartRate}次/分`);
        if (vitals.respiratoryRate) parts.push(`呼吸: ${vitals.respiratoryRate}次/分`);
        if (vitals.systolicBP && vitals.diastolicBP) parts.push(`血压: ${vitals.systolicBP}/${vitals.diastolicBP}mmHg`);
        if (vitals.temperature) parts.push(`体温: ${vitals.temperature}°C`);
        if (vitals.oxygenSaturation) parts.push(`血氧: ${vitals.oxygenSaturation}%`);
        
        return parts.join('<br>') || '生命体征: 未记录';
    }
    
    triagePatient(patientId, zoneType) {
        // 查找病人
        const patient = this.gameState.patients.find(p => p.id === patientId);
        if (!patient) {
            this.showMessage('未找到该病人', 'error');
            return;
        }
        
        // 检查区域是否有床位
        if (this.gameState.zones[zoneType].beds <= 0) {
            this.showMessage(`${this.getZoneName(zoneType)}床位已满！`, 'warning');
            return;
        }
        
        // 检查是否已经在某个区域
        const currentZone = this.findPatientZone(patientId);
        if (currentZone) {
            // 从当前区域移除
            this.removePatientFromZone(patientId, currentZone);
        }
        
        // 记录决策
        const decision = {
            patientId: patient.id,
            patientName: patient.name,
            action: zoneType,
            correctAction: patient.correctZone,
            isCorrect: zoneType === patient.correctZone,
            timestamp: Date.now(),
            timeElapsed: Math.floor((Date.now() - this.gameState.startTime) / 1000)
        };
        
        this.gameState.decisions.push(decision);
        
        // 评估决策
        if (decision.isCorrect) {
            // 正确分诊
            this.handleCorrectDecision(patient, zoneType, decision);
        } else {
            // 错误分诊
            this.handleIncorrectDecision(patient, zoneType, decision);
        }
        
        // 检查游戏是否结束
        this.checkGameEnd();
    }
    
    findPatientZone(patientId) {
        for (const [zoneName, zone] of Object.entries(this.gameState.zones)) {
            if (zone.patients.some(p => p.id === patientId)) {
                return zoneName;
            }
        }
        return null;
    }
    
    removePatientFromZone(patientId, zoneName) {
        const zone = this.gameState.zones[zoneName];
        const index = zone.patients.findIndex(p => p.id === patientId);
        if (index !== -1) {
            zone.patients.splice(index, 1);
            zone.beds++;
            
            // 从界面移除
            const container = this.getZoneContainer(zoneName);
            const card = container.querySelector(`[data-patient-id="${patientId}"]`);
            if (card) {
                card.remove();
            }
            
            // 更新显示
            this.updateZoneDisplay();
        }
    }
    
    getZoneContainer(zoneName) {
        const containerMap = {
            'emergency': this.emergencyPatients,
            'observation': this.observationPatients,
            'transfer': this.transferPatients,
            'waiting': this.waitingPatients
        };
        return containerMap[zoneName];
    }
    
    handleCorrectDecision(patient, zoneType, decision) {
        // 加分
        const baseScore = 100;
        const priorityBonus = (5 - patient.priority) * 20; // 优先级越高，加分越多
        const totalScore = baseScore + priorityBonus;
        
        this.gameState.score += totalScore;
        
        // 添加到目标区域
        this.addPatientToZone(patient, zoneType);
        
        // 从队列中移除
        this.removePatientFromQueue(patient.id);
        
        // 显示成功消息
        this.showMessage(`正确分诊 ${patient.name}！+${totalScore}分`, 'success');
        
        // 更新显示
        this.updateGameStatusDisplay();
    }
    
    handleIncorrectDecision(patient, zoneType, decision) {
        // 扣分
        const basePenalty = 50;
        const priorityPenalty = (5 - patient.priority) * 10; // 优先级越高，扣分越多
        const totalPenalty = basePenalty + priorityPenalty;
        
        this.gameState.score = Math.max(0, this.gameState.score - totalPenalty);
        this.gameState.warnings++;
        
        // 记录错误
        const mistake = {
            ...decision,
            penalty: totalPenalty,
            correctZoneName: this.getZoneName(decision.correctAction),
            wrongZoneName: this.getZoneName(decision.action)
        };
        this.gameState.mistakes.push(mistake);
        
        // 显示警告消息
        this.showMessage(`错误分诊 ${patient.name}！应该分到${this.getZoneName(decision.correctAction)}，-${totalPenalty}分`, 'error');
        
        // 高亮错误
        this.highlightMistake(patient, zoneType);
        
        // 更新显示
        this.updateGameStatusDisplay();
    }
    
    addPatientToZone(patient, zoneType) {
        const zone = this.gameState.zones[zoneType];
        zone.patients.push(patient);
        zone.beds--;
        
        // 创建病人卡片
        const patientCard = this.createPatientCard(patient);
        
        // 添加到界面
        const container = this.getZoneContainer(zoneType);
        container.appendChild(patientCard);
        
        // 更新显示
        this.updateZoneDisplay();
    }
    
    removePatientFromQueue(patientId) {
        const card = this.patientsList.querySelector(`[data-patient-id="${patientId}"]`);
        if (card) {
            card.remove();
        }
    }
    
    highlightMistake(patient, zoneType) {
        const container = this.getZoneContainer(zoneType);
        const card = container.querySelector(`[data-patient-id="${patient.id}"]`);
        if (card) {
            card.classList.add('highlight');
            
            // 3秒后移除高亮
            setTimeout(() => {
                card.classList.remove('highlight');
            }, 3000);
        }
    }
    
    getZoneName(zoneType) {
        const zoneNames = {
            'emergency': '抢救区',
            'observation': '留观区',
            'transfer': '转诊区',
            'waiting': '等待区'
        };
        return zoneNames[zoneType] || zoneType;
    }
    
    updateGameStatusDisplay() {
        // 更新分数和预警
        this.scoreDisplay.textContent = `分数: ${this.gameState.score}`;
        this.warningsDisplay.textContent = `预警: ${this.gameState.warnings}`;
    }
    
    startTimer() {
        this.timerInterval = setInterval(() => {
            if (this.gameState.status !== 'playing') {
                clearInterval(this.timerInterval);
                return;
            }
            
            const elapsed = Math.floor((Date.now() - this.gameState.startTime) / 1000);
            const remaining = this.gameState.totalTime - elapsed;
            
            if (remaining <= 0) {
                this.endGame();
                return;
            }
            
            this.gameState.timer = remaining;
            this.updateTimerDisplay(remaining);
            
            // 模拟病情恶化
            this.simulateConditionDeterioration();
            
            // 模拟医生疲劳
            this.simulateDoctorFatigue();
        }, 1000);
    }
    
    updateTimerDisplay(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.timerDisplay.textContent = `剩余时间: ${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        // 最后1分钟显示红色警告
        if (seconds < 60) {
            this.timerDisplay.style.color = '#ff4757';
        } else if (seconds < 120) {
            this.timerDisplay.style.color = '#ffa502';
        } else {
            this.timerDisplay.style.color = '';
        }
    }
    
    simulateConditionDeterioration() {
        // 每30秒有机会让等待区的病人病情恶化
        const elapsed = Math.floor((Date.now() - this.gameState.startTime) / 1000);
        if (elapsed % 30 === 0 && elapsed > 0) {
            const waitingPatients = this.gameState.zones.waiting.patients;
            if (waitingPatients.length > 0) {
                // 随机选择一个病人
                const randomIndex = Math.floor(Math.random() * waitingPatients.length);
                const patient = waitingPatients[randomIndex];
                
                // 降低优先级（病情恶化）
                if (patient.priority > 1) {
                    patient.priority--;
                    
                    // 更新病人卡片
                    const container = this.waitingPatients;
                    const card = container.querySelector(`[data-patient-id="${patient.id}"]`);
                    if (card) {
                        // 移除旧的优先级类
                        const priorityIndicator = card.querySelector('.priority-indicator');
                        priorityIndicator.className = `priority-indicator priority-${patient.priority}`;
                        
                        // 添加闪烁效果
                        card.classList.add('highlight');
                        setTimeout(() => {
                            card.classList.remove('highlight');
                        }, 2000);
                    }
                    
                    this.showMessage(`${patient.name} 病情恶化！请尽快处理`, 'warning');
                    this.gameState.warnings++;
                    this.updateGameStatusDisplay();
                }
            }
        }
    }
    
    simulateDoctorFatigue() {
        // 每60秒，医生疲劳，处理能力下降
        const elapsed = Math.floor((Date.now() - this.gameState.startTime) / 1000);
        if (elapsed % 60 === 0 && elapsed > 0) {
            // 可以在这里实现医生疲劳的逻辑
            // 例如：处理速度变慢，或者增加错误概率
        }
    }
    
    checkGameEnd() {
        // 检查是否所有病人都已分诊
        const allPatientsTriageed = this.gameState.patients.every(patient => {
            return Object.values(this.gameState.zones).some(zone => 
                zone.patients.some(p => p.id === patient.id)
            );
        });
        
        if (allPatientsTriageed) {
            this.endGame();
        }
    }
    
    endGame() {
        // 停止游戏
        this.gameState.status = 'ended';
        clearInterval(this.timerInterval);
        
        // 计算用时
        const timeUsed = this.gameState.totalTime - this.gameState.timer;
        
        // 计算准确率
        const totalDecisions = this.gameState.decisions.length;
        const correctDecisions = this.gameState.decisions.filter(d => d.isCorrect).length;
        const accuracy = totalDecisions > 0 ? Math.round((correctDecisions / totalDecisions) * 100) : 0;
        
        // 显示结果
        this.finalScore.textContent = `最终分数: ${this.gameState.score}`;
        this.accuracy.textContent = `准确率: ${accuracy}%`;
        this.warningsCount.textContent = `预警次数: ${this.gameState.warnings}`;
        this.timeUsed.textContent = `用时: ${this.formatTime(timeUsed)}`;
        
        // 显示结束界面
        this.showEndScreen();
        
        this.showMessage('游戏结束！查看你的成绩', 'success');
    }
    
    formatTime(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    showMessage(text, type = 'info') {
        const messageContainer = document.getElementById('message-container');
        
        const message = document.createElement('div');
        message.className = `message ${type}`;
        message.textContent = text;
        
        messageContainer.appendChild(message);
        
        // 3秒后自动隐藏
        setTimeout(() => {
            message.classList.add('hiding');
            setTimeout(() => {
                message.remove();
            }, 300);
        }, 3000);
    }
    
    showStartScreen() {
        this.startScreen.style.display = 'block';
        this.gameScreen.style.display = 'none';
        this.endScreen.style.display = 'none';
        this.savesScreen.style.display = 'none';
        this.replayScreen.style.display = 'none';
    }
    
    showGameScreen() {
        this.startScreen.style.display = 'none';
        this.gameScreen.style.display = 'flex';
        this.endScreen.style.display = 'none';
        this.savesScreen.style.display = 'none';
        this.replayScreen.style.display = 'none';
    }
    
    showEndScreen() {
        this.startScreen.style.display = 'none';
        this.gameScreen.style.display = 'none';
        this.endScreen.style.display = 'block';
        this.savesScreen.style.display = 'none';
        this.replayScreen.style.display = 'none';
    }
    
    showSavesScreen() {
        this.startScreen.style.display = 'none';
        this.gameScreen.style.display = 'none';
        this.endScreen.style.display = 'none';
        this.savesScreen.style.display = 'block';
        this.replayScreen.style.display = 'none';
    }
    
    showReplayScreen() {
        this.startScreen.style.display = 'none';
        this.gameScreen.style.display = 'none';
        this.endScreen.style.display = 'none';
        this.savesScreen.style.display = 'none';
        this.replayScreen.style.display = 'block';
    }
    
    showSaves() {
        this.loadSaves();
        this.showSavesScreen();
    }
    
    loadSaves() {
        const saves = JSON.parse(localStorage.getItem('triageGameSaves') || '[]');
        
        this.savesList.innerHTML = '';
        
        if (saves.length === 0) {
            this.savesList.innerHTML = '<p>暂无存档记录</p>';
            return;
        }
        
        saves.forEach((save, index) => {
            const saveItem = document.createElement('div');
            saveItem.className = 'save-item';
            
            const saveDate = new Date(save.timestamp);
            const formattedDate = saveDate.toLocaleString('zh-CN');
            
            saveItem.innerHTML = `
                <div class="save-info">
                    <h4>${save.name || `游戏记录 #${index + 1}`}</h4>
                    <p>日期: ${formattedDate}</p>
                    <p>分数: ${save.score} | 准确率: ${save.accuracy}% | 预警: ${save.warnings}</p>
                </div>
                <div class="save-actions">
                    <button class="load-save" data-index="${index}">加载</button>
                    <button class="delete-save" data-index="${index}">删除</button>
                </div>
            `;
            
            this.savesList.appendChild(saveItem);
        });
        
        // 绑定按钮事件
        document.querySelectorAll('.load-save').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.loadSave(index);
            });
        });
        
        document.querySelectorAll('.delete-save').forEach(button => {
            button.addEventListener('click', (e) => {
                const index = parseInt(e.target.dataset.index);
                this.deleteSave(index);
            });
        });
    }
    
    loadSave(index) {
        const saves = JSON.parse(localStorage.getItem('triageGameSaves') || '[]');
        const save = saves[index];
        
        if (save) {
            // 恢复游戏状态
            this.gameState.decisions = save.decisions || [];
            this.gameState.mistakes = save.mistakes || [];
            this.gameState.score = save.score || 0;
            this.gameState.warnings = save.warnings || 0;
            
            // 显示结束界面，允许回放和导出
            this.finalScore.textContent = `最终分数: ${save.score}`;
            this.accuracy.textContent = `准确率: ${save.accuracy}%`;
            this.warningsCount.textContent = `预警次数: ${save.warnings}`;
            this.timeUsed.textContent = `用时: ${this.formatTime(save.timeUsed || 0)}`;
            
            this.showEndScreen();
            this.showMessage('存档已加载', 'success');
        }
    }
    
    deleteSave(index) {
        let saves = JSON.parse(localStorage.getItem('triageGameSaves') || '[]');
        saves.splice(index, 1);
        localStorage.setItem('triageGameSaves', JSON.stringify(saves));
        
        this.loadSaves();
        this.showMessage('存档已删除', 'success');
    }
    
    saveGame() {
        const saveName = prompt('请输入存档名称:', `游戏记录 ${new Date().toLocaleDateString()}`);
        if (saveName === null) return;
        
        // 计算准确率
        const totalDecisions = this.gameState.decisions.length;
        const correctDecisions = this.gameState.decisions.filter(d => d.isCorrect).length;
        const accuracy = totalDecisions > 0 ? Math.round((correctDecisions / totalDecisions) * 100) : 0;
        
        const save = {
            name: saveName || '未命名',
            timestamp: Date.now(),
            score: this.gameState.score,
            warnings: this.gameState.warnings,
            accuracy: accuracy,
            timeUsed: this.gameState.totalTime - this.gameState.timer,
            decisions: this.gameState.decisions,
            mistakes: this.gameState.mistakes
        };
        
        let saves = JSON.parse(localStorage.getItem('triageGameSaves') || '[]');
        saves.push(save);
        localStorage.setItem('triageGameSaves', JSON.stringify(saves));
        
        this.showMessage('游戏记录已保存', 'success');
    }
    
    startReplay() {
        if (this.gameState.decisions.length === 0) {
            this.showMessage('没有决策记录可供回放', 'warning');
            return;
        }
        
        this.gameState.currentReplayStep = 0;
        this.showReplayScreen();
        this.updateReplayDisplay();
    }
    
    updateReplayDisplay() {
        const decision = this.gameState.decisions[this.gameState.currentReplayStep];
        
        this.replayStep.textContent = this.gameState.currentReplayStep + 1;
        this.replayTotal.textContent = this.gameState.decisions.length;
        this.replayTime.textContent = this.formatTime(decision.timeElapsed);
        
        // 显示决策内容
        let content = `
            <h3>决策详情</h3>
            <p><strong>病人:</strong> ${decision.patientName}</p>
            <p><strong>分诊到:</strong> ${this.getZoneName(decision.action)}</p>
            <p><strong>正确分诊:</strong> ${this.getZoneName(decision.correctAction)}</p>
            <p><strong>结果:</strong> ${decision.isCorrect ? '<span style="color: #2ed573;">正确</span>' : '<span style="color: #ff4757;">错误</span>'}</p>
        `;
        
        // 如果是错误决策，显示更多信息
        if (!decision.isCorrect) {
            const mistake = this.gameState.mistakes.find(m => m.patientId === decision.patientId);
            if (mistake) {
                content += `
                    <p><strong>扣分:</strong> ${mistake.penalty}分</p>
                `;
            }
        }
        
        this.replayContent.innerHTML = content;
    }
    
    replayPrev() {
        if (this.gameState.currentReplayStep > 0) {
            this.gameState.currentReplayStep--;
            this.updateReplayDisplay();
        }
    }
    
    replayNext() {
        if (this.gameState.currentReplayStep < this.gameState.decisions.length - 1) {
            this.gameState.currentReplayStep++;
            this.updateReplayDisplay();
        }
    }
    
    toggleReplayPlay() {
        if (this.gameState.replayInterval) {
            // 停止播放
            clearInterval(this.gameState.replayInterval);
            this.gameState.replayInterval = null;
            this.replayPlayButton.textContent = '播放';
        } else {
            // 开始播放
            this.replayPlayButton.textContent = '暂停';
            this.gameState.replayInterval = setInterval(() => {
                if (this.gameState.currentReplayStep < this.gameState.decisions.length - 1) {
                    this.gameState.currentReplayStep++;
                    this.updateReplayDisplay();
                } else {
                    // 播放结束
                    clearInterval(this.gameState.replayInterval);
                    this.gameState.replayInterval = null;
                    this.replayPlayButton.textContent = '播放';
                }
            }, 2000);
        }
    }
    
    exitReplay() {
        if (this.gameState.replayInterval) {
            clearInterval(this.gameState.replayInterval);
            this.gameState.replayInterval = null;
        }
        this.showEndScreen();
    }
    
    exportMarkdown() {
        if (this.gameState.decisions.length === 0) {
            this.showMessage('没有决策记录可供导出', 'warning');
            return;
        }
        
        // 计算统计信息
        const totalDecisions = this.gameState.decisions.length;
        const correctDecisions = this.gameState.decisions.filter(d => d.isCorrect).length;
        const accuracy = totalDecisions > 0 ? Math.round((correctDecisions / totalDecisions) * 100) : 0;
        const timeUsed = this.gameState.totalTime - this.gameState.timer;
        
        // 生成Markdown内容
        let markdown = `# 夜班分诊风暴 - 游戏复盘报告

## 基本信息
- **日期**: ${new Date().toLocaleString('zh-CN')}
- **最终分数**: ${this.gameState.score}
- **准确率**: ${accuracy}%
- **预警次数**: ${this.gameState.warnings}
- **用时**: ${this.formatTime(timeUsed)}

## 决策统计
- **总决策数**: ${totalDecisions}
- **正确决策**: ${correctDecisions}
- **错误决策**: ${totalDecisions - correctDecisions}

## 错误详情
`;
        
        if (this.gameState.mistakes.length > 0) {
            markdown += `
| 病人 | 错误分诊 | 正确分诊 | 扣分 |
|------|---------|---------|------|
`;
            
            this.gameState.mistakes.forEach(mistake => {
                markdown += `| ${mistake.patientName} | ${mistake.wrongZoneName} | ${mistake.correctZoneName} | ${mistake.penalty} |\n`;
            });
        } else {
            markdown += `
太棒了！没有错误决策！
`;
        }
        
        markdown += `

## 决策时间线

`;
        
        this.gameState.decisions.forEach((decision, index) => {
            const timeFormatted = this.formatTime(decision.timeElapsed);
            const result = decision.isCorrect ? '✅ 正确' : '❌ 错误';
            
            markdown += `### ${index + 1}. ${decision.patientName}
- **时间**: ${timeFormatted}
- **分诊到**: ${this.getZoneName(decision.action)}
- **正确分诊**: ${this.getZoneName(decision.correctAction)}
- **结果**: ${result}

`;
        });
        
        // 下载Markdown文件
        this.downloadFile(markdown, 'triage-game-report.md', 'text/markdown');
        this.showMessage('Markdown复盘报告已导出', 'success');
    }
    
    exportCsv() {
        if (this.gameState.mistakes.length === 0) {
            this.showMessage('没有错误决策记录', 'warning');
            return;
        }
        
        // 生成CSV内容
        let csv = '病人姓名,错误分诊,正确分诊,扣分,时间\n';
        
        this.gameState.mistakes.forEach(mistake => {
            const timeFormatted = this.formatTime(mistake.timeElapsed);
            csv += `"${mistake.patientName}","${mistake.wrongZoneName}","${mistake.correctZoneName}",${mistake.penalty},"${timeFormatted}"\n`;
        });
        
        // 下载CSV文件
        this.downloadFile(csv, 'triage-game-mistakes.csv', 'text/csv');
        this.showMessage('CSV错分清单已导出', 'success');
    }
    
    downloadFile(content, filename, contentType) {
        const blob = new Blob([content], { type: contentType });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    window.game = new EmergencyTriageGame();
});
