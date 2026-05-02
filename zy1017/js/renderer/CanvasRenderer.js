class CanvasRenderer {
    constructor(canvas) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gridSize = CONSTANTS.GRID_SIZE;
        this.offsetX = 0;
        this.offsetY = 0;
        this.scale = 1;
    }

    resize(gridMap, containerWidth, containerHeight) {
        const maxWidth = containerWidth * 0.95;
        const maxHeight = containerHeight * 0.95;
        
        const gameWidth = gridMap.width * this.gridSize;
        const gameHeight = gridMap.height * this.gridSize;
        
        const scaleX = maxWidth / gameWidth;
        const scaleY = maxHeight / gameHeight;
        this.scale = Math.min(scaleX, scaleY, 1.5);
        
        this.canvas.width = gameWidth * this.scale;
        this.canvas.height = gameHeight * this.scale;
        
        this.offsetX = (this.canvas.width - gameWidth * this.scale) / 2;
        this.offsetY = (this.canvas.height - gameHeight * this.scale) / 2;
    }

    clear() {
        this.ctx.fillStyle = '#0a0a15';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    }

    screenToGrid(screenX, screenY) {
        const gameX = (screenX - this.offsetX) / this.scale;
        const gameY = (screenY - this.offsetY) / this.scale;
        
        return {
            x: Math.floor(gameX / this.gridSize),
            y: Math.floor(gameY / this.gridSize)
        };
    }

    renderGrid(gridMap) {
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);
        
        for (let y = 0; y < gridMap.height; y++) {
            for (let x = 0; x < gridMap.width; x++) {
                const tile = gridMap.getTile(x, y);
                this.renderTile(x, y, tile, gridMap);
            }
        }
        
        for (let y = 0; y <= gridMap.height; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * this.gridSize);
            this.ctx.lineTo(gridMap.width * this.gridSize, y * this.gridSize);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            this.ctx.stroke();
        }
        
        for (let x = 0; x <= gridMap.width; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * this.gridSize, 0);
            this.ctx.lineTo(x * this.gridSize, gridMap.height * this.gridSize);
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
            this.ctx.stroke();
        }
        
        this.ctx.restore();
    }

    renderTile(x, y, tile, gridMap) {
        const px = x * this.gridSize;
        const py = y * this.gridSize;
        const size = this.gridSize;
        
        switch (tile) {
            case CONSTANTS.TILE_TYPES.WALL:
                this.ctx.fillStyle = '#1a1a2e';
                this.ctx.fillRect(px, py, size, size);
                this.ctx.strokeStyle = '#2a2a4e';
                this.ctx.lineWidth = 2;
                this.ctx.strokeRect(px + 1, py + 1, size - 2, size - 2);
                break;
                
            case CONSTANTS.TILE_TYPES.EMPTY:
                this.ctx.fillStyle = '#16213e';
                this.ctx.fillRect(px, py, size, size);
                break;
                
            case CONSTANTS.TILE_TYPES.ENTRANCE:
                const entrance = gridMap.getEntrance(x, y);
                this.ctx.fillStyle = '#16213e';
                this.ctx.fillRect(px, py, size, size);
                
                if (entrance) {
                    const color = Helpers.getColorByType(entrance.color);
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(px + 5, py + 5, size - 10, size - 10);
                    
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    this.ctx.font = 'bold 14px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('入', px + size / 2, py + size / 2);
                }
                break;
                
            case CONSTANTS.TILE_TYPES.EXIT:
                const exit = gridMap.getExit(x, y);
                this.ctx.fillStyle = '#16213e';
                this.ctx.fillRect(px, py, size, size);
                
                if (exit) {
                    const color = Helpers.getColorByType(exit.color);
                    this.ctx.fillStyle = color;
                    this.ctx.fillRect(px + 5, py + 5, size - 10, size - 10);
                    
                    this.ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
                    this.ctx.font = 'bold 14px Arial';
                    this.ctx.textAlign = 'center';
                    this.ctx.textBaseline = 'middle';
                    this.ctx.fillText('出', px + size / 2, py + size / 2);
                }
                break;
                
            case CONSTANTS.TILE_TYPES.GATE:
                const gate = gridMap.getGate(x, y);
                this.ctx.fillStyle = '#16213e';
                this.ctx.fillRect(px, py, size, size);
                
                if (gate) {
                    if (gate.open) {
                        this.ctx.strokeStyle = '#4CAF50';
                        this.ctx.lineWidth = 3;
                        this.ctx.strokeRect(px + 5, py + 5, size - 10, size - 10);
                        
                        this.ctx.fillStyle = '#4CAF50';
                        this.ctx.font = 'bold 16px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText('开', px + size / 2, py + size / 2);
                    } else {
                        this.ctx.fillStyle = '#f44336';
                        this.ctx.fillRect(px + 5, py + 5, size - 10, size - 10);
                        
                        this.ctx.fillStyle = 'white';
                        this.ctx.font = 'bold 16px Arial';
                        this.ctx.textAlign = 'center';
                        this.ctx.textBaseline = 'middle';
                        this.ctx.fillText('关', px + size / 2, py + size / 2);
                    }
                }
                break;
                
            case CONSTANTS.TILE_TYPES.OBSTACLE:
                this.ctx.fillStyle = '#2d2d4d';
                this.ctx.fillRect(px, py, size, size);
                this.ctx.fillStyle = '#3d3d5d';
                this.ctx.beginPath();
                this.ctx.moveTo(px + size / 2, py + 5);
                this.ctx.lineTo(px + size - 5, py + size - 5);
                this.ctx.lineTo(px + 5, py + size - 5);
                this.ctx.closePath();
                this.ctx.fill();
                break;
        }
    }

    renderOverlays(gridMap) {
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);
        
        for (const fence of gridMap.fences) {
            const px = fence.x * this.gridSize;
            const py = fence.y * this.gridSize;
            const size = this.gridSize;
            
            this.ctx.fillStyle = 'rgba(139, 69, 19, 0.8)';
            this.ctx.fillRect(px + 8, py + 8, size - 16, size - 16);
            
            this.ctx.strokeStyle = '#8B4513';
            this.ctx.lineWidth = 3;
            this.ctx.strokeRect(px + 8, py + 8, size - 16, size - 16);
            
            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🧱', px + size / 2, py + size / 2);
        }
        
        for (const staff of gridMap.staffMembers) {
            const px = staff.x * this.gridSize;
            const py = staff.y * this.gridSize;
            const size = this.gridSize;
            
            this.ctx.strokeStyle = '#FFD700';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(px + 4, py + 4, size - 8, size - 8);
            this.ctx.setLineDash([]);
            
            this.ctx.font = '20px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('👷', px + size / 2, py + size / 2);
        }
        
        this.ctx.restore();
    }

    renderPassengers(passengers) {
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);
        
        const passengerSize = this.gridSize * 0.6;
        const offset = (this.gridSize - passengerSize) / 2;
        
        for (const passenger of passengers) {
            if (passenger.isExited) continue;
            
            const rx = passenger.getRenderX();
            const ry = passenger.getRenderY();
            const px = rx * this.gridSize + offset;
            const py = ry * this.gridSize + offset;
            
            const color = Helpers.getColorByType(passenger.targetColor);
            
            this.ctx.beginPath();
            this.ctx.arc(
                px + passengerSize / 2,
                py + passengerSize / 2,
                passengerSize / 2,
                0,
                Math.PI * 2
            );
            this.ctx.fillStyle = color;
            this.ctx.fill();
            
            this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            const satisfaction = passenger.getSatisfaction();
            const barWidth = passengerSize;
            const barHeight = 4;
            const barX = px;
            const barY = py - 8;
            
            this.ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);
            
            let barColor;
            if (satisfaction > 0.6) {
                barColor = '#4CAF50';
            } else if (satisfaction > 0.3) {
                barColor = '#FF9800';
            } else {
                barColor = '#f44336';
            }
            
            this.ctx.fillStyle = barColor;
            this.ctx.fillRect(barX, barY, barWidth * satisfaction, barHeight);
            
            if (passenger.isBlocked) {
                this.ctx.fillStyle = 'rgba(255, 0, 0, 0.3)';
                this.ctx.beginPath();
                this.ctx.arc(
                    px + passengerSize / 2,
                    py + passengerSize / 2,
                    passengerSize / 2 + 3,
                    0,
                    Math.PI * 2
                );
                this.ctx.fill();
            }
        }
        
        this.ctx.restore();
    }

    renderHighlight(x, y, gridMap, valid = true) {
        this.ctx.save();
        this.ctx.translate(this.offsetX, this.offsetY);
        this.ctx.scale(this.scale, this.scale);
        
        const px = x * this.gridSize;
        const py = y * this.gridSize;
        const size = this.gridSize;
        
        if (valid) {
            this.ctx.strokeStyle = '#00d2ff';
            this.ctx.lineWidth = 3;
        } else {
            this.ctx.strokeStyle = '#f44336';
            this.ctx.lineWidth = 3;
        }
        
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(px + 2, py + 2, size - 4, size - 4);
        this.ctx.setLineDash([]);
        
        this.ctx.restore();
    }

    renderPreview(gridMap) {
        this.clear();
        this.renderGrid(gridMap);
        this.renderOverlays(gridMap);
    }

    render(gameEngine) {
        this.clear();
        this.renderGrid(gameEngine.gridMap);
        this.renderOverlays(gameEngine.gridMap);
        this.renderPassengers(gameEngine.passengers);
    }
}

if (typeof module !== 'undefined') {
    module.exports = CanvasRenderer;
}
