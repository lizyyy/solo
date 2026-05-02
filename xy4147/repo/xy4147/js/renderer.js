/**
 * 游戏渲染模块
 * 负责Canvas渲染和拖放交互
 */

import { TileType, Direction } from './levels.js';

const Colors = {
    FLOOR: '#f8f9fa',
    WALL: '#343a40',
    DOOR: '#17a2b8',
    DOOR_OPEN: '#28a745',
    DOOR_BLOCKED: '#dc3545',
    STAIRS: '#6f42c1',
    EXIT: '#28a745',
    SMOKE_SOURCE: '#dc3545',
    SMOKE: 'rgba(100, 100, 100, 0.6)',
    PERSON: '#007bff',
    PERSON_DISABLED: '#fd7e14',
    ARROW: '#ffc107',
    BLOCKED: '#dc3545',
    EXTINGUISHER: '#dc3545',
    ASSEMBLY: '#28a745',
    GRID_LINE: 'rgba(0, 0, 0, 0.1)'
};

export class Renderer {
    constructor(canvas, gameState) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.gameState = gameState;
        this.tileSize = 50;
        this.offsetX = 0;
        this.offsetY = 0;
        this.isDragging = false;
        this.dragTool = null;
        this.selectedItem = null;
        this.hoveredTile = null;
        
