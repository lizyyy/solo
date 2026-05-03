class UI {
    constructor(gameInstance) {
        this.game = gameInstance;
        this.elements = {};
        this.draggingResource = null;
        this.dragStartX = 0;
        this.dragStartY = 0;
        
        this._initElements();
        this._initEventListeners();
    }

    _initElements() {
        this.elements = {
            timer: document.getElementById('timer'),
            score: document.getElementById('score'),
            highScore: document.getElementById('high-score'),
            levelName: document.getElementById('level-name'),
            
            btnStart: document.getElementById('btn-start'),
            btnPause: document.getElementById('btn-pause'),
            btnRestart: document.getElementById('btn-restart'),
            btnExport: document.getElementById('btn-export'),
            
            levelSelect: document.getElementById('level-select'),
            
            eventLog: document.getElementById('event-log'),
            
            overlay: document.getElementById('overlay'),
            overlayTitle: document.getElementById('overlay-title'),
            overlayMessage: document.getElementById('overlay-message'),
            overlayBtnRestart: document.getElementById('overlay-btn-restart'),
            overlayBtnExport: document.getElementById('overlay-btn-export'),
            overlayBtnClose: document.getElementById('overlay-btn-close'),
            
            missions: {
                fetch: document.getElementById('mission-fetch'),
                arrive: document.getElementById('mission-arrive'),
                defibrillate: document.getElementById('mission-defibrillate'),
                handover: document.getElementById('mission-handover')
            },
            
            gameArea: document.getElementById('game-area'),
            canvas: document.getElementById('game-canvas')
        };
    }

    _initEventListeners() {
        this.elements.btnStart.addEventListener('click', () => this._onStartClick());
        this.elements.btnPause.addEventListener('click', () => this._onPauseClick());
        this.elements.btnRestart.addEventListener('click', () => this._onRestartClick());
        this.elements.btnExport.addEventListener('click', () => this._onExportClick());
        
        this.elements.levelSelect.addEventListener('change', (e) => this._onLevelChange(e));
        
        this.elements.overlayBtnRestart.addEventListener('click', () => this._onRestartClick());
        this.elements.overlayBtnExport.addEventListener('click', () => this._onExportClick());
        this.elements.overlayBtnClose.addEventListener('click', () => this._hideOverlay());
        
        this._initDragDrop();
        this._initCanvasInteraction();
    }

    _initDragDrop() {
        const resourceItems = document.querySelectorAll('.resource-item');
        
        resourceItems.forEach(item => {
            item.addEventListener('dragstart', (e) => {
                this.draggingResource = item.dataset.type;
                e.dataTransfer.setData('text/plain', item.dataset.type);
                e.dataTransfer.effectAllowed = 'copy';
                item.classList.add('dragging');
            });
            
            item.addEventListener('dragend', (e) => {
                item.classList.remove('dragging');
                this.draggingResource = null;
            });
        });
        
        const canvas = this.elements.canvas;
        
        canvas.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'copy';
            canvas.classList.add('drag-over');
        });
        
        canvas.addEventListener('dragleave', (e) => {
            canvas.classList.remove('drag-over');
        });
        
        canvas.addEventListener('drop', (e) => {
            e.preventDefault();
            canvas.classList.remove('drag-over');
            
            const resourceType = e.dataTransfer.getData('text/plain');
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this._handleResourceDrop(resourceType, x, y);
        });
    }

    _initCanvasInteraction() {
        const canvas = this.elements.canvas;
        let isDragging = false;
        let selectedResource = null;
        
        canvas.addEventListener('mousedown', (e) => {
            if (!this.game || !this.game.stateMachine.isRunning()) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            selectedResource = this._getResourceAtPosition(x, y);
            
            if (selectedResource) {
                isDragging = true;
                this.dragStartX = x;
                this.dragStartY = y;
            }
        });
        
        canvas.addEventListener('mousemove', (e) => {
            if (!isDragging || !selectedResource) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
        });
        
        canvas.addEventListener('mouseup', (e) => {
            if (isDragging && selectedResource) {
                const rect = canvas.getBoundingClientRect();
                const x = e.clientX - rect.left;
                const y = e.clientY - rect.top;
                
                this._handleResourceClick(selectedResource, x, y);
            }
            
            isDragging = false;
            selectedResource = null;
        });
        
        canvas.addEventListener('click', (e) => {
            if (!this.game || !this.game.stateMachine.isRunning()) return;
            
            const rect = canvas.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            this._handleCanvasClick(x, y);
        });
    }

    _getResourceAtPosition(x, y) {
        if (!this.game) return null;
        
        const gridSize = this.game.gameMap.getGridSize();
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (this.game.volunteer && this.game.volunteer.isAtPosition(gridX, gridY)) {
            return 'volunteer';
        }
        
        if (this.game.ambulance && this.game.ambulance.isAtPosition(gridX, gridY)) {
            return 'ambulance';
        }
        
        return null;
    }

    _handleResourceDrop(resourceType, x, y) {
        if (!this.game || !this.game.stateMachine.isRunning()) return;
        
        const gridSize = this.game.gameMap.getGridSize();
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        if (!this.game.gameMap.isWalkable(gridX, gridY)) {
            this.addLog('该位置不可通行，请选择其他位置', 'warning');
            return;
        }
        
        this.game.handleResourcePlacement(resourceType, gridX, gridY);
    }

    _handleResourceClick(resourceType, x, y) {
    }

    _handleCanvasClick(x, y) {
        if (!this.game || !this.game.stateMachine.isRunning()) return;
        
        const gridSize = this.game.gameMap.getGridSize();
        const gridX = Math.floor(x / gridSize);
        const gridY = Math.floor(y / gridSize);
        
        this.game.handleMapClick(gridX, gridY);
    }

    _onStartClick() {
        if (!this.game) return;
        
        if (this.game.stateMachine.isIdle()) {
            this.game.start();
        } else if (this.game.stateMachine.isPaused()) {
            this.game.resume();
        }
    }

    _onPauseClick() {
        if (!this.game) return;
        this.game.pause();
    }

    _onRestartClick() {
        if (!this.game) return;
        this.game.restart();
    }

    _onExportClick() {
        if (!this.game) return;
        this.game.exportReplay();
    }

    _onLevelChange(e) {
        const levelId = e.target.value;
        if (this.game) {
            this.game.loadLevel(levelId);
        }
    }

    updateTimer(time) {
        if (this.elements.timer) {
            this.elements.timer.textContent = Utils.formatTime(time);
            
            if (time > 120) {
                this.elements.timer.style.color = '#f44336';
            } else if (time > 60) {
                this.elements.timer.style.color = '#ff9800';
            } else {
                this.elements.timer.style.color = 'inherit';
            }
        }
    }

    updateScore(score) {
        if (this.elements.score) {
            this.elements.score.textContent = score;
        }
    }

    updateHighScore(score) {
        if (this.elements.highScore) {
            this.elements.highScore.textContent = score;
        }
    }

    updateLevelName(name) {
        if (this.elements.levelName) {
            this.elements.levelName.textContent = name;
        }
    }

    updateMissionStatus(missionName, state, time = null) {
        const missionEl = this.elements.missions[missionName];
        if (!missionEl) return;
        
        missionEl.classList.remove('active', 'completed', 'failed');
        
        const statusEl = missionEl.querySelector('.mission-status');
        const timeEl = missionEl.querySelector('.mission-time');
        
        if (time !== null && timeEl) {
            timeEl.textContent = Utils.formatTime(time);
        }
        
        switch (state) {
            case 'active':
                missionEl.classList.add('active');
                if (statusEl) statusEl.textContent = '进行中';
                break;
            case 'completed':
                missionEl.classList.add('completed');
                if (statusEl) statusEl.textContent = '完成';
                break;
            case 'failed':
                missionEl.classList.add('failed');
                if (statusEl) statusEl.textContent = '失败';
                break;
            default:
                if (statusEl) statusEl.textContent = '等待';
        }
    }

    updateButtonStates() {
        if (!this.game) return;
        
        const state = this.game.stateMachine;
        
        if (state.isIdle()) {
            this.elements.btnStart.disabled = false;
            this.elements.btnStart.textContent = '开始游戏';
            this.elements.btnPause.disabled = true;
            this.elements.btnExport.disabled = true;
            this.elements.levelSelect.disabled = false;
        } else if (state.isPreparing()) {
            this.elements.btnStart.disabled = false;
            this.elements.btnStart.textContent = '确认开始';
            this.elements.btnPause.disabled = true;
            this.elements.btnExport.disabled = true;
            this.elements.levelSelect.disabled = false;
        } else if (state.isRunning()) {
            this.elements.btnStart.disabled = true;
            this.elements.btnPause.disabled = false;
            this.elements.btnExport.disabled = true;
            this.elements.levelSelect.disabled = true;
        } else if (state.isPaused()) {
            this.elements.btnStart.disabled = false;
            this.elements.btnStart.textContent = '继续游戏';
            this.elements.btnPause.disabled = true;
            this.elements.btnExport.disabled = false;
            this.elements.levelSelect.disabled = false;
        } else if (state.isEnded()) {
            this.elements.btnStart.disabled = false;
            this.elements.btnStart.textContent = '重新开始';
            this.elements.btnPause.disabled = true;
            this.elements.btnExport.disabled = false;
            this.elements.levelSelect.disabled = false;
        }
    }

    addLog(message, type = 'info') {
        if (!this.elements.eventLog) return;
        
        const entry = document.createElement('div');
        entry.className = `log-entry ${type}`;
        entry.textContent = message;
        
        this.elements.eventLog.insertBefore(entry, this.elements.eventLog.firstChild);
        
        while (this.elements.eventLog.children.length > 50) {
            this.elements.eventLog.removeChild(this.elements.eventLog.lastChild);
        }
    }

    clearLog() {
        if (!this.elements.eventLog) return;
        this.elements.eventLog.innerHTML = '<div class="log-entry">游戏开始，请调度资源救援</div>';
    }

    showOverlay(title, message) {
        if (this.elements.overlayTitle) {
            this.elements.overlayTitle.textContent = title;
        }
        if (this.elements.overlayMessage) {
            this.elements.overlayMessage.textContent = message;
        }
        if (this.elements.overlay) {
            this.elements.overlay.classList.remove('hidden');
        }
    }

    _hideOverlay() {
        if (this.elements.overlay) {
            this.elements.overlay.classList.add('hidden');
        }
    }

    reset() {
        this.clearLog();
        this.updateTimer(0);
        this.updateScore(0);
        
        Object.keys(this.elements.missions).forEach(missionName => {
            this.updateMissionStatus(missionName, 'pending');
            const missionEl = this.elements.missions[missionName];
            if (missionEl) {
                const timeEl = missionEl.querySelector('.mission-time');
                if (timeEl) timeEl.textContent = '--:--';
            }
        });
        
        this._hideOverlay();
        this.updateButtonStates();
    }
}

window.UI = UI;