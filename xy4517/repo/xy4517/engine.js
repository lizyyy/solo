// 铁路货场调车演练 - 核心游戏引擎

// 违规类型定义
const VIOLATION_TYPES = {
    COLLISION: { id: 'collision', name: '撞车', penalty: 100, description: '发生碰撞事故' },
    TRACK_OCCUPIED: { id: 'track_occupied', name: '占线冲突', penalty: 75, description: '目标轨道已被占用' },
    SWITCH_CONFLICT: { id: 'switch_conflict', name: '道岔冲突', penalty: 50, description: '道岔位置不正确或被锁定' },
    OVERTIME: { id: 'overtime', name: '超时', penalty: 200, description: '超出时间限制' },
    NO_STOP_ZONE: { id: 'no_stop_zone', name: '禁停区停车', penalty: 30, description: '车辆停放在禁止停车区域' },
    WRONG_DESTINATION: { id: 'wrong_destination', name: '错误目的地', penalty: 40, description: '车皮被送到错误的目的地' }
};

// 游戏引擎类
class GameEngine {
    constructor(levelData) {
        this.levelData = levelData;
        this.gameState = this.initializeGameState(levelData);
        this.violations = [];
        this.actionHistory = [];
        this.startTime = null;
        this.elapsedTime = 0;
        this.isRunning = false;
        this.isReplayMode = false;
    }

    // 初始化游戏状态
    initializeGameState(levelData) {
        return {
            tracks: JSON.parse(JSON.stringify(levelData.tracks)),
            switches: JSON.parse(JSON.stringify(levelData.switches)),
            locomotives: JSON.parse(JSON.stringify(levelData.locomotives)),
            cars: JSON.parse(JSON.stringify(levelData.cars)),
            destinations: JSON.parse(JSON.stringify(levelData.destinations)),
            noStopZones: JSON.parse(JSON.stringify(levelData.noStopZones)),
            score: 0,
            violationCount: 0,
            isGameOver: false,
            isWin: false,
            selectedLocomotiveId: null
        };
    }

    // 开始游戏
    startGame() {
        this.startTime = Date.now();
        this.isRunning = true;
        this.recordAction({
            type: 'game_start',
            timestamp: Date.now(),
            description: '游戏开始'
        });
    }

    // 暂停游戏
    pauseGame() {
        this.isRunning = false;
        if (this.startTime) {
            this.elapsedTime += Date.now() - this.startTime;
            this.startTime = null;
        }
    }

    // 恢复游戏
    resumeGame() {
        this.isRunning = true;
        this.startTime = Date.now();
    }

    // 获取当前时间（秒）
    getCurrentTime() {
        let totalTime = this.elapsedTime;
        if (this.isRunning && this.startTime) {
            totalTime += Date.now() - this.startTime;
        }
        return Math.floor(totalTime / 1000);
    }

    // 检查超时
    checkOvertime() {
        const currentTime = this.getCurrentTime();
        if (currentTime >= this.levelData.timeLimit) {
            this.addViolation(VIOLATION_TYPES.OVERTIME, {
                time: currentTime,
                limit: this.levelData.timeLimit
            });
            this.gameState.isGameOver = true;
            this.gameState.isWin = false;
            return true;
        }
        return false;
    }

    // 选择机车
    selectLocomotive(locomotiveId) {
        const locomotive = this.gameState.locomotives.find(l => l.id === locomotiveId);
        if (locomotive) {
            this.gameState.selectedLocomotiveId = locomotiveId;
            this.recordAction({
                type: 'select_locomotive',
                timestamp: Date.now(),
                locomotiveId: locomotiveId,
                description: `选择机车 ${locomotive.name}`
            });
            return true;
        }
        return false;
    }

    // 获取当前选中的机车
    getSelectedLocomotive() {
        if (!this.gameState.selectedLocomotiveId) return null;
        return this.gameState.locomotives.find(l => l.id === this.gameState.selectedLocomotiveId);
    }

