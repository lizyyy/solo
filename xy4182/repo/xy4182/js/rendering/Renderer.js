/**
 * 渲染引擎
 * 使用Canvas渲染棋盘、地形、船舶、UI元素
 */

const Colors = {
    DEEP_WATER: '#1a5276',
    SHALLOW_WATER: '#d4ac0d',
    SPEED_LIMIT: '#5d6d7e',
    BERTH: '#27ae60',
    GRID_LINE: '#1a4a6a',
    CURRENT_ARROW: '#f39c12',
    SHIP_TUG: '#3498db',
    SHIP_CARGO: '#e74c3c',
    SHIP_OTHER: '#9b59b6',
    SHIP_SELECTED: '#f1c40f',
    SHIP_ARRIVED: '#2ecc71',
    MOVE_PREVIEW: '#3498db',
    MOVE_PATH: '#f39c12',
    HIGHLIGHT: '#f1c40f'
};

class Renderer {
    constructor(canvas, engine, editor) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.engine = engine;
        this.editor = editor;
        
        this.cellSize = 40;
        this.gridWidth = 20;
        this.gridHeight = 16;
        
        this.offsetX = 0;
        this.offsetY = 0;
        
        this.hoverCell = null;
        this.selectedCell = null;
        this.previewMoves = new Map();
        
