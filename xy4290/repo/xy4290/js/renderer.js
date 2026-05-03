// 渲染交互模块 - 负责将游戏状态渲染到 Canvas 并处理用户交互

import { CellType, UnitType, CommandType, GameState } from './types.js';

/**
 * 渲染器类
 */
export class Renderer {
    constructor(canvas, stateManager, rulesEngine) {
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        this.stateManager = stateManager;
        this.rulesEngine = rulesEngine;

        this.cellSize = 50;
        this.padding = 20;

        this.selectedUnitId = null;
        this.hoveredCell = null;
        this.previewPath = null;
        this.previewCommand = null;

        this.listeners = [];

        this.setupEventListeners();
    }

    /**
     * 设置事件监听器
     */
    setupEventListeners() {
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        this.canvas.addEventListener('contextmenu', (e) => this.handleRightClick(e));
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        this.canvas.addEventListener('mouseleave', () => this.handleMouseLeave());
    }

    /**
     * 处理点击事件
     * @param {MouseEvent} e - 鼠标事件
     */
    handleClick(e) {
        const cellPos = this.getCellPosition(e);
        if (!cellPos) return;

        const { x, y } = cellPos;
        const state = this.stateManager.getCurrentState();
        
        if (!state) return;

        const clickedUnit = state.units.find(
            unit => unit.position.x === x && unit.position.y === y
        );

        if (clickedUnit && !clickedUnit.isDeployed) {
            this.selectUnit(clickedUnit.id);
            return;
        }

        if (this.selectedUnitId) {
            this.createCommand(x, y);
        }
    }

    /**
     * 处理右键点击事件
     * @param {MouseEvent} e - 鼠标事件
     */
    handleRightClick(e) {
        e.preventDefault();
        this.deselectUnit();
    }

    /**
     * 处理鼠标移动事件
     * @param {MouseEvent} e - 鼠标事件
     */
    handleMouseMove(e) {
        const cellPos = this.getCellPosition(e);
        
        if (cellPos) {
            this.hoveredCell = cellPos;
            
            if (this.selectedUnitId) {
                this.updatePreview(cellPos.x, cellPos.y);
            }
        } else {
            this.hoveredCell = null;
            this.previewPath = null;
            this.previewCommand = null;
        }

        this.render();
    }

    /**
     * 处理鼠标离开事件
     */
    handleMouseLeave() {
        this.hoveredCell = null;
        this.previewPath = null;
        this.previewCommand = null;
        this.render();
    }

    /**
     * 获取鼠标位置对应的格子坐标
     * @param {MouseEvent} e - 鼠标事件
     * @returns {import('./types.js').Position|null} 格子坐标
     */
    getCellPosition(e) {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        const mouseX = (e.clientX - rect.left) * scaleX;
        const mouseY = (e.clientY - rect.top) * scaleY;

        const state = this.stateManager.getCurrentState();
        if (!state) return null;

        const gridWidth = this.stateManager.getLevelConfig().grid.width;
        const gridHeight = this.stateManager.getLevelConfig().grid.height;
        
        const totalGridWidth = gridWidth * this.cellSize;
        const totalGridHeight = gridHeight * this.cellSize;
        
        const offsetX = (this.canvas.width - totalGridWidth) / 2;
        const offsetY = (this.canvas.height - totalGridHeight) / 2;

        const x = Math.floor((mouseX - offsetX) / this.cellSize);
        const y = Math.floor((mouseY - offsetY) / this.cellSize);

        if (x >= 0 && x < gridWidth && y >= 0 && y < gridHeight) {
            return { x, y };
        }

        return null;
    }

    /**
     * 选择单位
     * @param {string} unitId - 单位 ID
     */
    selectUnit(unitId) {
        this.selectedUnitId = unitId;
        this.previewPath = null;
        this.previewCommand = null;
        this.notifyListeners('unitSelected', unitId);
        this.render();
    }

    /**
     * 取消选择单位
     */
    deselectUnit() {
        this.selectedUnitId = null;
        this.previewPath = null;
        this.previewCommand = null;
        this.notifyListeners('unitDeselected');
        this.render();
    }

