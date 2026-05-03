/**
 * 仿真引擎模块
 * 负责人流模拟、拥堵检测、风险评估
 */

const SimulationEngine = {
    isRunning: false,
    isPaused: false,
    currentTimeSlot: null,
    speed: 1,
    time: 0,
    
    visitors: [],
    risks: [],
    stats: {
        totalVisitors: 0,
        movingVisitors: 0,
        congestedAreas: 0,
        accessDetours: 0
    },

    /**
     * 初始化仿真引擎
     */
    init() {
        this.isRunning = false;
        this.isPaused = false;
        this.currentTimeSlot = null;
        this.speed = 1;
        this.time = 0;
        this.visitors = [];
        this.risks = [];
        this.stats = {
            totalVisitors: 0,
            movingVisitors: 0,
            congestedAreas: 0,
            accessDetours: 0
        };
    },

    /**
     * 启动仿真
     */
    start(timeSlotId) {
        if (!SpaceModel.isComplete()) {
            throw new Error('展厅数据不完整，请先导入展厅平面图和展品清单');
        }

        const timeSlot = SpaceModel.getTimeSlots().find(ts => ts.id === timeSlotId);
        if (!timeSlot) {
            throw new Error('未找到指定时段');
        }

        this.currentTimeSlot = timeSlot;
        this.isRunning = true;
        this.isPaused = false;
        this.time = 0;
        this.visitors = [];
        this.risks = [];

        this.generateVisitors(timeSlot);
        
        return this;
    },

    /**
     * 暂停仿真
     */
    pause() {
        this.isPaused = true;
        return this;
    },

    /**
     * 恢复仿真
     */
    resume() {
        this.isPaused = false;
        return this;
    },

    /**
     * 停止仿真
     */
    stop() {
        this.isRunning = false;
        this.isPaused = false;
        return this;
    },

    /**
     * 重置仿真
     */
    reset() {
        this.stop();
        this.visitors = [];
        this.risks = [];
        this.time = 0;
        this.stats = {
            totalVisitors: 0,
            movingVisitors: 0,
            congestedAreas: 0,
            accessDetours: 0
        };
        return this;
    },

    /**
     * 设置仿真速度
     */
    setSpeed(speed) {
        this.speed = Math.max(0.1, Math.min(5, speed));
        return this;
    },

    /**
     * 生成观众
     */
    generateVisitors(timeSlot) {
        const count = timeSlot.visitorCount;
        const entrances = SpaceModel.getEntrances();
        
        if (entrances.length === 0) {
            throw new Error('没有可用的入口');
        }

        const exhibits = SpaceModel.getExhibits();
        const exits = SpaceModel.getExits();

        for (let i = 0; i < count; i++) {
            const entrance = entrances[Math.floor(Math.random() * entrances.length)];
            const isAccessibilityNeed = Math.random() < 0.05;
            
            const path = this.generatePath(entrance, exhibits, exits, isAccessibilityNeed);
            
            const visitor = {
                id: `visitor_${Date.now()}_${i}`,
                position: {
                    x: entrance.position.x + (Math.random() - 0.5) * entrance.width,
                    y: entrance.position.y + (Math.random() - 0.5) * entrance.width
                },
                targetIndex: 0,
                path: path,
                speed: 1 + Math.random() * 0.5,
                isAccessibilityNeed: isAccessibilityNeed,
                state: 'moving',
                viewingTimeLeft: 0,
                currentExhibit: null
            };

            this.visitors.push(visitor);
        }

        this.stats.totalVisitors = this.visitors.length;
    },

    /**
     * 生成观众路径
     */
    generatePath(entrance, exhibits, exits, isAccessibilityNeed) {
        const path = [
            { type: 'start', position: { ...entrance.position }, target: null }
        ];

        const sortedExhibits = [...exhibits].sort((a, b) => {
            const distA = SpaceModel.getDistance(
                entrance.position.x, entrance.position.y,
                a.position.x, a.position.y
            );
            const distB = SpaceModel.getDistance(
                entrance.position.x, entrance.position.y,
                b.position.x, b.position.y
            );
            
            const scoreA = distA * (1 / a.popularity);
            const scoreB = distB * (1 / b.popularity);
            
            return scoreA - scoreB;
        });

        const numExhibits = Math.min(
            Math.floor(Math.random() * sortedExhibits.length) + 1,
            Math.floor(sortedExhibits.length * 0.7)
        );

        for (let i = 0; i < numExhibits; i++) {
            const exhibit = sortedExhibits[i];
            const viewPosition = this.getViewPosition(exhibit);
            
            path.push({
                type: 'exhibit',
                position: viewPosition,
                target: exhibit
            });
        }

        if (exits.length > 0) {
            const exit = exits[Math.floor(Math.random() * exits.length)];
            path.push({
                type: 'exit',
                position: { ...exit.position },
                target: exit
            });
        }

        return path;
    },

    /**
     * 获取展品的观展位置
     */
    getViewPosition(exhibit) {
        const angle = Math.random() * Math.PI * 2;
        const distance = 1.5 + exhibit.dimensions.width / 2;
        
        return {
            x: exhibit.position.x + Math.cos(angle) * distance,
            y: exhibit.position.y + Math.sin(angle) * distance
        };
    },

    /**
     * 更新仿真
     */
    update(deltaTime) {
        if (!this.isRunning || this.isPaused) return;

        const scaledDelta = deltaTime * this.speed;
        this.time += scaledDelta;

        this.updateVisitors(scaledDelta);
        this.detectRisks();
        this.updateStats();
    },

    /**
     * 更新观众位置
     */
    updateVisitors(deltaTime) {
        for (const visitor of this.visitors) {
            if (visitor.state === 'finished') continue;

            if (visitor.state === 'viewing') {
                visitor.viewingTimeLeft -= deltaTime;
                if (visitor.viewingTimeLeft <= 0) {
                    visitor.state = 'moving';
                    visitor.currentExhibit = null;
                }
                continue;
            }

            if (visitor.targetIndex >= visitor.path.length) {
                visitor.state = 'finished';
                continue;
            }

            const target = visitor.path[visitor.targetIndex];
            const targetPos = target.position;

            const dx = targetPos.x - visitor.position.x;
            const dy = targetPos.y - visitor.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < 0.1) {
                if (target.type === 'exhibit' && target.target) {
                    visitor.state = 'viewing';
                    visitor.viewingTimeLeft = target.target.viewingTime;
                    visitor.currentExhibit = target.target;
                }
                visitor.targetIndex++;
            } else {
                const moveDistance = visitor.speed * deltaTime * 0.5;
                const ratio = Math.min(moveDistance / distance, 1);

                visitor.position.x += dx * ratio;
                visitor.position.y += dy * ratio;

                this.avoidCollisions(visitor);
            }
        }
    },

    /**
     * 避免碰撞
     */
    avoidCollisions(visitor) {
        const avoidDistance = 0.5;
        
        for (const other of this.visitors) {
            if (other.id === visitor.id || other.state === 'finished') continue;

            const dx = other.position.x - visitor.position.x;
            const dy = other.position.y - visitor.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            if (distance < avoidDistance && distance > 0) {
                const pushRatio = (avoidDistance - distance) / avoidDistance;
                visitor.position.x -= dx * pushRatio * 0.1;
                visitor.position.y -= dy * pushRatio * 0.1;
            }
        }
    },

    /**
     * 检测风险
     */
    detectRisks() {
        this.risks = [];

        this.detectCongestion();
        this.detectFireExitBlockage();
        this.detectViewObstruction();
        this.detectAccessibilityDetour();
    },

    /**
     * 检测拥堵
     */
    detectCongestion() {
        const gridSize = 2;
        const congestionThreshold = 4;
        const severeThreshold = 8;

        const grid = {};
        const dimensions = SpaceModel.getDimensions();

        for (const visitor of this.visitors) {
            if (visitor.state === 'finished') continue;

            const gridX = Math.floor((visitor.position.x + dimensions.width / 2) / gridSize);
            const gridY = Math.floor((visitor.position.y + dimensions.height / 2) / gridSize);
            const key = `${gridX},${gridY}`;

            if (!grid[key]) {
                grid[key] = {
                    count: 0,
                    visitors: [],
                    position: {
                        x: gridX * gridSize - dimensions.width / 2 + gridSize / 2,
                        y: gridY * gridSize - dimensions.height / 2 + gridSize / 2
                    }
                };
            }

            grid[key].count++;
            grid[key].visitors.push(visitor);
        }

        for (const key in grid) {
            const cell = grid[key];
            if (cell.count >= congestionThreshold) {
                const severity = cell.count >= severeThreshold ? 'high' : 'medium';
                const description = cell.count >= severeThreshold 
                    ? `严重拥堵: ${cell.count} 人聚集在此区域`
                    : `拥堵: ${cell.count} 人聚集在此区域`;

                this.risks.push({
                    id: `risk_congestion_${Date.now()}_${key}`,
                    type: 'congestion',
                    severity: severity,
                    position: cell.position,
                    description: description,
                    visitorCount: cell.count
                });
            }
        }
    },

    /**
     * 检测消防通道占用
     */
    detectFireExitBlockage() {
        const fireExits = SpaceModel.getFireExits();

        for (const fireExit of fireExits) {
            const blockedVisitors = this.visitors.filter(v => {
                if (v.state === 'finished') return false;
                const dist = SpaceModel.getDistance(
                    v.position.x, v.position.y,
                    fireExit.position.x, fireExit.position.y
                );
                return dist <= fireExit.clearZone * 0.5;
            });

            if (blockedVisitors.length > 2) {
                this.risks.push({
                    id: `risk_fire_${Date.now()}_${fireExit.id}`,
                    type: 'fire_exit_blocked',
                    severity: 'high',
                    position: { ...fireExit.position },
                    description: `消防通道被占用: ${blockedVisitors.length} 人在禁停区域`,
                    visitorCount: blockedVisitors.length,
                    fireExit: fireExit
                });
            }
        }
    },

    /**
     * 检测视线遮挡
     */
    detectViewObstruction() {
        const exhibits = SpaceModel.getExhibits();

        for (const exhibit of exhibits) {
            const viewingVisitors = this.visitors.filter(v => 
                v.state === 'viewing' && v.currentExhibit && v.currentExhibit.id === exhibit.id
            );

            if (viewingVisitors.length > 0) {
                const blockingVisitors = this.visitors.filter(v => {
                    if (v.state === 'finished') return false;
                    if (viewingVisitors.includes(v)) return false;

                    const distToExhibit = SpaceModel.getDistance(
                        v.position.x, v.position.y,
                        exhibit.position.x, exhibit.position.y
                    );

                    return distToExhibit < 1.5;
                });

                if (blockingVisitors.length > 0) {
                    this.risks.push({
                        id: `risk_view_${Date.now()}_${exhibit.id}`,
                        type: 'view_obstruction',
                        severity: 'medium',
                        position: { ...exhibit.position },
                        description: `展品"${exhibit.name}"视线被 ${blockingVisitors.length} 人遮挡`,
                        visitorCount: blockingVisitors.length,
                        exhibit: exhibit
                    });
                }
            }
        }
    },

    /**
     * 检测无障碍绕行
     */
    detectAccessibilityDetour() {
        const accessibilityVisitors = this.visitors.filter(v => v.isAccessibilityNeed && v.state !== 'finished');
        const rules = SpaceModel.getAccessibilityRules();

        for (const visitor of accessibilityVisitors) {
            if (visitor.path.length > 0) {
                let totalDistance = 0;
                for (let i = 1; i < visitor.path.length; i++) {
                    totalDistance += SpaceModel.getDistance(
                        visitor.path[i - 1].position.x,
                        visitor.path[i - 1].position.y,
                        visitor.path[i].position.x,
                        visitor.path[i].position.y
                    );
                }

                if (totalDistance > rules.maxDetourDistance) {
                    this.risks.push({
                        id: `risk_access_${Date.now()}_${visitor.id}`,
                        type: 'accessibility_detour',
                        severity: 'low',
                        position: { ...visitor.position },
                        description: `无障碍观众绕行距离过长: ${totalDistance.toFixed(1)} 米 (限制: ${rules.maxDetourDistance} 米)`,
                        visitorCount: 1,
                        visitor: visitor,
                        detourDistance: totalDistance
                    });
                }
            }
        }
    },

    /**
     * 更新统计
     */
    updateStats() {
        this.stats.movingVisitors = this.visitors.filter(v => v.state === 'moving').length;
        
        const congestionRisks = this.risks.filter(r => r.type === 'congestion');
        this.stats.congestedAreas = congestionRisks.length;
        
        const detourRisks = this.risks.filter(r => r.type === 'accessibility_detour');
        this.stats.accessDetours = detourRisks.length;
    },

    /**
     * 获取当前风险列表
     */
    getRisks() {
        return [...this.risks];
    },

    /**
     * 获取统计数据
     */
    getStats() {
        return { ...this.stats };
    },

    /**
     * 获取观众列表
     */
    getVisitors() {
        return [...this.visitors];
    },

    /**
     * 生成评估报告数据
     */
    generateReportData() {
        const congestionRisks = this.risks.filter(r => r.type === 'congestion');
        const fireRisks = this.risks.filter(r => r.type === 'fire_exit_blocked');
        const viewRisks = this.risks.filter(r => r.type === 'view_obstruction');
        const accessRisks = this.risks.filter(r => r.type === 'accessibility_detour');

        const highRisks = this.risks.filter(r => r.severity === 'high');
        const mediumRisks = this.risks.filter(r => r.severity === 'medium');
        const lowRisks = this.risks.filter(r => r.severity === 'low');

        return {
            timestamp: new Date().toISOString(),
            timeSlot: this.currentTimeSlot,
            totalVisitors: this.stats.totalVisitors,
            risks: {
                total: this.risks.length,
                high: highRisks.length,
                medium: mediumRisks.length,
                low: lowRisks.length,
                byType: {
                    congestion: congestionRisks.length,
                    fire_blocked: fireRisks.length,
                    view_obstruction: viewRisks.length,
                    accessibility_detour: accessRisks.length
                }
            },
            riskDetails: this.risks.map(r => ({
                type: r.type,
                severity: r.severity,
                position: r.position,
                description: r.description
            })),
            recommendations: this.generateRecommendations()
        };
    },

    /**
     * 生成建议
     */
    generateRecommendations() {
        const recommendations = [];

        const congestionRisks = this.risks.filter(r => r.type === 'congestion' && r.severity === 'high');
        if (congestionRisks.length > 0) {
            recommendations.push({
                priority: 'high',
                title: '严重拥堵区域',
                description: `${congestionRisks.length} 个区域存在严重拥堵，建议：`,
                items: [
                    '考虑拓宽该区域的通道',
                    '调整展品布局分散人流',
                    '设置工作人员引导分流'
                ]
            });
        }

        const fireRisks = this.risks.filter(r => r.type === 'fire_exit_blocked');
        if (fireRisks.length > 0) {
            recommendations.push({
                priority: 'high',
                title: '消防通道被占用',
                description: `${fireRisks.length} 个消防通道存在被占用风险，建议：`,
                items: [
                    '在消防通道区域设置明显标识',
                    '安排专人监督消防通道畅通',
                    '考虑调整附近展品位置'
                ]
            });
        }

        const viewRisks = this.risks.filter(r => r.type === 'view_obstruction');
        if (viewRisks.length > 0) {
            recommendations.push({
                priority: 'medium',
                title: '展品视线遮挡',
                description: `${viewRisks.length} 个展品存在视线遮挡问题，建议：`,
                items: [
                    '扩大展品周围的观展空间',
                    '设置观展引导线',
                    '考虑调整展品摆放角度'
                ]
            });
        }

        const accessRisks = this.risks.filter(r => r.type === 'accessibility_detour');
        if (accessRisks.length > 0) {
            recommendations.push({
                priority: 'low',
                title: '无障碍绕行过长',
                description: `${accessRisks.length} 位无障碍观众绕行距离过长，建议：`,
                items: [
                    '优化无障碍通道布局',
                    '在热门展品附近设置无障碍观展区域',
                    '提供更短的无障碍路径'
                ]
            });
        }

        return recommendations;
    }
};

// 导出为全局变量
window.SimulationEngine = SimulationEngine;
