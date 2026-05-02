const RECORDS_STORAGE_KEY = 'movable_type_records';
const MAX_HISTORY_SIZE = 50;

export class HistoryManager {
    constructor() {
        this.undoStack = [];
        this.redoStack = [];
        this.maxSize = MAX_HISTORY_SIZE;
    }

    pushState(state) {
        const stateCopy = JSON.parse(JSON.stringify(state));
        this.undoStack.push(stateCopy);
        this.redoStack = [];
        
        if (this.undoStack.length > this.maxSize) {
            this.undoStack.shift();
        }
    }

    canUndo() {
        return this.undoStack.length > 1;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    undo(currentState) {
        if (!this.canUndo()) {
            return null;
        }
        
        const currentCopy = JSON.parse(JSON.stringify(currentState));
        this.redoStack.push(currentCopy);
        
        const previousState = this.undoStack.pop();
        return previousState;
    }

    redo(currentState) {
        if (!this.canRedo()) {
            return null;
        }
        
        const currentCopy = JSON.parse(JSON.stringify(currentState));
        this.undoStack.push(currentCopy);
        
        const nextState = this.redoStack.pop();
        return nextState;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    setInitialState(state) {
        this.clear();
        this.undoStack.push(JSON.parse(JSON.stringify(state)));
    }

    getUndoCount() {
        return this.undoStack.length;
    }

    getRedoCount() {
        return this.redoStack.length;
    }
}

export class RecordsManager {
    constructor() {
        this.records = {};
        this.loadRecords();
    }

    loadRecords() {
        try {
            const saved = localStorage.getItem(RECORDS_STORAGE_KEY);
            if (saved) {
                this.records = JSON.parse(saved);
            }
        } catch (error) {
            console.warn('无法加载游戏记录:', error);
            this.records = {};
        }
    }

    saveRecords() {
        try {
            localStorage.setItem(RECORDS_STORAGE_KEY, JSON.stringify(this.records));
        } catch (error) {
            console.error('保存游戏记录失败:', error);
        }
    }

    addRecord(levelId, result) {
        if (!this.records[levelId]) {
            this.records[levelId] = {
                bestScore: 0,
                bestTime: Infinity,
                bestSteps: Infinity,
                plays: 0,
                completed: false,
                history: []
            };
        }

        const record = this.records[levelId];
        record.plays++;
        
        if (result.completed) {
            record.completed = true;
            
            if (result.score > record.bestScore) {
                record.bestScore = result.score;
            }
            
            if (result.timeSeconds < record.bestTime) {
                record.bestTime = result.timeSeconds;
            }
            
            if (result.steps < record.bestSteps) {
                record.bestSteps = result.steps;
            }
            
            record.history.push({
                score: result.score,
                time: result.timeSeconds,
                steps: result.steps,
                rating: result.rating,
                date: new Date().toISOString()
            });
            
            if (record.history.length > 20) {
                record.history = record.history.slice(-20);
            }
        }

        this.saveRecords();
        return record;
    }

    getRecord(levelId) {
        return this.records[levelId] || null;
    }

    getAllRecords() {
        return { ...this.records };
    }

    isLevelCompleted(levelId) {
        return this.records[levelId]?.completed || false;
    }

    getLevelStats(levelId) {
        const record = this.records[levelId];
        if (!record) {
            return {
                completed: false,
                plays: 0,
                bestScore: 0,
                bestTime: null,
                bestSteps: null,
                rating: null
            };
        }

        return {
            completed: record.completed,
            plays: record.plays,
            bestScore: record.bestScore,
            bestTime: record.bestTime === Infinity ? null : record.bestTime,
            bestSteps: record.bestSteps === Infinity ? null : record.bestSteps,
            rating: this.getBestRating(record)
        };
    }

    getBestRating(record) {
        if (!record || !record.history || record.history.length === 0) {
            return null;
        }
        
        const ratings = ['S', 'A', 'B', 'C', 'D'];
        let bestRatingIndex = ratings.length - 1;
        
        for (const entry of record.history) {
            const index = ratings.indexOf(entry.rating);
            if (index !== -1 && index < bestRatingIndex) {
                bestRatingIndex = index;
            }
        }
        
        return ratings[bestRatingIndex];
    }

    clearRecords() {
        this.records = {};
        this.saveRecords();
    }

    clearLevelRecord(levelId) {
        delete this.records[levelId];
        this.saveRecords();
    }

    exportRecords() {
        return JSON.stringify(this.records, null, 2);
    }

    importRecords(jsonString) {
        try {
            const data = JSON.parse(jsonString);
            this.records = { ...this.records, ...data };
            this.saveRecords();
            return { success: true };
        } catch (error) {
            return { success: false, error: 'JSON 格式错误' };
        }
    }
}

export class GameStateSerializer {
    static serializeGameState(gameState) {
        return {
            levelId: gameState.levelId,
            gridState: gameState.gridState,
            steps: gameState.steps,
            startTime: gameState.startTime,
            pausedTime: gameState.pausedTime,
            isPaused: gameState.isPaused
        };
    }

    static deserializeGameState(serialized) {
        return {
            levelId: serialized.levelId,
            gridState: serialized.gridState,
            steps: serialized.steps,
            startTime: serialized.startTime,
            pausedTime: serialized.pausedTime,
            isPaused: serialized.isPaused
        };
    }

    static createSnapshot(layoutRules, steps, elapsedSeconds) {
        return {
            gridState: layoutRules.getGridState(),
            steps: steps,
            timestamp: Date.now(),
            elapsedSeconds: elapsedSeconds
        };
    }
}