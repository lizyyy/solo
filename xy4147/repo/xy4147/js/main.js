/**
 * 主程序入口
 * 负责协调所有模块，管理游戏状态
 */

import { getLevelById, getLevelNames, Direction } from './levels.js';
import { Renderer } from './renderer.js';
import { PeopleSimulation, SmokeSimulation } from './simulation.js';
import { RuleEngine, Severity } from './rules.js';
import { storageManager } from './storage.js';
import { markdownExporter } from './exporter.js';

class GameState {
    constructor() {
        this.currentLevel = null;
        this.placedItems = [];
        this.people = [];
        this.smokeState = null;
        this.isSimulating = false;
        this.simulationTime = 0;
        this.lastResult = null;
        
        this.peopleSimulation = null;
        this.smokeSimulation = null;
        this.simulationLoop = null;
        this.renderer = null;
    }

    loadLevel(levelId) {
        this.currentLevel = getLevelById(levelId);
        this.placedItems = [];
        this.people = JSON.parse(JSON.stringify(this.currentLevel.people));
        this.smokeState = null;
        this.isSimulating = false;
        this.lastResult = null;
        
        this.peopleSimulation = null;
        this.smokeSimulation = null;
        
        if (this.renderer) {
            this.renderer.resizeCanvas();
            this.renderer.render();
        }
        
        return this.currentLevel;
    }

