
const TIMER_STATES = {
    IDLE: 'idle',
    RUNNING: 'running',
    PAUSED: 'paused',
    COMPLETED: 'completed'
};

class TimerState {
    constructor(duration = 60) {
        this.state = TIMER_STATES.IDLE;
        this.duration = duration * 1000;
        this.elapsedTime = 0;
        this.startTime = null;
        this.pauseTime = null;
        this.lastUpdateTime = null;
        this.tickCallbacks = [];
        this.stateChangeCallbacks = [];
        this.completionCallbacks = [];
        this.animationFrameId = null;
    }

    getCurrentState() {
        return {
            state: this.state,
            duration: this.duration,
            elapsedTime: this.elapsedTime,
            remainingTime: Math.max(0, this.duration - this.elapsedTime),
            formattedTime: this.formatTime(Math.max(0, this.duration - this.elapsedTime)),
            formattedElapsed: this.formatTime(this.elapsedTime)
        };
    }

    formatTime(ms) {
        const minutes = Math.floor(ms / 60000);
        const seconds = Math.floor((ms % 60000) / 1000);
        const centiseconds = Math.floor((ms % 1000) / 10);
        
        return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(centiseconds).padStart(2, '0')}`;
    }

    setDuration(seconds) {
        if (this.state === TIMER_STATES.RUNNING) {
            throw new Error('Cannot change duration while timer is running');
        }
        this.duration = seconds * 1000;
        this.elapsedTime = 0;
        this.notifyTick();
    }

    start() {
        if (this.state === TIMER_STATES.RUNNING) return;

        const previousState = this.state;
        this.state = TIMER_STATES.RUNNING;
        
        if (previousState === TIMER_STATES.PAUSED) {
            this.startTime = performance.now() - this.elapsedTime;
        } else {
            this.startTime = performance.now();
            this.elapsedTime = 0;
        }
        
        this.lastUpdateTime = this.startTime;
        this.notifyStateChange(previousState, this.state);
        this.startTickLoop();
    }

    pause() {
        if (this.state !== TIMER_STATES.RUNNING) return;

        const previousState = this.state;
        this.pauseTime = performance.now();
        this.elapsedTime = this.pauseTime - this.startTime;
        this.state = TIMER_STATES.PAUSED;
        
        this.stopTickLoop();
        this.notifyStateChange(previousState, this.state);
        this.notifyTick();
    }

    reset() {
        const previousState = this.state;
        this.stopTickLoop();
        
        this.state = TIMER_STATES.IDLE;
        this.elapsedTime = 0;
        this.startTime = null;
        this.pauseTime = null;
        this.lastUpdateTime = null;
        
        this.notifyStateChange(previousState, this.state);
        this.notifyTick();
    }

    restart() {
        this.reset();
        this.start();
    }

    startTickLoop() {
        const tick = (currentTime) => {
            if (this.state !== TIMER_STATES.RUNNING) return;

            this.elapsedTime = currentTime - this.startTime;
            
            if (this.elapsedTime >= this.duration) {
                this.elapsedTime = this.duration;
                this.complete();
                return;
            }

            this.notifyTick();
            this.animationFrameId = requestAnimationFrame(tick);
        };

        this.animationFrameId = requestAnimationFrame(tick);
    }

    stopTickLoop() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }

    complete() {
        const previousState = this.state;
        this.stopTickLoop();
        this.state = TIMER_STATES.COMPLETED;
        
        this.notifyStateChange(previousState, this.state);
        this.notifyTick();
        this.notifyCompletion();
    }

    onTick(callback) {
        this.tickCallbacks.push(callback);
        return () => {
            const index = this.tickCallbacks.indexOf(callback);
            if (index > -1) {
                this.tickCallbacks.splice(index, 1);
            }
        };
    }

    onStateChange(callback) {
        this.stateChangeCallbacks.push(callback);
        return () => {
            const index = this.stateChangeCallbacks.indexOf(callback);
            if (index > -1) {
                this.stateChangeCallbacks.splice(index, 1);
            }
        };
    }

    onComplete(callback) {
        this.completionCallbacks.push(callback);
        return () => {
            const index = this.completionCallbacks.indexOf(callback);
            if (index > -1) {
                this.completionCallbacks.splice(index, 1);
            }
        };
    }

    notifyTick() {
        const state = this.getCurrentState();
        this.tickCallbacks.forEach(callback => callback(state));
    }

    notifyStateChange(previousState, newState) {
        this.stateChangeCallbacks.forEach(callback => 
            callback(previousState, newState, this.getCurrentState())
        );
    }

    notifyCompletion() {
        const state = this.getCurrentState();
        this.completionCallbacks.forEach(callback => callback(state));
    }

    isIdle() {
        return this.state === TIMER_STATES.IDLE;
    }

    isRunning() {
        return this.state === TIMER_STATES.RUNNING;
    }

    isPaused() {
        return this.state === TIMER_STATES.PAUSED;
    }

    isCompleted() {
        return this.state === TIMER_STATES.COMPLETED;
    }
}

export default TimerState;
export { TIMER_STATES };
