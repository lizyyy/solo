class ReplayManager {
    constructor() {
        this.records = this.loadRecords();
        this.currentReplay = null;
        this.replayIndex = 0;
        this.isReplaying = false;
        this.replaySpeed = 1;
    }

    loadRecords() {
        try {
            const stored = localStorage.getItem('theater_game_history');
            if (stored) {
                const data = JSON.parse(stored);
                return data.map(d => Object.assign(new HistoryRecord(), d));
            }
        } catch (e) {
            console.error('Failed to load history:', e);
        }
        return [];
    }

    saveRecords() {
        try {
            localStorage.setItem('theater_game_history', JSON.stringify(this.records));
        } catch (e) {
            console.error('Failed to save history:', e);
        }
    }

    addRecord(levelId, levelName, state, result) {
        const schedule = this.extractSchedule(state);
        const record = new HistoryRecord(levelId, levelName, schedule, result);
        this.records.unshift(record);
        if (this.records.length > 50) {
            this.records = this.records.slice(0, 50);
        }
        this.saveRecords();
        return record;
    }

    extractSchedule(state) {
        const events = [];
        state.tracks.forEach(track => {
            track.events.forEach(evt => {
                events.push({
                    id: evt.id,
                    type: evt.type,
                    name: evt.name,
                    startTime: evt.startTime,
                    duration: evt.duration,
                    trackId: track.id,
                    config: { ...evt.config }
                });
            });
        });
        return {
            events: events,
            timestamp: Date.now()
        };
    }

    applySchedule(game, schedule) {
        game.state.tracks.forEach(track => {
            track.events = [];
        });
        
        game.state.eventPool.forEach(evt => {
            evt.placed = false;
            evt.startTime = null;
            evt.track = null;
        });

        schedule.events.forEach(schedEvt => {
            const poolEvent = game.state.eventPool.find(e => e.id === schedEvt.id);
            const track = game.state.tracks.find(t => t.id === schedEvt.trackId);
            
            if (poolEvent && track) {
                poolEvent.startTime = schedEvt.startTime;
                poolEvent.placed = true;
                poolEvent.track = track.id;
                track.events.push(poolEvent);
            }
        });

        game.checkConflicts();
    }

    startReplay(game, renderer, record, onProgress, onComplete) {
        this.currentReplay = record;
        this.isReplaying = true;
        this.replayIndex = 0;

        this.applySchedule(game, record.schedule);
        
        const levelData = getLevelById(record.levelId);
        const simulation = RuleEngine.simulatePlayback(game.state, levelData);
        
        const events = simulation.events;
        const conflicts = simulation.conflicts;
        
        game.state.phase = GamePhase.PLAYING;
        renderer.config.showPlayhead = true;
        renderer.config.currentTime = 0;

        let currentEventIndex = 0;
        const startTime = performance.now();
        const playbackSpeed = this.replaySpeed;

        const animate = () => {
            if (!this.isReplaying) {
                onComplete && onComplete(false);
                return;
            }

            const elapsed = (performance.now() - startTime) / 1000 * playbackSpeed;
            renderer.config.currentTime = Math.min(elapsed, game.state.maxTime);

            while (currentEventIndex < events.length && events[currentEventIndex].time <= elapsed) {
                const scheduled = events[currentEventIndex];
                if (!scheduled.isEnd) {
                    onProgress && onProgress('start', scheduled.event, scheduled.time);
                } else {
                    onProgress && onProgress('end', scheduled.event, scheduled.time);
                }
                currentEventIndex++;
            }

            if (elapsed >= game.state.maxTime) {
                this.isReplaying = false;
                game.state.phase = GamePhase.FINISHED;
                onComplete && onComplete(true, conflicts);
                return;
            }

            requestAnimationFrame(animate);
        };

        animate();
    }

    stopReplay() {
        this.isReplaying = false;
        this.currentReplay = null;
    }

    deleteRecord(recordId) {
        const idx = this.records.findIndex(r => r.id === recordId);
        if (idx !== -1) {
            this.records.splice(idx, 1);
            this.saveRecords();
            return true;
        }
        return false;
    }

    clearRecords() {
        this.records = [];
        this.saveRecords();
    }

    getRecordsByLevel(levelId) {
        return this.records.filter(r => r.levelId === levelId);
    }

    getBestRecord(levelId) {
        const levelRecords = this.getRecordsByLevel(levelId);
        if (levelRecords.length === 0) return null;
        return levelRecords.reduce((best, curr) => 
            curr.result.score > best.result.score ? curr : best
        );
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReplayManager };
}