    // 切换道岔
    toggleSwitch(switchId) {
        const switchObj = this.gameState.switches.find(s => s.id === switchId);
        if (!switchObj) return { success: false, error: '道岔不存在' };

        if (switchObj.locked) {
            return { success: false, error: '道岔已被锁定' };
        }

        // 检查道岔是否被占用
        if (this.isSwitchOccupied(switchObj)) {
            const violation = VIOLATION_TYPES.SWITCH_CONFLICT;
            this.addViolation(violation, {
                switchId: switchId,
                switchName: switchObj.name,
                reason: '道岔区域有车辆占用'
            });
            return { success: false, error: '道岔区域有车辆占用，无法切换' };
        }

        // 切换道岔位置
        const oldPosition = switchObj.currentPosition;
        if (switchObj.currentPosition === 'main' && switchObj.connectingTracks.length > 0) {
            switchObj.currentPosition = switchObj.connectingTracks[0];
        } else if (switchObj.connectingTracks.length > 1) {
            const currentIndex = switchObj.connectingTracks.indexOf(switchObj.currentPosition);
            const nextIndex = (currentIndex + 1) % switchObj.connectingTracks.length;
            switchObj.currentPosition = switchObj.connectingTracks[nextIndex];
        } else {
            switchObj.currentPosition = 'main';
        }

        this.recordAction({
            type: 'toggle_switch',
            timestamp: Date.now(),
            switchId: switchId,
            oldPosition: oldPosition,
            newPosition: switchObj.currentPosition,
            description: `切换道岔 ${switchObj.name} 从 ${oldPosition} 到 ${switchObj.currentPosition}`
        });

        return { success: true, oldPosition, newPosition: switchObj.currentPosition };
    }

    // 检查道岔是否被占用
    isSwitchOccupied(switchObj) {
        const checkZone = {
            trackId: switchObj.trackId,
            start: switchObj.position - 20,
            end: switchObj.position + 20
        };

        // 检查机车
        for (const loco of this.gameState.locomotives) {
            if (loco.trackId === checkZone.trackId &&
                loco.position >= checkZone.start &&
                loco.position <= checkZone.end) {
                return true;
            }
        }

        // 检查车皮
        for (const car of this.gameState.cars) {
            if (car.trackId === checkZone.trackId &&
                car.position >= checkZone.start &&
                car.position <= checkZone.end) {
                return true;
            }
        }

        return false;
    }

    // 连挂车皮
    coupleCar(locomotiveId, carId) {
        const locomotive = this.gameState.locomotives.find(l => l.id === locomotiveId);
        const car = this.gameState.cars.find(c => c.id === carId);

        if (!locomotive || !car) {
            return { success: false, error: '机车或车皮不存在' };
        }

        if (locomotive.coupledCarId) {
            return { success: false, error: '机车已连挂其他车皮' };
        }

        if (car.coupledTo) {
            return { success: false, error: '车皮已被其他机车连挂' };
        }

        // 检查是否足够接近
        if (locomotive.trackId !== car.trackId) {
            return { success: false, error: '机车和车皮不在同一轨道' };
        }

        const distance = Math.abs(locomotive.position - car.position);
        if (distance > 50) {
            return { success: false, error: `距离太远 (${distance} 单位)，无法连挂` };
        }

        // 执行连挂
        locomotive.coupledCarId = carId;
        car.coupledTo = locomotiveId;

        this.recordAction({
            type: 'couple',
            timestamp: Date.now(),
            locomotiveId: locomotiveId,
            carId: carId,
            description: `机车 ${locomotive.name} 连挂车皮 ${car.name}`
        });

        return { success: true };
    }

    // 摘钩车皮
    uncoupleCar(locomotiveId) {
        const locomotive = this.gameState.locomotives.find(l => l.id === locomotiveId);
        
        if (!locomotive) {
            return { success: false, error: '机车不存在' };
        }

        if (!locomotive.coupledCarId) {
            return { success: false, error: '机车没有连挂任何车皮' };
        }

        const car = this.gameState.cars.find(c => c.id === locomotive.coupledCarId);
        
        // 检查是否在禁停区域
        for (const zone of this.gameState.noStopZones) {
            if (car.trackId === zone.trackId &&
                car.position >= zone.startPosition &&
                car.position <= zone.endPosition) {
                const violation = VIOLATION_TYPES.NO_STOP_ZONE;
                this.addViolation(violation, {
                    carId: car.id,
                    carName: car.name,
                    zoneId: zone.id,
                    zoneName: zone.name,
                    position: car.position
                });
                return { success: false, error: `不能在禁停区 ${zone.name} 摘钩` };
            }
        }

        const oldCarId = locomotive.coupledCarId;
        const carName = car ? car.name : oldCarId;

        // 执行摘钩
        locomotive.coupledCarId = null;
        if (car) {
            car.coupledTo = null;
            
            // 检查是否送到了正确的目的地
            this.checkDelivery(car);
        }

        this.recordAction({
            type: 'uncouple',
            timestamp: Date.now(),
            locomotiveId: locomotiveId,
            carId: oldCarId,
            description: `机车 ${locomotive.name} 摘钩车皮 ${carName}`
        });

        return { success: true };
    }

