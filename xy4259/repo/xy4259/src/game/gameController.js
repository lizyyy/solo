// 游戏控制器 - 游戏逻辑和状态管理

import { Point, ElementType, Level, MapElement } from '../models/level.js';
import { PhysicsEngine, ScoreCalculator } from '../physics/physics.js';
import { PathValidator, ValidationErrorType, createValidationSummary } from '../validation/pathValidator.js';
import { PathHistoryManager, storageManager } from '../storage/storage.js';
import { replayExporter } from '../export/exporter.js';

export const GameState = {
    MENU: 'menu',
    LEVEL_SELECT: 'level_select',
    EDITING: 'editing',
    PLAYING: 'playing',
    PLANNING: 'planning',
    EXECUTING: 'executing',
    REPLAYING: 'replaying',
    FINISHED: 'finished',
    HISTORY: 'history'
};

export class GameController {
    constructor(options = {}) {
        this.state = GameState.MENU;
        this.currentLevel = null;
        this.currentLevelId = null;
        this.path = [];
        this.visitedRescuePoints = new Set();
        this.pathHistory = new PathHistoryManager();
        this.physicsEngine = null;
        this.pathValidator = null;
        this.scoreCalculator = new ScoreCalculator();
        
        this.replayData = null;
        this.replayIndex = 0;
        this.replayInterval = null;
        
        this.dronePosition = null;
        this.droneRotation = 0;
        this.remainingBattery = 0;
        
        this.callbacks = {
            onStateChange: options.onStateChange || (() => {}),
            onPathUpdate: options.onPathUpdate || (() => {}),
            onGameUpdate: options.onGameUpdate || (() => {}),
            onMessage: options.onMessage || (() => {})
        };
    }
    
    setState(newState) {
        this.state = newState;
        this.callbacks.onStateChange(newState);
    }
    
    async loadLevel(levelId) {
        const level = storageManager.getLevel(levelId);
        if (!level) {
            this.callbacks.onMessage('关卡不存在', 'error');
            return false;
        }
        
        this.currentLevel = level;
        this.currentLevelId = levelId;
        this.physicsEngine = new PhysicsEngine(level.settings);
        this.pathValidator = new PathValidator(level, this.physicsEngine);
        
        this.resetGame();
        this.setState(GameState.PLANNING);
        
        return true;
    }
    
    createNewLevel() {
        this.currentLevel = new Level('未命名关卡');
        this.currentLevelId = null;
        this.physicsEngine = new PhysicsEngine(this.currentLevel.settings);
        this.pathValidator = new PathValidator(this.currentLevel, this.physicsEngine);
        
        this.setState(GameState.EDITING);
        return this.currentLevel;
    }
    
    saveCurrentLevel() {
        if (!this.currentLevel) return null;
        
        const validation = this.currentLevel.validate();
        if (!validation.valid) {
            this.callbacks.onMessage(validation.errors.join('; '), 'error');
            return null;
        }
        
        this.currentLevelId = storageManager.saveLevel(this.currentLevel);
        this.callbacks.onMessage('关卡保存成功!', 'success');
        return this.currentLevelId;
    }
    
    resetGame() {
        if (!this.currentLevel) return;
        
        this.path = [this.currentLevel.startPoint.position.clone()];
        this.visitedRescuePoints = new Set();
        this.pathHistory.clear();
        this.pathHistory.push(this.path);
        this.remainingBattery = this.currentLevel.settings.initialBattery;
        this.dronePosition = this.currentLevel.startPoint.position.clone();
        this.replayData = null;
        
        this.callbacks.onPathUpdate(this.path);
        this.updateUI();
    }
    
    addPathPoint(x, y) {
        if (this.state !== GameState.PLANNING) return false;
        
        const newPoint = new Point(x, y);
        
        const segmentStart = this.path[this.path.length - 1];
        const segmentErrors = this.pathValidator.validateSegment(segmentStart, newPoint, this.path.length - 1);
        
        if (segmentErrors.length > 0) {
            const errorMessages = segmentErrors.map(e => e.message).join('; ');
            this.callbacks.onMessage(errorMessages, 'error');
            return false;
        }
        
        this.path.push(newPoint);
        this.pathHistory.push(this.path);
        
        this.callbacks.onPathUpdate(this.path);
        this.updateUI();
        
        return true;
    }
    
    undo() {
        if (this.state !== GameState.PLANNING) return false;
        
        const previousPath = this.pathHistory.undo();
        if (previousPath) {
            this.path = previousPath;
            this.callbacks.onPathUpdate(this.path);
            this.updateUI();
            return true;
        }
        
        this.callbacks.onMessage('无法撤销', 'warning');
        return false;
    }
    
    redo() {
        if (this.state !== GameState.PLANNING) return false;
        
        const nextPath = this.pathHistory.redo();
        if (nextPath) {
            this.path = nextPath;
            this.callbacks.onPathUpdate(this.path);
            this.updateUI();
            return true;
        }
        
        this.callbacks.onMessage('无法重做', 'warning');
        return false;
    }
    
