import { VALIDATION_ERRORS } from './layoutRules.js';

export class UIManager {
    constructor(options = {}) {
        this.screens = {};
        this.currentScreen = null;
        this.elements = {};
        this.messageTimeout = null;
        
        this.onLevelSelect = options.onLevelSelect || (() => {});
        this.onStartGame = options.onStartGame || (() => {});
        this.onPause = options.onPause || (() => {});
        this.onResume = options.onResume || (() => {});
        this.onRestart = options.onRestart || (() => {});
        this.onUndo = options.onUndo || (() => {});
        this.onRedo = options.onRedo || (() => {});
        this.onExit = options.onExit || (() => {});
        this.onNextLevel = options.onNextLevel || (() => {});
        this.onImportLevel = options.onImportLevel || (() => {});
        this.onExportTemplate = options.onExportTemplate || (() => {});
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initScreens();
    }

    cacheElements() {
        this.elements = {
            menuScreen: document.getElementById('menu-screen'),
            levelSelect: document.getElementById('level-select'),
            gameScreen: document.getElementById('game-screen'),
            pauseOverlay: document.getElementById('pause-overlay'),
            
            startGameBtn: document.getElementById('start-game'),
            backToMenuBtn: document.getElementById('back-to-menu'),
            
            levelList: document.getElementById('level-list'),
            
            levelTitle: document.getElementById('level-title'),
            levelHint: document.getElementById('level-hint'),
            timer: document.getElementById('timer'),
            stepCount: document.getElementById('step-count'),
            maxSteps: document.getElementById('max-steps'),
            score: document.getElementById('score'),
            
            btnPause: document.getElementById('btn-pause'),
            btnRestart: document.getElementById('btn-restart'),
            btnUndo: document.getElementById('btn-undo'),
            btnRedo: document.getElementById('btn-redo'),
            btnExit: document.getElementById('btn-exit'),
            
            charPool: document.getElementById('char-pool'),
            printFrame: document.getElementById('print-frame'),
            frameDimensions: document.getElementById('frame-dimensions'),
            forbiddenInfo: document.getElementById('forbidden-info'),
            
            messageToast: document.getElementById('message-toast'),
            messageText: document.getElementById('message-text'),
            
            overlayTitle: document.getElementById('overlay-title'),
            pauseContent: document.getElementById('pause-content'),
            victoryContent: document.getElementById('victory-content'),
            
            finalTime: document.getElementById('final-time'),
            finalSteps: document.getElementById('final-steps'),
            finalScore: document.getElementById('final-score'),
            finalRating: document.getElementById('final-rating'),
            reconstructedText: document.getElementById('reconstructed-text'),
            
            btnResume: document.getElementById('btn-resume'),
            btnRestartLevel: document.getElementById('btn-restart-level'),
            btnNextLevel: document.getElementById('btn-next-level'),
            btnToLevelSelect: document.getElementById('btn-to-level-select'),
            
            importLevelInput: document.getElementById('import-level'),
            btnImportLevel: document.getElementById('btn-import-level'),
            btnExportTemplate: document.getElementById('btn-export-template')
        };
    }

    bindEvents() {
        this.elements.startGameBtn.addEventListener('click', () => this.onStartGame());
        this.elements.backToMenuBtn.addEventListener('click', () => this.showScreen('menu'));
        
        this.elements.btnPause.addEventListener('click', () => this.onPause());
        this.elements.btnRestart.addEventListener('click', () => this.onRestart());
        this.elements.btnUndo.addEventListener('click', () => this.onUndo());
        this.elements.btnRedo.addEventListener('click', () => this.onRedo());
        this.elements.btnExit.addEventListener('click', () => this.onExit());
        
        this.elements.btnResume.addEventListener('click', () => this.onResume());
        this.elements.btnRestartLevel.addEventListener('click', () => this.onRestart());
        this.elements.btnNextLevel.addEventListener('click', () => this.onNextLevel());
        this.elements.btnToLevelSelect.addEventListener('click', () => {
            this.hideOverlay();
            this.showScreen('levelSelect');
        });
        
        this.elements.btnImportLevel.addEventListener('click', () => {
            this.elements.importLevelInput.click();
        });
        this.elements.importLevelInput.addEventListener('change', (e) => this.handleFileImport(e));
        this.elements.btnExportTemplate.addEventListener('click', () => this.onExportTemplate());
    }

    initScreens() {
        this.screens = {
            menu: this.elements.menuScreen,
            levelSelect: this.elements.levelSelect,
            game: this.elements.gameScreen
        };
    }

