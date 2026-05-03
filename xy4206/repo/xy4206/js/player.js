class Player {
    constructor() {
        this.audioContext = null;
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.currentPlaybackTime = 0;
        this.playbackSpeed = 1;
        this.playTarget = true;
        this.playPerformance = true;
        this.scheduledEvents = [];
        this.onPlaybackUpdate = null;
        this.onPlaybackEnd = null;
        this.onMeasureChange = null;
        
        this.scoreData = null;
        this.performanceData = null;
        this.alignment = null;
        this.analysis = null;
        this.totalDuration = 0;
    }

    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }

    setData(score, performance, alignment, analysis) {
        this.scoreData = score;
        this.performanceData = performance;
        this.alignment = alignment;
        this.analysis = analysis;
        
        this.calculateTotalDuration();
    }

    calculateTotalDuration() {
        let maxEndTime = 0;

        if (this.scoreData && this.scoreData.measures) {
            this.scoreData.measures.forEach(measure => {
                measure.notes.forEach(note => {
                    const endTime = note.startTime + note.duration;
                    if (endTime > maxEndTime) maxEndTime = endTime;
                });
            });
        }

        if (this.performanceData && this.performanceData.notes) {
            this.performanceData.notes.forEach(note => {
                const endTime = note.endTime || (note.startTime + note.duration);
                if (endTime > maxEndTime) maxEndTime = endTime;
            });
        }

        this.totalDuration = maxEndTime + 0.5;
    }

    play(startTime = 0) {
        if (!this.scoreData && !this.performanceData) {
            return;
        }

        this.initAudioContext();
        this.scheduleEvents(startTime);

        const now = this.audioContext.currentTime;
        this.startTime = now - (startTime / this.playbackSpeed);
        this.currentPlaybackTime = startTime;
        this.isPlaying = true;
        this.isPaused = false;

        this.updatePlaybackLoop();
    }

    pause() {
        if (!this.isPlaying) return;
        
        this.pauseTime = this.currentPlaybackTime;
        this.isPlaying = false;
        this.isPaused = true;
        this.cancelScheduledEvents();
    }

    resume() {
        if (!this.isPaused) return;
        this.play(this.pauseTime);
    }

    stop() {
        this.isPlaying = false;
        this.isPaused = false;
        this.currentPlaybackTime = 0;
        this.pauseTime = 0;
        this.cancelScheduledEvents();

        if (this.onPlaybackUpdate) {
            this.onPlaybackUpdate(0, this.totalDuration);
        }
    }

    seek(time) {
        this.currentPlaybackTime = Math.max(0, Math.min(time, this.totalDuration));
        
        if (this.isPlaying) {
            this.cancelScheduledEvents();
            this.scheduleEvents(this.currentPlaybackTime);
            const now = this.audioContext.currentTime;
            this.startTime = now - (this.currentPlaybackTime / this.playbackSpeed);
        }

        if (this.onPlaybackUpdate) {
            this.onPlaybackUpdate(this.currentPlaybackTime, this.totalDuration);
        }
    }

    setSpeed(speed) {
        const wasPlaying = this.isPlaying;
        const currentTime = this.currentPlaybackTime;

        if (wasPlaying) {
            this.stop();
        }

        this.playbackSpeed = Math.max(0.5, Math.min(2, speed));

        if (wasPlaying) {
            this.play(currentTime);
        }
    }

    togglePlayTarget(enabled) {
        this.playTarget = enabled;
    }

    togglePlayPerformance(enabled) {
        this.playPerformance = enabled;
    }

    scheduleEvents(startTime) {
        this.cancelScheduledEvents();
        this.scheduledEvents = [];

        const now = this.audioContext.currentTime;
        const speed = this.playbackSpeed;

        if (this.playTarget && this.scoreData && this.scoreData.measures) {
            this.scoreData.measures.forEach(measure => {
                measure.notes.forEach(note => {
                    const noteStartTime = note.startTime;
                    
                    if (noteStartTime >= startTime - 0.1) {
                        const scheduleTime = now + (noteStartTime - startTime) / speed;
                        const duration = note.duration / speed;
                        
                        this.scheduleNote(
                            note.pitch,
                            note.velocity,
                            scheduleTime,
                            duration,
                            'target'
                        );
                    }
                });
            });
        }

        if (this.playPerformance && this.performanceData && this.performanceData.notes) {
            this.performanceData.notes.forEach(note => {
                const noteStartTime = note.startTime;
                
                if (noteStartTime >= startTime - 0.1) {
                    const scheduleTime = now + (noteStartTime - startTime) / speed;
                    const duration = note.duration / speed;
                    
                    this.scheduleNote(
                        note.pitch,
                        note.velocity,
                        scheduleTime,
                        duration,
                        'performance',
                        note.startTime < startTime
                    );
                }
            });
        }
    }

    scheduleNote(pitch, velocity, startTime, duration, type, isAlreadyPlaying = false) {
        const osc = this.audioContext.createOscillator();
        const gain = this.audioContext.createGain();
        const filter = this.audioContext.createBiquadFilter();

        const frequency = this.midiToFrequency(pitch);
        osc.frequency.setValueAtTime(frequency, startTime);

        osc.type = type === 'target' ? 'sine' : 'triangle';

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(type === 'target' ? 2000 : 1500, startTime);
        filter.Q.setValueAtTime(1, startTime);

        const normalizedVelocity = Math.max(0.1, Math.min(1, velocity / 127));
        const volume = type === 'target' ? 0.2 : 0.3;
        const attack = 0.02;
        const decay = 0.1;
        const sustain = 0.7;
        const release = 0.2;

        gain.gain.setValueAtTime(0, startTime);
        gain.gain.linearRampToValueAtTime(
            volume * normalizedVelocity,
            startTime + attack
        );
        gain.gain.linearRampToValueAtTime(
            volume * normalizedVelocity * sustain,
            startTime + attack + decay
        );

        const endTime = startTime + duration;
        gain.gain.setValueAtTime(
            volume * normalizedVelocity * sustain,
            endTime
        );
        gain.gain.exponentialRampToValueAtTime(
            0.001,
            endTime + release
        );

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.audioContext.destination);

        osc.start(startTime);
        osc.stop(endTime + release + 0.1);

        this.scheduledEvents.push({ osc, gain, filter, startTime, endTime });
    }

    cancelScheduledEvents() {
        this.scheduledEvents.forEach(event => {
            try {
                event.osc.stop();
            } catch (e) {}
            try {
                event.osc.disconnect();
            } catch (e) {}
            try {
                event.gain.disconnect();
            } catch (e) {}
            try {
                event.filter.disconnect();
            } catch (e) {}
        });
        this.scheduledEvents = [];
    }

    updatePlaybackLoop() {
        if (!this.isPlaying) return;

        const now = this.audioContext.currentTime;
        const elapsed = (now - this.startTime) * this.playbackSpeed;
        this.currentPlaybackTime = elapsed;

        if (this.onPlaybackUpdate) {
            this.onPlaybackUpdate(this.currentPlaybackTime, this.totalDuration);
        }

        if (this.onMeasureChange && this.alignment) {
            const currentMeasure = this.getCurrentMeasure();
            if (currentMeasure !== this.lastReportedMeasure) {
                this.lastReportedMeasure = currentMeasure;
                this.onMeasureChange(currentMeasure);
            }
        }

        if (this.currentPlaybackTime >= this.totalDuration) {
            this.stop();
            if (this.onPlaybackEnd) {
                this.onPlaybackEnd();
            }
            return;
        }

        requestAnimationFrame(() => this.updatePlaybackLoop());
    }

    getCurrentMeasure() {
        if (!this.alignment || !this.alignment.measures) return null;

        for (let i = 0; i < this.alignment.measures.length; i++) {
            const measure = this.alignment.measures[i];
            if (this.currentPlaybackTime >= measure.measureStartTime &&
                this.currentPlaybackTime < measure.measureEndTime) {
                return measure.measureNumber;
            }
        }

        if (this.alignment.measures.length > 0) {
            return this.alignment.measures[this.alignment.measures.length - 1].measureNumber;
        }

        return null;
    }

    getCurrentTime() {
        return this.currentPlaybackTime;
    }

    getTotalDuration() {
        return this.totalDuration;
    }

    midiToFrequency(midiNote) {
        return 440 * Math.pow(2, (midiNote - 69) / 12);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Player;
}
