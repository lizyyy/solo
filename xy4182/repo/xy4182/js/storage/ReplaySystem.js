/**
 * 重放系统
 * 管理游戏回放数据的录制、加载和播放
 */

class ReplaySystem {
    constructor(engine, editor, renderer) {
        this.engine = engine;
        this.editor = editor;
        this.renderer = renderer;
        
        this.isRecording = false;
        this.isPlaying = false;
        
        this.replayData = null;
        this.currentFrame = 0;
        
        this.initialState = null;
        this.frames = [];
        
        this.playbackSpeed = 1;
        this.playbackInterval = null;
    }

    startRecording() {
        if (this.isRecording) {
            console.log('已经在录制中');
            return false;
        }
        
        this.initialState = this.createInitialState();
        this.frames = [];
        this.isRecording = true;
        
        console.log('开始录制回放数据');
        return true;
    }

    createInitialState() {
        return {
            levelId: this.engine.level?.id || null,
            levelName: this.engine.level?.name || null,
            boardData: JSON.parse(JSON.stringify(this.engine.board.toJSON())),
            ships: this.engine.ships.map(s => JSON.parse(JSON.stringify(s.toJSON()))),
            timestamp: Date.now()
        };
    }

    recordFrame() {
        if (!this.isRecording) return;
        
        const frame = {
            turn: this.engine.turn,
            ships: this.engine.ships.map(s => ({
                id: s.id,
                x: s.x,
                y: s.y,
                dx: s.dx,
                dy: s.dy,
                state: s.state
            })),
            penaltyPoints: this.engine.penaltyPoints,
            incidents: JSON.parse(JSON.stringify(this.engine.incidents || [])),
            selectedShipId: this.engine.selectedShipId
        };
        
        this.frames.push(frame);
    }

    stopRecording() {
        if (!this.isRecording) {
            console.log('没有正在进行的录制');
            return null;
        }
        
        this.isRecording = false;
        
        this.replayData = {
            version: '1.0',
            created: new Date().toISOString(),
            initialState: this.initialState,
            frames: [...this.frames],
            metadata: {
                totalTurns: this.engine.totalTurns,
                finalPenalty: this.engine.penaltyPoints,
                totalIncidents: this.engine.incidents.length
            }
        };
        
        console.log(`录制完成，共 ${this.frames.length} 帧`);
        return this.replayData;
    }

    loadReplay(replayData) {
        if (!replayData || !replayData.initialState || !replayData.frames) {
            console.error('无效的回放数据');
            return false;
        }
        
        this.replayData = replayData;
        this.currentFrame = 0;
        
        console.log(`加载回放数据，共 ${replayData.frames.length} 帧`);
        return true;
    }

    startPlayback() {
        if (!this.replayData) {
            console.error('没有加载的回放数据');
            return false;
        }
        
        if (this.isPlaying) {
            console.log('已经在播放中');
            return false;
        }
        
        this.isPlaying = true;
        this.currentFrame = 0;
        
        this.restoreInitialState();
        
        this.playbackInterval = setInterval(() => {
            this.playNextFrame();
        }, 1000 / this.playbackSpeed);
        
        console.log('开始回放');
        return true;
    }

    stopPlayback() {
        if (!this.isPlaying) return;
        
        this.isPlaying = false;
        
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
        
        console.log('停止回放');
    }

    pausePlayback() {
        if (!this.isPlaying) return;
        
        if (this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = null;
        }
        
        this.isPlaying = false;
        console.log('暂停回放');
    }

    resumePlayback() {
        if (this.isPlaying || !this.replayData) return;
        
        this.isPlaying = true;
        
        this.playbackInterval = setInterval(() => {
            this.playNextFrame();
        }, 1000 / this.playbackSpeed);
        
        console.log('继续回放');
    }

    playNextFrame() {
        if (!this.replayData || this.currentFrame >= this.replayData.frames.length) {
            this.stopPlayback();
            console.log('回放结束');
            return;
        }
        
        const frame = this.replayData.frames[this.currentFrame];
        this.applyFrame(frame);
        
        this.currentFrame++;
        this.renderer.render();
    }

    playFrame(frameIndex) {
        if (!this.replayData || frameIndex < 0 || frameIndex >= this.replayData.frames.length) {
            return false;
        }
        
        this.restoreInitialState();
        
        for (let i = 0; i <= frameIndex; i++) {
            const frame = this.replayData.frames[i];
            this.applyFrame(frame);
        }
        
        this.currentFrame = frameIndex + 1;
        this.renderer.render();
        
        return true;
    }