    clearPath() {
        if (this.state !== GameState.PLANNING) return;
        
        this.resetGame();
        this.callbacks.onMessage('路径已清除', 'info');
    }
    
    validatePath() {
        if (!this.path || this.path.length < 2) {
            return {
                valid: false,
                issues: [{
                    type: 'INVALID_PATH',
                    message: '路径至少需要两个点'
                }]
            };
        }
        
        return this.pathValidator.validateCompleteMission(this.path);
    }
    
    async executePlan() {
        if (this.state !== GameState.PLANNING) return;
        
        const validation = this.validatePath();
        
        if (!validation.valid) {
            const summary = createValidationSummary(validation);
            this.callbacks.onMessage(summary.messages.join('; '), 'error');
            return;
        }
        
        this.setState(GameState.EXECUTING);
        this.remainingBattery = this.currentLevel.settings.initialBattery;
        this.visitedRescuePoints = new Set();
        this.dronePosition = this.path[0].clone();
        
        const replayEvents = [];
        const segments = [];
        
        for (let i = 0; i < this.path.length - 1; i++) {
            const start = this.path[i];
            const end = this.path[i + 1];
            const energy = this.physicsEngine.calculateSegmentEnergy(start, end, this.currentLevel.windZones);
            const distance = start.distanceTo(end);
            
            this.remainingBattery -= energy;
            
            const segmentResult = {
                index: i,
                start: { x: start.x, y: start.y },
                end: { x: end.x, y: end.y },
                distance,
                energy,
                remainingBattery: this.remainingBattery
            };
            segments.push(segmentResult);
            
            for (const rescuePoint of this.currentLevel.rescuePoints) {
                const distToRescue = end.distanceTo(rescuePoint.position);
                if (distToRescue <= 15 && !this.visitedRescuePoints.has(rescuePoint.id)) {
                    this.visitedRescuePoints.add(rescuePoint.id);
                    replayEvents.push({
                        type: 'RESCUE',
                        pointIndex: i + 1,
                        rescuePointId: rescuePoint.id,
                        position: { x: end.x, y: end.y }
                    });
                }
            }
            
            replayEvents.push({
                type: 'MOVE',
                from: { x: start.x, y: start.y },
                to: { x: end.x, y: end.y },
                energy,
                remainingBattery: this.remainingBattery
            });
            
            if (this.remainingBattery < 0) {
                replayEvents.push({
                    type: 'BATTERY_DEPLETED',
                    position: { x: end.x, y: end.y }
                });
                break;
            }
        }
        
        const statistics = this.pathValidator.getPathStatistics(this.path);
        
        this.replayData = {
            path: this.path.map(p => ({ x: p.x, y: p.y })),
            segments,
            events: replayEvents,
            statistics
        };
        
        const success = this.remainingBattery >= 0 && 
                       this.visitedRescuePoints.size === this.currentLevel.rescuePoints.length;
        
        const gameResult = {
            success,
            remainingBattery: Math.max(0, this.remainingBattery),
            totalDistance: statistics.totalDistance,
            rescuePointsVisited: this.visitedRescuePoints.size,
            totalRescuePoints: this.currentLevel.rescuePoints.length,
            replayData: this.replayData,
            levelId: this.currentLevelId,
            levelName: this.currentLevel.name
        };
        
        if (success) {
            const scoreResult = this.scoreCalculator.calculateScore(gameResult, this.currentLevel);
            gameResult.score = scoreResult.score;
            gameResult.grade = scoreResult.grade;
            gameResult.scoreBreakdown = scoreResult.breakdown;
            
            storageManager.saveGameHistory(gameResult);
            
            this.showResult(gameResult);
        } else {
            this.callbacks.onMessage('任务失败! 请检查路径', 'error');
            this.setState(GameState.PLANNING);
        }
    }
    
    showResult(gameResult) {
        this.setState(GameState.FINISHED);
        
        if (this.callbacks.onGameUpdate) {
            this.callbacks.onGameUpdate({
                type: 'RESULT',
                data: gameResult
            });
        }
    }
    
