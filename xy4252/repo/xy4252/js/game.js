class Game {
    constructor() {
        this.levelId = 'level1';
        this.levelData = null;
        
        this.gameMap = null;
        this.renderer = null;
        this.pathFinder = null;
        this.eventManager = null;
        
        this.stateMachine = null;
        this.missionStateMachine = null;
        this.scoringSystem = null;
        this.storageManager = null;
        
        this.timer = null;
        this.ui = null;
        
        this.volunteer = null;
        this.ambulance = null;
        this.aed = null;
        
        this.startTime = null;
        this.lastFrameTime = null;
        this.logEntries = [];
        
        this.selectedAEDLocation = null;
        this.volunteerTarget = null;
        this.ambulanceTarget = null;
        
        this._init();
    }

    _init() {
        this.storageManager = new StorageManager();
        this.loadLevel(this.levelId);
    }

    loadLevel(levelId) {
        this.levelId = levelId;
        this.levelData = LEVELS.getLevel(levelId);
        
        this.gameMap = new GameMap(this.levelData);
        this.pathFinder = new PathFinder(this.gameMap);
        this.eventManager = new EventManager(this.gameMap, this.levelData);
        
        this.stateMachine = new StateMachine();
        this.missionStateMachine = new MissionStateMachine();
        this.scoringSystem = new ScoringSystem();
        this.timer = new GameTimer();
        
        this._initResources();
        
        const canvas = document.getElementById('game-canvas');
        this.renderer = new GameRenderer(canvas, this.gameMap);
        this.renderer.setGameInstance(this);
        
        if (!this.ui) {
            this.ui = new UI(this);
        }
        
        this._updateUI();
        this._setupEventListeners();
        
        this.reset();
        
        this.renderer.start();
    }

    _initResources() {
        const resources = this.levelData.resources;
        
        this.volunteer = new VolunteerResource();
        if (resources.volunteerStart) {
            this.volunteer.setPosition(resources.volunteerStart.x, resources.volunteerStart.y);
        }
        
        this.ambulance = new AmbulanceResource();
        if (resources.ambulanceStart) {
            this.ambulance.setPosition(resources.ambulanceStart.x, resources.ambulanceStart.y);
        }
        
        this.aed = new AEDResource();
        this.aed.setPosition(-1, -1);
    }

    _setupEventListeners() {
        this.stateMachine.on('stateChange', (data) => {
            this._onStateChange(data.oldState, data.newState);
        });
        
        this.missionStateMachine.on('missionStart', (data) => {
            this._onMissionStart(data.mission);
        });
        
        this.missionStateMachine.on('missionComplete', (data) => {
            this._onMissionComplete(data.mission, data.score);
        });
        
        this.missionStateMachine.on('missionFail', (data) => {
            this._onMissionFail(data.mission, data.reason);
        });
        
        this.timer.onTick((time) => {
            this._onTimerTick(time);
        });
    }

    _onStateChange(oldState, newState) {
        this.ui.updateButtonStates();
        
        if (newState === CONFIG.STATES.RUNNING) {
            this.addLog('游戏开始！请调度志愿者前往AED存放点取机');
        } else if (newState === CONFIG.STATES.PAUSED) {
            this.addLog('游戏已暂停', 'warning');
        } else if (newState === CONFIG.STATES.COMPLETED) {
            this._onGameComplete();
        } else if (newState === CONFIG.STATES.FAILED) {
            this._onGameFailed();
        }
    }

    _onMissionStart(missionName) {
        const currentTime = this.timer.getTime();
        this.ui.updateMissionStatus(missionName, 'active', currentTime);
        
        const missionNames = {
            fetch: '取机任务开始',
            arrive: '到场任务开始',
            defibrillate: '除颤任务开始',
            handover: '交接任务开始'
        };
        this.addLog(missionNames[missionName] || '任务开始');
    }

    _onMissionComplete(missionName, score) {
        const currentTime = this.timer.getTime();
        this.ui.updateMissionStatus(missionName, 'completed', currentTime);
        
        const missionNames = {
            fetch: '取机任务完成',
            arrive: '到场任务完成',
            defibrillate: '除颤任务完成',
            handover: '交接任务完成'
        };
        this.addLog(`${missionNames[missionName] || '任务完成'}，获得${score}分`, 'success');
        
        this._updateScore();
    }

    _onMissionFail(missionName, reason) {
        const currentTime = this.timer.getTime();
        this.ui.updateMissionStatus(missionName, 'failed', currentTime);
        
        const missionNames = {
            fetch: '取机任务失败',
            arrive: '到场任务失败',
            defibrillate: '除颤任务失败',
            handover: '交接任务失败'
        };
        this.addLog(`${missionNames[missionName] || '任务失败'}: ${reason}`, 'error');
        
        this.stateMachine.transition(CONFIG.STATES.FAILED);
    }

    _onTimerTick(time) {
        this.ui.updateTimer(time);
        
        this._checkMissionTimeouts(time);
        
        if (this.timer.isTimeUp()) {
            this.addLog('时间耗尽！救援失败', 'error');
            this.stateMachine.transition(CONFIG.STATES.FAILED);
        }
    }

    _checkMissionTimeouts(time) {
        const activeMission = this.missionStateMachine.getCurrentActiveMission();
        if (activeMission) {
            this.missionStateMachine.checkMissionTimeout(activeMission, time);
        }
    }

    _onGameComplete() {
        this.timer.stop();
        
        const finalScore = this.scoringSystem.calculateScoreFromMissions(this.missionStateMachine);
        const grade = this.scoringSystem.getGrade();
        
        this.storageManager.saveHighScore(finalScore, this.levelId);
        this._updateHighScore();
        
        const replayData = this.storageManager.createReplayData(this);
        this.storageManager.saveGameRecord(replayData);
        
        const title = '救援成功！';
        const message = `最终分数: ${finalScore}分 (${grade.label})`;
        
        this.ui.showOverlay(title, message);
        this.addLog(`救援成功！最终分数: ${finalScore}分`, 'success');
    }

    _onGameFailed() {
        this.timer.stop();
        
        const finalScore = this.scoringSystem.calculateScoreFromMissions(this.missionStateMachine);
        
        const replayData = this.storageManager.createReplayData(this);
        this.storageManager.saveGameRecord(replayData);
        
        const title = '救援失败';
        const message = `最终分数: ${finalScore}分`;
        
        this.ui.showOverlay(title, message);
        this.addLog('救援失败，请重新尝试', 'error');
    }

    start() {
        if (this.stateMachine.isIdle()) {
            this.stateMachine.transition(CONFIG.STATES.PREPARING);
        }
        
        if (this.stateMachine.isPreparing() || this.stateMachine.isPaused()) {
            this.stateMachine.transition(CONFIG.STATES.RUNNING);
            
            if (this.stateMachine.isPreparing()) {
                this.missionStateMachine.startMission('fetch', 0);
            }
            
            this.timer.start();
            this.lastFrameTime = performance.now();
        }
    }

    pause() {
        if (this.stateMachine.isRunning()) {
            this.stateMachine.transition(CONFIG.STATES.PAUSED);
            this.timer.pause();
        }
    }

    resume() {
        if (this.stateMachine.isPaused()) {
            this.stateMachine.transition(CONFIG.STATES.RUNNING);
            this.timer.resume();
            this.lastFrameTime = performance.now();
        }
    }

    restart() {
        this.reset();
        this.stateMachine.transition(CONFIG.STATES.IDLE);
    }

    reset() {
        this.timer.reset();
        this.stateMachine.reset();
        this.missionStateMachine.reset();
        this.scoringSystem.reset();
        this.eventManager.reset();
        
        this._initResources();
        
        this.selectedAEDLocation = null;
        this.volunteerTarget = null;
        this.ambulanceTarget = null;
        this.logEntries = [];
        
        this.ui.reset();
        this._updateUI();
    }

    update(deltaTime) {
        if (!this.stateMachine.isRunning()) return;
        
        this._updateVolunteer(deltaTime);
        this._updateAmbulance(deltaTime);
    }

    _updateVolunteer(deltaTime) {
        if (!this.volunteer) return;
        
        if (this.volunteer.updateDelay(deltaTime)) {
            this.addLog('志愿者延误结束，继续移动');
        }
        
        if (this.volunteer.isFetching) {
            if (this.volunteer.updateFetching(deltaTime)) {
                this.addLog('志愿者已取到AED', 'success');
                
                const currentTime = this.timer.getTime();
                this.missionStateMachine.completeMission('fetch', currentTime);
                
                this.missionStateMachine.startMission('arrive', currentTime);
                
                this._moveVolunteerToPatient();
            }
            return;
        }
        
        if (this.volunteer.isMoving) {
            const arrived = this.volunteer.move(deltaTime);
            
            if (arrived) {
                this._checkVolunteerArrival();
            } else {
                this._checkVolunteerEvents();
            }
        }
        
        if (this.volunteer.hasAED && this.volunteer.atPatient && this.aed) {
            if (this.aed.isDefibrillating) {
                const defibComplete = this.aed.updateDefibrillation(deltaTime);
                if (defibComplete) {
                    this.addLog('除颤完成！', 'success');
                    const currentTime = this.timer.getTime();
                    this.missionStateMachine.completeMission('defibrillate', currentTime);
                }
            }
        }
    }

    _checkVolunteerArrival() {
        const gridX = this.volunteer.gridX;
        const gridY = this.volunteer.gridY;
        
        const aedLocations = this.gameMap.getAllAEDLocations();
        for (const aedLoc of aedLocations) {
            if (aedLoc.x === gridX && aedLoc.y === gridY) {
                if (!this.volunteer.hasAED) {
                    this.addLog(`志愿者到达${aedLoc.name}，正在取AED...`);
                    this.volunteer.isFetching = true;
                    this.volunteer.fetchProgress = 0;
                    
                    this.aed.setPosition(gridX, gridY);
                    this.aed.locationName = aedLoc.name;
                }
                return;
            }
        }
        
        const patient = this.gameMap.getPatientPosition();
        if (patient && patient.x === gridX && patient.y === gridY) {
            if (this.volunteer.hasAED) {
                this.addLog('志愿者到达患者位置', 'success');
                this.volunteer.atPatient = true;
                
                const currentTime = this.timer.getTime();
                this.missionStateMachine.completeMission('arrive', currentTime);
                
                this.missionStateMachine.startMission('defibrillate', currentTime);
                
                if (this.aed && !this.aed.disabled) {
                    this.addLog('开始除颤...');
                    this.aed.startDefibrillation();
                } else {
                    this.addLog('AED无法使用，除颤失败！', 'error');
                    this.missionStateMachine.failMission('defibrillate', currentTime, 'AED故障');
                }
            }
        }
    }

    _checkVolunteerEvents() {
        const gridX = Math.round(this.volunteer.x);
        const gridY = Math.round(this.volunteer.y);
        
        const event = this.eventManager.checkPositionForEvent(gridX, gridY, 'volunteer');
        if (event) {
            const effect = this.eventManager.getEventEffect(event);
            
            switch (effect.type) {
                case 'delay':
                    this.addLog(effect.message, 'warning');
                    this.volunteer.addDelay(effect.delay);
                    this.eventManager.handleEvent(event.id);
                    break;
                case 'fail':
                    this.addLog(effect.message, 'error');
                    this.stateMachine.transition(CONFIG.STATES.FAILED);
                    break;
                case 'disable':
                    if (this.volunteer.hasAED && this.aed) {
                        this.addLog(effect.message, 'error');
                        this.aed.disabled = true;
                        this.eventManager.handleEvent(event.id);
                    }
                    break;
            }
        }
    }

    _updateAmbulance(deltaTime) {
        if (!this.ambulance) return;
        
        if (this.ambulance.updateDelay(deltaTime)) {
            this.addLog('救护车延误结束，继续移动');
        }
        
        if (this.ambulance.isMoving) {
            const arrived = this.ambulance.move(deltaTime);
            
            if (arrived) {
                const patient = this.gameMap.getPatientPosition();
                if (patient && 
                    this.ambulance.gridX === patient.x && 
                    this.ambulance.gridY === patient.y) {
                    
                    this.addLog('救护车到达患者位置', 'success');
                    this.ambulance.arrived = true;
                    
                    const currentTime = this.timer.getTime();
                    this.missionStateMachine.completeMission('handover', currentTime);
                    
                    if (this.missionStateMachine.areAllMissionsCompleted()) {
                        this.stateMachine.transition(CONFIG.STATES.COMPLETED);
                    }
                }
            } else {
                this._checkAmbulanceEvents();
            }
        }
    }

    _checkAmbulanceEvents() {
        const gridX = Math.round(this.ambulance.x);
        const gridY = Math.round(this.ambulance.y);
        
        const event = this.eventManager.checkPositionForEvent(gridX, gridY, 'ambulance');
        if (event) {
            const effect = this.eventManager.getEventEffect(event);
            
            switch (effect.type) {
                case 'delay':
                    this.addLog(effect.message, 'warning');
                    this.ambulance.addDelay(effect.delay);
                    this.eventManager.handleEvent(event.id);
                    break;
                case 'fail':
                    this.addLog(effect.message, 'error');
                    this.stateMachine.transition(CONFIG.STATES.FAILED);
                    break;
            }
        }
    }

    handleMapClick(gridX, gridY) {
        if (!this.stateMachine.isRunning()) return;
        
        const aedLocations = this.gameMap.getAllAEDLocations();
        for (const aedLoc of aedLocations) {
            if (aedLoc.x === gridX && aedLoc.y === gridY) {
                if (!this.volunteer.hasAED) {
                    this._moveVolunteerToAED(aedLoc);
                }
                return;
            }
        }
        
        const patient = this.gameMap.getPatientPosition();
        if (patient && patient.x === gridX && patient.y === gridY) {
            if (this.volunteer.hasAED && !this.volunteer.atPatient) {
                this._moveVolunteerToPatient();
            }
            return;
        }
    }

    handleResourcePlacement(resourceType, gridX, gridY) {
        if (!this.stateMachine.isRunning()) return;
        
        switch (resourceType) {
            case 'aed':
                this.addLog('请点击AED存放点来选择使用哪个AED');
                break;
            case 'volunteer':
                this.addLog('请点击地图上的目标位置来移动志愿者');
                break;
            case 'ambulance':
                this._callAmbulance();
                break;
        }
    }

    _moveVolunteerToAED(aedLocation) {
        const path = this.pathFinder.findPath(
            this.volunteer.gridX,
            this.volunteer.gridY,
            aedLocation.x,
            aedLocation.y
        );
        
        if (path && path.length > 0) {
            this.volunteer.setPath(path);
            this.addLog(`志愿者正在前往${aedLocation.name}`);
        } else {
            this.addLog('无法找到前往AED存放点的路径', 'warning');
        }
    }

    _moveVolunteerToPatient() {
        const patient = this.gameMap.getPatientPosition();
        if (!patient) return;
        
        const path = this.pathFinder.findPath(
            this.volunteer.gridX,
            this.volunteer.gridY,
            patient.x,
            patient.y
        );
        
        if (path && path.length > 0) {
            this.volunteer.setPath(path);
            this.addLog('志愿者正在前往患者位置');
        } else {
            this.addLog('无法找到前往患者的路径', 'warning');
        }
    }

    _callAmbulance() {
        if (this.ambulance.arrived) {
            this.addLog('救护车已到达');
            return;
        }
        
        if (this.ambulance.isMoving) {
            this.addLog('救护车正在途中');
            return;
        }
        
        const defibrillateMission = this.missionStateMachine.getMission('defibrillate');
        if (defibrillateMission && (defibrillateMission.completed || defibrillateMission.state === 'active')) {
            const patient = this.gameMap.getPatientPosition();
            if (patient) {
                const path = this.pathFinder.findPath(
                    this.ambulance.gridX,
                    this.ambulance.gridY,
                    patient.x,
                    patient.y
                );
                
                if (path && path.length > 0) {
                    this.ambulance.setPath(path);
                    
                    const currentTime = this.timer.getTime();
                    this.missionStateMachine.startMission('handover', currentTime);
                    
                    this.addLog('救护车已派遣，正在前往患者位置');
                }
            }
        } else {
            this.addLog('请先完成除颤任务后再呼叫救护车', 'warning');
        }
    }

    _updateUI() {
        if (this.ui) {
            this.ui.updateLevelName(this.levelData?.name || '');
            this._updateHighScore();
            this.ui.updateButtonStates();
        }
    }

    _updateHighScore() {
        const highScore = this.storageManager.getHighScore(this.levelId);
        this.ui.updateHighScore(highScore.score);
    }

    _updateScore() {
        const score = this.missionStateMachine.getTotalScore();
        this.ui.updateScore(score);
    }

    addLog(message, type = 'info') {
        this.logEntries.push({
            message,
            type,
            time: this.timer?.getTime() || 0
        });
        
        if (this.ui) {
            this.ui.addLog(message, type);
        }
    }

    exportReplay() {
        const replayData = this.storageManager.createReplayData(this);
        const jsonStr = this.storageManager.exportGameRecordToJSON(replayData);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `replay_${this.levelId}_${timestamp}.json`;
        
        Utils.downloadJSON(replayData, filename);
        this.addLog(`已导出复盘数据: ${filename}`, 'success');
    }

    getState() {
        return {
            levelId: this.levelId,
            levelData: Utils.deepClone(this.levelData),
            stateMachine: this.stateMachine.getState(),
            missionStateMachine: this.missionStateMachine.getState(),
            scoringSystem: this.scoringSystem.getState(),
            timer: this.timer.getState(),
            eventManager: this.eventManager.getState(),
            volunteer: this.volunteer ? this.volunteer.getState() : null,
            ambulance: this.ambulance ? this.ambulance.getState() : null,
            aed: this.aed ? this.aed.getState() : null,
            logEntries: [...this.logEntries]
        };
    }
}

window.Game = Game;