    // 检查车皮是否送到目的地
    checkDelivery(car) {
        for (const dest of this.gameState.destinations) {
            if (car.destination === dest.trackId &&
                car.trackId === dest.trackId &&
                car.position >= dest.startPosition &&
                car.position <= dest.endPosition) {
                
                // 检查是否是正确的车皮
                if (dest.requiredCars.includes(car.id)) {
                    if (!car.delivered) {
                        car.delivered = true;
                        this.gameState.score += this.levelData.scorePerCar;
                        
                        this.recordAction({
                            type: 'delivery',
                            timestamp: Date.now(),
                            carId: car.id,
                            destinationId: dest.id,
                            points: this.levelData.scorePerCar,
                            description: `车皮 ${car.name} 正确送达 ${dest.name}，获得 ${this.levelData.scorePerCar} 分`
                        });
                    }
                    return;
                } else {
                    // 送到了错误的目的地
                    const violation = VIOLATION_TYPES.WRONG_DESTINATION;
                    this.addViolation(violation, {
                        carId: car.id,
                        carName: car.name,
                        intendedDestination: car.destination,
                        actualDestination: dest.trackId
                    });
                    return;
                }
            }
        }
    }

    // 移动机车（推送）
    moveLocomotive(locomotiveId, direction, distance = 100) {
        const locomotive = this.gameState.locomotives.find(l => l.id === locomotiveId);
        
        if (!locomotive) {
            return { success: false, error: '机车不存在' };
        }

        const startPosition = locomotive.position;
        const startTrackId = locomotive.trackId;
        
        // 计算目标位置
        const actualDistance = Math.min(distance, locomotive.maxSpeed * 10);
        let targetPosition = direction === 'forward' ? 
            locomotive.position + actualDistance : 
            locomotive.position - actualDistance;

        // 获取轨道
        const track = this.gameState.tracks.find(t => t.id === locomotive.trackId);
        if (!track) {
            return { success: false, error: '轨道不存在' };
        }

        // 检查轨道边界
        targetPosition = Math.max(0, Math.min(targetPosition, track.length));

        // 检查路径是否有冲突
        const collisionCheck = this.checkPathCollision(
            locomotive,
            startPosition,
            targetPosition,
            direction
        );

        if (collisionCheck.collision) {
            const violation = VIOLATION_TYPES.COLLISION;
            this.addViolation(violation, {
                locomotiveId: locomotiveId,
                locomotiveName: locomotive.name,
                collisionWith: collisionCheck.collisionWith,
                collisionType: collisionCheck.collisionType,
                position: collisionCheck.position
            });
            return { success: false, error: collisionCheck.message };
        }

        // 检查道岔
        const switchCheck = this.checkSwitchPath(locomotive, startPosition, targetPosition);
        if (!switchCheck.success) {
            return { success: false, error: switchCheck.error };
        }

        // 执行移动
        locomotive.position = targetPosition;
        locomotive.direction = direction === 'forward' ? 'right' : 'left';

        // 如果连挂了车皮，同时移动车皮
        if (locomotive.coupledCarId) {
            const car = this.gameState.cars.find(c => c.id === locomotive.coupledCarId);
            if (car) {
                // 车皮位置相对于机车偏移
                const carOffset = direction === 'forward' ? -30 : 30;
                car.position = targetPosition + carOffset;
                car.trackId = locomotive.trackId;
                car.direction = locomotive.direction;
            }
        }

        this.recordAction({
            type: 'move',
            timestamp: Date.now(),
            locomotiveId: locomotiveId,
            fromPosition: startPosition,
            toPosition: targetPosition,
            fromTrackId: startTrackId,
            toTrackId: locomotive.trackId,
            direction: direction,
            description: `机车 ${locomotive.name} 从 ${startTrackId}:${startPosition} 移动到 ${locomotive.trackId}:${targetPosition}`
        });

        return { success: true, oldPosition: startPosition, newPosition: targetPosition };
    }

