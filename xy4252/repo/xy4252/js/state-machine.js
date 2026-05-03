class StateMachine {
    constructor() {
        this.currentState = CONFIG.STATES.IDLE;
        this.previousState = null;
        this.listeners = {};
        
        this.validTransitions = {
            [CONFIG.STATES.IDLE]: [CONFIG.STATES.PREPARING],
            [CONFIG.STATES.PREPARING]: [CONFIG.STATES.RUNNING, CONFIG.STATES.IDLE],
            [CONFIG.STATES.RUNNING]: [CONFIG.STATES.PAUSED, CONFIG.STATES.COMPLETED, CONFIG.STATES.FAILED],
            [CONFIG.STATES.PAUSED]: [CONFIG.STATES.RUNNING, CONFIG.STATES.IDLE],
            [CONFIG.STATES.COMPLETED]: [CONFIG.STATES.IDLE],
            [CONFIG.STATES.FAILED]: [CONFIG.STATES.IDLE]
        };
    }

    transition(newState) {
        if (!this.canTransition(newState)) {
            console.warn(`Invalid transition: ${this.currentState} -> ${newState}`);
            return false;
        }
        
        this.previousState = this.currentState;
        const oldState = this.currentState;
        this.currentState = newState;
        
        this._emit('stateChange', {
            oldState: oldState,
            newState: newState
        });
        
        this._emit(`enter:${newState}`, { from: oldState });
        this._emit(`leave:${oldState}`, { to: newState });
        
        return true;
    }

    canTransition(newState) {
        const validNextStates = this.validTransitions[this.currentState] || [];
        return validNextStates.includes(newState);
    }

    getCurrentState() {
        return this.currentState;
    }

    getPreviousState() {
        return this.previousState;
    }

    isIdle() {
        return this.currentState === CONFIG.STATES.IDLE;
    }

    isPreparing() {
        return this.currentState === CONFIG.STATES.PREPARING;
    }

    isRunning() {
        return this.currentState === CONFIG.STATES.RUNNING;
    }

    isPaused() {
        return this.currentState === CONFIG.STATES.PAUSED;
    }

    isCompleted() {
        return this.currentState === CONFIG.STATES.COMPLETED;
    }

    isFailed() {
        return this.currentState === CONFIG.STATES.FAILED;
    }

    isEnded() {
        return this.isCompleted() || this.isFailed();
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        
        if (callback) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        } else {
            delete this.listeners[event];
        }
    }

    _emit(event, data) {
        if (!this.listeners[event]) return;
        
        this.listeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in state listener for ${event}:`, error);
            }
        });
    }

    reset() {
        this.currentState = CONFIG.STATES.IDLE;
        this.previousState = null;
    }

    getState() {
        return {
            currentState: this.currentState,
            previousState: this.previousState
        };
    }

    restoreState(state) {
        if (state) {
            this.currentState = state.currentState || CONFIG.STATES.IDLE;
            this.previousState = state.previousState;
        }
    }
}

class MissionStateMachine {
    constructor() {
        this.missions = {
            fetch: {
                state: 'pending',
                startTime: null,
                endTime: null,
                timeLimit: CONFIG.MISSIONS.FETCH.timeLimit,
                maxPoints: CONFIG.MISSIONS.FETCH.maxPoints,
                completed: false,
                failed: false,
                score: 0
            },
            arrive: {
                state: 'pending',
                startTime: null,
                endTime: null,
                timeLimit: CONFIG.MISSIONS.ARRIVE.timeLimit,
                maxPoints: CONFIG.MISSIONS.ARRIVE.maxPoints,
                completed: false,
                failed: false,
                score: 0
            },
            defibrillate: {
                state: 'pending',
                startTime: null,
                endTime: null,
                timeLimit: CONFIG.MISSIONS.DEFIBRILLATE.timeLimit,
                maxPoints: CONFIG.MISSIONS.DEFIBRILLATE.maxPoints,
                completed: false,
                failed: false,
                score: 0
            },
            handover: {
                state: 'pending',
                startTime: null,
                endTime: null,
                timeLimit: CONFIG.MISSIONS.HANDOVER.timeLimit,
                maxPoints: CONFIG.MISSIONS.HANDOVER.maxPoints,
                completed: false,
                failed: false,
                score: 0
            }
        };
        
        this.missionOrder = ['fetch', 'arrive', 'defibrillate', 'handover'];
        this.listeners = {};
    }

    startMission(missionName, currentTime) {
        const mission = this.missions[missionName];
        if (!mission || mission.state !== 'pending') {
            return false;
        }
        
        mission.state = 'active';
        mission.startTime = currentTime;
        
        this._emit('missionStart', {
            mission: missionName,
            missionData: mission
        });
        
        return true;
    }

    completeMission(missionName, currentTime) {
        const mission = this.missions[missionName];
        if (!mission || mission.state !== 'active') {
            return false;
        }
        
        mission.state = 'completed';
        mission.endTime = currentTime;
        mission.completed = true;
        
        const timeTaken = currentTime - mission.startTime;
        mission.score = this._calculateMissionScore(mission, timeTaken);
        
        this._emit('missionComplete', {
            mission: missionName,
            missionData: mission,
            timeTaken: timeTaken,
            score: mission.score
        });
        
        return true;
    }

    failMission(missionName, currentTime, reason = '') {
        const mission = this.missions[missionName];
        if (!mission || mission.state === 'completed' || mission.state === 'failed') {
            return false;
        }
        
        mission.state = 'failed';
        mission.endTime = currentTime;
        mission.failed = true;
        mission.score = 0;
        
        this._emit('missionFail', {
            mission: missionName,
            missionData: mission,
            reason: reason
        });
        
        return true;
    }

    checkMissionTimeout(missionName, currentTime) {
        const mission = this.missions[missionName];
        if (!mission || mission.state !== 'active') {
            return false;
        }
        
        if (mission.startTime !== null && 
            currentTime - mission.startTime > mission.timeLimit) {
            this.failMission(missionName, currentTime, '超时');
            return true;
        }
        
        return false;
    }

    _calculateMissionScore(mission, timeTaken) {
        if (timeTaken <= 0) return mission.maxPoints;
        
        const ratio = timeTaken / mission.timeLimit;
        
        if (ratio <= 0.5) {
            return mission.maxPoints;
        } else if (ratio <= 0.75) {
            return Math.round(mission.maxPoints * 0.8);
        } else if (ratio <= 0.9) {
            return Math.round(mission.maxPoints * 0.5);
        } else if (ratio <= 1) {
            return Math.round(mission.maxPoints * 0.2);
        }
        
        return 0;
    }

    getMission(missionName) {
        return this.missions[missionName] ? { ...this.missions[missionName] } : null;
    }

    getAllMissions() {
        return Utils.deepClone(this.missions);
    }

    getNextPendingMission() {
        for (const missionName of this.missionOrder) {
            if (this.missions[missionName].state === 'pending') {
                return missionName;
            }
        }
        return null;
    }

    getCurrentActiveMission() {
        for (const missionName of this.missionOrder) {
            if (this.missions[missionName].state === 'active') {
                return missionName;
            }
        }
        return null;
    }

    areAllMissionsCompleted() {
        return this.missionOrder.every(name => this.missions[name].completed);
    }

    hasAnyMissionFailed() {
        return this.missionOrder.some(name => this.missions[name].failed);
    }

    getTotalScore() {
        return this.missionOrder.reduce((total, name) => {
            return total + this.missions[name].score;
        }, 0);
    }

    on(event, callback) {
        if (!this.listeners[event]) {
            this.listeners[event] = [];
        }
        this.listeners[event].push(callback);
    }

    off(event, callback) {
        if (!this.listeners[event]) return;
        
        if (callback) {
            this.listeners[event] = this.listeners[event].filter(cb => cb !== callback);
        } else {
            delete this.listeners[event];
        }
    }

    _emit(event, data) {
        if (!this.listeners[event]) return;
        
        this.listeners[event].forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error(`Error in mission listener for ${event}:`, error);
            }
        });
    }

    reset() {
        this.missionOrder.forEach(name => {
            this.missions[name] = {
                state: 'pending',
                startTime: null,
                endTime: null,
                timeLimit: this.missions[name].timeLimit,
                maxPoints: this.missions[name].maxPoints,
                completed: false,
                failed: false,
                score: 0
            };
        });
    }

    getState() {
        return {
            missions: Utils.deepClone(this.missions),
            missionOrder: [...this.missionOrder]
        };
    }

    restoreState(state) {
        if (state && state.missions) {
            this.missions = Utils.deepClone(state.missions);
        }
    }
}

window.StateMachine = StateMachine;
window.MissionStateMachine = MissionStateMachine;