    restoreInitialState() {
        if (!this.replayData) return;
        
        const initial = this.replayData.initialState;
        
        this.engine.board = Board.fromJSON(initial.boardData);
        this.engine.ships = initial.ships.map(s => Ship.fromJSON(s));
        this.engine.turn = 1;
        this.engine.penaltyPoints = 0;
        this.engine.incidents = [];
        this.engine.selectedShipId = null;
        
        this.updateUI();
    }

    applyFrame(frame) {
        this.engine.turn = frame.turn;
        this.engine.penaltyPoints = frame.penaltyPoints;
        this.engine.incidents = JSON.parse(JSON.stringify(frame.incidents));
        this.engine.selectedShipId = frame.selectedShipId;
        
        for (const shipState of frame.ships) {
            const ship = this.engine.getShipById(shipState.id);
            if (ship) {
                ship.x = shipState.x;
                ship.y = shipState.y;
                ship.dx = shipState.dx;
                ship.dy = shipState.dy;
                ship.state = shipState.state;
            }
        }
        
        this.updateUI();
    }

    updateUI() {
        const state = this.engine.getGameState();
        
        const turnCounter = document.getElementById('turn-counter');
        if (turnCounter) {
            turnCounter.textContent = `回合: ${state.turn}/${this.engine.totalTurns}`;
        }
        
        const score = document.getElementById('score');
        if (score) {
            score.textContent = `扣分: ${state.penaltyPoints}`;
        }
        
        this.updateShipList();
        this.updateIncidentList();
    }

    updateShipList() {
        const shipList = document.getElementById('ship-list');
        if (!shipList) return;
        
        shipList.innerHTML = '';
        
        for (const ship of this.engine.ships) {
            const item = document.createElement('div');
            item.className = 'ship-item';
            
            if (this.engine.selectedShipId === ship.id) {
                item.classList.add('selected');
            }
            if (ship.isArrived()) {
                item.classList.add('arrived');
            }
            
            item.innerHTML = `
                <div class="ship-name">${ship.name}</div>
                <div class="ship-info">
                    <span>类型: ${ship.getTypeDisplayName()}</span>
                    <span>状态: ${ship.getStateDisplayName()}</span>
                    <span>位置: (${ship.x}, ${ship.y})</span>
                </div>
            `;
            
            shipList.appendChild(item);
        }
    }

    updateIncidentList() {
        const incidentList = document.getElementById('incident-list');
        if (!incidentList) return;
        
        if (this.engine.incidents.length === 0) {
            incidentList.innerHTML = '<p class="no-incidents">暂无事故记录</p>';
            return;
        }
        
        incidentList.innerHTML = '';
        
        for (const incident of this.engine.incidents.slice().reverse()) {
            const item = document.createElement('div');
            item.className = `incident-item ${incident.type}`;
            
            let typeText;
            switch (incident.type) {
                case IncidentType.COLLISION: typeText = '碰撞事故'; break;
                case IncidentType.SHALLOW: typeText = '浅滩驶入'; break;
                case IncidentType.SPEED: typeText = '超速违规'; break;
                case IncidentType.GIVE_WAY: typeText = '让路违规'; break;
                case IncidentType.BOUNDARY: typeText = '越界违规'; break;
                default: typeText = '违规';
            }
            
            item.innerHTML = `
                <div class="incident-turn">回合 ${incident.turn}: ${typeText}</div>
                <div class="incident-text">${incident.description}</div>
                <div class="incident-points">扣分: ${incident.points}</div>
            `;
            
            incidentList.appendChild(item);
        }
    }

    setPlaybackSpeed(speed) {
        this.playbackSpeed = Math.max(0.25, Math.min(4, speed));
        
        if (this.isPlaying && this.playbackInterval) {
            clearInterval(this.playbackInterval);
            this.playbackInterval = setInterval(() => {
                this.playNextFrame();
            }, 1000 / this.playbackSpeed);
        }
        
        console.log(`回放速度设置为 ${this.playbackSpeed}x`);
    }

    getReplayData() {
        return this.replayData;
    }

    exportReplayJSON() {
        if (!this.replayData) return null;
        return JSON.stringify(this.replayData, null, 2);
    }

    importReplayJSON(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            return this.loadReplay(data);
        } catch (e) {
            console.error('导入回放数据失败:', e);
            return false;
        }
    }

    getPlaybackProgress() {
        if (!this.replayData) return 0;
        return this.currentFrame / this.replayData.frames.length;
    }

    getTotalFrames() {
        return this.replayData?.frames?.length || 0;
    }

    getCurrentFrame() {
        return this.currentFrame;
    }

    isRecordingActive() {
        return this.isRecording;
    }

    isPlayingActive() {
        return this.isPlaying;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ReplaySystem };
}
