var GameRenderer = function(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.level = null;
    this.robotState = null;
    this.cellSize = 40;
    this.margin = 20;
    this.animatingRobot = false;
    this.animationQueue = [];
    this.onCellClick = null;
    this.hoverCell = null;
    this.selectedTool = null;
    
    this._init();
};

GameRenderer.prototype._init = function() {
    var thisRenderer = this;
    
    this.canvas.addEventListener('click', function(e) {
        var cell = thisRenderer.getCellFromMouse(e);
        if (cell && thisRenderer.onCellClick) {
            thisRenderer.onCellClick(cell.x, cell.y);
        }
    });
    
    this.canvas.addEventListener('mousemove', function(e) {
        var cell = thisRenderer.getCellFromMouse(e);
        if (cell) {
            thisRenderer.hoverCell = cell;
            thisRenderer.render();
        }
    });
    
    this.canvas.addEventListener('mouseleave', function() {
        thisRenderer.hoverCell = null;
        thisRenderer.render();
    });
};

GameRenderer.prototype.setLevel = function(level) {
    this.level = level;
    this._calculateCellSize();
};

GameRenderer.prototype.setRobotState = function(robotState) {
    this.robotState = robotState;
};

GameRenderer.prototype._calculateCellSize = function() {
    if (!this.level) return;
    
    var maxWidth = this.canvas.width - this.margin * 2;
    var maxHeight = this.canvas.height - this.margin * 2;
    
    var cellWidth = Math.floor(maxWidth / this.level.mapWidth);
    var cellHeight = Math.floor(maxHeight / this.level.mapHeight);
    
    this.cellSize = Math.min(cellWidth, cellHeight, 50);
    this.cellSize = Math.max(this.cellSize, 20);
};

GameRenderer.prototype.getCellFromMouse = function(e) {
    if (!this.level) return null;
    
    var rect = this.canvas.getBoundingClientRect();
    var mouseX = e.clientX - rect.left;
    var mouseY = e.clientY - rect.top;
    
    var gridWidth = this.level.mapWidth * this.cellSize;
    var gridHeight = this.level.mapHeight * this.cellSize;
    var offsetX = (this.canvas.width - gridWidth) / 2;
    var offsetY = (this.canvas.height - gridHeight) / 2;
    
    var cellX = Math.floor((mouseX - offsetX) / this.cellSize);
    var cellY = Math.floor((mouseY - offsetY) / this.cellSize);
    
    if (cellX >= 0 && cellX < this.level.mapWidth && cellY >= 0 && cellY < this.level.mapHeight) {
        return { x: cellX, y: cellY };
    }
    
    return null;
};

GameRenderer.prototype.render = function() {
    if (!this.level) return;
    
    var ctx = this.ctx;
    var level = this.level;
    
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    
    var gridWidth = level.mapWidth * this.cellSize;
    var gridHeight = level.mapHeight * this.cellSize;
    var offsetX = (this.canvas.width - gridWidth) / 2;
    var offsetY = (this.canvas.height - gridHeight) / 2;
    
    this._renderGrid(ctx, level, offsetX, offsetY);
    this._renderCells(ctx, level, offsetX, offsetY);
    this._renderPath(ctx, offsetX, offsetY);
    this._renderRobot(ctx, offsetX, offsetY);
    this._renderHover(ctx, offsetX, offsetY);
};

GameRenderer.prototype._renderGrid = function(ctx, level, offsetX, offsetY) {
    ctx.strokeStyle = '#cbd5e0';
    ctx.lineWidth = 1;
    
    for (var x = 0; x <= level.mapWidth; x++) {
        ctx.beginPath();
        ctx.moveTo(offsetX + x * this.cellSize, offsetY);
        ctx.lineTo(offsetX + x * this.cellSize, offsetY + level.mapHeight * this.cellSize);
        ctx.stroke();
    }
    
    for (var y = 0; y <= level.mapHeight; y++) {
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY + y * this.cellSize);
        ctx.lineTo(offsetX + level.mapWidth * this.cellSize, offsetY + y * this.cellSize);
        ctx.stroke();
    }
};

GameRenderer.prototype._renderCells = function(ctx, level, offsetX, offsetY) {
    var colors = {
        [Constants.CELL_TYPE.EMPTY]: '#ffffff',
        [Constants.CELL_TYPE.START]: '#c6f6d5',
        [Constants.CELL_TYPE.OBSTACLE]: '#fed7d7',
        [Constants.CELL_TYPE.CHARGE]: '#fef3c7',
        [Constants.CELL_TYPE.CHECKPOINT]: '#c4f1f9',
        [Constants.CELL_TYPE.DANGER]: '#fecaca',
        [Constants.CELL_TYPE.SAMPLE]: '#d6bcfa'
    };
    
    var icons = {
        [Constants.CELL_TYPE.START]: '🚀',
        [Constants.CELL_TYPE.OBSTACLE]: '🧱',
        [Constants.CELL_TYPE.CHARGE]: '🔋',
        [Constants.CELL_TYPE.CHECKPOINT]: '✅',
        [Constants.CELL_TYPE.DANGER]: '⚠️',
        [Constants.CELL_TYPE.SAMPLE]: '📦'
    };
    
    for (var y = 0; y < level.mapHeight; y++) {
        for (var x = 0; x < level.mapWidth; x++) {
            var cellType = level.getCell(x, y);
            var cellX = offsetX + x * this.cellSize;
            var cellY = offsetY + y * this.cellSize;
            
            if (colors[cellType]) {
                ctx.fillStyle = colors[cellType];
                ctx.fillRect(cellX + 1, cellY + 1, this.cellSize - 2, this.cellSize - 2);
            }
            
            if (icons[cellType]) {
                ctx.font = Math.floor(this.cellSize * 0.5) + 'px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(icons[cellType], cellX + this.cellSize / 2, cellY + this.cellSize / 2);
            }
            
            if (this.robotState) {
                var posKey = x + ',' + y;
                if (this.robotState.visitedCheckpoints.indexOf(posKey) !== -1 && cellType === Constants.CELL_TYPE.CHECKPOINT) {
                    ctx.fillStyle = 'rgba(72, 187, 120, 0.3)';
                    ctx.fillRect(cellX + 1, cellY + 1, this.cellSize - 2, this.cellSize - 2);
                    ctx.strokeStyle = '#48bb78';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(cellX + 2, cellY + 2, this.cellSize - 4, this.cellSize - 4);
                }
                
                if (this.robotState.sampledPoints.indexOf(posKey) !== -1 && cellType === Constants.CELL_TYPE.SAMPLE) {
                    ctx.fillStyle = 'rgba(159, 122, 234, 0.3)';
                    ctx.fillRect(cellX + 1, cellY + 1, this.cellSize - 2, this.cellSize - 2);
                }
            }
        }
    }
};