    showScreen(screenName) {
        Object.values(this.screens).forEach(screen => {
            screen.classList.remove('active');
        });
        
        if (this.screens[screenName]) {
            this.screens[screenName].classList.add('active');
            this.currentScreen = screenName;
        }
    }

    renderLevelList(levels, recordsManager) {
        this.elements.levelList.innerHTML = '';
        
        levels.forEach((level, index) => {
            const stats = recordsManager.getLevelStats(level.id);
            const card = this.createLevelCard(level, stats, index);
            this.elements.levelList.appendChild(card);
        });
    }

    createLevelCard(level, stats, index) {
        const card = document.createElement('div');
        card.className = `level-card ${stats.completed ? 'completed' : ''} ${level.isCustom ? 'custom' : ''}`;
        card.dataset.levelIndex = index;
        
        const difficultyStars = '★'.repeat(level.difficulty) + '☆'.repeat(Math.max(0, 5 - level.difficulty));
        
        let ratingBadge = '';
        if (stats.rating) {
            ratingBadge = `<span class="rating-badge rating-${stats.rating}">${stats.rating}</span>`;
        }
        
        card.innerHTML = `
            <div class="level-card-header">
                <h3>${level.title}</h3>
                ${ratingBadge}
            </div>
            <p class="level-description">${level.description || ''}</p>
            <div class="level-meta">
                <span class="difficulty">难度: ${difficultyStars}</span>
                <span class="grid-size">${level.gridSize.rows}×${level.gridSize.cols}</span>
            </div>
            ${stats.completed ? `
                <div class="level-stats">
                    <span>最佳: ${stats.bestScore}分</span>
                    <span>用时: ${this.formatTime(stats.bestTime)}</span>
                </div>
            ` : ''}
            ${level.isCustom ? '<span class="custom-tag">自定义</span>' : ''}
        `;
        
        card.addEventListener('click', () => this.onLevelSelect(index));
        
        return card;
    }

    renderCharacterPool(characters, onDragStart) {
        this.elements.charPool.innerHTML = '';
        
        const shuffled = [...characters].sort(() => Math.random() - 0.5);
        
        shuffled.forEach((char, index) => {
            const tile = document.createElement('div');
            tile.className = 'character-tile';
            tile.textContent = char;
            tile.dataset.character = char;
            tile.dataset.index = index;
            
            this.elements.charPool.appendChild(tile);
        });
    }

    renderPrintFrame(gridSize, gridState, onCellClick) {
        this.elements.printFrame.innerHTML = '';
        this.elements.printFrame.style.gridTemplateColumns = `repeat(${gridSize.cols}, 1fr)`;
        this.elements.printFrame.style.gridTemplateRows = `repeat(${gridSize.rows}, 1fr)`;
        
        this.elements.frameDimensions.textContent = `版心: ${gridSize.cols}×${gridSize.rows}`;
        
        const forbiddenCount = gridState.flat().filter(cell => cell.isForbidden).length;
        this.elements.forbiddenInfo.textContent = forbiddenCount > 0 
            ? `禁排格: ${forbiddenCount}格` 
            : '禁排格: 无';
        
        for (let r = 0; r < gridSize.rows; r++) {
            for (let c = 0; c < gridSize.cols; c++) {
                const cellState = gridState[r][c];
                const cell = document.createElement('div');
                cell.className = 'frame-cell';
                cell.dataset.row = r;
                cell.dataset.col = c;
                
                if (cellState.isForbidden) {
                    cell.classList.add('forbidden');
                    cell.title = cellState.forbiddenReason || '禁排格';
                }
                
                if (cellState.character) {
                    const tile = document.createElement('div');
                    tile.className = 'placed-character';
                    tile.textContent = cellState.character;
                    tile.dataset.character = cellState.character;
                    tile.dataset.row = r;
                    tile.dataset.col = c;
                    cell.appendChild(tile);
                }
                
                this.elements.printFrame.appendChild(cell);
            }
        }
    }

    updateGameUI(level, steps, maxSteps, canUndo, canRedo) {
        this.elements.levelTitle.textContent = level.title;
        this.elements.levelHint.textContent = level.hint ? `提示: ${level.hint}` : '';
        this.elements.stepCount.textContent = steps;
        
        if (maxSteps && maxSteps > 0) {
            this.elements.maxSteps.textContent = `/${maxSteps}`;
        } else {
            this.elements.maxSteps.textContent = '/∞';
        }
        
        this.elements.btnUndo.disabled = !canUndo;
        this.elements.btnRedo.disabled = !canRedo;
        this.elements.btnUndo.classList.toggle('disabled', !canUndo);
        this.elements.btnRedo.classList.toggle('disabled', !canRedo);
    }

