export class HistoryManager {
    constructor(maxHistory = 50) {
        this.undoStack = [];
        this.redoStack = [];
        this.maxHistory = maxHistory;
    }

    saveState(stateSnapshot) {
        this.undoStack.push({
            state: stateSnapshot,
            timestamp: Date.now()
        });

        if (this.undoStack.length > this.maxHistory) {
            this.undoStack.shift();
        }

        this.redoStack = [];
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    undo(currentState) {
        if (!this.canUndo()) {
            return null;
        }

        const previousState = this.undoStack.pop();
        
        this.redoStack.push({
            state: currentState,
            timestamp: Date.now()
        });

        return previousState.state;
    }

    redo(currentState) {
        if (!this.canRedo()) {
            return null;
        }

        const nextState = this.redoStack.pop();
        
        this.undoStack.push({
            state: currentState,
            timestamp: Date.now()
        });

        return nextState.state;
    }

    getUndoCount() {
        return this.undoStack.length;
    }

    getRedoCount() {
        return this.redoStack.length;
    }

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    getHistorySummary() {
        return {
            canUndo: this.canUndo(),
            canRedo: this.canRedo(),
            undoCount: this.getUndoCount(),
            redoCount: this.getRedoCount()
        };
    }
}