    placeTool(toolType, x, y) {
        if (!this.currentLevel) return false;
        
        if (x < 0 || x >= this.currentLevel.width || y < 0 || y >= this.currentLevel.height) {
            return false;
        }
        
        const tile = this.currentLevel.grid[y][x];
        if (tile === 1) {
            console.warn('Cannot place tool on wall');
            return false;
        }
        
        const existing = this.getPlacedItemAt(x, y);
        if (existing) {
            console.warn('Position already has an item');
            return false;
        }
        
        const maxItems = {
            'arrow': this.currentLevel.maxArrows,
            'block': this.currentLevel.maxBlocks,
            'extinguisher': this.currentLevel.maxExtinguishers,
            'assembly': this.currentLevel.requiredAssemblyPoints + 2
        };
        
        const currentCount = this.placedItems.filter(i => i.type === toolType).length;
        if (currentCount >= maxItems[toolType]) {
            console.warn(`Maximum number of ${toolType} reached: ${maxItems[toolType]}`);
            return false;
        }
        
        if (toolType === 'block') {
            if (tile !== 2) {
                console.warn('Block can only be placed on doors');
                return false;
            }
        }
        
        const item = {
            id: `item_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            type: toolType,
            x,
            y,
            direction: Direction.UP,
            createdAt: Date.now()
        };
        
        this.placedItems.push(item);
        return true;
    }

    getPlacedItemAt(x, y) {
        return this.placedItems.find(item => item.x === x && item.y === y);
    }

    removePlacedItem(item) {
        const index = this.placedItems.findIndex(i => i.id === item.id);
        if (index !== -1) {
            this.placedItems.splice(index, 1);
            return true;
        }
        return false;
    }

    rotateArrow(item) {
        if (item.type !== 'arrow') return false;
        item.direction = (item.direction + 1) % 4;
        return true;
    }

    isDoorBlocked(x, y) {
        return this.placedItems.some(item => 
            item.type === 'block' && item.x === x && item.y === y
        );
    }

    startSimulation() {
        if (!this.currentLevel || this.isSimulating) return false;
        
        this.isSimulating = true;
        this.simulationTime = 0;
        
        this.peopleSimulation = new PeopleSimulation(this.currentLevel, this.placedItems);
        this.smokeSimulation = new SmokeSimulation(this.currentLevel);
        
        const extinguishers = this.placedItems.filter(i => i.type === 'extinguisher');
        this.smokeSimulation.setExtinguishers(extinguishers);
        
        this.people = this.peopleSimulation.initialize();
        this.smokeState = this.smokeSimulation.initialize();
        
        return true;
    }

    stopSimulation() {
        this.isSimulating = false;
        if (this.simulationLoop) {
            cancelAnimationFrame(this.simulationLoop);
            this.simulationLoop = null;
        }
    }

    runSimulation(onProgress, onComplete) {
        if (!this.startSimulation()) {
            onComplete && onComplete(null);
            return;
        }
        
        const startTime = performance.now();
        let lastTime = startTime;
        const timeScale = 1.0;
        
        const loop = (currentTime) => {
            if (!this.isSimulating) return;
            
            const deltaTime = (currentTime - lastTime) / 1000 * timeScale;
            lastTime = currentTime;
            
            this.simulationTime += deltaTime;
            
            this.smokeState = this.smokeSimulation.step(this.simulationTime);
            const result = this.peopleSimulation.step(deltaTime, this.smokeState);
            this.people = result.people;
            
            const escaped = this.peopleSimulation.getEscapedCount();
            const total = this.currentLevel.people.length;
            const progress = (escaped / total) * 100;
            
            onProgress && onProgress(progress, this.simulationTime, escaped, total);
            
            const allDone = escaped + this.peopleSimulation.getDeadCount() >= total || 
                           this.simulationTime > this.currentLevel.timeLimit * 1.5;
            
            if (allDone) {
                this.stopSimulation();
                
                const finalResult = this.evaluateResult();
                this.lastResult = finalResult;
                
                onComplete && onComplete(finalResult);
                return;
            }
            
            this.simulationLoop = requestAnimationFrame(loop);
        };
        
        this.simulationLoop = requestAnimationFrame(loop);
    }

    evaluateResult() {
        const ruleEngine = new RuleEngine(this.currentLevel);
        
        const simulationResult = {
            people: this.people,
            simulationTime: this.simulationTime,
            congestionPoints: [],
            stairCongestion: []
        };
        
        const issues = ruleEngine.validate(
            this.peopleSimulation,
            this.smokeSimulation,
            simulationResult,
            this.placedItems,
            this.simulationTime
        );
        
        const scoreResult = ruleEngine.calculateScore(issues);
        const detailedResult = ruleEngine.getDetailedResults(issues, scoreResult);
        
        return detailedResult;
    }

    reset() {
        this.stopSimulation();
        this.placedItems = [];
        if (this.currentLevel) {
            this.people = JSON.parse(JSON.stringify(this.currentLevel.people));
        }
        this.smokeState = null;
        this.lastResult = null;
    }

    getSaveData() {
        return {
            levelId: this.currentLevel?.id,
            placedItems: JSON.parse(JSON.stringify(this.placedItems))
        };
    }

    loadSaveData(saveData) {
        if (saveData.levelId) {
            this.loadLevel(saveData.levelId);
            this.placedItems = JSON.parse(JSON.stringify(saveData.placedItems));
            return true;
        }
        return false;
    }
}

class GameApp {
    constructor() {
        this.gameState = new GameState();
        this.canvas = null;
        this.renderer = null;
        this.animationLoop = null;
        
        this.init();
    }

    init() {
        this.canvas = document.getElementById('game-canvas');
        this.renderer = new Renderer(this.canvas, this.gameState);
        this.gameState.renderer = this.renderer;
        
        this.setupEventListeners();
        this.loadLevelSelect();
        this.startRenderLoop();
    }

    setupEventListeners() {
        const levelSelect = document.getElementById('level-select');
        if (levelSelect) {
            levelSelect.addEventListener('change', (e) => {
                if (e.target.value) {
                    this.gameState.loadLevel(e.target.value);
                    this.updateLevelInfo();
                    this.renderer.render();
                }
            });
        }
        
        const startSimBtn = document.getElementById('btn-start-sim');
        if (startSimBtn) {
            startSimBtn.addEventListener('click', () => this.handleStartSimulation());
        }
        
        const stopSimBtn = document.getElementById('btn-stop-sim');
        if (stopSimBtn) {
            stopSimBtn.addEventListener('click', () => this.handleStopSimulation());
        }
        
        const resetBtn = document.getElementById('btn-reset');
        if (resetBtn) {
            resetBtn.addEventListener('click', () => this.handleReset());
        }
        
        const saveBtn = document.getElementById('btn-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleSave());
        }
        
        const loadBtn = document.getElementById('btn-load');
        if (loadBtn) {
            loadBtn.addEventListener('click', () => this.handleLoad());
        }
        
        const exportBtn = document.getElementById('btn-export');
        if (exportBtn) {
            exportBtn.addEventListener('click', () => this.handleExport());
        }
        
        const retryBtn = document.getElementById('btn-retry');
        if (retryBtn) {
            retryBtn.addEventListener('click', () => this.handleRetry());
        }
        
        const saveBestBtn = document.getElementById('btn-save-best');
        if (saveBestBtn) {
            saveBestBtn.addEventListener('click', () => this.handleSaveBest());
        }
    }

    loadLevelSelect() {
        const levels = getLevelNames();
        const select = document.getElementById('level-select');
        
        if (!select) return;
        
        select.innerHTML = '<option value="">选择关卡</option>';
        
        levels.forEach(level => {
            const option = document.createElement('option');
            option.value = level.id;
            option.textContent = `${level.name} - ${level.title}`;
            select.appendChild(option);
        });
    }

    updateLevelInfo() {
        const level = this.gameState.currentLevel;
        if (!level) return;
        
        const titleEl = document.getElementById('level-title');
        const descEl = document.getElementById('level-description');
        
        if (titleEl) {
            titleEl.textContent = `${level.title} (${level.difficulty === 'easy' ? '初级' : level.difficulty === 'medium' ? '中级' : '高级'})`;
        }
        
        if (descEl) {
            descEl.textContent = level.description;
        }
    }

    handleStartSimulation() {
        if (!this.gameState.currentLevel) {
            alert('请先选择一个关卡！');
            return;
        }
        
        const startBtn = document.getElementById('btn-start-sim');
        const stopBtn = document.getElementById('btn-stop-sim');
        
        if (startBtn) startBtn.disabled = true;
        if (stopBtn) stopBtn.disabled = false;
        
        this.renderer.hideResult();
        
        this.gameState.runSimulation(
            (progress, time, escaped, total) => {
                this.renderer.updateSimulationUI(progress, time, escaped, total);
            },
            (result) => {
                this.handleSimulationComplete(result);
            }
        );
    }

    handleStopSimulation() {
        this.gameState.stopSimulation();
        
        const startBtn = document.getElementById('btn-start-sim');
        const stopBtn = document.getElementById('btn-stop-sim');
        
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        
        this.renderer.hideSimulationUI();
    }

    handleSimulationComplete(result) {
        const startBtn = document.getElementById('btn-start-sim');
        const stopBtn = document.getElementById('btn-stop-sim');
        
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
        
        this.renderer.hideSimulationUI();
        
        if (result) {
            this.renderer.showResult(result);
        }
        
        this.renderer.render();
    }

    handleReset() {
        this.gameState.reset();
        this.renderer.hideResult();
        this.renderer.hideSimulationUI();
        this.renderer.render();
        
        const startBtn = document.getElementById('btn-start-sim');
        const stopBtn = document.getElementById('btn-stop-sim');
        
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
    }

    handleSave() {
        if (!this.gameState.currentLevel) {
            alert('请先选择一个关卡！');
            return;
        }
        
        const name = prompt('输入方案名称：', `方案 ${Date.now()}`);
        if (!name) return;
        
        const saveData = storageManager.saveLevel(
            this.gameState.currentLevel.id,
            this.gameState.placedItems,
            name
        );
        
        if (saveData) {
            alert(`方案已保存：${name}`);
        } else {
            alert('保存失败！');
        }
    }

    handleLoad() {
        if (!this.gameState.currentLevel) {
            alert('请先选择一个关卡！');
            return;
        }
        
        const saves = storageManager.getLevelSaves(this.gameState.currentLevel.id);
        
        if (saves.length === 0) {
            const best = storageManager.loadBest(this.gameState.currentLevel.id);
            if (best) {
                if (confirm('没有找到保存的方案。是否加载最佳方案？')) {
                    this.gameState.loadSaveData(best);
                    this.renderer.render();
                    alert('已加载最佳方案');
                }
            } else {
                alert('没有找到保存的方案');
            }
            return;
        }
        
        const options = saves.map((save, index) => 
            `${index + 1}. ${save.name} (${new Date(save.createdAt).toLocaleString('zh-CN')})`
        );
        options.unshift('0. 取消');
        
        const input = prompt('选择要加载的方案：\n' + options.join('\n'), '0');
        const index = parseInt(input) - 1;
        
        if (index >= 0 && index < saves.length) {
            this.gameState.loadSaveData(saves[index]);
            this.renderer.render();
            alert(`已加载：${saves[index].name}`);
        }
    }

    handleExport() {
        if (!this.gameState.currentLevel) {
            alert('请先选择一个关卡并完成模拟！');
            return;
        }
        
        if (!this.gameState.lastResult) {
            alert('请先运行模拟才能导出复盘报告！');
            return;
        }
        
        const simulationResult = {
            people: this.gameState.people,
            simulationTime: this.gameState.simulationTime,
            congestionPoints: [],
            stairCongestion: []
        };
        
        const report = markdownExporter.generateReport(
            this.gameState.currentLevel,
            simulationResult,
            this.gameState.lastResult,
            this.gameState.placedItems,
            this.gameState.simulationTime
        );
        
        const filename = `evacuation-report-${this.gameState.currentLevel.id}-${Date.now()}.md`;
        markdownExporter.downloadReport(report, filename);
        
        alert(`复盘报告已导出：${filename}`);
    }

    handleRetry() {
        this.gameState.reset();
        this.renderer.hideResult();
        this.renderer.hideSimulationUI();
        this.renderer.render();
        
        const startBtn = document.getElementById('btn-start-sim');
        const stopBtn = document.getElementById('btn-stop-sim');
        
        if (startBtn) startBtn.disabled = false;
        if (stopBtn) stopBtn.disabled = true;
    }

    handleSaveBest() {
        if (!this.gameState.currentLevel || !this.gameState.lastResult) {
            alert('请先运行模拟并获取结果！');
            return;
        }
        
        const saved = storageManager.saveBest(
            this.gameState.currentLevel.id,
            this.gameState.placedItems,
            this.gameState.lastResult
        );
        
        if (saved) {
            alert('已保存为最佳方案！');
        } else {
            alert('当前方案不如已保存的最佳方案');
        }
    }

    startRenderLoop() {
        const loop = () => {
            if (this.gameState.isSimulating) {
                this.renderer.render();
            }
            this.animationLoop = requestAnimationFrame(loop);
        };
        
        this.animationLoop = requestAnimationFrame(loop);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new GameApp();
});
