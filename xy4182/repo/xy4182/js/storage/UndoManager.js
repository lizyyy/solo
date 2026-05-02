/**
 * 撤销管理器
 * 管理游戏历史记录，支持撤销和重做
 */

class UndoManager {
    constructor(engine, editor, renderer) {
        this.engine = engine;
        this.editor = editor;
        this.renderer = renderer;
        
        this.undoStack = [];
        this.redoStack = [];
        
        this.maxHistorySize = 50;
        
        this.isUndoing = false;
        this.isRedoing = false;
    }

    saveState() {
        if (this.isUndoing || this.isRedoing) return;
        
        const state = this.createSnapshot();
        
        this.undoStack.push(state);
        
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        
        this.redoStack = [];
    }

    createSnapshot() {
        const shipsClone = this.engine.ships.map(ship => {
            const clone = ship.clone();
            return clone.toJSON();
        });
        
        return {
            timestamp: Date.now(),
            turn: this.engine.turn,
            ships: shipsClone,
            penaltyPoints: this.engine.penaltyPoints,
            incidents: JSON.parse(JSON.stringify(this.engine.incidents || [])),
            selectedShipId: this.engine.selectedShipId,
            pendingMoves: this.serializePendingMoves()
        };
    }

    serializePendingMoves() {
        const moves = {};
        for (const [shipId, move] of this.engine.pendingMoves) {
            moves[shipId] = { ...move };
        }
        return moves;
    }

    deserializePendingMoves(movesData) {
        const moves = new Map();
        for (const shipId in movesData) {
            if (movesData.hasOwnProperty(shipId)) {
                moves.set(shipId, { ...movesData[shipId] });
            }
        }
        return moves;
    }

    canUndo() {
        return this.undoStack.length > 0;
    }

    canRedo() {
        return this.redoStack.length > 0;
    }

    undo() {
        if (!this.canUndo()) {
            console.log('没有可撤销的操作');
            return false;
        }
        
        this.isUndoing = true;
        
        const currentState = this.createSnapshot();
        this.redoStack.push(currentState);
        
        const previousState = this.undoStack.pop();
        this.restoreState(previousState);
        
        this.isUndoing = false;
        
        console.log(`已撤销到回合 ${previousState.turn}`);
        return true;
    }

    redo() {
        if (!this.canRedo()) {
            console.log('没有可重做的操作');
            return false;
        }
        
        this.isRedoing = true;
        
        const currentState = this.createSnapshot();
        this.undoStack.push(currentState);
        
        const nextState = this.redoStack.pop();
        this.restoreState(nextState);
        
        this.isRedoing = false;
        
        console.log(`已重做至回合 ${nextState.turn}`);
        return true;
    }

    restoreState(state) {
        this.engine.turn = state.turn;
        this.engine.penaltyPoints = state.penaltyPoints;
        this.engine.incidents = JSON.parse(JSON.stringify(state.incidents || []));
        this.engine.selectedShipId = state.selectedShipId;
        this.engine.pendingMoves = this.deserializePendingMoves(state.pendingMoves);
        
        this.engine.ships = state.ships.map(shipData => Ship.fromJSON(shipData));
        
        this.updateUI();
        this.renderer.render();
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

    clear() {
        this.undoStack = [];
        this.redoStack = [];
    }

    getHistorySize() {
        return {
            undo: this.undoStack.length,
            redo: this.redoStack.length
        };
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { UndoManager };
}
