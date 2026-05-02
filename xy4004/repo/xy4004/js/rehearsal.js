(function(global) {
    'use strict';

    const RehearsalManager = {
        isRunning: false,
        isPaused: false,
        startTime: null,
        pauseStartTime: null,
        totalPausedTime: 0,
        currentCueIndex: -1,
        cues: [],
        timerInterval: null,
        listeners: [],
        elapsedTime: 0,

        init: function() {
            this.isRunning = false;
            this.isPaused = false;
            this.startTime = null;
            this.pauseStartTime = null;
            this.totalPausedTime = 0;
            this.currentCueIndex = -1;
            this.cues = [];
            this.elapsedTime = 0;
            this.stopTimer();
            this.listeners = [];
        },

        startRehearsal: function(cues) {
            if (!cues || cues.length === 0) {
                this.triggerError('没有可排练的 Cue');
                return false;
            }

            this.cues = cues.map(cue => ({
                ...cue,
                actualStartTime: null,
                actualEndTime: null,
                status: 'pending'
            }));

            this.isRunning = true;
            this.isPaused = false;
            this.startTime = Date.now();
            this.totalPausedTime = 0;
            this.currentCueIndex = -1;
            this.elapsedTime = 0;

            this.startTimer();
            this.moveToNextCue();
            this.notifyListeners('start', { startTime: this.startTime });

            return true;
        },

        pauseRehearsal: function() {
            if (!this.isRunning || this.isPaused) return false;

            this.isPaused = true;
            this.pauseStartTime = Date.now();
            this.stopTimer();
            this.notifyListeners('pause', { pauseTime: this.pauseStartTime });

            return true;
        },

        resumeRehearsal: function() {
            if (!this.isRunning || !this.isPaused) return false;

            const pauseEndTime = Date.now();
            this.totalPausedTime += (pauseEndTime - this.pauseStartTime);
            this.isPaused = false;
            this.startTimer();
            this.notifyListeners('resume', { resumeTime: pauseEndTime, pausedDuration: this.totalPausedTime });

            return true;
        },

        stopRehearsal: function() {
            if (!this.isRunning) return null;

            this.isRunning = false;
            this.isPaused = false;
            this.stopTimer();

            if (this.currentCueIndex >= 0 && this.currentCueIndex < this.cues.length) {
                const currentCue = this.cues[this.currentCueIndex];
                if (currentCue.actualStartTime !== null && currentCue.actualEndTime === null) {
                    currentCue.actualEndTime = this.getRehearsalElapsedTime();
                    currentCue.status = 'completed';
                }
            }

            const summary = this.generateSummary();
            this.notifyListeners('stop', { summary: summary });

            return summary;
        },

        moveToNextCue: function() {
            if (!this.isRunning) return false;

            if (this.currentCueIndex >= 0 && this.currentCueIndex < this.cues.length) {
                const currentCue = this.cues[this.currentCueIndex];
                if (currentCue.actualStartTime !== null && currentCue.actualEndTime === null) {
                    currentCue.actualEndTime = this.getRehearsalElapsedTime();
                    currentCue.status = 'completed';
                }
            }

            if (this.currentCueIndex >= this.cues.length - 1) {
                this.stopRehearsal();
                return false;
            }

            this.currentCueIndex++;
            const nextCue = this.cues[this.currentCueIndex];
            nextCue.actualStartTime = this.getRehearsalElapsedTime();
            nextCue.status = 'active';

            this.notifyListeners('cueChange', {
                cue: nextCue,
                index: this.currentCueIndex,
                isFirst: this.currentCueIndex === 0,
                isLast: this.currentCueIndex === this.cues.length - 1
            });

            return true;
        },

        moveToPrevCue: function() {
            if (!this.isRunning || this.currentCueIndex <= 0) return false;

            if (this.currentCueIndex >= 0 && this.currentCueIndex < this.cues.length) {
                const currentCue = this.cues[this.currentCueIndex];
                currentCue.actualStartTime = null;
                currentCue.actualEndTime = null;
                currentCue.status = 'pending';
            }

            this.currentCueIndex--;
            const prevCue = this.cues[this.currentCueIndex];
            prevCue.actualStartTime = this.getRehearsalElapsedTime();
            prevCue.actualEndTime = null;
            prevCue.status = 'active';

            this.notifyListeners('cueChange', {
                cue: prevCue,
                index: this.currentCueIndex,
                isFirst: this.currentCueIndex === 0,
                isLast: this.currentCueIndex === this.cues.length - 1
            });

            return true;
        },

        jumpToCue: function(index) {
            if (!this.isRunning || index < 0 || index >= this.cues.length) return false;

            for (let i = 0; i < this.cues.length; i++) {
                if (i < index) {
                    this.cues[i].status = 'completed';
                    if (this.cues[i].actualStartTime === null) {
                        this.cues[i].actualStartTime = this.cues[i].startTime;
                    }
                    if (this.cues[i].actualEndTime === null) {
                        this.cues[i].actualEndTime = this.cues[i].startTime + (this.cues[i].duration || 0);
                    }
                } else if (i === index) {
                    this.cues[i].actualStartTime = this.getRehearsalElapsedTime();
                    this.cues[i].actualEndTime = null;
                    this.cues[i].status = 'active';
                } else {
                    this.cues[i].actualStartTime = null;
                    this.cues[i].actualEndTime = null;
                    this.cues[i].status = 'pending';
                }
            }

            this.currentCueIndex = index;

            this.notifyListeners('cueChange', {
                cue: this.cues[index],
                index: index,
                isFirst: index === 0,
                isLast: index === this.cues.length - 1
            });

            return true;
        },

        getCurrentCue: function() {
            if (this.currentCueIndex < 0 || this.currentCueIndex >= this.cues.length) {
                return null;
            }
            return this.cues[this.currentCueIndex];
        },

        getRehearsalElapsedTime: function() {
            if (!this.startTime) return 0;
            
            let currentTime;
            if (this.isPaused && this.pauseStartTime) {
                currentTime = this.pauseStartTime;
            } else {
                currentTime = Date.now();
            }

            const totalElapsed = currentTime - this.startTime - this.totalPausedTime;
            return Math.floor(totalElapsed / 1000);
        },

        getCurrentCueElapsedTime: function() {
            const currentCue = this.getCurrentCue();
            if (!currentCue || currentCue.actualStartTime === null) {
                return 0;
            }

            const now = this.getRehearsalElapsedTime();
            return now - currentCue.actualStartTime;
        },

        startTimer: function() {
            this.stopTimer();
            this.timerInterval = setInterval(() => {
                this.elapsedTime = this.getRehearsalElapsedTime();
                this.notifyListeners('tick', {
                    elapsedTime: this.elapsedTime,
                    currentCueElapsed: this.getCurrentCueElapsedTime(),
                    currentCue: this.getCurrentCue()
                });
            }, 1000);
        },

        stopTimer: function() {
            if (this.timerInterval) {
                clearInterval(this.timerInterval);
                this.timerInterval = null;
            }
        },

        generateSummary: function() {
            const summary = {
                startTime: this.startTime,
                endTime: Date.now(),
                totalDuration: this.getRehearsalElapsedTime(),
                totalPausedTime: this.totalPausedTime,
                cues: []
            };

            this.cues.forEach((cue, index) => {
                const expectedDuration = cue.duration || 0;
                let actualDuration = 0;

                if (cue.actualStartTime !== null && cue.actualEndTime !== null) {
                    actualDuration = cue.actualEndTime - cue.actualStartTime;
                } else if (cue.actualStartTime !== null) {
                    actualDuration = this.getRehearsalElapsedTime() - cue.actualStartTime;
                }

                const startDeviation = cue.actualStartTime !== null 
                    ? cue.actualStartTime - cue.startTime 
                    : null;

                const durationDeviation = actualDuration - expectedDuration;

                summary.cues.push({
                    ...cue,
                    index: index,
                    expectedStartTime: cue.startTime,
                    expectedDuration: expectedDuration,
                    actualStartTime: cue.actualStartTime,
                    actualEndTime: cue.actualEndTime,
                    actualDuration: actualDuration,
                    startDeviation: startDeviation,
                    durationDeviation: durationDeviation,
                    status: cue.status
                });
            });

            return summary;
        },

        subscribe: function(listener) {
            this.listeners.push(listener);
            return () => {
                const index = this.listeners.indexOf(listener);
                if (index > -1) {
                    this.listeners.splice(index, 1);
                }
            };
        },

        notifyListeners: function(event, data) {
            this.listeners.forEach(listener => {
                try {
                    listener(event, data);
                } catch (e) {
                    console.error('Rehearsal listener error:', e);
                }
            });
        },

        triggerError: function(message) {
            console.error('Rehearsal Error:', message);
            this.notifyListeners('error', { message: message });
        },

        getStatus: function() {
            return {
                isRunning: this.isRunning,
                isPaused: this.isPaused,
                currentCueIndex: this.currentCueIndex,
                totalCues: this.cues.length,
                elapsedTime: this.elapsedTime,
                totalPausedTime: this.totalPausedTime
            };
        },

        getAllCues: function() {
            return [...this.cues];
        },

        formatDeviation: function(deviation) {
            if (deviation === null || deviation === undefined) {
                return '--:--';
            }

            const isPositive = deviation > 0;
            const absDeviation = Math.abs(deviation);
            const m = Math.floor(absDeviation / 60);
            const s = Math.floor(absDeviation % 60);

            const sign = isPositive ? '+' : '-';
            return `${sign}${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
        },

        getDeviationClass: function(deviation) {
            if (deviation === null || deviation === undefined) {
                return 'deviation-zero';
            }
            if (deviation > 0) {
                return 'deviation-positive';
            }
            if (deviation < 0) {
                return 'deviation-negative';
            }
            return 'deviation-zero';
        }
    };

    RehearsalManager.init();
    global.RehearsalManager = RehearsalManager;

})(window);
