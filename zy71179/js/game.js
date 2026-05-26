class Game {
    constructor() {
        this.state = new GameState();
        this.currentLevelData = null;
        this.renderer = null;
        this.interaction = null;
        this.replayManager = new ReplayManager();
        this.playbackAnimationId = null;
        this.playbackStartTime = 0;
        this.playbackPausedTime = 0;
        this.playbackEvents = [];
        this.playbackEventIndex = 0;
        this.onPlaybackProgress = null;
        this.onPlaybackComplete = null;
        this.ui = null;
    }

    init(canvas, ui) {
        this.ui = ui;
        this.renderer = new TimelineRenderer(canvas, this.state);
        this.interaction = new InteractionManager(canvas, this.renderer, this);
        
        window.addEventListener('resize', () => {
            this.renderer.resize();
        });

        this.animate();
    }

    loadLevel(levelId) {
        const levelData = getLevelById(levelId);
        if (!levelData) return false;

        this.currentLevelData = levelData;
        const newState = createLevelState(levelData);
        this.state = newState;
        this.renderer.state = this.state;
        this.renderer.config.scrollX = 0;
        this.renderer.config.scrollY = 0;
        this.renderer.config.showPlayhead = false;
        this.renderer.clearHighlight();
        
        this.stopPlayback();
        this.checkConflicts();
        
        return true;
    }

    placeEvent(event, track, startTime) {
        const poolEvent = this.state.eventPool.find(e => e.id === event.id);
        if (!poolEvent) return false;

        if (poolEvent.track) {
            const oldTrack = this.state.tracks.find(t => t.id === poolEvent.track);
            if (oldTrack) {
                oldTrack.removeEvent(poolEvent.id);
            }
        }

        poolEvent.startTime = startTime;
        poolEvent.placed = true;
        poolEvent.track = track.id;
        track.addEvent(poolEvent);

        track.events.sort((a, b) => a.startTime - b.startTime);
        
        return true;
    }

    removeEventFromTrack(event) {
        const track = this.state.tracks.find(t => t.id === event.track);
        if (track) {
            track.removeEvent(event.id);
        }
        const poolEvent = this.state.eventPool.find(e => e.id === event.id);
        if (poolEvent) {
            poolEvent.startTime = null;
            poolEvent.track = null;
            poolEvent.placed = false;
        }
    }

    checkConflicts() {
        if (!this.currentLevelData) return [];
        
        const conflicts = RuleEngine.checkAllConflicts(this.state, this.currentLevelData);
        this.state.conflicts = conflicts;
        
        const errors = conflicts.filter(c => c.severity === 'error');
        const warnings = conflicts.filter(c => c.severity === 'warning');
        const timeouts = conflicts.filter(c => c.type === ConflictType.SCENECHANGE_TIMEOUT);
        
        this.state.score = RuleEngine.calculateScore(conflicts, this.currentLevelData, this.state);
        
        if (this.renderer) {
            this.renderer.highlightConflicts(conflicts);
        }
        
        return conflicts;
    }

    startPlayback() {
        if (this.state.phase !== GamePhase.PLANNING) return;
        
        const conflicts = this.checkConflicts();
        const errors = conflicts.filter(c => c.severity === 'error');
        
        const simulation = RuleEngine.simulatePlayback(this.state, this.currentLevelData);
        this.playbackEvents = simulation.events;
        this.playbackEventIndex = 0;
        
        this.state.phase = GamePhase.PLAYING;
        this.renderer.config.showPlayhead = true;
        this.renderer.config.currentTime = 0;
        this.playbackStartTime = performance.now();
        this.playbackPausedTime = 0;
        
        this.ui.addPlayLog('info', `演出开始！共 ${simulation.events.length / 2} 个事件`);
        
        this.runPlayback();
    }

    runPlayback() {
        const animate = () => {
            if (this.state.phase !== GamePhase.PLAYING) {
                this.playbackAnimationId = null;
                return;
            }

            const elapsed = (performance.now() - this.playbackStartTime) / 1000 * this.state.playbackSpeed;
            this.renderer.config.currentTime = Math.min(elapsed, this.state.maxTime);
            this.state.playTime = elapsed;

            while (this.playbackEventIndex < this.playbackEvents.length && 
                   this.playbackEvents[this.playbackEventIndex].time <= elapsed) {
                const scheduled = this.playbackEvents[this.playbackEventIndex];
                this.handlePlaybackEvent(scheduled);
                this.playbackEventIndex++;
            }

            if (elapsed >= this.state.maxTime) {
                this.finishPlayback();
                return;
            }

            this.playbackAnimationId = requestAnimationFrame(animate);
        };

        animate();
    }

    handlePlaybackEvent(scheduled) {
        const event = scheduled.event;
        const time = scheduled.time;
        const isEnd = scheduled.isEnd;
        
        if (!isEnd) {
            const conflict = this.state.conflicts.find(c => 
                c.eventIds.includes(event.id) && c.severity === 'error'
            );
            
            if (conflict) {
                this.ui.addPlayLog('error', `[${this.formatTime(time)}] ✗ ${event.name}: ${conflict.message}`);
            } else {
                this.ui.addPlayLog('success', `[${this.formatTime(time)}] ✓ ${event.name} 开始`);
            }
        } else {
            this.ui.addPlayLog('info', `[${this.formatTime(time)}] ${event.name} 完成`);
        }
    }

    pause() {
        if (this.state.phase !== GamePhase.PLAYING) return;
        
        this.state.phase = GamePhase.PAUSED;
        this.playbackPausedTime = performance.now();
        
        if (this.playbackAnimationId) {
            cancelAnimationFrame(this.playbackAnimationId);
            this.playbackAnimationId = null;
        }
        
        this.ui.addPlayLog('warning', '演出暂停');
    }

    resume() {
        if (this.state.phase !== GamePhase.PAUSED) return;
        
        this.state.phase = GamePhase.PLAYING;
        const pauseDuration = performance.now() - this.playbackPausedTime;
        this.playbackStartTime += pauseDuration;
        
        this.ui.addPlayLog('warning', '演出继续');
        this.runPlayback();
    }

    stopPlayback() {
        if (this.playbackAnimationId) {
            cancelAnimationFrame(this.playbackAnimationId);
            this.playbackAnimationId = null;
        }
        
        this.state.phase = GamePhase.PLANNING;
        this.renderer.config.showPlayhead = false;
        this.renderer.config.currentTime = 0;
        this.state.playTime = 0;
        this.playbackEventIndex = 0;
        this.playbackEvents = [];
    }

    finishPlayback() {
        this.state.phase = GamePhase.FINISHED;
        this.renderer.config.showPlayhead = true;
        this.renderer.config.currentTime = this.state.maxTime;
        
        const conflicts = this.checkConflicts();
        const errors = conflicts.filter(c => c.severity === 'error');
        
        const result = new GameResult();
        result.success = errors.length === 0;
        result.score = this.state.score;
        result.maxScore = this.currentLevelData.maxScore;
        result.conflicts = conflicts;
        result.totalTime = this.state.maxTime;
        result.sceneChanges = [...this.state.sceneChanges];
        
        if (!result.success) {
            const criticalError = errors[0];
            result.failReason = criticalError ? criticalError.message : '存在未解决的冲突';
        }
        
        this.state.lastResult = result;
        
        const record = this.replayManager.addRecord(
            this.currentLevelData.id,
            this.currentLevelData.name,
            this.state,
            result
        );
        
        this.ui.addPlayLog(result.success ? 'success' : 'error', 
            `演出${result.success ? '成功' : '失败'}！得分: ${result.score}/${result.maxScore}`);
        
        this.ui.showResult(result, this.currentLevelData, this.state);
        this.ui.updateHistoryList();
        this.ui.enableExport();
    }

    restart() {
        if (this.currentLevelData) {
            this.loadLevel(this.currentLevelData.id);
            this.ui.clearPlayLog();
            this.ui.updateStatus();
            this.ui.updateEventPool();
        }
    }

    replayRecord(recordId) {
        const record = this.replayManager.records.find(r => r.id === recordId);
        if (!record) return false;
        
        this.loadLevel(record.levelId);
        this.ui.clearPlayLog();
        
        this.replayManager.startReplay(
            this,
            this.renderer,
            record,
            (type, event, time) => {
                if (type === 'start') {
                    this.ui.addPlayLog('success', `[回放] [${this.formatTime(time)}] ✓ ${event.name} 开始`);
                }
            },
            (success, conflicts) => {
                this.state.lastResult = record.result;
                this.ui.showResult(record.result, this.currentLevelData, this.state);
                this.ui.enableExport();
            }
        );
        
        return true;
    }

    exportReport(format = 'text') {
        if (!this.currentLevelData || !this.state.lastResult) return null;
        
        return ReportExporter.generateReport(
            this.currentLevelData,
            this.state,
            this.state.lastResult,
            format
        );
    }

    downloadReport(format = 'text') {
        if (!this.currentLevelData || !this.state.lastResult) return;
        
        const content = this.exportReport(format);
        const filename = ReportExporter.generateFilename(this.currentLevelData);
        ReportExporter.downloadReport(content, filename, format);
    }

    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }

    animate() {
        if (this.renderer) {
            this.renderer.render();
        }
        
        if (this.state.phase === GamePhase.PLAYING || this.state.phase === GamePhase.PAUSED) {
            if (this.ui) {
                this.ui.updateTimeDisplay(this.renderer.config.currentTime);
            }
        }
        
        requestAnimationFrame(() => this.animate());
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Game };
}