    updateTimer(formattedTime) {
        this.elements.timer.textContent = formattedTime;
    }

    updateScore(score) {
        this.elements.score.textContent = score;
    }

    showMessage(message, type = 'info', duration = 3000) {
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
        
        const toast = this.elements.messageToast;
        const text = this.elements.messageText;
        
        toast.className = 'message-toast';
        toast.classList.add(type);
        text.textContent = message;
        
        toast.classList.remove('hidden');
        
        if (duration > 0) {
            this.messageTimeout = setTimeout(() => {
                toast.classList.add('hidden');
            }, duration);
        }
    }

    hideMessage() {
        this.elements.messageToast.classList.add('hidden');
        if (this.messageTimeout) {
            clearTimeout(this.messageTimeout);
        }
    }

    showValidationError(errorType, message) {
        let type = 'error';
        let displayMessage = message;
        
        switch (errorType) {
            case VALIDATION_ERRORS.WRONG_CHARACTER:
                type = 'error';
                break;
            case VALIDATION_ERRORS.OUT_OF_BOUNDS:
                type = 'warning';
                break;
            case VALIDATION_ERRORS.FORBIDDEN_CELL:
                type = 'error';
                break;
            case VALIDATION_ERRORS.INVALID_ORDER:
                type = 'warning';
                break;
            case VALIDATION_ERRORS.CELL_OCCUPIED:
                type = 'warning';
                break;
            case VALIDATION_ERRORS.INVALID_PUNCTUATION:
                type = 'warning';
                break;
        }
        
        this.showMessage(displayMessage, type);
    }

    showPauseOverlay() {
        this.elements.overlayTitle.textContent = '游戏暂停';
        this.elements.pauseContent.classList.remove('hidden');
        this.elements.victoryContent.classList.add('hidden');
        this.elements.btnResume.classList.remove('hidden');
        this.elements.btnNextLevel.classList.add('hidden');
        
        this.elements.pauseOverlay.classList.remove('hidden');
    }

    showVictoryOverlay(result, targetSentence, hasNextLevel) {
        this.elements.overlayTitle.textContent = '恭喜通关！';
        this.elements.pauseContent.classList.add('hidden');
        this.elements.victoryContent.classList.remove('hidden');
        this.elements.btnResume.classList.add('hidden');
        
        this.elements.finalTime.textContent = result.formattedTime;
        this.elements.finalSteps.textContent = result.steps;
        this.elements.finalScore.textContent = result.score;
        
        this.elements.finalRating.textContent = result.rating;
        this.elements.finalRating.style.color = result.ratingColor;
        this.elements.finalRating.className = `value rating rating-${result.rating}`;
        
        this.elements.reconstructedText.textContent = targetSentence;
        
        if (hasNextLevel) {
            this.elements.btnNextLevel.classList.remove('hidden');
        } else {
            this.elements.btnNextLevel.classList.add('hidden');
        }
        
        this.elements.pauseOverlay.classList.remove('hidden');
    }

    hideOverlay() {
        this.elements.pauseOverlay.classList.add('hidden');
    }

    handleFileImport(e) {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            const content = event.target.result;
            this.onImportLevel(content, file.name);
        };
        reader.readAsText(file);
        
        e.target.value = '';
    }

    downloadJSON(content, filename) {
        const blob = new Blob([content], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    formatTime(seconds) {
        if (!seconds) return '--:--';
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    getDropZoneElement() {
        return this.elements.printFrame;
    }

    getPoolElement() {
        return this.elements.charPool;
    }

    highlightNextPosition(position) {
        this.clearHighlights();
        
        if (!position) return;
        
        const cell = this.elements.printFrame.querySelector(
            `.frame-cell[data-row="${position.row}"][data-col="${position.col}"]`
        );
        
        if (cell && !cell.classList.contains('forbidden')) {
            cell.classList.add('next-position');
        }
    }

    clearHighlights() {
        const cells = this.elements.printFrame.querySelectorAll('.frame-cell');
        cells.forEach(cell => {
            cell.classList.remove('next-position', 'invalid-drop', 'valid-drop');
        });
    }

    highlightInvalidCell(row, col) {
        const cell = this.elements.printFrame.querySelector(
            `.frame-cell[data-row="${row}"][data-col="${col}"]`
        );
        if (cell) {
            cell.classList.add('invalid-drop');
        }
    }
}