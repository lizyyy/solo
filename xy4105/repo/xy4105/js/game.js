import { LevelData } from './levelData.js';
import { LayoutRules, VALIDATION_ERRORS } from './layoutRules.js';
import { DragDropManager } from './dragDrop.js';
import { HistoryManager, RecordsManager, GameStateSerializer } from './stateStorage.js';
import { ScoringSystem } from './scoring.js';
import { UIManager } from './uiManager.js';

class Game {
    constructor() {
        this.levelData = new LevelData();
        this.layoutRules = new LayoutRules();
        this.dragDrop = new DragDropManager();
        this.history = new HistoryManager();
        this.records = new RecordsManager();
        this.scoring = new ScoringSystem();
        this.ui = new UIManager({
            onStartGame: () => this.showLevelSelect(),
            onLevelSelect: (index) => this.startLevel(index),
            onPause: () => this.pauseGame(),
            onResume: () => this.resumeGame(),
            onRestart: () => this.restartLevel(),
            onUndo: () => this.undo(),
            onRedo: () => this.redo(),
            onExit: () => this.exitLevel(),
            onNextLevel: () => this.nextLevel(),
            onImportLevel: (content, filename) => this.importLevel(content, filename),
            onExportTemplate: () => this.exportLevelTemplate()
        });
        
        this.currentLevel = null;
        this.steps = 0;
        this.isPlaying = false;
        this.isPaused = false;
        this.mistakeCount = 0;
    }

    async init() {
        await this.levelData.init();
        this.ui.init();
        this.setupDragDrop();
        this.ui.showScreen('menu');
    }

    setupDragDrop() {
        this.dragDrop.init();
        
        this.dragDrop.onDragStart = (data, element) => {
            this.ui.clearHighlights();
            const nextPos = this.layoutRules.getNextExpectedPosition();
            if (nextPos) {
                this.ui.highlightNextPosition(nextPos);
            }
        };
        
        this.dragDrop.onDragEnd = () => {
            this.ui.clearHighlights();
        };
        
        this.dragDrop.onDrop = (data, zoneType, position, options, e) => {
            if (zoneType === 'frame') {
                this.handleFrameDrop(data, position);
            }
        };
    }

    showLevelSelect() {
        const levels = this.levelData.getAllLevels();
        this.ui.renderLevelList(levels, this.records);
        this.ui.showScreen('levelSelect');
    }

    async startLevel(levelIndex) {
        this.currentLevel = this.levelData.getLevel(levelIndex);
        if (!this.currentLevel) {
            this.ui.showMessage('关卡不存在', 'error');
            return;
        }
        
        this.layoutRules.init(this.currentLevel);
        
        this.steps = 0;
        this.mistakeCount = 0;
        this.isPlaying = true;
        this.isPaused = false;
        
        const initialState = GameStateSerializer.createSnapshot(
            this.layoutRules, 
            this.steps, 
            0
        );
        this.history.setInitialState(initialState);
        
        this.scoring.resetTimer();
        this.scoring.startTimer();
        
        this.setupDropZones();
        
        this.renderGame();
        
        this.ui.showScreen('game');
        this.ui.hideOverlay();
    }

    setupDropZones() {
        const frame = this.ui.getDropZoneElement();
        this.dragDrop.makeDropZone(frame, 'frame');
    }

    renderGame() {
        const availableChars = this.layoutRules.getAvailableCharactersInPool();
        this.ui.renderCharacterPool(availableChars);
        
        const gridState = this.layoutRules.getGridState();
        this.ui.renderPrintFrame(this.currentLevel.gridSize, gridState);
        
        this.makeCharactersDraggable();
        this.makePlacedCharactersInteractive();
        
        this.updateUI();
        
        const nextPos = this.layoutRules.getNextExpectedPosition();
        if (nextPos) {
            this.ui.highlightNextPosition(nextPos);
        }
    }

    makeCharactersDraggable() {
        const tiles = document.querySelectorAll('#char-pool .character-tile');
        tiles.forEach(tile => {
            const char = tile.dataset.character;
            this.dragDrop.makeDraggable(tile, {
                character: char,
                source: 'pool',
                element: tile
            });
        });
    }

    makePlacedCharactersInteractive() {
        const placedTiles = document.querySelectorAll('.placed-character');
        placedTiles.forEach(tile => {
            tile.addEventListener('click', (e) => {
                e.stopPropagation();
                this.removePlacedCharacter(tile);
            });
            
            this.dragDrop.makeDraggable(tile, {
                character: tile.dataset.character,
                source: 'frame',
                row: parseInt(tile.dataset.row),
                col: parseInt(tile.dataset.col)
            });
        });
    }

    handleFrameDrop(data, position) {
        if (!this.isPlaying || this.isPaused) return;
        
        const frame = this.ui.getDropZoneElement();
        const cells = frame.querySelectorAll('.frame-cell');
        const cellIndex = this.getCellIndexFromPosition(position, cells);
        
        if (cellIndex === -1) {
            this.ui.showMessage('请放置在版框内', 'warning');
            return;
        }
        
        const cell = cells[cellIndex];
        const row = parseInt(cell.dataset.row);
        const col = parseInt(cell.dataset.col);
        
        let result;
        
        if (data.source === 'pool') {
            result = this.layoutRules.placeCharacter(data.character, row, col);
        } else if (data.source === 'frame') {
            result = this.layoutRules.moveCharacter(data.row, data.col, row, col);
        }
        
        if (result.valid) {
            this.steps++;
            this.saveState();
            this.renderGame();
            this.checkCompletion();
        } else {
            this.mistakeCount++;
            this.ui.showValidationError(result.error, result.message);
            this.ui.highlightInvalidCell(row, col);
        }
    }