    /**
     * 创建指令
     * @param {number} x - 目标 X 坐标
     * @param {number} y - 目标 Y 坐标
     */
    createCommand(x, y) {
        const unit = this.stateManager.getUnitById(this.selectedUnitId);
        if (!unit) return;

        const cell = this.stateManager.getCell(x, y);
        if (!cell) return;

        let commandType = null;
        let validationResult = null;

        if (unit.type === UnitType.REPAIR_VEHICLE) {
            if (cell.type === CellType.BLOCKED && cell.isRepairable) {
                commandType = CommandType.REPAIR;
                validationResult = this.rulesEngine.validateRepair(this.selectedUnitId, { x, y });
            } else {
                const state = this.stateManager.getCurrentState();
                const targetGenerator = state.units.find(
                    u => u.type === UnitType.GENERATOR && 
                         u.position.x === x && 
                         u.position.y === y
                );

                if (targetGenerator) {
                    commandType = CommandType.SUPPLY;
                    validationResult = this.rulesEngine.validateSupply(this.selectedUnitId, { x, y });
                } else if (cell.isPassable || cell.hasBroadcast) {
                    commandType = CommandType.MOVE;
                    validationResult = this.rulesEngine.validateMove(this.selectedUnitId, { x, y });
                }
            }
        } else if (unit.type === UnitType.GENERATOR) {
            if (cell.hasBroadcast && !cell.isBroadcastActive) {
                commandType = CommandType.DEPLOY;
                validationResult = this.rulesEngine.validateDeploy(this.selectedUnitId, { x, y });
            } else if (cell.isPassable || cell.hasBroadcast) {
                commandType = CommandType.MOVE;
                validationResult = this.rulesEngine.validateMove(this.selectedUnitId, { x, y });
            }
        }

        if (commandType && validationResult) {
            if (validationResult.valid) {
                const command = {
                    id: `cmd_${Date.now()}`,
                    type: commandType,
                    unitId: this.selectedUnitId,
                    target: { x, y },
                    estimatedTime: validationResult.details.totalTime || validationResult.details.timeCost || 0,
                    options: {
                        path: validationResult.details.path
                    }
                };

                this.notifyListeners('commandCreated', command, validationResult);
            } else {
                this.notifyListeners('commandInvalid', validationResult.error);
            }
        }
    }

    /**
     * 更新预览
     * @param {number} x - 目标 X 坐标
     * @param {number} y - 目标 Y 坐标
     */
    updatePreview(x, y) {
        const unit = this.stateManager.getUnitById(this.selectedUnitId);
        if (!unit) return;

        const cell = this.stateManager.getCell(x, y);
        if (!cell) return;

        let pathResult = null;

        if (unit.type === UnitType.REPAIR_VEHICLE) {
            if (cell.type === CellType.BLOCKED && cell.isRepairable) {
                const validationResult = this.rulesEngine.validateRepair(this.selectedUnitId, { x, y });
                if (validationResult.valid) {
                    pathResult = validationResult.details;
                }
            } else if (cell.isPassable || cell.hasBroadcast) {
                const validationResult = this.rulesEngine.validateMove(this.selectedUnitId, { x, y });
                if (validationResult.valid) {
                    pathResult = validationResult.details;
                }
            }
        } else if (unit.type === UnitType.GENERATOR) {
            if (cell.isPassable || cell.hasBroadcast) {
                const validationResult = this.rulesEngine.validateMove(this.selectedUnitId, { x, y });
                if (validationResult.valid) {
                    pathResult = validationResult.details;
                }
            }
        }

        if (pathResult && pathResult.path) {
            this.previewPath = pathResult.path;
            this.previewCommand = pathResult;
        } else {
            this.previewPath = null;
            this.previewCommand = null;
        }
    }

    /**
     * 渲染游戏
     */
    render() {
        const state = this.stateManager.getCurrentState();
        const config = this.stateManager.getLevelConfig();

        if (!state || !config) return;

        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        const gridWidth = config.grid.width;
        const gridHeight = config.grid.height;
        
        const totalGridWidth = gridWidth * this.cellSize;
        const totalGridHeight = gridHeight * this.cellSize;
        
        const offsetX = (this.canvas.width - totalGridWidth) / 2;
        const offsetY = (this.canvas.height - totalGridHeight) / 2;

        const coverageInfo = this.rulesEngine.calculateCoverage();

        for (let y = 0; y < gridHeight; y++) {
            for (let x = 0; x < gridWidth; x++) {
                const cell = state.cells[y][x];
                const isCovered = coverageInfo.coveredCells.has(`${x},${y}`);
                
                this.drawCell(
                    x, 
                    y, 
                    cell, 
                    isCovered,
                    offsetX, 
                    offsetY
                );
            }
        }

        if (this.previewPath) {
            this.drawPreviewPath(this.previewPath, offsetX, offsetY);
        }

        for (const unit of state.units) {
            const isSelected = unit.id === this.selectedUnitId;
            this.drawUnit(unit, isSelected, offsetX, offsetY);
        }

        if (this.hoveredCell) {
            this.drawHoverHighlight(this.hoveredCell.x, this.hoveredCell.y, offsetX, offsetY);
        }
    }

