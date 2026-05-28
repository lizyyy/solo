var HistoryManager = (function() {

    function create() {
        return {
            undoStack: [],
            redoStack: [],
            log: [],
            snapshots: []
        };
    }

    function pushAction(history, action, oldSnapshot, newSnapshot) {
        action.timestamp = action.timestamp || Date.now();
        action.id = action.id || Date.now() + '-' + Math.random().toString(36).substr(2, 9);
        if (oldSnapshot) {
            action.oldSnapshot = oldSnapshot;
        }
        if (newSnapshot) {
            action.newSnapshot = newSnapshot;
        }
        history.undoStack.push(action);
        history.redoStack = [];
        history.log.push({
            type: 'action',
            originalType: action.type,
            index: action.index,
            oldValue: action.oldValue,
            newValue: action.newValue,
            description: describeAction(action),
            timestamp: action.timestamp,
            id: action.id,
            undone: false
        });
    }

    function pushHintAction(history, hint) {
        var entry = {
            type: 'hint',
            level: hint.level,
            message: hint.message,
            cell: hint.cell,
            technique: hint.technique,
            value: hint.value,
            timestamp: Date.now(),
            id: Date.now() + '-' + Math.random().toString(36).substr(2, 9)
        };
        history.log.push(entry);
        return entry;
    }

    function undo(history, board) {
        if (history.undoStack.length === 0) return null;
        var action = history.undoStack.pop();

        if (action.index === -1 || action.type === 'import') {
            if (action.oldSnapshot) {
                board.fromJSON(action.oldSnapshot);
                board.propagateAll();
                board.detectConflicts();
            }
        } else if (action.index >= 0 && action.index < 81) {
            board.cells[action.index].value = action.oldValue;
            board.cells[action.index].candidates = new Set(action.oldCandidates);
            board.cells[action.index].given = action.wasGiven;
            board.propagateAll();
            board.detectConflicts();
        }

        history.redoStack.push(action);
        history.log.push({
            type: 'undo',
            ofId: action.id,
            description: '撤销: ' + describeAction(action),
            timestamp: Date.now()
        });

        return action;
    }

    function redo(history, board) {
        if (history.redoStack.length === 0) return null;
        var action = history.redoStack.pop();

        if (action.index === -1 || action.type === 'import') {
            if (action.newSnapshot) {
                board.fromJSON(action.newSnapshot);
                board.propagateAll();
                board.detectConflicts();
            }
        } else if (action.index >= 0 && action.index < 81) {
            board.cells[action.index].value = action.newValue;
            board.cells[action.index].candidates = new Set(action.newCandidates);
            board.cells[action.index].given = action.isGiven;
            board.propagateAll();
            board.detectConflicts();
        }

        history.undoStack.push(action);
        history.log.push({
            type: 'redo',
            ofId: action.id,
            description: '重做: ' + describeAction(action),
            timestamp: Date.now()
        });

        return action;
    }

    function canUndo(history) {
        return history.undoStack.length > 0;
    }

    function canRedo(history) {
        return history.redoStack.length > 0;
    }

    function getLog(history) {
        return history.log;
    }

    function describeAction(action) {
        var row, col;
        switch (action.type) {
            case 'set_value':
                row = Math.floor(action.index / 9) + 1;
                col = (action.index % 9) + 1;
                return 'R' + row + 'C' + col + ': ' + (action.oldValue || '_') + ' \u2192 ' + (action.newValue || '_');
            case 'clear_value':
                row = Math.floor(action.index / 9) + 1;
                col = (action.index % 9) + 1;
                return 'R' + row + 'C' + col + ': ' + action.oldValue + ' \u2192 _';
            case 'import':
                return '\u5bfc\u5165\u76d8\u9762';
            default:
                return action.type;
        }
    }

    function toJSON(history) {
        return {
            log: history.log,
            undoCount: history.undoStack.length,
            redoCount: history.redoStack.length
        };
    }

    function fromJSON(data) {
        var h = create();
        if (data && data.log) {
            h.log = data.log;
        }
        return h;
    }

    return {
        create: create,
        pushAction: pushAction,
        pushHintAction: pushHintAction,
        undo: undo,
        redo: redo,
        canUndo: canUndo,
        canRedo: canRedo,
        getLog: getLog,
        describeAction: describeAction,
        toJSON: toJSON,
        fromJSON: fromJSON
    };
})();
