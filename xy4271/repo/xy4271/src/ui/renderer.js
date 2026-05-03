export class Renderer {
    constructor(canvas, gameState) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameState = gameState;
        this.cellSize = 60;
        this.padding = 10;
        this.colors = {
            track: '#34495e',
            station: '#3498db',
            junction: '#9b59b6',
            depot: '#1abc9c',
            terminus: '#e67e22',
            empty: '#ecf0f1',
            maintenanceCar: '#e74c3c',
            maintenanceCarSelected: '#c0392b',
            block: '#f39c12',
            criticalSegment: '#e74c3c',
            criticalSegmentRepaired: '#27ae60',
            train: '#2c3e50',
            gridLine: '#bdc3c7',
            text: '#2c3e50'
        };
        this.selectedCell = null;
        this.selectedCar = null;
        this.hoveredCell = null;
    }

    resize(width, height) {
        const grid = this.gameState.getGrid();
        const gridWidth = grid[0] ? grid[0].length : 0;
        const gridHeight = grid.length;
        
        const availableWidth = width - this.padding * 2;
        const availableHeight = height - this.padding * 2;
        
        const cellSizeX = Math.floor(availableWidth / gridWidth);
        const cellSizeY = Math.floor(availableHeight / gridHeight);
        
        this.cellSize = Math.min(cellSizeX, cellSizeY, 80);
        this.cellSize = Math.max(this.cellSize, 40);
    }

    render() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        const grid = this.gameState.getGrid();
        if (grid.length === 0) return;
        
        const gridWidth = grid[0].length;
        const gridHeight = grid.length;
        
        const totalWidth = gridWidth * this.cellSize;
        const totalHeight = gridHeight * this.cellSize;
        const offsetX = (this.canvas.width - totalWidth) / 2;
        const offsetY = (this.canvas.height - totalHeight) / 2;

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = grid[y][x];
                const cellX = offsetX + x * this.cellSize;
                const cellY = offsetY + y * this.cellSize;
                
                this._drawCell(cell, cellX, cellY);
            }
        }

        const segments = this.gameState.getCriticalSegments();
        segments.forEach(segment => {
            const cellX = offsetX + segment.x * this.cellSize;
            const cellY = offsetY + segment.y * this.cellSize;
            this._drawCriticalSegment(segment, cellX, cellY);
        });

        const blocks = this.gameState.getBlocks();
        blocks.forEach(block => {
            const cellX = offsetX + block.x * this.cellSize;
            const cellY = offsetY + block.y * this.cellSize;
            this._drawBlock(cellX, cellY);
        });

        const trains = this.gameState.getLastTrains();
        trains.forEach(train => {
            if (train.status === 'moving' || train.status === 'completed') {
                const position = train.route[train.currentPosition];
                if (position) {
                    const cellX = offsetX + position.x * this.cellSize;
                    const cellY = offsetY + position.y * this.cellSize;
                    this._drawTrain(train, cellX, cellY);
                }
            }
        });

        const cars = this.gameState.getMaintenanceCars();
        cars.forEach(car => {
            const cellX = offsetX + car.x * this.cellSize;
            const cellY = offsetY + car.y * this.cellSize;
            const isSelected = this.selectedCar === car.id;
            this._drawMaintenanceCar(car, cellX, cellY, isSelected);
        });

        if (this.selectedCell) {
            const cellX = offsetX + this.selectedCell.x * this.cellSize;
            const cellY = offsetY + this.selectedCell.y * this.cellSize;
            this._drawSelection(cellX, cellY);
        }

        if (this.hoveredCell) {
            const cellX = offsetX + this.hoveredCell.x * this.cellSize;
            const cellY = offsetY + this.hoveredCell.y * this.cellSize;
            this._drawHover(cellX, cellY);
        }
    }

    _drawCell(cell, x, y) {
        const size = this.cellSize;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        this.ctx.fillStyle = this.colors.empty;
        this.ctx.fillRect(x, y, size, size);

        this.ctx.strokeStyle = this.colors.gridLine;
        this.ctx.lineWidth = 1;
        this.ctx.strokeRect(x, y, size, size);

        if (cell.type === 'empty') {
            return;
        }

        this.ctx.strokeStyle = this.colors.track;
        this.ctx.lineWidth = 8;
        this.ctx.lineCap = 'round';

        cell.connections.forEach(connection => {
            this.ctx.beginPath();
            switch (connection) {
                case 'N':
                    this.ctx.moveTo(centerX, centerY);
                    this.ctx.lineTo(centerX, y);
                    break;
                case 'S':
                    this.ctx.moveTo(centerX, centerY);
                    this.ctx.lineTo(centerX, y + size);
                    break;
                case 'E':
                    this.ctx.moveTo(centerX, centerY);
                    this.ctx.lineTo(x + size, centerY);
                    break;
                case 'W':
                    this.ctx.moveTo(centerX, centerY);
                    this.ctx.lineTo(x, centerY);
                    break;
            }
            this.ctx.stroke();
        });

        if (cell.type === 'station') {
            this.ctx.fillStyle = this.colors.station;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, size / 4, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
        } else if (cell.type === 'junction') {
            this.ctx.fillStyle = this.colors.junction;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, size / 5, 0, Math.PI * 2);
            this.ctx.fill();
        } else if (cell.type === 'depot') {
            this.ctx.fillStyle = this.colors.depot;
            this.ctx.fillRect(centerX - size / 5, centerY - size / 5, size / 2.5, size / 2.5);
        } else if (cell.type === 'terminus') {
            this.ctx.fillStyle = this.colors.terminus;
            this.ctx.beginPath();
            this.ctx.moveTo(centerX, centerY - size / 5);
            this.ctx.lineTo(centerX + size / 5, centerY + size / 5);
            this.ctx.lineTo(centerX - size / 5, centerY + size / 5);
            this.ctx.closePath();
            this.ctx.fill();
        }
    }

    _drawCriticalSegment(segment, x, y) {
        const size = this.cellSize;
        const isRepaired = segment.isRepaired;

        this.ctx.fillStyle = isRepaired ? 
            `rgba(39, 174, 96, 0.3)` : 
            `rgba(231, 76, 60, 0.3)`;
        this.ctx.fillRect(x + 4, y + 4, size - 8, size - 8);

        this.ctx.strokeStyle = isRepaired ? this.colors.criticalSegmentRepaired : this.colors.criticalSegment;
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);
        this.ctx.strokeRect(x + 4, y + 4, size - 8, size - 8);
        this.ctx.setLineDash([]);

        if (!isRepaired && segment.remainingTime > 0) {
            this.ctx.fillStyle = this.colors.text;
            this.ctx.font = `bold ${Math.floor(size / 4)}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                `${segment.remainingTime}`,
                x + size / 2,
                y + size / 2
            );
        }
    }

    _drawBlock(x, y) {
        const size = this.cellSize;
        
        this.ctx.fillStyle = this.colors.block;
        this.ctx.fillRect(x + 10, y + 10, size - 20, size - 20);
        
        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 3;
        this.ctx.beginPath();
        this.ctx.moveTo(x + 15, y + 15);
        this.ctx.lineTo(x + size - 15, y + size - 15);
        this.ctx.moveTo(x + size - 15, y + 15);
        this.ctx.lineTo(x + 15, y + size - 15);
        this.ctx.stroke();
    }

    _drawMaintenanceCar(car, x, y, isSelected) {
        const size = this.cellSize;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        const carRadius = size / 3;
        
        this.ctx.fillStyle = isSelected ? this.colors.maintenanceCarSelected : this.colors.maintenanceCar;
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, carRadius, 0, Math.PI * 2);
        this.ctx.fill();

        this.ctx.strokeStyle = '#fff';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();

        this.ctx.fillStyle = '#fff';
        this.ctx.font = `bold ${Math.floor(size / 5)}px Arial`;
        this.ctx.textAlign = 'center';
        this.ctx.textBaseline = 'middle';
        this.ctx.fillText('🔧', centerX, centerY);

        const batteryPercent = car.battery / car.maxBattery;
        const barWidth = size - 10;
        const barHeight = 6;
        const barX = x + 5;
        const barY = y + size - 12;

        this.ctx.fillStyle = '#333';
        this.ctx.fillRect(barX, barY, barWidth, barHeight);

        let batteryColor = '#27ae60';
        if (batteryPercent < 0.3) {
            batteryColor = '#e74c3c';
        } else if (batteryPercent < 0.6) {
            batteryColor = '#f39c12';
        }
        
        this.ctx.fillStyle = batteryColor;
        this.ctx.fillRect(barX, barY, barWidth * batteryPercent, barHeight);

        if (isSelected) {
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([5, 5]);
            this.ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
            this.ctx.setLineDash([]);
        }
    }

    _drawTrain(train, x, y) {
        const size = this.cellSize;
        const centerX = x + size / 2;
        const centerY = y + size / 2;

        const trainWidth = size / 1.5;
        const trainHeight = size / 2.5;

        this.ctx.fillStyle = this.colors.train;
        this.ctx.fillRect(
            centerX - trainWidth / 2,
            centerY - trainHeight / 2,
            trainWidth,
            trainHeight
        );

        this.ctx.fillStyle = '#3498db';
        this.ctx.fillRect(
            centerX - trainWidth / 2 + 5,
            centerY - trainHeight / 2 + 5,
            trainWidth - 10,
            trainHeight - 10
        );

        this.ctx.fillStyle = '#fff';
        this.ctx.beginPath();
        this.ctx.arc(centerX - trainWidth / 4, centerY, 4, 0, Math.PI * 2);
        this.ctx.arc(centerX + trainWidth / 4, centerY, 4, 0, Math.PI * 2);
        this.ctx.fill();
    }

    _drawSelection(x, y) {
        const size = this.cellSize;
        this.ctx.strokeStyle = '#3498db';
        this.ctx.lineWidth = 4;
        this.ctx.strokeRect(x + 2, y + 2, size - 4, size - 4);
    }

    _drawHover(x, y) {
        const size = this.cellSize;
        this.ctx.fillStyle = 'rgba(52, 152, 219, 0.2)';
        this.ctx.fillRect(x, y, size, size);
    }

    setSelectedCell(x, y) {
        this.selectedCell = x !== null ? { x, y } : null;
    }

    setSelectedCar(carId) {
        this.selectedCar = carId;
    }

    getSelectedCar() {
        return this.selectedCar;
    }

    setHoveredCell(x, y) {
        this.hoveredCell = x !== null ? { x, y } : null;
    }

    getCellFromMousePosition(mouseX, mouseY) {
        const grid = this.gameState.getGrid();
        if (grid.length === 0) return null;
        
        const gridWidth = grid[0].length;
        const gridHeight = grid.length;
        
        const totalWidth = gridWidth * this.cellSize;
        const totalHeight = gridHeight * this.cellSize;
        const offsetX = (this.canvas.width - totalWidth) / 2;
        const offsetY = (this.canvas.height - totalHeight) / 2;

        const gridX = Math.floor((mouseX - offsetX) / this.cellSize);
        const gridY = Math.floor((mouseY - offsetY) / this.cellSize);

        if (gridX < 0 || gridX >= gridWidth || gridY < 0 || gridY >= gridHeight) {
            return null;
        }

        const cellX = offsetX + gridX * this.cellSize;
        const cellY = offsetY + gridY * this.cellSize;
        
        if (mouseX >= cellX && mouseX < cellX + this.cellSize &&
            mouseY >= cellY && mouseY < cellY + this.cellSize) {
            return { x: gridX, y: gridY };
        }

        return null;
    }

    getCanvas() {
        return this.canvas;
    }
}