    /**
     * 绘制单个格子
     * @param {number} x - 格子 X 坐标
     * @param {number} y - 格子 Y 坐标
     * @param {import('./types.js').Cell} cell - 格子数据
     * @param {boolean} isCovered - 是否被广播覆盖
     * @param {number} offsetX - 偏移 X
     * @param {number} offsetY - 偏移 Y
     */
    drawCell(x, y, cell, isCovered, offsetX, offsetY) {
        const screenX = offsetX + x * this.cellSize;
        const screenY = offsetY + y * this.cellSize;

        let fillColor = '#333';
        let strokeColor = '#555';

        switch (cell.type) {
            case CellType.ROAD:
                fillColor = isCovered ? '#2a4a2a' : '#444';
                strokeColor = isCovered ? '#4a7a4a' : '#666';
                break;
            case CellType.BUILDING:
                fillColor = '#5a3a3a';
                strokeColor = '#8a5a5a';
                break;
            case CellType.WATER:
                fillColor = '#1a3a5a';
                strokeColor = '#3a6a9a';
                break;
            case CellType.BLOCKED:
                fillColor = '#5a3a1a';
                strokeColor = '#8a5a3a';
                break;
            case CellType.BROADCAST_POINT:
                fillColor = cell.isBroadcastActive ? '#2a5a2a' : '#5a5a2a';
                strokeColor = cell.isBroadcastActive ? '#4a9a4a' : '#8a8a4a';
                break;
            case CellType.EMPTY:
                fillColor = '#1a1a2a';
                strokeColor = '#2a2a4a';
                break;
        }

        this.ctx.fillStyle = fillColor;
        this.ctx.fillRect(screenX + 1, screenY + 1, this.cellSize - 2, this.cellSize - 2);

        this.ctx.strokeStyle = strokeColor;
        this.ctx.lineWidth = 2;
        this.ctx.strokeRect(screenX + 1, screenY + 1, this.cellSize - 2, this.cellSize - 2);

        if (cell.type === CellType.BLOCKED) {
            this.drawBlockedIcon(screenX, screenY);
        }

        if (cell.hasBroadcast) {
            this.drawBroadcastPoint(screenX, screenY, cell.isBroadcastActive);
        }

        if (isCovered && cell.type !== CellType.BROADCAST_POINT) {
            this.ctx.fillStyle = 'rgba(0, 255, 100, 0.1)';
            this.ctx.fillRect(screenX + 1, screenY + 1, this.cellSize - 2, this.cellSize - 2);
        }
    }

    /**
     * 绘制阻断图标
     * @param {number} screenX - 屏幕 X 坐标
     * @param {number} screenY - 屏幕 Y 坐标
     */
    drawBlockedIcon(screenX, screenY) {
        const centerX = screenX + this.cellSize / 2;
        const centerY = screenY + this.cellSize / 2;
        const size = this.cellSize * 0.3;

        this.ctx.strokeStyle = '#ff6b6b';
        this.ctx.lineWidth = 3;
        
        this.ctx.beginPath();
        this.ctx.moveTo(centerX - size, centerY - size);
        this.ctx.lineTo(centerX + size, centerY + size);
        this.ctx.moveTo(centerX + size, centerY - size);
        this.ctx.lineTo(centerX - size, centerY + size);
        this.ctx.stroke();
    }