GameRenderer.prototype._renderPath = function(ctx, offsetX, offsetY) {
    if (!this.robotState || !this.robotState.visitedPath) return;
    
    var path = this.robotState.visitedPath;
    if (path.length < 2) return;
    
    ctx.strokeStyle = 'rgba(102, 126, 234, 0.5)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    
    ctx.beginPath();
    for (var i = 0; i < path.length; i++) {
        var point = path[i];
        var px = offsetX + point.x * this.cellSize + this.cellSize / 2;
        var py = offsetY + point.y * this.cellSize + this.cellSize / 2;
        
        if (i === 0) {
            ctx.moveTo(px, py);
        } else {
            ctx.lineTo(px, py);
        }
    }
    ctx.stroke();
    
    for (var i = 0; i < path.length; i++) {
        var point = path[i];
        var px = offsetX + point.x * this.cellSize + this.cellSize / 2;
        var py = offsetY + point.y * this.cellSize + this.cellSize / 2;
        
        ctx.fillStyle = i === 0 ? '#48bb78' : '#667eea';
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
    }
};

GameRenderer.prototype._renderRobot = function(ctx, offsetX, offsetY) {
    if (!this.robotState) return;
    
    var x = this.robotState.x;
    var y = this.robotState.y;
    var direction = this.robotState.direction;
    
    var cellX = offsetX + x * this.cellSize + this.cellSize / 2;
    var cellY = offsetY + y * this.cellSize + this.cellSize / 2;
    
    ctx.save();
    ctx.translate(cellX, cellY);
    
    var rotation = direction * Math.PI / 2;
    ctx.rotate(rotation);
    
    var robotSize = this.cellSize * 0.6;
    
    ctx.fillStyle = this.robotState.isDead ? '#fc8181' : '#667eea';
    ctx.beginPath();
    ctx.moveTo(0, -robotSize / 2);
    ctx.lineTo(robotSize / 2, robotSize / 2);
    ctx.lineTo(-robotSize / 2, robotSize / 2);
    ctx.closePath();
    ctx.fill();
    
    ctx.strokeStyle = '#4c51bf';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(0, 0, robotSize / 5, 0, Math.PI * 2);
    ctx.fill();
    
    ctx.restore();
};

GameRenderer.prototype._renderHover = function(ctx, offsetX, offsetY) {
    if (!this.hoverCell) return;
    
    var x = this.hoverCell.x;
    var y = this.hoverCell.y;
    var cellX = offsetX + x * this.cellSize;
    var cellY = offsetY + y * this.cellSize;
    
    ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
    ctx.fillRect(cellX + 2, cellY + 2, this.cellSize - 4, this.cellSize - 4);
    
    ctx.strokeStyle = '#667eea';
    ctx.lineWidth = 2;
    ctx.strokeRect(cellX + 2, cellY + 2, this.cellSize - 4, this.cellSize - 4);
};

GameRenderer.prototype.setSelectedTool = function(tool) {
    this.selectedTool = tool;
};

GameRenderer.prototype.animateRobotMove = function(fromX, fromY, toX, toY, callback) {
    var thisRenderer = this;
    var progress = 0;
    var duration = 200;
    var startTime = null;
    
    function animate(timestamp) {
        if (!startTime) startTime = timestamp;
        progress = (timestamp - startTime) / duration;
        progress = Math.min(progress, 1);
        
        var easeProgress = 1 - Math.pow(1 - progress, 3);
        var currentX = fromX + (toX - fromX) * easeProgress;
        var currentY = fromY + (toY - fromY) * easeProgress;
        
        var tempX = thisRenderer.robotState.x;
        var tempY = thisRenderer.robotState.y;
        thisRenderer.robotState.x = currentX;
        thisRenderer.robotState.y = currentY;
        
        thisRenderer.render();
        
        thisRenderer.robotState.x = tempX;
        thisRenderer.robotState.y = tempY;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        } else {
            if (callback) callback();
        }
    }
    
    requestAnimationFrame(animate);
};

GameRenderer.prototype.resize = function(width, height) {
    this.canvas.width = width;
    this.canvas.height = height;
    if (this.level) {
        this._calculateCellSize();
    }
    this.render();
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = GameRenderer;
}