    // 检查路径碰撞
    checkPathCollision(locomotive, startPos, endPos, direction) {
        const trackId = locomotive.trackId;
        const isForward = direction === 'forward';
        const minPos = isForward ? startPos : endPos;
        const maxPos = isForward ? endPos : startPos;

        // 检查与其他机车的碰撞
        for (const otherLoco of this.gameState.locomotives) {
            if (otherLoco.id === locomotive.id) continue;
            
            if (otherLoco.trackId === trackId) {
                if (otherLoco.position >= minPos && otherLoco.position <= maxPos) {
                    return {
                        collision: true,
                        collisionWith: otherLoco.id,
                        collisionType: 'locomotive',
                        position: otherLoco.position,
                        message: `与机车 ${otherLoco.name} 发生碰撞危险`
                    };
                }
            }
        }

        // 检查与车皮的碰撞（未连挂的）
        for (const car of this.gameState.cars) {
            if (locomotive.coupledCarId === car.id) continue;
            if (car.coupledTo === locomotive.id) continue;
            
            if (car.trackId === trackId) {
                if (car.position >= minPos && car.position <= maxPos) {
                    // 允许连挂的距离
                    const distance = Math.abs(locomotive.position - car.position);
                    if (distance > 30) {
                        return {
                            collision: true,
                            collisionWith: car.id,
                            collisionType: 'car',
                            position: car.position,
                            message: `与车皮 ${car.name} 发生碰撞危险`
                        };
                    }
                }
            }
        }

        return { collision: false };
    }

    // 检查道岔路径
    checkSwitchPath(locomotive, startPos, endPos) {
        const trackId = locomotive.trackId;
        const minPos = Math.min(startPos, endPos);
        const maxPos = Math.max(startPos, endPos);

        for (const switchObj of this.gameState.switches) {
            if (switchObj.trackId === trackId) {
                if (switchObj.position >= minPos && switchObj.position <= maxPos) {
                    // 检查道岔位置
                    if (switchObj.currentPosition !== 'main' && 
                        !switchObj.connectingTracks.includes(switchObj.currentPosition)) {
                        return {
                            success: false,
                            error: `道岔 ${switchObj.name} 位置不正确`
                        };
                    }

                    // 锁定道岔（暂时）
                    switchObj.locked = true;
                    
                    // 如果通过道岔，可能需要切换轨道
                    if (switchObj.currentPosition !== 'main' && 
                        switchObj.connectingTracks.includes(switchObj.currentPosition)) {
                        // 切换到连接的轨道
                        locomotive.trackId = switchObj.currentPosition;
                    }
                }
            }
        }

        return { success: true };
    }