    /**
     * 绘制广播点
     * @param {number} screenX - 屏幕 X 坐标
     * @param {number} screenY - 屏幕 Y 坐标
     * @param {boolean} isActive - 是否激活
     */
    drawBroadcastPoint(screenX, screenY, isActive) {
        const centerX = screenX + this.cellSize / 2;
        const centerY = screenY + this.cellSize / 2;
        const radius = this.cellSize * 0.2;

        this.ctx.fillStyle = isActive ? '#00ff64' : '#ffcc00';
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        this.ctx.fill();

        if (isActive) {
            this.ctx.strokeStyle = 'rgba(0, 255, 100, 0.5)';
            this.ctx.lineWidth = 2;
            
            for (let i = 1; i <= 3; i++) {
                const waveRadius = radius * (1 + i * 0.5);
                this.ctx.beginPath();
                this.ctx.arc(centerX, centerY, waveRadius, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        }
    }

    /**
     * 绘制单位
     * @param {import('./types.js').RepairVehicle|import('./types.js').Generator} unit - 单位
     * @param {boolean} isSelected - 是否被选中
     * @param {number} offsetX - 偏移 X
     * @param {number} offsetY - 偏移 Y
     */
    drawUnit(unit, isSelected, offsetX, offsetY) {
        const screenX = offsetX + unit.position.x * this.cellSize + this.cellSize / 2;
        const screenY = offsetY + unit.position.y * this.cellSize + this.cellSize / 2;
        const size = this.cellSize * 0.35;

        if (isSelected) {
            this.ctx.strokeStyle = '#00ffff';
            this.ctx.lineWidth = 3;
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, size + 8, 0, Math.PI * 2);
            this.ctx.stroke();
        }

        if (unit.type === UnitType.REPAIR_VEHICLE) {
            this.ctx.fillStyle = unit.isDeployed ? '#888' : '#ff9500';
            this.ctx.fillRect(screenX - size, screenY - size * 0.6, size * 2, size * 1.2);
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${size * 0.8}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('🔧', screenX, screenY);
        } else if (unit.type === UnitType.GENERATOR) {
            this.ctx.fillStyle = unit.isDeployed ? '#888' : '#007aff';
            this.ctx.beginPath();
            this.ctx.arc(screenX, screenY, size, 0, Math.PI * 2);
            this.ctx.fill();
            
            this.ctx.fillStyle = '#fff';
            this.ctx.font = `${size * 0.8}px Arial`;
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText('⚡', screenX, screenY);
        }

        if (unit.type === UnitType.REPAIR_VEHICLE || unit.type === UnitType.GENERATOR) {
            const barWidth = size * 2;
            const barHeight = 6;
            const barX = screenX - barWidth / 2;
            const barY = screenY + size + 5;

            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(barX, barY, barWidth, barHeight);

            const fuelRatio = unit.fuel / unit.maxFuel;
            const fuelColor = fuelRatio > 0.5 ? '#00ff64' : fuelRatio > 0.25 ? '#ffcc00' : '#ff6b6b';
            
            this.ctx.fillStyle = fuelColor;
            this.ctx.fillRect(barX, barY, barWidth * fuelRatio, barHeight);

            this.ctx.strokeStyle = '#666';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(barX, barY, barWidth, barHeight);
        }
    }

    /**
     * 绘制预览路径
     * @param {import('./types.js').Position[]} path - 路径
     * @param {number} offsetX - 偏移 X
     * @param {number} offsetY - 偏移 Y
     */
    drawPreviewPath(path, offsetX, offsetY) {
        if (!path || path.length < 2) return;

        this.ctx.strokeStyle = 'rgba(0, 255, 255, 0.7)';
        this.ctx.lineWidth = 3;
        this.ctx.setLineDash([5, 5]);

        this.ctx.beginPath();
        
        for (let i = 0; i < path.length; i++) {
            const point = path[i];
            const screenX = offsetX + point.x * this.cellSize + this.cellSize / 2;
            const screenY = offsetY + point.y * this.cellSize + this.cellSize / 2;

            if (i === 0) {
                this.ctx.moveTo(screenX, screenY);
            } else {
                this.ctx.lineTo(screenX, screenY);
            }
        }
        
        this.ctx.stroke();
        this.ctx.setLineDash([]);

        const lastPoint = path[path.length - 1];
        const targetX = offsetX + lastPoint.x * this.cellSize + this.cellSize / 2;
        const targetY = offsetY + lastPoint.y * this.cellSize + this.cellSize / 2;

        this.ctx.fillStyle = 'rgba(0, 255, 255, 0.5)';
        this.ctx.beginPath();
        this.ctx.arc(targetX, targetY, 10, 0, Math.PI * 2);
        this.ctx.fill();
    }

    /**
     * 绘制悬停高亮
     * @param {number} x - 格子 X 坐标
     * @param {number} y - 格子 Y 坐标
     * @param {number} offsetX - 偏移 X
     * @param {number} offsetY - 偏移 Y
     */
    drawHoverHighlight(x, y, offsetX, offsetY) {
        const screenX = offsetX + x * this.cellSize;
        const screenY = offsetY + y * this.cellSize;

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.8)';
        this.ctx.lineWidth = 3;
        this.ctx.strokeRect(screenX + 1, screenY + 1, this.cellSize - 2, this.cellSize - 2);
    }

    /**
     * 调整画布大小
     * @param {number} width - 宽度
     * @param {number} height - 高度
     */
    resize(width, height) {
        this.canvas.width = width;
        this.canvas.height = height;
        this.render();
    }

    /**
     * 添加监听器
     * @param {Function} listener - 监听器函数
     */
    addListener(listener) {
        this.listeners.push(listener);
    }

    /**
     * 移除监听器
     * @param {Function} listener - 要移除的监听器函数
     */
    removeListener(listener) {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * 通知所有监听器
     * @param {string} eventType - 事件类型
     * @param {*} data - 数据
     */
    notifyListeners(eventType, ...data) {
        for (const listener of this.listeners) {
            try {
                listener(eventType, ...data);
            } catch (error) {
                console.error('监听器执行出错:', error);
            }
        }
    }
}

export default Renderer;
