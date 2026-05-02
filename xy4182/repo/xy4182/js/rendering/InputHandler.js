/**
 * 输入处理器
 * 处理鼠标、键盘输入，协调编辑和演练模式
 */

class InputHandler {
    constructor(engine, editor, renderer) {
        this.engine = engine;
        this.editor = editor;
        this.renderer = renderer;
        this.canvas = renderer.getCanvas();
        
        this.isMouseDown = false;
        this.lastMousePos = { x: 0, y: 0 };
        this.lastGridPos = { x: -1, y: -1 };
        
        this.keyStates = {};
        
        this.moveDirections = {
            ArrowUp: { dx: 0, dy: -1 },
            ArrowDown: { dx: 0, dy: 1 },
            ArrowLeft: { dx: -1, dy: 0 },
            ArrowRight: { dx: 1, dy: 0 },
            w: { dx: 0, dy: -1 },
            s: { dx: 0, dy: 1 },
            a: { dx: -1, dy: 0 },
            d: { dx: 1, dy: 0 },
            W: { dx: 0, dy: -1 },
            S: { dx: 0, dy: 1 },
            A: { dx: -1, dy: 0 },
            D: { dx: 1, dy: 0 }
        };
        
        this.speedModifier = {
            Shift: 1,
            Default: 1
        };
        
        this.init();
    }