        this.resize();
        window.addEventListener('resize', () => this.resize());
    }

    resize() {
        const container = this.canvas.parentElement;
        const maxWidth = container.clientWidth - 40;
        const maxHeight = container.clientHeight - 40;
        
        const aspectRatio = this.gridWidth / this.gridHeight;
        
        let canvasWidth = maxWidth;
        let canvasHeight = canvasWidth / aspectRatio;
        
        if (canvasHeight > maxHeight) {
            canvasHeight = maxHeight;
            canvasWidth = canvasHeight * aspectRatio;
        }
        
        this.canvas.width = canvasWidth;
        this.canvas.height = canvasHeight;
        
        this.cellSize = Math.min(
            canvasWidth / this.gridWidth,
            canvasHeight / this.gridHeight
        );
        
        this.offsetX = (canvasWidth - this.cellSize * this.gridWidth) / 2;
        this.offsetY = (canvasHeight - this.cellSize * this.gridHeight) / 2;
        
        this.render();
    }

    setGridSize(width, height) {
        this.gridWidth = width;
        this.gridHeight = height;
        this.resize();
    }

    render() {
        const ctx = this.ctx;
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        ctx.fillStyle = '#0d1b2a';
        ctx.fillRect(0, 0, width, height);
        
        this.renderTerrain();
        this.renderCurrents();
        this.renderGrid();
        this.renderPreviewMoves();
        this.renderShips();
        this.renderHover();
    }

    renderTerrain() {
        const ctx = this.ctx;
        const board = this.engine.board;
        
        if (!board) return;
        
        for (let y = 0; y < board.height; y++) {
            for (let x = 0; x < board.width; x++) {
                const terrain = board.getTerrain(x, y);
                let color = Colors.DEEP_WATER;
                
                switch (terrain) {
                    case TerrainType.SHALLOW_WATER:
                        color = Colors.SHALLOW_WATER;
                        break;
                    case TerrainType.SPEED_LIMIT:
                        color = Colors.SPEED_LIMIT;
                        break;
                    case TerrainType.BERTH:
                        color = Colors.BERTH;
                        break;
                }
                
                ctx.fillStyle = color;
                ctx.fillRect(
                    this.offsetX + x * this.cellSize,
                    this.offsetY + y * this.cellSize,
                    this.cellSize,
                    this.cellSize
                );
                
                if (terrain === TerrainType.SPEED_LIMIT) {
                    const speedLimit = board.getSpeedLimit(x, y);
                    ctx.fillStyle = '#ffffff';
                    ctx.font = `${this.cellSize * 0.4}px Arial`;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(
                        `${speedLimit}`,
                        this.offsetX + x * this.cellSize + this.cellSize / 2,
                        this.offsetY + y * this.cellSize + this.cellSize / 2
                    );
                }
                
                if (terrain === TerrainType.BERTH) {
                    const berthId = board.getBerthId(x, y);
                    if (berthId !== null) {
                        const berth = board.getBerth(berthId);
                        if (berth && berth.x === x && berth.y === y) {
                            ctx.strokeStyle = '#ffffff';
                            ctx.lineWidth = 2;
                            ctx.setLineDash([5, 3]);
                            ctx.strokeRect(
                                this.offsetX + x * this.cellSize + 2,
                                this.offsetY + y * this.cellSize + 2,
                                this.cellSize * berth.width - 4,
                                this.cellSize * berth.height - 4
                            );
                            ctx.setLineDash([]);
                            
                            ctx.fillStyle = '#ffffff';
                            ctx.font = `bold ${this.cellSize * 0.25}px Arial`;
                            ctx.textAlign = 'left';
                            ctx.textBaseline = 'top';
                            ctx.fillText(
                                berth.name,
                                this.offsetX + x * this.cellSize + 4,
                                this.offsetY + y * this.cellSize + 4
                            );
                        }
                    }
                }
            }
        }
    }

    renderCurrents() {
        const ctx = this.ctx;
        const board = this.engine.board;
        
        if (!board || !board.currents) return;
        
        for (const current of board.currents) {
            if (!current) continue;
            
            const centerX = this.offsetX + (current.x + current.width / 2) * this.cellSize;
            const centerY = this.offsetY + (current.y + current.height / 2) * this.cellSize;
            
            ctx.fillStyle = Colors.CURRENT_ARROW;
            ctx.save();
            ctx.translate(centerX, centerY);
            
            const angle = Math.atan2(current.dy, current.dx);
            ctx.rotate(angle);
            
            const arrowLength = Math.min(
                current.width,
                current.height
            ) * this.cellSize * 0.4;
            
            ctx.beginPath();
            ctx.moveTo(-arrowLength / 2, 0);
            ctx.lineTo(arrowLength / 2, 0);
            ctx.lineTo(arrowLength / 2 - 10, -8);
            ctx.moveTo(arrowLength / 2, 0);
            ctx.lineTo(arrowLength / 2 - 10, 8);
            ctx.lineWidth = 3;
            ctx.strokeStyle = Colors.CURRENT_ARROW;
            ctx.stroke();
            
            ctx.restore();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = `${this.cellSize * 0.25}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.fillText(
                current.name,
                centerX,
                centerY - this.cellSize * 0.4
            );
        }
    }

    renderGrid() {
        const ctx = this.ctx;
        const board = this.engine.board;
        
        if (!board) return;
        
        ctx.strokeStyle = Colors.GRID_LINE;
        ctx.lineWidth = 0.5;
        
        for (let x = 0; x <= board.width; x++) {
            ctx.beginPath();
            ctx.moveTo(
                this.offsetX + x * this.cellSize,
                this.offsetY
            );
            ctx.lineTo(
                this.offsetX + x * this.cellSize,
                this.offsetY + board.height * this.cellSize
            );
            ctx.stroke();
        }
        
        for (let y = 0; y <= board.height; y++) {
            ctx.beginPath();
            ctx.moveTo(
                this.offsetX,
                this.offsetY + y * this.cellSize
            );
            ctx.lineTo(
                this.offsetX + board.width * this.cellSize,
                this.offsetY + y * this.cellSize
            );
            ctx.stroke();
        }
    }

    renderShips() {
        const ctx = this.ctx;
        const ships = this.engine.ships;
        
        if (!ships) return;
        
        const selectedShip = this.engine.getSelectedShip();
        
        for (const ship of ships) {
            if (!ship) continue;
            
            const x = this.offsetX + ship.x * this.cellSize;
            const y = this.offsetY + ship.y * this.cellSize;
            const size = this.cellSize * 0.8;
            const padding = this.cellSize * 0.1;
            
            let color;
            switch (ship.type) {
                case ShipType.TUG:
                    color = Colors.SHIP_TUG;
                    break;
                case ShipType.CARGO:
                    color = Colors.SHIP_CARGO;
                    break;
                case ShipType.OTHER:
                    color = Colors.SHIP_OTHER;
                    break;
                default:
                    color = Colors.SHIP_OTHER;
            }
            
            if (ship.isArrived()) {
                color = Colors.SHIP_ARRIVED;
            }
            
            if (selectedShip && ship.id === selectedShip.id) {
                ctx.strokeStyle = Colors.SHIP_SELECTED;
                ctx.lineWidth = 3;
                ctx.strokeRect(
                    x + padding / 2,
                    y + padding / 2,
                    size + padding,
                    size + padding
                );
            }
            
            ctx.fillStyle = color;
            ctx.beginPath();
            
            const centerX = x + this.cellSize / 2;
            const centerY = y + this.cellSize / 2;
            const radius = size / 2;
            
            const angle = Math.atan2(ship.dy, ship.dx);
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(angle);
            
            ctx.beginPath();
            ctx.moveTo(radius, 0);
            ctx.lineTo(-radius * 0.6, -radius * 0.7);
            ctx.lineTo(-radius * 0.3, 0);
            ctx.lineTo(-radius * 0.6, radius * 0.7);
            ctx.closePath();
            ctx.fill();
            
            ctx.restore();
            
            ctx.fillStyle = '#ffffff';
            ctx.font = `bold ${this.cellSize * 0.2}px Arial`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'top';
            ctx.fillText(
                ship.name,
                x + this.cellSize / 2,
                y + this.cellSize + 2
            );
            
            if (ship.mode !== MovementMode.PLAYER_CONTROLLED) {
                ctx.fillStyle = '#f39c12';
                ctx.font = `${this.cellSize * 0.18}px Arial`;
                ctx.fillText(
                    'AI',
                    x + this.cellSize / 2,
                    y - 5
                );
            }
        }
    }

    renderPreviewMoves() {
        const ctx = this.ctx;
        const selectedShip = this.engine.getSelectedShip();
        
        if (!selectedShip || this.engine.getMode() !== GameMode.PLAY) return;
        
        const pendingMove = this.engine.getPendingMove(selectedShip.id);
        
        if (pendingMove) {
            const startX = selectedShip.x;
            const startY = selectedShip.y;
            const endX = startX + pendingMove.dx;
            const endY = startY + pendingMove.dy;
            
            ctx.strokeStyle = Colors.MOVE_PATH;
            ctx.lineWidth = 3;
            ctx.setLineDash([10, 5]);
            
            ctx.beginPath();
            ctx.moveTo(
                this.offsetX + startX * this.cellSize + this.cellSize / 2,
                this.offsetY + startY * this.cellSize + this.cellSize / 2
            );
            ctx.lineTo(
                this.offsetX + endX * this.cellSize + this.cellSize / 2,
                this.offsetY + endY * this.cellSize + this.cellSize / 2
            );
            ctx.stroke();
            ctx.setLineDash([]);
            
            ctx.fillStyle = Colors.MOVE_PREVIEW;
            ctx.globalAlpha = 0.5;
            ctx.fillRect(
                this.offsetX + endX * this.cellSize + 2,
                this.offsetY + endY * this.cellSize + 2,
                this.cellSize - 4,
                this.cellSize - 4
            );
            ctx.globalAlpha = 1;
        }
    }

    renderHover() {
        if (!this.hoverCell) return;
        
        const ctx = this.ctx;
        const { x, y } = this.hoverCell;
        
        ctx.fillStyle = Colors.HIGHLIGHT;
        ctx.globalAlpha = 0.3;
        ctx.fillRect(
            this.offsetX + x * this.cellSize,
            this.offsetY + y * this.cellSize,
            this.cellSize,
            this.cellSize
        );
        ctx.globalAlpha = 1;
    }

    setHoverCell(x, y) {
        this.hoverCell = (x !== null && y !== null) ? { x, y } : null;
    }

    setPreviewMove(shipId, dx, dy) {
        if (dx !== null && dy !== null) {
            this.previewMoves.set(shipId, { dx, dy });
        } else {
            this.previewMoves.delete(shipId);
        }
    }

    clearPreviewMoves() {
        this.previewMoves.clear();
    }

    screenToGrid(screenX, screenY) {
        const x = Math.floor((screenX - this.offsetX) / this.cellSize);
        const y = Math.floor((screenY - this.offsetY) / this.cellSize);
        
        const board = this.engine.board;
        if (!board) return { x: -1, y: -1 };
        
        if (x >= 0 && x < board.width && y >= 0 && y < board.height) {
            return { x, y };
        }
        
        return { x: -1, y: -1 };
    }

    getCanvas() {
        return this.canvas;
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { Renderer, Colors };
}