    getCellIndexFromPosition(position, cells) {
        for (let i = 0; i < cells.length; i++) {
            const rect = cells[i].getBoundingClientRect();
            if (
                position.clientX >= rect.left &&
                position.clientX <= rect.right &&
                position.clientY >= rect.top &&
                position.clientY <= rect.bottom
            ) {
                return i;
            }
        }
        return -1;
    }

    removePlacedCharacter(tile) {
        if (!this.isPlaying || this.isPaused) return;
        
        const row = parseInt(tile.dataset.row);
        const col = parseInt(tile.dataset.col);
        
        const result = this.layoutRules.removeCharacter(row, col);
        
        if (result.success) {
            this.steps++;
            this.saveState();
            this.renderGame();
        } else {
            this.ui.showMessage(result.error, 'warning');
        }
    }

    saveState() {
        const state = GameStateSerializer.createSnapshot(
            this.layoutRules,
            this.steps,
            this.scoring.getElapsedSeconds()
        );
        this.history.pushState(state);
        this.updateUI();
    }

    undo() {
        if (!this.history.canUndo()) return;
        
        const currentState = GameStateSerializer.createSnapshot(
            this.layoutRules,
            this.steps,
            this.scoring.getElapsedSeconds()
        );
        
        const previousState = this.history.undo(currentState);
        
        if (previousState) {
            this.layoutRules.setGridState(previousState.gridState);
            this.steps = previousState.steps;
            this.renderGame();
            this.ui.showMessage('已撤销', 'info', 1500);
        }
    }

    redo() {
        if (!this.history.canRedo()) return;
        
        const currentState = GameStateSerializer.createSnapshot(
            this.layoutRules,
            this.steps,
            this.scoring.getElapsedSeconds()
        );
        
        const nextState = this.history.redo(currentState);
        
        if (nextState) {
            this.layoutRules.setGridState(nextState.gridState);
            this.steps = nextState.steps;
            this.renderGame();
            this.ui.showMessage('已重做', 'info', 1500);
        }
    }

    checkCompletion() {
        const result = this.layoutRules.checkCompletion();
        
        if (result.complete) {
            this.completeLevel();
        }
    }

    completeLevel() {
        this.isPlaying = false;
        this.scoring.stopTimer();
        
        const gameResult = this.scoring.generateResult(
            true,
            this.steps,
            this.currentLevel.targetTime,
            this.currentLevel.maxSteps,
            {
                noMistakes: this.mistakeCount === 0
            }
        );
        
        this.records.addRecord(this.currentLevel.id, gameResult);
        
        const hasNextLevel = this.levelData.hasNextLevel();
        
        this.ui.showVictoryOverlay(
            gameResult,
            this.currentLevel.targetSentence,
            hasNextLevel
        );
    }

    pauseGame() {
        if (!this.isPlaying || this.isPaused) return;
        
        this.isPaused = true;
        this.scoring.pauseTimer();
        this.ui.showPauseOverlay();
    }

    resumeGame() {
        if (!this.isPaused) return;
        
        this.isPaused = false;
        this.scoring.resumeTimer();
        this.ui.hideOverlay();
    }

    restartLevel() {
        this.ui.hideOverlay();
        if (this.currentLevel) {
            this.startLevel(this.currentLevel.index);
        }
    }

    exitLevel() {
        this.isPlaying = false;
        this.isPaused = false;
        this.scoring.stopTimer();
        this.ui.hideOverlay();
        this.showLevelSelect();
    }

    nextLevel() {
        const nextLevel = this.levelData.getNextLevel();
        if (nextLevel) {
            this.startLevel(nextLevel.index);
        }
    }

    updateUI() {
        this.ui.updateGameUI(
            this.currentLevel,
            this.steps,
            this.currentLevel.maxSteps,
            this.history.canUndo(),
            this.history.canRedo()
        );
        
        this.ui.updateTimer(this.scoring.getFormattedTime());
        
        const currentScore = this.scoring.calculateScore(
            this.steps,
            this.currentLevel.targetTime,
            this.currentLevel.maxSteps
        );
        this.ui.updateScore(currentScore);
    }

    importLevel(content, filename) {
        const result = this.levelData.importLevelFromJSON(content);
        
        if (result.success) {
            this.ui.showMessage(`关卡"${result.level.title}"导入成功！`, 'success');
            this.showLevelSelect();
        } else {
            this.ui.showMessage('导入失败: ' + result.error, 'error');
        }
    }

    exportLevelTemplate() {
        const template = this.levelData.exportLevelTemplate();
        this.ui.downloadJSON(template, 'level-template.json');
        this.ui.showMessage('关卡模板已导出', 'info');
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const game = new Game();
    await game.init();
    
    window.gameInstance = game;
});