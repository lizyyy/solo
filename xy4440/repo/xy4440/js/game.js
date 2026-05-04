/**
 * 游戏核心逻辑模块
 */

(function() {
    const GAME_STATE = window.constants.GAME_STATE;
    const TURN_STATE = window.constants.TURN_STATE;
    const OBJECT_TYPE = window.constants.OBJECT_TYPE;
    const GAME = window.constants.GAME;
    const EventEmitter = window.utils.EventEmitter;
    const PhysicsEngine = window.physics.PhysicsEngine;
    const Renderer = window.renderer.Renderer;
    const InputManager = window.input.InputManager;
    const LevelManager = window.level.LevelManager;
    const StorageManager = window.storage.StorageManager;

// 游戏类
class Game extends EventEmitter {
    constructor(canvas) {
        super();
        
        this.canvas = canvas;
        this.ctx = canvas.getContext('2d');
        
        // 游戏状态
        this.state = GAME_STATE.MENU;
        this.turnState = TURN_STATE.PLANNING;
        
        // 游戏参数
        this.currentTurn = 1;
        this.maxTurns = GAME.MAX_TURNS;
        this.gameTime = 0;
        this.timeLimit = GAME.TIMEOUT_LIMIT;
        this.score = 0;
        this.rescuedCount = 0;
        this.pendingCount = 0;
        
        // 游戏对象
        this.rivers = [];
        this.shallows = [];
        this.students = [];
        this.boats = [];
        this.ropes = [];
        this.safeZones = [];
        
        // 游戏循环
        this.isRunning = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        
        // 管理器
        this.physicsEngine = new PhysicsEngine();
        this.renderer = new Renderer(canvas);
        this.inputManager = new InputManager(canvas, this);
        this.levelManager = new LevelManager(this);
        this.storageManager = new StorageManager();
        
        // 回放数据
        this.replayData = {
            id: null,
            levelId: null,
            startTime: null,
            endTime: null,
            turns: [],
            events: [],
            finalState: null
        };
        
        // 复盘笔记
        this.reviewNotes = [];
        
        // 绑定事件
        this.setupEventListeners();
    }
    
    // 设置事件监听器
    setupEventListeners() {
        // 监听对象选择事件
        this.on('objectSelected', (obj) => {
            this.inputManager.updateSelectedObjectInfo();
        });
        
        this.on('objectDeselected', () => {
            this.inputManager.updateSelectedObjectInfo();
        });
        
        // 监听学员救援事件
        for (const student of this.students) {
            student.on('rescued', (studentObj) => {
                this.handleStudentRescued(studentObj);
            });
        }
    }
    
    // 开始游戏
    start() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.state = GAME_STATE.PLAYING;
        this.lastTime = performance.now();
        
        // 初始化回放数据
        this.replayData = {
            id: `replay_${Date.now()}`,
            levelId: this.levelManager.currentLevel?.id || 'unknown',
            startTime: new Date().toISOString(),
            endTime: null,
            turns: [],
            events: [],
            finalState: null
        };
        
        this.logAction('游戏开始');
        
        // 开始游戏循环
        this.gameLoop();
        
        this.emit('gameStarted');
    }
    
    // 暂停游戏
    pause() {
        if (!this.isRunning) return;
        
        this.isRunning = false;
        this.state = GAME_STATE.PAUSED;
        
        this.logAction('游戏暂停');
        this.emit('gamePaused');
    }
    
    // 恢复游戏
    resume() {
        if (this.isRunning) return;
        
        this.isRunning = true;
        this.state = GAME_STATE.PLAYING;
        this.lastTime = performance.now();
        
        this.logAction('游戏恢复');
        this.gameLoop();
        this.emit('gameResumed');
    }
    
    // 游戏循环
    gameLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // 更新游戏时间
        if (this.turnState === TURN_STATE.EXECUTING) {
            this.gameTime += this.deltaTime;
        }
        
        // 更新游戏逻辑
        this.update(this.deltaTime);
        
        // 渲染
        this.render();
        
        // 检查游戏结束条件
        this.checkGameEnd();
        
        // 请求下一帧
        requestAnimationFrame(() => this.gameLoop());
    }
    
    // 更新游戏逻辑
    update(deltaTime) {
        // 只在执行阶段更新物理
        if (this.turnState === TURN_STATE.EXECUTING) {
            // 更新物理引擎
            this.physicsEngine.update(deltaTime);
            
            // 移动救援艇沿路径
            for (const boat of this.boats) {
                if (boat.path && boat.path.length > 0) {
                    boat.moveToPathPoint(deltaTime);
                }
            }
            
            // 检查救援艇是否到达安全区
            this.checkSafeZoneArrival();
            
            // 检查学员是否超时
            this.checkStudentTimeout();
        }
        
        // 更新UI
        this.updateUI();
    }
    
    // 渲染
    render() {
        // 清空渲染器
        this.renderer.clearObjects();
        
        // 添加所有对象到渲染器
        for (const river of this.rivers) {
            this.renderer.addObject(river);
        }
        
        for (const shallow of this.shallows) {
            this.renderer.addObject(shallow);
        }
        
        for (const safeZone of this.safeZones) {
            this.renderer.addObject(safeZone);
        }
        
        for (const rope of this.ropes) {
            this.renderer.addObject(rope);
        }
        
        for (const student of this.students) {
            this.renderer.addObject(student);
        }
        
        for (const boat of this.boats) {
            this.renderer.addObject(boat);
        }
        
        // 渲染
        this.renderer.render();
    }
    
    // 开始回合
    startTurn() {
        if (this.turnState !== TURN_STATE.PLANNING) return;
        
        this.turnState = TURN_STATE.EXECUTING;
        
        // 记录回合开始
        this.logAction(`回合 ${this.currentTurn} 开始执行`);
        
        // 记录回放数据
        this.replayData.turns.push({
            turnNumber: this.currentTurn,
            startTime: this.gameTime,
            endTime: null,
            actions: this.captureTurnActions()
        });
        
        this.emit('turnStarted', this.currentTurn);
    }
    
    // 结束回合
    endTurn() {
        if (this.turnState !== TURN_STATE.EXECUTING) return;
        
        this.turnState = TURN_STATE.COMPLETED;
        
        // 记录回合结束
        if (this.replayData.turns.length > 0) {
            this.replayData.turns[this.replayData.turns.length - 1].endTime = this.gameTime;
        }
        
        this.logAction(`回合 ${this.currentTurn} 结束`);
        
        // 增加回合数
        if (this.currentTurn < this.maxTurns) {
            this.currentTurn++;
            this.turnState = TURN_STATE.PLANNING;
            
            // 重置所有救援艇的路径
            for (const boat of this.boats) {
                boat.setPath([]);
            }
        }
        
        this.emit('turnEnded', this.currentTurn - 1);
    }
    
    // 重置当前回合
    resetTurn() {
        if (this.turnState !== TURN_STATE.PLANNING) return;
        
        // 重置所有救援艇的路径
        for (const boat of this.boats) {
            boat.setPath([]);
        }
        
        this.logAction('当前回合已重置');
        this.emit('turnReset');
    }
    
    // 捕获回合动作
    captureTurnActions() {
        const actions = [];
        
        for (const boat of this.boats) {
            if (boat.path && boat.path.length > 0) {
                actions.push({
                    type: 'boat_move',
                    boatId: boat.id,
                    boatName: boat.name,
                    path: [...boat.path]
                });
            }
        }
        
        return actions;
    }
    
    // 处理学员被救援
    handleStudentRescued(student) {
        this.rescuedCount++;
        this.pendingCount--;
        this.score += GAME.RESCUE_SCORE;
        
        this.logAction(`学员 ${student.name} 已被救援`);
        
        // 记录事件
        this.replayData.events.push({
            type: 'rescue',
            studentId: student.id,
            studentName: student.name,
            time: this.gameTime,
            turn: this.currentTurn
        });
        
        this.emit('studentRescued', student);
    }
    
    // 检查救援艇是否到达安全区
    checkSafeZoneArrival() {
        for (const boat of this.boats) {
            if (boat.passengers.length > 0) {
                for (const safeZone of this.safeZones) {
                    if (safeZone.isInside(boat.getCenterX(), boat.getCenterY())) {
                        // 卸载乘客
                        while (boat.passengers.length > 0) {
                            const studentId = boat.passengers.shift();
                            const student = this.students.find(s => s.id === studentId);
                            
                            if (student) {
                                // 将学员放置在安全区
                                student.x = safeZone.centerX + (Math.random() - 0.5) * 20;
                                student.y = safeZone.centerY + (Math.random() - 0.5) * 20;
                                student.resetVelocity();
                                
                                this.logAction(`学员 ${student.name} 已安全送达`);
                                
                                // 记录事件
                                this.replayData.events.push({
                                    type: 'delivery',
                                    studentId: student.id,
                                    studentName: student.name,
                                    time: this.gameTime,
                                    turn: this.currentTurn
                                });
                            }
                        }
                        
                        // 给予时间奖励
                        const timeBonus = Math.max(0, GAME.TIME_BONUS * (1 - this.gameTime / this.timeLimit));
                        this.score += Math.round(timeBonus);
                        
                        break;
                    }
                }
            }
        }
    }
    
    // 检查学员是否超时
    checkStudentTimeout() {
        for (const student of this.students) {
            if (!student.isRescued && student.health <= 0) {
                // 学员超时
                this.score -= GAME.TIMEOUT_PENALTY;
                this.pendingCount--;
                
                this.logAction(`学员 ${student.name} 超时未救援`);
                
                // 记录事件
                this.replayData.events.push({
                    type: 'timeout',
                    studentId: student.id,
                    studentName: student.name,
                    time: this.gameTime,
                    turn: this.currentTurn
                });
                
                this.emit('studentTimeout', student);
            }
        }
    }
    
    // 检查游戏结束条件
    checkGameEnd() {
        // 检查所有学员是否都被救援或超时
        const allStudentsProcessed = this.students.every(s => s.isRescued || s.health <= 0);
        
        // 检查是否超过最大回合数
        const maxTurnsReached = this.currentTurn >= this.maxTurns && this.turnState === TURN_STATE.COMPLETED;
        
        // 检查是否超过时间限制
        const timeLimitReached = this.gameTime >= this.timeLimit;
        
        if (allStudentsProcessed || maxTurnsReached || timeLimitReached) {
            this.endGame();
        }
    }
    
    // 结束游戏
    endGame() {
        if (this.state === GAME_STATE.GAME_OVER) return;
        
        this.state = GAME_STATE.GAME_OVER;
        this.isRunning = false;
        
        // 记录回放数据
        this.replayData.endTime = new Date().toISOString();
        this.replayData.finalState = this.getGameState();
        
        // 保存回放
        this.storageManager.saveReplay(this.replayData);
        
        // 保存分数
        this.storageManager.saveScore({
            levelId: this.levelManager.currentLevel?.id || 'unknown',
            levelName: this.levelManager.currentLevel?.name || '未知关卡',
            score: this.score,
            rescuedCount: this.rescuedCount,
            totalStudents: this.students.length,
            turnsUsed: this.currentTurn,
            timeUsed: this.gameTime
        });
        
        this.logAction('游戏结束');
        this.emit('gameEnded', this.getGameState());
    }
    
    // 添加河流
    addRiver(river) {
        this.rivers.push(river);
        this.physicsEngine.addObject(river);
    }
    
    // 添加浅滩
    addShallow(shallow) {
        this.shallows.push(shallow);
        this.physicsEngine.addObject(shallow);
    }
    
    // 添加学员
    addStudent(student) {
        this.students.push(student);
        this.physicsEngine.addObject(student);
        this.pendingCount++;
        
        // 监听救援事件
        student.on('rescued', (studentObj) => {
            this.handleStudentRescued(studentObj);
        });
    }
    
    // 添加救援艇
    addBoat(boat) {
        this.boats.push(boat);
        this.physicsEngine.addObject(boat);
    }
    
    // 添加救援绳
    addRope(rope) {
        this.ropes.push(rope);
        this.physicsEngine.addObject(rope);
    }
    
    // 添加安全区
    addSafeZone(safeZone) {
        this.safeZones.push(safeZone);
        this.physicsEngine.addObject(safeZone);
    }
    
    // 移除对象
    removeObject(obj) {
        // 从各个数组中移除
        const arrays = [
            { array: this.rivers, name: 'rivers' },
            { array: this.shallows, name: 'shallows' },
            { array: this.students, name: 'students' },
            { array: this.boats, name: 'boats' },
            { array: this.ropes, name: 'ropes' },
            { array: this.safeZones, name: 'safeZones' }
        ];
        
        for (const { array } of arrays) {
            const index = array.indexOf(obj);
            if (index > -1) {
                array.splice(index, 1);
                break;
            }
        }
        
        // 从物理引擎中移除
        this.physicsEngine.removeObject(obj);
    }
    
    // 清空所有对象
    clearAllObjects() {
        this.rivers = [];
        this.shallows = [];
        this.students = [];
        this.boats = [];
        this.ropes = [];
        this.safeZones = [];
        
        this.physicsEngine.reset();
    }
    
    // 获取游戏状态
    getGameState() {
        return {
            state: this.state,
            turnState: this.turnState,
            currentTurn: this.currentTurn,
            maxTurns: this.maxTurns,
            gameTime: this.gameTime,
            timeLimit: this.timeLimit,
            score: this.score,
            rescuedCount: this.rescuedCount,
            pendingCount: this.pendingCount,
            
            rivers: this.rivers.map(r => r.toJSON()),
            shallows: this.shallows.map(s => s.toJSON()),
            students: this.students.map(s => s.toJSON()),
            boats: this.boats.map(b => b.toJSON()),
            ropes: this.ropes.map(r => r.toJSON()),
            safeZones: this.safeZones.map(s => s.toJSON())
        };
    }
    
    // 更新UI
    updateUI() {
        // 更新回合显示
        document.getElementById('current-turn').textContent = this.currentTurn;
        
        // 更新时间显示
        document.getElementById('game-time').textContent = window.utils.formatTime(this.gameTime);
        
        // 更新分数显示
        document.getElementById('score').textContent = this.score;
        
        // 更新救援计数
        document.getElementById('rescued-count').textContent = this.rescuedCount;
        document.getElementById('pending-count').textContent = this.pendingCount;
        
        // 更新超时风险
        const timePercent = this.gameTime / this.timeLimit;
        let riskText = '低';
        let riskColor = '#27ae60';
        
        if (timePercent > 0.8) {
            riskText = '高';
            riskColor = '#e74c3c';
        } else if (timePercent > 0.5) {
            riskText = '中';
            riskColor = '#f39c12';
        }
        
        const timeoutRiskElement = document.getElementById('timeout-risk');
        timeoutRiskElement.textContent = riskText;
        timeoutRiskElement.style.color = riskColor;
        
        // 更新按钮状态
        const startTurnBtn = document.getElementById('start-turn-btn');
        const endTurnBtn = document.getElementById('end-turn-btn');
        const resetTurnBtn = document.getElementById('reset-turn-btn');
        
        startTurnBtn.disabled = this.turnState !== TURN_STATE.PLANNING;
        endTurnBtn.disabled = this.turnState !== TURN_STATE.EXECUTING;
        resetTurnBtn.disabled = this.turnState !== TURN_STATE.PLANNING;
    }
    
    // 记录行动日志
    logAction(message) {
        const logElement = document.getElementById('action-log');
        const timeStr = window.utils.formatTime(this.gameTime);
        
        const logEntry = document.createElement('p');
        logEntry.innerHTML = `<strong>[${timeStr}]</strong> ${message}`;
        
        logElement.appendChild(logEntry);
        
        // 滚动到底部
        logElement.scrollTop = logElement.scrollHeight;
        
        // 记录到回放数据
        this.replayData.events.push({
            type: 'log',
            message: message,
            time: this.gameTime,
            turn: this.currentTurn
        });
    }
    
    // 添加复盘笔记
    addReviewNote(note) {
        this.reviewNotes.push({
            time: this.gameTime,
            turn: this.currentTurn,
            note: note,
            timestamp: new Date().toISOString()
        });
    }
    
    // 生成Markdown复盘报告
    generateMarkdownReport() {
        const level = this.levelManager.currentLevel;
        const gameState = this.getGameState();
        
        let markdown = `# 皮划艇救援训练复盘报告\n\n`;
        
        // 基本信息
        markdown += `## 基本信息\n\n`;
        markdown += `- **关卡名称**: ${level?.name || '未知'}\n`;
        markdown += `- **关卡难度**: ${level?.difficulty || 'normal'}\n`;
        markdown += `- **训练时间**: ${window.utils.formatTime(this.gameTime)}\n`;
        markdown += `- **使用回合**: ${this.currentTurn}/${this.maxTurns}\n`;
        markdown += `- **最终得分**: ${this.score}\n\n`;
        
        // 救援统计
        markdown += `## 救援统计\n\n`;
        markdown += `- **总学员数**: ${this.students.length}\n`;
        markdown += `- **成功救援**: ${this.rescuedCount}\n`;
        markdown += `- **超时未救**: ${this.students.length - this.rescuedCount - this.pendingCount}\n`;
        markdown += `- **救援成功率**: ${this.students.length > 0 ? Math.round((this.rescuedCount / this.students.length) * 100) : 0}%\n\n`;
        
        // 学员详情
        markdown += `## 学员详情\n\n`;
        markdown += `| 学员 | 状态 | 健康值 | 救援者 | 救援时间 |\n`;
        markdown += `|------|------|--------|--------|----------|\n`;
        
        for (const student of this.students) {
            const status = student.isRescued ? '已救援' : (student.health <= 0 ? '超时' : '待救援');
            const rescuer = student.rescuedBy || '-';
            const rescueTime = student.rescueTime > 0 ? window.utils.formatTime(student.rescueTime) : '-';
            
            markdown += `| ${student.name} | ${status} | ${Math.round(student.health)}% | ${rescuer} | ${rescueTime} |\n`;
        }
        
        markdown += `\n`;
        
        // 回合分析
        markdown += `## 回合分析\n\n`;
        for (let i = 0; i < this.replayData.turns.length; i++) {
            const turn = this.replayData.turns[i];
            markdown += `### 回合 ${turn.turnNumber}\n\n`;
            markdown += `- **开始时间**: ${window.utils.formatTime(turn.startTime)}\n`;
            if (turn.endTime) {
                markdown += `- **结束时间**: ${window.utils.formatTime(turn.endTime)}\n`;
                markdown += `- **持续时间**: ${window.utils.formatTime(turn.endTime - turn.startTime)}\n`;
            }
            
            if (turn.actions && turn.actions.length > 0) {
                markdown += `\n**行动**:\n`;
                for (const action of turn.actions) {
                    if (action.type === 'boat_move') {
                        markdown += `- ${action.boatName}: 规划路径 ${action.path.length} 个点\n`;
                    }
                }
            }
            
            markdown += `\n`;
        }
        
        // 复盘笔记
        if (this.reviewNotes.length > 0) {
            markdown += `## 复盘笔记\n\n`;
            for (const note of this.reviewNotes) {
                markdown += `**[回合 ${note.turn} - ${window.utils.formatTime(note.time)}]**\n\n`;
                markdown += `${note.note}\n\n`;
            }
        }
        
        // 总结
        markdown += `## 总结与建议\n\n`;
        
        const rescueRate = this.students.length > 0 ? (this.rescuedCount / this.students.length) : 0;
        
        if (rescueRate === 1) {
            markdown += `🎉 **出色表现！** 所有学员都被成功救援。继续保持！\n\n`;
        } else if (rescueRate >= 0.7) {
            markdown += `👍 **表现良好！** 救援成功率较高，但仍有提升空间。\n\n`;
            markdown += `建议：\n`;
            markdown += `- 优化救援路线，减少迂回\n`;
            markdown += `- 优先救援健康值较低的学员\n`;
            markdown += `- 考虑多艇协同救援\n\n`;
        } else {
            markdown += `⚠️ **需要改进！** 救援成功率较低，请分析以下问题：\n\n`;
            markdown += `- 路线规划是否合理？\n`;
            markdown += `- 是否优先救援了危险学员？\n`;
            markdown += `- 救援艇的使用是否高效？\n\n`;
        }
        
        return markdown;
    }
    
    // 生成JSON回放包
    generateReplayJSON() {
        return JSON.stringify({
            ...this.replayData,
            reviewNotes: this.reviewNotes,
            generatedAt: new Date().toISOString()
        }, null, 2);
    }
    
    // 重置游戏
    reset() {
        this.state = GAME_STATE.MENU;
        this.turnState = TURN_STATE.PLANNING;
        this.currentTurn = 1;
        this.gameTime = 0;
        this.score = 0;
        this.rescuedCount = 0;
        this.pendingCount = 0;
        this.isRunning = false;
        
        this.reviewNotes = [];
        this.replayData = {
            id: null,
            levelId: null,
            startTime: null,
            endTime: null,
            turns: [],
            events: [],
            finalState: null
        };
        
        // 清空日志
        document.getElementById('action-log').innerHTML = '<p>游戏开始...</p>';
        
        this.emit('gameReset');
    }
}

// 导出模块
window.game = {
    Game
};
})();