    async startReplay(replayData = null) {
        const dataToReplay = replayData || this.replayData;
        
        if (!dataToReplay) {
            this.callbacks.onMessage('没有可回放的数据', 'error');
            return;
        }
        
        this.setState(GameState.REPLAYING);
        this.replayIndex = 0;
        
        const path = dataToReplay.path.map(p => new Point(p.x, p.y));
        this.path = path;
        this.dronePosition = path[0].clone();
        this.remainingBattery = this.currentLevel?.settings.initialBattery || 100;
        this.visitedRescuePoints = new Set();
        
        this.callbacks.onPathUpdate(this.path);
        
        const replayStep = () => {
            if (this.state !== GameState.REPLAYING) return;
            
            if (this.replayIndex < path.length - 1) {
                const currentPos = path[this.replayIndex];
                const nextPos = path[this.replayIndex + 1];
                
                const segment = dataToReplay.segments?.[this.replayIndex];
                if (segment) {
                    this.remainingBattery = segment.remainingBattery;
                }
                
                for (const rescuePoint of this.currentLevel?.rescuePoints || []) {
                    const distToRescue = nextPos.distanceTo(rescuePoint.position);
                    if (distToRescue <= 15) {
                        this.visitedRescuePoints.add(rescuePoint.id);
                    }
                }
                
                const dx = nextPos.x - currentPos.x;
                const dy = nextPos.y - currentPos.y;
                this.droneRotation = Math.atan2(dy, dx);
                
                this.dronePosition = nextPos.clone();
                this.replayIndex++;
                
                this.callbacks.onGameUpdate({
                    type: 'REPLAY_STEP',
                    data: {
                        position: this.dronePosition,
                        rotation: this.droneRotation,
                        remainingBattery: this.remainingBattery,
                        visitedRescuePoints: this.visitedRescuePoints
                    }
                });
                
                this.replayInterval = setTimeout(replayStep, 500);
            } else {
                this.callbacks.onMessage('回放完成', 'info');
                this.setState(GameState.FINISHED);
            }
        };
        
        replayStep();
    }
    
    stopReplay() {
        if (this.replayInterval) {
            clearTimeout(this.replayInterval);
            this.replayInterval = null;
        }
        this.setState(GameState.PLANNING);
    }
    
    exportReplay() {
        if (!this.replayData || !this.currentLevel) {
            this.callbacks.onMessage('没有可导出的数据', 'error');
            return;
        }
        
        const gameResult = {
            success: true,
            score: 0,
            grade: 'N/A',
            remainingBattery: this.remainingBattery,
            totalDistance: this.replayData.statistics?.totalDistance || 0,
            rescuePointsVisited: this.visitedRescuePoints.size,
            totalRescuePoints: this.currentLevel.rescuePoints.length,
            replayData: this.replayData,
            playedAt: new Date().toISOString()
        };
        
        const replayData = replayExporter.exportReplay(gameResult, this.currentLevel, {
            includeScoreBreakdown: true
        });
        
        replayExporter.downloadJSON(replayData, `replay_${Date.now()}.json`);
        this.callbacks.onMessage('回放数据已导出', 'success');
    }
    
    addEditorElement(type, position, options = {}) {
        if (this.state !== GameState.EDITING || !this.currentLevel) return null;
        
        let actualPosition;
        if (type === ElementType.START_POINT || type === ElementType.RESCUE_POINT) {
            actualPosition = position instanceof Point ? position : new Point(position.x, position.y);
        } else {
            actualPosition = position.map(p => new Point(p.x, p.y));
        }
        
        const element = new MapElement(type, actualPosition, options);
        this.currentLevel.addElement(element);
        
        this.callbacks.onGameUpdate({
            type: 'LEVEL_UPDATED',
            data: this.currentLevel
        });
        
        return element;
    }
    
    removeEditorElement(elementId) {
        if (this.state !== GameState.EDITING || !this.currentLevel) return false;
        
        const success = this.currentLevel.removeElement(elementId);
        if (success) {
            this.callbacks.onGameUpdate({
                type: 'LEVEL_UPDATED',
                data: this.currentLevel
            });
        }
        
        return success;
    }
    
    getAvailableLevels() {
        return storageManager.getLevels();
    }
    
    getGameHistory() {
        return storageManager.getGameHistory();
    }
    
    deleteLevel(levelId) {
        storageManager.deleteLevel(levelId);
        this.callbacks.onMessage('关卡已删除', 'info');
    }
    
    deleteHistory(historyId) {
        storageManager.deleteGameHistory(historyId);
        this.callbacks.onMessage('记录已删除', 'info');
    }
    
    updateUI() {
        if (!this.currentLevel) return;
        
        const estimatedEnergy = this.path.length >= 2 
            ? this.physicsEngine.calculatePathEnergy(this.path, this.currentLevel.windZones)
            : 0;
        
        const coverage = this.pathValidator.checkRescuePointCoverage(this.path);
        
        const data = {
            pathLength: this.path.length,
            estimatedEnergy: estimatedEnergy.toFixed(1),
            remainingBattery: this.remainingBattery.toFixed(1),
            visitedRescuePoints: coverage.visited.length,
            totalRescuePoints: coverage.total
        };
        
        this.callbacks.onGameUpdate({
            type: 'UI_UPDATE',
            data
        });
    }
    
    getCurrentState() {
        return {
            state: this.state,
            level: this.currentLevel,
            path: this.path,
            dronePosition: this.dronePosition,
            droneRotation: this.droneRotation,
            remainingBattery: this.remainingBattery,
            visitedRescuePoints: this.visitedRescuePoints
        };
    }
}