    init() {
        this.canvas.addEventListener('mousedown', (e) => this.handleMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.handleMouseUp(e));
        this.canvas.addEventListener('mouseleave', (e) => this.handleMouseLeave(e));
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            this.handleRightClick(e);
        });
        
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
        document.addEventListener('keyup', (e) => this.handleKeyUp(e));
    }

    getCanvasPos(e) {
        const rect = this.canvas.getBoundingClientRect();
        return {
            x: e.clientX - rect.left,
            y: e.clientY - rect.top
        };
    }

    handleMouseDown(e) {
        if (e.button !== 0) return;
        
        this.isMouseDown = true;
        const pos = this.getCanvasPos(e);
        this.lastMousePos = pos;
        
        const gridPos = this.renderer.screenToGrid(pos.x, pos.y);
        this.lastGridPos = gridPos;
        
        this.handleClick(gridPos, e);
    }

    handleMouseMove(e) {
        const pos = this.getCanvasPos(e);
        this.lastMousePos = pos;
        
        const gridPos = this.renderer.screenToGrid(pos.x, pos.y);
        
        if (gridPos.x !== this.lastGridPos.x || gridPos.y !== this.lastGridPos.y) {
            this.lastGridPos = gridPos;
            this.handleHover(gridPos);
        }
        
        if (this.isMouseDown) {
            this.handleDrag(gridPos, e);
        }
    }

    handleMouseUp(e) {
        this.isMouseDown = false;
    }

    handleMouseLeave(e) {
        this.isMouseDown = false;
        this.renderer.setHoverCell(null, null);
        this.renderer.render();
    }

    handleRightClick(e) {
        const pos = this.getCanvasPos(e);
        const gridPos = this.renderer.screenToGrid(pos.x, pos.y);
        
        if (this.engine.getMode() === GameMode.PLAY) {
            const selectedShip = this.engine.getSelectedShip();
            if (selectedShip) {
                this.engine.clearPendingMoves();
                this.renderer.clearPreviewMoves();
                this.renderer.render();
            }
        }
    }

    handleClick(gridPos, e) {
        if (gridPos.x < 0 || gridPos.y < 0) return;
        
        const mode = this.engine.getMode();
        
        if (mode === GameMode.EDIT) {
            this.handleEditClick(gridPos, e);
        } else if (mode === GameMode.PLAY) {
            this.handlePlayClick(gridPos, e);
        }
        
        this.renderer.render();
    }

    handleEditClick(gridPos, e) {
        const tool = this.editor.getTool();
        if (!tool) return;
        
        this.editor.handleCanvasClick(gridPos.x, gridPos.y);
        this.syncLevelToEngine();
    }

    handlePlayClick(gridPos, e) {
        const clickedShip = this.engine.ships.find(ship => 
            Math.abs(ship.x - gridPos.x) < 0.5 && 
            Math.abs(ship.y - gridPos.y) < 0.5
        );
        
        if (clickedShip) {
            if (clickedShip.isControllable()) {
                this.engine.selectShip(clickedShip.id);
            }
        } else {
            const selectedShip = this.engine.getSelectedShip();
            if (selectedShip) {
                const dx = gridPos.x - selectedShip.x;
                const dy = gridPos.y - selectedShip.y;
                
                if (dx >= -2 && dx <= 2 && dy >= -2 && dy <= 2) {
                    const result = this.engine.planMove(selectedShip.id, dx, dy);
                    if (result.valid) {
                        this.updateInfoText(`已规划移动: (${dx}, ${dy})`);
                    } else {
                        this.updateInfoText(`无效移动: ${result.reason}`);
                    }
                }
            }
        }
    }

    handleHover(gridPos) {
        this.renderer.setHoverCell(gridPos.x, gridPos.y);
        
        if (this.engine.getMode() === GameMode.PLAY) {
            const selectedShip = this.engine.getSelectedShip();
            if (selectedShip) {
                const hoveredShip = this.engine.ships.find(ship => 
                    Math.abs(ship.x - gridPos.x) < 0.5 && 
                    Math.abs(ship.y - gridPos.y) < 0.5
                );
                
                if (hoveredShip) {
                    this.showShipInfo(hoveredShip);
                } else if (gridPos.x >= 0 && gridPos.y >= 0) {
                    const dx = gridPos.x - selectedShip.x;
                    const dy = gridPos.y - selectedShip.y;
                    
                    if (Math.abs(dx) <= 2 && Math.abs(dy) <= 2 && (dx !== 0 || dy !== 0)) {
                        const terrain = this.engine.board.getTerrain(gridPos.x, gridPos.y);
                        const speedLimit = this.engine.board.getMaxSpeed(selectedShip.x, selectedShip.y);
                        this.updateInfoText(`目标位置: (${gridPos.x}, ${gridPos.y}), 地形: ${this.getTerrainName(terrain)}, 限速: ${speedLimit}`);
                    }
                }
            }
        } else if (this.engine.getMode() === GameMode.EDIT) {
            if (gridPos.x >= 0 && gridPos.y >= 0) {
                const terrain = this.engine.board.getTerrain(gridPos.x, gridPos.y);
                const current = this.engine.board.getCurrentAt(gridPos.x, gridPos.y);
                
                let info = `位置: (${gridPos.x}, ${gridPos.y}), 地形: ${this.getTerrainName(terrain)}`;
                if (current) {
                    info += `, 潮流: ${current.name}`;
                }
                this.updateInfoText(info);
            }
        }
        
        this.renderer.render();
    }

    handleDrag(gridPos, e) {
        if (this.engine.getMode() === GameMode.EDIT) {
            const tool = this.editor.getTool();
            if (tool && (tool === EditTool.DEEP_WATER || 
                         tool === EditTool.SHALLOW_WATER || 
                         tool === EditTool.SPEED_LIMIT)) {
                this.editor.handleCanvasClick(gridPos.x, gridPos.y);
                this.syncLevelToEngine();
                this.renderer.render();
            }
        }
    }

    handleKeyDown(e) {
        this.keyStates[e.key] = true;
        
        if (this.engine.getMode() !== GameMode.PLAY) return;
        
        const selectedShip = this.engine.getSelectedShip();
        if (!selectedShip) return;
        
        const direction = this.moveDirections[e.key];
        if (direction) {
            let speed = 1;
            if (this.keyStates['Shift'] || this.keyStates['shift']) {
                speed = 2;
            }
            
            const maxSpeed = this.engine.board.getMaxSpeed(selectedShip.x, selectedShip.y);
            speed = Math.min(speed, maxSpeed);
            
            const dx = direction.dx * speed;
            const dy = direction.dy * speed;
            
            const result = this.engine.planMove(selectedShip.id, dx, dy);
            if (result.valid) {
                this.updateInfoText(`已规划移动: (${dx}, ${dy})`);
            } else {
                this.updateInfoText(`无效移动: ${result.reason}`);
            }
            this.renderer.render();
        }
        
        if (e.key === 'Enter' || e.key === ' ') {
            if (this.engine.allControllableShipsMoved()) {
                this.executeTurn();
            } else {
                this.updateInfoText('请先为所有可控船舶规划移动');
            }
        }
        
        if (e.key === 'z' && (this.keyStates['Control'] || this.keyStates['ctrl'])) {
            this.undo();
        }
        
        if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.engine.getSelectedShip()) {
                this.engine.clearPendingMoves();
                this.renderer.clearPreviewMoves();
                this.updateInfoText('已取消移动规划');
                this.renderer.render();
            }
        }
    }

    handleKeyUp(e) {
        this.keyStates[e.key] = false;
    }

    syncLevelToEngine() {
        const level = this.editor.getLevel();
        if (level) {
            this.engine.board = Board.fromJSON(level.boardData);
            this.engine.ships = level.ships.map(s => Ship.fromJSON(s));
        }
    }

    executeTurn() {
        this.engine.executeTurn();
        this.updateUI();
        this.renderer.render();
    }

    undo() {
        this.updateInfoText('撤销功能需要历史记录支持');
    }

    showShipInfo(ship) {
        const state = ship.getStateDisplayName();
        const type = ship.getTypeDisplayName();
        const heading = ship.getHeadingName();
        const info = `${ship.name} - ${type}, 状态: ${state}, 航向: ${heading}, 位置: (${ship.x}, ${ship.y})`;
        this.updateInfoText(info);
    }

    getTerrainName(terrain) {
        switch (terrain) {
            case TerrainType.DEEP_WATER: return '深水航道';
            case TerrainType.SHALLOW_WATER: return '浅滩';
            case TerrainType.SPEED_LIMIT: return '限速区';
            case TerrainType.BERTH: return '泊位';
            case TerrainType.BOUNDARY: return '边界';
            default: return '未知';
        }
    }

    updateInfoText(text) {
        const infoText = document.getElementById('info-text');
        if (infoText) {
            infoText.textContent = text;
        }
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
        
        if (state.gameEnded) {
            const message = state.winner === 'success' 
                ? `恭喜！任务完成！用时 ${state.turn} 回合，扣分 ${state.penaltyPoints} 分`
                : `任务失败！用时超过 ${state.turn} 回合`;
            alert(message);
        }
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
            
            item.addEventListener('click', () => {
                if (ship.isControllable()) {
                    this.engine.selectShip(ship.id);
                    this.updateUI();
                    this.renderer.render();
                }
            });
            
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
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { InputHandler };
}