        this.setupCanvas();
        this.setupEventListeners();
    }

    setupCanvas() {
        this.resizeCanvas();
        window.addEventListener('resize', () => this.resizeCanvas());
    }

    resizeCanvas() {
        const container = this.canvas.parentElement;
        const maxWidth = container.clientWidth - 40;
        const maxHeight = container.clientHeight - 40;
        
        const level = this.gameState.currentLevel;
        if (!level) return;
        
        const levelWidth = level.width * this.tileSize;
        const levelHeight = level.height * this.tileSize;
        
        const scaleX = maxWidth / levelWidth;
        const scaleY = maxHeight / levelHeight;
        const scale = Math.min(scaleX, scaleY, 1);
        
        this.scale = scale;
        this.canvas.width = levelWidth * scale;
        this.canvas.height = levelHeight * scale;
        
        this.offsetX = (this.canvas.width - levelWidth * scale) / 2;
        this.offsetY = (this.canvas.height - levelHeight * scale) / 2;
    }

    setupEventListeners() {
        const toolItems = document.querySelectorAll('.tool-item');
        toolItems.forEach(item => {
            item.addEventListener('dragstart', (e) => this.onToolDragStart(e));
        });

        this.canvas.addEventListener('dragover', (e) => this.onCanvasDragOver(e));
        this.canvas.addEventListener('drop', (e) => this.onCanvasDrop(e));
        this.canvas.addEventListener('click', (e) => this.onCanvasClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.onCanvasMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => {
            this.hoveredTile = null;
            this.render();
        });
    }

    onToolDragStart(e) {
        const toolType = e.target.closest('.tool-item').dataset.tool;
        e.dataTransfer.setData('toolType', toolType);
        e.dataTransfer.effectAllowed = 'copy';
    }

    onCanvasDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    }

    onCanvasDrop(e) {
        e.preventDefault();
        const toolType = e.dataTransfer.getData('toolType');
        if (!toolType) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;
        
        const tileX = Math.floor(x / this.tileSize);
        const tileY = Math.floor(y / this.tileSize);
        
        this.gameState.placeTool(toolType, tileX, tileY);
        this.render();
    }

    onCanvasClick(e) {
        if (this.gameState.isSimulating) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;
        
        const tileX = Math.floor(x / this.tileSize);
        const tileY = Math.floor(y / this.tileSize);
        
        const clickedItem = this.gameState.getPlacedItemAt(tileX, tileY);
        if (clickedItem) {
            if (clickedItem.type === 'arrow') {
                this.gameState.rotateArrow(clickedItem);
            } else {
                this.gameState.removePlacedItem(clickedItem);
            }
            this.render();
        }
    }

    onCanvasMouseMove(e) {
        if (this.gameState.isSimulating) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left - this.offsetX) / this.scale;
        const y = (e.clientY - rect.top - this.offsetY) / this.scale;
        
        const tileX = Math.floor(x / this.tileSize);
        const tileY = Math.floor(y / this.tileSize);
        
        const level = this.gameState.currentLevel;
        if (level && tileX >= 0 && tileX < level.width && tileY >= 0 && tileY < level.height) {
            this.hoveredTile = { x: tileX, y: tileY };
        } else {
            this.hoveredTile = null;
        }
        
        this.render();
    }

    render() {
        const ctx = this.ctx;
        const level = this.gameState.currentLevel;
        
        if (!level) {
            this.renderEmptyState();
            return;
        }
        
        ctx.save();
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.translate(this.offsetX, this.offsetY);
        ctx.scale(this.scale, this.scale);
        
        this.renderGrid(level);
        this.renderWalls(level);
        this.renderDoors(level);
        this.renderExits(level);
        this.renderStairs(level);
        this.renderSmokeSources(level);
        this.renderPlacedItems();
        
        if (this.gameState.isSimulating || this.gameState.smokeState) {
            this.renderSmoke();
        }
        
        this.renderPeople();
        
        if (this.hoveredTile && !this.gameState.isSimulating) {
            this.renderHoverHighlight();
        }
        
        ctx.restore();
    }

    renderEmptyState() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        ctx.fillStyle = '#6c757d';
        ctx.font = '24px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('请选择一个关卡开始', this.canvas.width / 2, this.canvas.height / 2);
        
        ctx.font = '16px Microsoft YaHei';
        ctx.fillStyle = '#adb5bd';
        ctx.fillText('使用上方下拉菜单选择关卡', this.canvas.width / 2, this.canvas.height / 2 + 40);
    }

    renderGrid(level) {
        const ctx = this.ctx;
        
        ctx.fillStyle = Colors.FLOOR;
        ctx.fillRect(0, 0, level.width * this.tileSize, level.height * this.tileSize);
        
        ctx.strokeStyle = Colors.GRID_LINE;
        ctx.lineWidth = 1;
        
        for (let x = 0; x <= level.width; x++) {
            ctx.beginPath();
            ctx.moveTo(x * this.tileSize, 0);
            ctx.lineTo(x * this.tileSize, level.height * this.tileSize);
            ctx.stroke();
        }
        
        for (let y = 0; y <= level.height; y++) {
            ctx.beginPath();
            ctx.moveTo(0, y * this.tileSize);
            ctx.lineTo(level.width * this.tileSize, y * this.tileSize);
            ctx.stroke();
        }
    }

    renderWalls(level) {
        const ctx = this.ctx;
        ctx.fillStyle = Colors.WALL;
        
        for (let y = 0; y < level.height; y++) {
            for (let x = 0; x < level.width; x++) {
                if (level.grid[y][x] === TileType.WALL) {
                    ctx.fillRect(
                        x * this.tileSize,
                        y * this.tileSize,
                        this.tileSize,
                        this.tileSize
                    );
                    
                    ctx.fillStyle = '#495057';
                    ctx.fillRect(
                        x * this.tileSize + 2,
                        y * this.tileSize + 2,
                        this.tileSize - 4,
                        4
                    );
                    ctx.fillStyle = Colors.WALL;
                }
            }
        }
    }

    renderDoors(level) {
        const ctx = this.ctx;
        
        for (let y = 0; y < level.height; y++) {
            for (let x = 0; x < level.width; x++) {
                if (level.grid[y][x] === TileType.DOOR) {
                    const isBlocked = this.gameState.isDoorBlocked(x, y);
                    
                    ctx.fillStyle = isBlocked ? Colors.DOOR_BLOCKED : Colors.DOOR;
                    ctx.fillRect(
                        x * this.tileSize + 5,
                        y * this.tileSize + 5,
                        this.tileSize - 10,
                        this.tileSize - 10
                    );
                    
                    if (isBlocked) {
                        ctx.fillStyle = 'white';
                        ctx.font = '20px Arial';
                        ctx.textAlign = 'center';
                        ctx.fillText('🚫', 
                            x * this.tileSize + this.tileSize / 2,
                            y * this.tileSize + this.tileSize / 2 + 7
                        );
                    }
                }
            }
        }
    }

    renderExits(level) {
        const ctx = this.ctx;
        
        level.exits.forEach(exit => {
            ctx.fillStyle = Colors.EXIT;
            ctx.fillRect(
                exit.x * this.tileSize + 2,
                exit.y * this.tileSize + 2,
                this.tileSize - 4,
                this.tileSize - 4
            );
            
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText('出口',
                exit.x * this.tileSize + this.tileSize / 2,
                exit.y * this.tileSize + this.tileSize / 2 + 4
            );
            
            ctx.font = '10px Microsoft YaHei';
            ctx.fillText(`容量:${exit.capacity}`,
                exit.x * this.tileSize + this.tileSize / 2,
                exit.y * this.tileSize + this.tileSize / 2 + 18
            );
        });
    }

    renderStairs(level) {
        const ctx = this.ctx;
        
        level.stairs.forEach(stair => {
            ctx.fillStyle = Colors.STAIRS;
            ctx.fillRect(
                stair.x * this.tileSize + 3,
                stair.y * this.tileSize + 3,
                this.tileSize - 6,
                this.tileSize - 6
            );
            
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            for (let i = 1; i <= 3; i++) {
                ctx.beginPath();
                ctx.moveTo(
                    stair.x * this.tileSize + 8,
                    stair.y * this.tileSize + 10 + i * 10
                );
                ctx.lineTo(
                    stair.x * this.tileSize + this.tileSize - 8,
                    stair.y * this.tileSize + 10 + i * 10
                );
                ctx.stroke();
            }
            
            ctx.fillStyle = 'white';
            ctx.font = '9px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(`楼梯(${stair.capacity})`,
                stair.x * this.tileSize + this.tileSize / 2,
                stair.y * this.tileSize + this.tileSize - 5
            );
        });
    }

    renderSmokeSources(level) {
        const ctx = this.ctx;
        
        level.smokeSources.forEach(source => {
            const gradient = ctx.createRadialGradient(
                source.x * this.tileSize + this.tileSize / 2,
                source.y * this.tileSize + this.tileSize / 2,
                0,
                source.x * this.tileSize + this.tileSize / 2,
                source.y * this.tileSize + this.tileSize / 2,
                this.tileSize / 2
            );
            gradient.addColorStop(0, '#ff4444');
            gradient.addColorStop(0.5, '#ff6b6b');
            gradient.addColorStop(1, '#dc3545');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(
                source.x * this.tileSize + this.tileSize / 2,
                source.y * this.tileSize + this.tileSize / 2,
                this.tileSize / 2 - 5,
                0,
                Math.PI * 2
            );
            ctx.fill();
            
            ctx.fillStyle = 'white';
            ctx.font = '16px Arial';
            ctx.textAlign = 'center';
            ctx.fillText('🔥',
                source.x * this.tileSize + this.tileSize / 2,
                source.y * this.tileSize + this.tileSize / 2 + 6
            );
        });
    }

    renderPlacedItems() {
        const ctx = this.ctx;
        
        this.gameState.placedItems.forEach(item => {
            switch (item.type) {
                case 'arrow':
                    this.renderArrow(item);
                    break;
                case 'block':
                    this.renderBlock(item);
                    break;
                case 'extinguisher':
                    this.renderExtinguisher(item);
                    break;
                case 'assembly':
                    this.renderAssemblyPoint(item);
                    break;
            }
        });
    }

    renderArrow(item) {
        const ctx = this.ctx;
        const centerX = item.x * this.tileSize + this.tileSize / 2;
        const centerY = item.y * this.tileSize + this.tileSize / 2;
        
        ctx.save();
        ctx.translate(centerX, centerY);
        
        const rotation = item.direction * Math.PI / 2;
        ctx.rotate(rotation);
        
        ctx.fillStyle = Colors.ARROW;
        ctx.strokeStyle = '#e0a800';
        ctx.lineWidth = 2;
        
        ctx.beginPath();
        ctx.moveTo(0, -18);
        ctx.lineTo(15, 5);
        ctx.lineTo(5, 5);
        ctx.lineTo(5, 18);
        ctx.lineTo(-5, 18);
        ctx.lineTo(-5, 5);
        ctx.lineTo(-15, 5);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        
        ctx.restore();
    }

    renderBlock(item) {
        const ctx = this.ctx;
        
        ctx.fillStyle = Colors.BLOCKED;
        ctx.strokeStyle = '#a71d2a';
        ctx.lineWidth = 2;
        
        ctx.fillRect(
            item.x * this.tileSize + 8,
            item.y * this.tileSize + 8,
            this.tileSize - 16,
            this.tileSize - 16
        );
        ctx.strokeRect(
            item.x * this.tileSize + 8,
            item.y * this.tileSize + 8,
            this.tileSize - 16,
            this.tileSize - 16
        );
        
        ctx.fillStyle = 'white';
        ctx.font = '20px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🚫',
            item.x * this.tileSize + this.tileSize / 2,
            item.y * this.tileSize + this.tileSize / 2 + 7
        );
    }

    renderExtinguisher(item) {
        const ctx = this.ctx;
        const centerX = item.x * this.tileSize + this.tileSize / 2;
        const centerY = item.y * this.tileSize + this.tileSize / 2;
        
        ctx.fillStyle = '#dc3545';
        ctx.beginPath();
        ctx.roundRect(centerX - 12, centerY - 15, 24, 30, 4);
        ctx.fill();
        
        ctx.fillStyle = '#adb5bd';
        ctx.fillRect(centerX - 4, centerY - 22, 8, 10);
        
        ctx.fillStyle = '#ffc107';
        ctx.fillRect(centerX - 8, centerY - 5, 16, 8);
        
        ctx.fillStyle = 'white';
        ctx.font = 'bold 10px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🧯', centerX, centerY + 5);
    }

    renderAssemblyPoint(item) {
        const ctx = this.ctx;
        const centerX = item.x * this.tileSize + this.tileSize / 2;
        const centerY = item.y * this.tileSize + this.tileSize / 2;
        
        ctx.fillStyle = 'rgba(40, 167, 69, 0.3)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, this.tileSize / 2 - 5, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = Colors.ASSEMBLY;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        ctx.fillStyle = 'white';
        ctx.font = '24px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('🏁', centerX, centerY + 8);
    }

    renderSmoke() {
        const ctx = this.ctx;
        const smokeState = this.gameState.smokeState;
        
        if (!smokeState) return;
        
        Object.keys(smokeState).forEach(key => {
            const [x, y] = key.split(',').map(Number);
            const density = smokeState[key];
            
            if (density > 0.1) {
                ctx.fillStyle = `rgba(80, 80, 80, ${Math.min(density * 0.8, 0.7)})`;
                ctx.fillRect(
                    x * this.tileSize,
                    y * this.tileSize,
                    this.tileSize,
                    this.tileSize
                );
                
                ctx.fillStyle = `rgba(60, 60, 60, ${Math.min(density * 0.5, 0.5)})`;
                for (let i = 0; i < 3; i++) {
                    const offsetX = (Math.sin(Date.now() / 1000 + i) + 1) * 10;
                    const offsetY = (Math.cos(Date.now() / 800 + i * 2) + 1) * 10;
                    ctx.beginPath();
                    ctx.arc(
                        x * this.tileSize + 10 + offsetX,
                        y * this.tileSize + 10 + offsetY,
                        8,
                        0,
                        Math.PI * 2
                    );
                    ctx.fill();
                }
            }
        });
    }

    renderPeople() {
        const ctx = this.ctx;
        const people = this.gameState.people || [];
        
        people.forEach(person => {
            if (person.escaped || person.dead) return;
            
            const px = person.x * this.tileSize + this.tileSize / 2;
            const py = person.y * this.tileSize + this.tileSize / 2;
            
            ctx.fillStyle = person.type === 'disabled' ? Colors.PERSON_DISABLED : Colors.PERSON;
            ctx.beginPath();
            ctx.arc(px, py, 15, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.strokeStyle = person.type === 'disabled' ? '#e55a00' : '#0056b3';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = 'white';
            ctx.font = '14px Arial';
            ctx.textAlign = 'center';
            ctx.fillText(
                person.type === 'disabled' ? '♿' : '👤',
                px,
                py + 5
            );
            
            if (person.needsHelp && !person.beingHelped) {
                ctx.fillStyle = '#ffc107';
                ctx.font = '10px Arial';
                ctx.fillText('!', px, py - 20);
            }
            
            if (person.beingHelped) {
                ctx.fillStyle = '#28a745';
                ctx.font = '10px Arial';
                ctx.fillText('+', px, py - 20);
            }
        });
    }

    renderHoverHighlight() {
        if (!this.hoveredTile) return;
        
        const ctx = this.ctx;
        const level = this.gameState.currentLevel;
        
        if (!level) return;
        
        const tileType = level.grid[this.hoveredTile.y]?.[this.hoveredTile.x];
        
        if (tileType === TileType.WALL) return;
        
        ctx.fillStyle = 'rgba(102, 126, 234, 0.2)';
        ctx.strokeStyle = '#667eea';
        ctx.lineWidth = 2;
        
        ctx.fillRect(
            this.hoveredTile.x * this.tileSize + 2,
            this.hoveredTile.y * this.tileSize + 2,
            this.tileSize - 4,
            this.tileSize - 4
        );
        ctx.strokeRect(
            this.hoveredTile.x * this.tileSize + 2,
            this.hoveredTile.y * this.tileSize + 2,
            this.tileSize - 4,
            this.tileSize - 4
        );
    }

    updateSimulationUI(progress, time, escaped, total) {
        const progressEl = document.getElementById('sim-progress');
        const timeEl = document.getElementById('sim-time');
        const escapedEl = document.getElementById('sim-escaped');
        const totalEl = document.getElementById('sim-total');
        const overlay = document.getElementById('simulation-overlay');
        
        if (progressEl) progressEl.textContent = Math.round(progress);
        if (timeEl) timeEl.textContent = Math.round(time);
        if (escapedEl) escapedEl.textContent = escaped;
        if (totalEl) totalEl.textContent = total;
        if (overlay) overlay.classList.remove('hidden');
    }

    hideSimulationUI() {
        const overlay = document.getElementById('simulation-overlay');
        if (overlay) overlay.classList.add('hidden');
    }

    showResult(result) {
        const panel = document.getElementById('result-panel');
        const scoreEl = document.getElementById('result-score');
        const gradeEl = document.getElementById('result-grade');
        const issuesEl = document.getElementById('result-issues');
        
        if (!panel) return;
        
        scoreEl.textContent = result.score;
        
        gradeEl.textContent = result.grade;
        gradeEl.className = `score-grade ${result.grade}`;
        
        issuesEl.innerHTML = '';
        result.issues.forEach(issue => {
            const item = document.createElement('div');
            item.className = `issue-item ${issue.severity}`;
            item.innerHTML = `
                <span class="issue-icon">${issue.icon}</span>
                <div class="issue-content">
                    <div class="issue-title">${issue.title}</div>
                    <div class="issue-desc">${issue.description}</div>
                </div>
            `;
            issuesEl.appendChild(item);
        });
        
        panel.classList.remove('hidden');
    }

    hideResult() {
        const panel = document.getElementById('result-panel');
        if (panel) panel.classList.add('hidden');
    }
}