    // 添加违规记录
    addViolation(violationType, details = {}) {
        const violation = {
            id: `violation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            type: violationType.id,
            name: violationType.name,
            penalty: violationType.penalty,
            description: violationType.description,
            details: details,
            timestamp: Date.now(),
            gameTime: this.getCurrentTime()
        };

        this.violations.push(violation);
        this.gameState.violationCount++;
        this.gameState.score = Math.max(0, this.gameState.score - violationType.penalty);

        this.recordAction({
            type: 'violation',
            timestamp: Date.now(),
            violationId: violation.id,
            violationType: violationType.id,
            penalty: violationType.penalty,
            description: `发生违规: ${violationType.name}，扣除 ${violationType.penalty} 分`
        });
    }

    // 记录操作历史
    recordAction(action) {
        action.id = `action-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        action.gameTime = this.getCurrentTime();
        this.actionHistory.push(action);
    }

    // 检查胜利条件
    checkWinCondition() {
        // 检查所有车皮是否都已送达正确目的地
        const allDelivered = this.gameState.cars.every(car => car.delivered);
        
        if (allDelivered) {
            // 检查时间奖励
            const currentTime = this.getCurrentTime();
            if (currentTime <= this.levelData.bonusTimeLimit) {
                this.gameState.score += this.levelData.bonusScore;
                this.recordAction({
                    type: 'bonus',
                    timestamp: Date.now(),
                    bonusType: 'time_bonus',
                    points: this.levelData.bonusScore,
                    description: `提前完成，获得时间奖励 ${this.levelData.bonusScore} 分`
                });
            }

            this.gameState.isGameOver = true;
            this.gameState.isWin = true;
            this.isRunning = false;
            
            this.recordAction({
                type: 'game_win',
                timestamp: Date.now(),
                finalScore: this.gameState.score,
                description: `游戏胜利！最终得分: ${this.gameState.score}`
            });

            return true;
        }
        
        return false;
    }

    // 获取游戏状态快照
    getGameSnapshot() {
        return {
            timestamp: Date.now(),
            gameTime: this.getCurrentTime(),
            gameState: JSON.parse(JSON.stringify(this.gameState)),
            violations: JSON.parse(JSON.stringify(this.violations))
        };
    }

    // 获取统计信息
    getStats() {
        const totalCars = this.gameState.cars.length;
        const deliveredCars = this.gameState.cars.filter(c => c.delivered).length;
        const pendingCars = totalCars - deliveredCars;
        
        return {
            score: this.gameState.score,
            currentTime: this.getCurrentTime(),
            timeLimit: this.levelData.timeLimit,
            totalCars,
            deliveredCars,
            pendingCars,
            violationCount: this.gameState.violationCount,
            isGameOver: this.gameState.isGameOver,
            isWin: this.gameState.isWin
        };
    }

    // 导出完整游戏数据
    exportGameData() {
        return {
            levelId: this.levelData.id,
            levelName: this.levelData.name,
            startTime: this.startTime,
            endTime: Date.now(),
            elapsedTime: this.getCurrentTime(),
            finalScore: this.gameState.score,
            isWin: this.gameState.isWin,
            levelData: JSON.parse(JSON.stringify(this.levelData)),
            finalState: this.getGameSnapshot(),
            violations: JSON.parse(JSON.stringify(this.violations)),
            actionHistory: JSON.parse(JSON.stringify(this.actionHistory))
        };
    }

    // 导出Markdown复盘报告
    exportMarkdownReport() {
        const stats = this.getStats();
        const gameData = this.exportGameData();
        
        let md = `# 铁路货场调车演练复盘报告\n\n`;
        
        // 基本信息
        md += `## 基本信息\n\n`;
        md += `- **关卡**: ${this.levelData.name} (${this.levelData.id})\n`;
        md += `- **难度**: ${'★'.repeat(this.levelData.difficulty)}${'☆'.repeat(3 - this.levelData.difficulty)}\n`;
        md += `- **结果**: ${stats.isWin ? '✅ 胜利' : '❌ 失败'}\n`;
        md += `- **最终得分**: ${stats.score} 分\n`;
        md += `- **用时**: ${this.formatTime(stats.currentTime)} / ${this.formatTime(stats.timeLimit)}\n\n`;
        
        // 统计信息
        md += `## 统计信息\n\n`;
        md += `- **车皮总数**: ${stats.totalCars}\n`;
        md += `- **已送达**: ${stats.deliveredCars}\n`;
        md += `- **未送达**: ${stats.pendingCars}\n`;
        md += `- **违规次数**: ${stats.violationCount}\n\n`;
        
        // 违规记录
        if (this.violations.length > 0) {
            md += `## 违规记录\n\n`;
            md += `| 序号 | 违规类型 | 扣分 | 时间 | 描述 |\n`;
            md += `|------|----------|------|------|------|\n`;
            
            this.violations.forEach((v, index) => {
                md += `| ${index + 1} | ${v.name} | ${v.penalty} | ${this.formatTime(v.gameTime)} | ${v.description} |\n`;
            });
            md += `\n`;
        }
        
        // 操作历史
        md += `## 操作历史\n\n`;
        const recentActions = this.actionHistory.slice(-50);
        recentActions.forEach((action, index) => {
            const timeStr = this.formatTime(action.gameTime);
            md += `**[${timeStr}]** ${action.description}\n\n`;
        });
        
        // 建议
        md += `## 建议\n\n`;
        if (stats.violationCount > 0) {
            md += `⚠️ 本次演练发生了 ${stats.violationCount} 次违规，建议：\n\n`;
            const violationTypes = {};
            this.violations.forEach(v => {
                violationTypes[v.type] = (violationTypes[v.type] || 0) + 1;
            });
            
            for (const [type, count] of Object.entries(violationTypes)) {
                const violationInfo = VIOLATION_TYPES[type.toUpperCase()] || { name: type };
                md += `- **${violationInfo.name}** (${count}次): 注意${violationInfo.description}\n`;
            }
        } else {
            md += `🎉 本次演练无违规记录，表现优秀！\n`;
        }
        
        md += `\n---\n`;
        md += `*报告生成时间: ${new Date().toLocaleString('zh-CN')}*\n`;
        
        return md;
    }

    // 格式化时间
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
}
