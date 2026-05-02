class Game {
    constructor() {
        this.currentLevel = null;
        this.state = null;
        this.renderer = null;
        this.init();
    }

    init() {
        const canvas = document.getElementById('gameCanvas');
        this.renderer = new Renderer(canvas);

        this.renderer.onClick = (type, id) => this.handleCanvasClick(type, id);

        this.initUI();
        this.loadLevelSelect();
    }

    initUI() {
        document.getElementById('restartBtn').addEventListener('click', () => this.restartLevel());
        document.getElementById('undoBtn').addEventListener('click', () => this.undo());
        document.getElementById('autoMoveBtn').addEventListener('click', () => this.autoMove());
        document.getElementById('levelSelect').addEventListener('change', (e) => {
            if (e.target.value) {
                this.loadLevel(parseInt(e.target.value));
            }
        });
    }

    loadLevelSelect() {
        const select = document.getElementById('levelSelect');
        select.innerHTML = '<option value="">选择关卡</option>';
        getAllLevels().forEach(level => {
            const option = document.createElement('option');
            option.value = level.id;
            option.textContent = `${level.id}. ${level.name}`;
            select.appendChild(option);
        });
    }

    loadLevel(levelId) {
        const level = getLevel(levelId);
        if (!level) return;

        this.currentLevel = level;
        this.state = new GameState(level);

        this.renderer.resize(level.mapWidth, level.mapHeight);
        this.render();

        document.getElementById('levelName').textContent = level.name;
        document.getElementById('levelDesc').textContent = level.description;

        this.updateStats();
        this.updateTrainList();
        this.hideMessages();

        document.getElementById('levelSelect').value = levelId;
    }

    restartLevel() {
        if (this.currentLevel) {
            this.loadLevel(this.currentLevel.id);
        }
    }

    undo() {
        if (!this.state) return;
        if (this.state.restoreState()) {
            this.render();
            this.updateStats();
            this.hideMessages();
        }
    }

    handleCanvasClick(type, id) {
        if (!this.state || this.state.status !== 'playing') return;

        let result;
        switch (type) {
            case 'switch':
                result = RuleEngine.executeToggleSwitch(this.state, id);
                break;
            case 'signal':
                result = RuleEngine.executeToggleSignal(this.state, id);
                break;
            case 'train':
                result = RuleEngine.executeMoveTrain(this.state, id, this.currentLevel);
                break;
        }

        if (result) {
            if (result.success) {
                this.render();
                this.updateStats();
                this.updateTrainList();
                this.hideMessages();
                this.checkWin();
            } else {
                this.showFailure(result.message);
            }
        }
    }

    autoMove() {
        if (!this.state || this.state.status !== 'playing') return;

        for (const train of this.state.trains) {
            if (train.sectionId !== train.goalSection) {
                const result = RuleEngine.executeMoveTrain(this.state, train.id, this.currentLevel);
                if (result.success) {
                    this.render();
                    this.updateStats();
                    this.updateTrainList();
                    this.checkWin();
                    break;
                }
            }
        }
    }

    render() {
        if (this.state && this.currentLevel) {
            this.renderer.render(this.state, this.currentLevel);
        }
    }

    updateStats() {
        if (!this.state) return;
        document.getElementById('moveCount').textContent = this.state.moveCount;
        const best = Storage.getBestMoves(this.currentLevel.id);
        document.getElementById('bestMoves').textContent = best !== null ? best : '-';
    }

    updateTrainList() {
        if (!this.state) return;
        const list = document.getElementById('trainList');
        list.innerHTML = '';
        this.state.trains.forEach(train => {
            const isCompleted = train.sectionId === train.goalSection;
            const item = document.createElement('div');
            item.className = `train-item ${isCompleted ? 'completed' : ''}`;
            item.innerHTML = `
                <h4 style="color: ${train.color}">${train.name}</h4>
                <p>当前位置: ${train.sectionId}</p>
                <p class="goal">目标: ${train.goalSection}</p>
            `;
            list.appendChild(item);
        });
    }

    showFailure(message) {
        const el = document.getElementById('failureMessage');
        el.textContent = message;
        el.classList.add('show');
        setTimeout(() => el.classList.remove('show'), 3000);
    }

    showSuccess() {
        const el = document.getElementById('successMessage');
        el.textContent = '恭喜！任务完成！';
        el.classList.add('show');
    }

    hideMessages() {
        document.getElementById('failureMessage').classList.remove('show');
        document.getElementById('successMessage').classList.remove('show');
    }

    checkWin() {
        if (this.state.checkWin(this.currentLevel)) {
            this.state.status = 'won';
            Storage.setBestMoves(this.currentLevel.id, this.state.moveCount);
            this.updateStats();
            this.showSuccess();
        }
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.game = new Game();
    window.game.loadLevel(1);
});
