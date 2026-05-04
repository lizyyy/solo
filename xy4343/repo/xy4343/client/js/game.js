class Game {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.isRunning = false;
        this.lastTime = 0;
        
        // 游戏状态
        this.currentLevel = null;
        this.sessionId = null;
        this.player = null;
        this.checkpoints = [];
        this.visitedCheckpoints = [];
        this.remainingTime = 0;
        this.totalTime = 0;
        this.distanceTraveled = 0;
        
        // 回放数据
        this.replayData = {
            positions: [],
            visitedCheckpoints: [],
            timestamps: []
        };
        
        // 键盘状态
        this.keys = {};
        
        // 绑定事件
        this.bindEvents();
    }
    
    bindEvents() {
        document.addEventListener('keydown', (e) => {
            this.keys[e.key.toLowerCase()] = true;
            // 阻止方向键滚动页面
            if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(e.key.toLowerCase())) {
                e.preventDefault();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            this.keys[e.key.toLowerCase()] = false;
        });
    }
    
    async start(levelId) {
        // 获取关卡数据
        try {
            this.currentLevel = await API.levels.get(levelId);
        } catch (error) {
            alert('加载关卡失败: ' + error.message);
            return;
        }
        
        // 创建会话
        try {
            const sessionResult = await API.sessions.create(levelId, '匿名巡查员');
            this.sessionId = sessionResult.session_id;
        } catch (error) {
            alert('创建会话失败: ' + error.message);
            return;
        }
        
        // 初始化游戏状态
        this.initializeGame();
        
        // 开始游戏循环
        this.isRunning = true;
        this.lastTime = performance.now();
        this.gameLoop();
    }
    
    initializeGame() {
        const floorPlan = this.currentLevel.floor_plan;
        const checkpoints = this.currentLevel.checkpoints;
        
        // 设置画布大小
        this.canvas.width = floorPlan.width || 800;
        this.canvas.height = floorPlan.height || 600;
        
        // 初始化玩家
        const startPos = floorPlan.start || { x: 50, y: 50 };
        this.player = {
            x: startPos.x,
            y: startPos.y,
            radius: 15,
            speed: 3,
            color: '#4facfe'
        };
        
        // 初始化检查点
        this.checkpoints = checkpoints.map(cp => ({
            ...cp,
            visited: false,
            radius: 20,
            color: this.getCheckpointColor(cp.type)
        }));
        
        // 初始化时间
        this.totalTime = this.currentLevel.time_limit;
        this.remainingTime = this.totalTime;
        
        // 重置其他状态
        this.visitedCheckpoints = [];
        this.distanceTraveled = 0;
        
        // 重置回放数据
        this.replayData = {
            positions: [],
            visitedCheckpoints: [],
            timestamps: []
        };
        
        // 更新UI
        this.updateUI();
        
        // 显示游戏界面
        showScreen('game-screen');
        document.getElementById('current-level').textContent = `关卡：${this.currentLevel.name}`;
    }
    
    getCheckpointColor(type) {
        const colors = {
            'door': '#ff6b6b',
            'temperature': '#ffd93d',
            'exhibit': '#6bcf7f'
        };
        return colors[type] || '#ffffff';
    }
    
    getCheckpointTypeName(type) {
        const types = {
            'door': '门禁',
            'temperature': '温湿度报警',
            'exhibit': '重点展柜'
        };
        return types[type] || type;
    }
    
    gameLoop() {
        if (!this.isRunning) return;
        
        const currentTime = performance.now();
        const deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // 更新时间
        this.remainingTime -= deltaTime;
        
        // 检查时间是否用完
        if (this.remainingTime <= 0) {
            this.remainingTime = 0;
            this.endGame();
            return;
        }
        
        // 更新玩家位置
        const oldPos = { x: this.player.x, y: this.player.y };
        this.updatePlayer(deltaTime);
        
        // 计算移动距离
        const distance = this.calculateDistance(oldPos, this.player);
        this.distanceTraveled += distance;
        
        // 记录回放数据（每帧记录）
        this.replayData.positions.push({ x: this.player.x, y: this.player.y });
        this.replayData.timestamps.push(currentTime);
        
        // 检查检查点碰撞
        this.checkCheckpointCollisions();
        
        // 更新UI
        this.updateUI();
        
        // 渲染
        this.render();
        
        // 继续循环
        requestAnimationFrame(() => this.gameLoop());
    }
    
    updatePlayer(deltaTime) {
        let dx = 0;
        let dy = 0;
        
        // 检查按键
        if (this.keys['w'] || this.keys['arrowup']) dy -= 1;
        if (this.keys['s'] || this.keys['arrowdown']) dy += 1;
        if (this.keys['a'] || this.keys['arrowleft']) dx -= 1;
        if (this.keys['d'] || this.keys['arrowright']) dx += 1;
        
        // 归一化对角线移动
        if (dx !== 0 && dy !== 0) {
            const factor = 1 / Math.sqrt(2);
            dx *= factor;
            dy *= factor;
        }
        
        // 更新位置
        const speed = this.player.speed;
        const newX = this.player.x + dx * speed;
        const newY = this.player.y + dy * speed;
        
        // 边界检查
        const margin = this.player.radius;
        if (newX >= margin && newX <= this.canvas.width - margin) {
            this.player.x = newX;
        }
        if (newY >= margin && newY <= this.canvas.height - margin) {
            this.player.y = newY;
        }
        
        // 障碍物碰撞检测（简化：检查墙）
        this.checkWallCollision();
    }
    
    checkWallCollision() {
        const floorPlan = this.currentLevel.floor_plan;
        if (!floorPlan.walls) return;
        
        const playerRadius = this.player.radius;
        
        for (const wall of floorPlan.walls) {
            // 简化的矩形碰撞检测
            if (this.rectCircleCollision(
                wall.x, wall.y, wall.width, wall.height,
                this.player.x, this.player.y, playerRadius
            )) {
                // 简单的碰撞响应：将玩家推出墙壁
                // 这里简化处理，实际应该计算正确的推出方向
                const centerX = wall.x + wall.width / 2;
                const centerY = wall.y + wall.height / 2;
                
                const dx = this.player.x - centerX;
                const dy = this.player.y - centerY;
                const dist = Math.sqrt(dx * dx + dy * dy);
                
                if (dist > 0) {
                    // 这里只是一个简化的处理方式
                    const pushDist = (wall.width / 2 + playerRadius) - dist;
                    if (pushDist > 0) {
                        this.player.x += (dx / dist) * pushDist;
                        this.player.y += (dy / dist) * pushDist;
                    }
                }
            }
        }
    }
    
    rectCircleCollision(rx, ry, rw, rh, cx, cy, cr) {
        // 找到矩形中离圆心最近的点
        const closestX = Math.max(rx, Math.min(cx, rx + rw));
        const closestY = Math.max(ry, Math.min(cy, ry + rh));
        
        // 计算距离
        const dx = cx - closestX;
        const dy = cy - closestY;
        
        return (dx * dx + dy * dy) < (cr * cr);
    }
    
    checkCheckpointCollisions() {
        for (const checkpoint of this.checkpoints) {
            if (checkpoint.visited) continue;
            
            const distance = this.calculateDistance(
                this.player,
                checkpoint.position
            );
            
            if (distance < this.player.radius + checkpoint.radius) {
                // 到达检查点
                checkpoint.visited = true;
                this.visitedCheckpoints.push(checkpoint.id);
                
                // 记录到回放数据
                this.replayData.visitedCheckpoints.push({
                    checkpointId: checkpoint.id,
                    timestamp: performance.now(),
                    position: { x: this.player.x, y: this.player.y }
                });
                
                // 显示消息
                document.getElementById('game-message').textContent = 
                    `已检查：${checkpoint.name} (${this.getCheckpointTypeName(checkpoint.type)})`;
                
                // 检查是否所有检查点都已访问
                if (this.visitedCheckpoints.length === this.checkpoints.length) {
                    // 所有检查点已完成，可以结束游戏
                    setTimeout(() => {
                        this.endGame();
                    }, 500);
                }
            }
        }
    }
    
    calculateDistance(p1, p2) {
        return Math.sqrt(
            Math.pow(p2.x - p1.x, 2) + 
            Math.pow(p2.y - p1.y, 2)
        );
    }
    
    updateUI() {
        // 更新时间显示
        const timeElement = document.getElementById('time-remaining');
        const minutes = Math.floor(this.remainingTime / 60);
        const seconds = Math.floor(this.remainingTime % 60);
        timeElement.textContent = 
            `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        
        // 更新时间颜色
        timeElement.classList.remove('warning', 'danger');
        if (this.remainingTime < 30) {
            timeElement.classList.add('danger');
        } else if (this.remainingTime < 60) {
            timeElement.classList.add('warning');
        }
        
        // 更新检查点计数
        document.getElementById('checkpoints-count').textContent = 
            `${this.visitedCheckpoints.length}/${this.checkpoints.length}`;
        
        // 更新下一个检查点提示
        const nextCheckpoint = this.checkpoints.find(cp => !cp.visited);
        if (nextCheckpoint) {
            document.getElementById('next-checkpoint').textContent = 
                `${nextCheckpoint.name} (${this.getCheckpointTypeName(nextCheckpoint.type)})`;
        } else {
            document.getElementById('next-checkpoint').textContent = '所有检查点已完成';
        }
    }
    
    render() {
        const ctx = this.ctx;
        const floorPlan = this.currentLevel.floor_plan;
        
        // 清空画布
        ctx.fillStyle = '#0a0a15';
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制网格背景
        this.drawGrid();
        
        // 绘制墙壁
        if (floorPlan.walls) {
            for (const wall of floorPlan.walls) {
                ctx.fillStyle = '#2a2a4a';
                ctx.fillRect(wall.x, wall.y, wall.width, wall.height);
                
                // 墙壁边框
                ctx.strokeStyle = '#4a4a6a';
                ctx.lineWidth = 2;
                ctx.strokeRect(wall.x, wall.y, wall.width, wall.height);
            }
        }
        
        // 绘制起点标记
        if (floorPlan.start) {
            ctx.beginPath();
            ctx.arc(floorPlan.start.x, floorPlan.start.y, 10, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(79, 172, 254, 0.3)';
            ctx.fill();
            ctx.strokeStyle = '#4facfe';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            ctx.fillStyle = '#4facfe';
            ctx.font = '10px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('起点', floorPlan.start.x, floorPlan.start.y + 20);
        }
        
        // 绘制检查点
        for (const checkpoint of this.checkpoints) {
            const pos = checkpoint.position;
            
            // 检查点圆圈
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, checkpoint.radius, 0, Math.PI * 2);
            
            if (checkpoint.visited) {
                ctx.fillStyle = 'rgba(107, 207, 127, 0.3)';
                ctx.strokeStyle = '#6bcf7f';
            } else {
                ctx.fillStyle = checkpoint.color + '33';  // 20% opacity
                ctx.strokeStyle = checkpoint.color;
            }
            
            ctx.fill();
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // 检查点图标
            ctx.fillStyle = checkpoint.visited ? '#6bcf7f' : checkpoint.color;
            ctx.font = '14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            
            let icon = '❓';
            switch (checkpoint.type) {
                case 'door': icon = '🚪'; break;
                case 'temperature': icon = '🌡️'; break;
                case 'exhibit': icon = '🖼️'; break;
            }
            ctx.fillText(icon, pos.x, pos.y);
            
            // 检查点名称
            ctx.fillStyle = '#e0e0e0';
            ctx.font = '10px sans-serif';
            ctx.fillText(checkpoint.name, pos.x, pos.y + 28);
        }
        
        // 绘制玩家
        this.drawPlayer();
        
        // 绘制玩家轨迹（如果需要）
        this.drawTrail();
    }
    
    drawGrid() {
        const ctx = this.ctx;
        const gridSize = 40;
        
        ctx.strokeStyle = 'rgba(79, 172, 254, 0.1)';
        ctx.lineWidth = 1;
        
        // 垂直线
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        
        // 水平线
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    }
    
    drawPlayer() {
        const ctx = this.ctx;
        const p = this.player;
        
        // 玩家外圈光晕
        const gradient = ctx.createRadialGradient(
            p.x, p.y, 0,
            p.x, p.y, p.radius * 1.5
        );
        gradient.addColorStop(0, 'rgba(79, 172, 254, 0.5)');
        gradient.addColorStop(1, 'rgba(79, 172, 254, 0)');
        
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius * 1.5, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        
        // 玩家主体
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.fill();
        
        // 玩家图标
        ctx.font = '16px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('👮', p.x, p.y);
    }
    
    drawTrail() {
        // 绘制最近的轨迹点
        const ctx = this.ctx;
        const positions = this.replayData.positions;
        const trailLength = Math.min(positions.length, 50);
        
        for (let i = 0; i < trailLength; i++) {
            const pos = positions[positions.length - trailLength + i];
            const alpha = (i + 1) / trailLength * 0.3;
            
            ctx.beginPath();
            ctx.arc(pos.x, pos.y, 2, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(79, 172, 254, ${alpha})`;
            ctx.fill();
        }
    }
    
    async endGame() {
        this.isRunning = false;
        
        // 更新会话数据
        try {
            await API.sessions.update(this.sessionId, {
                checkpoints_visited: this.visitedCheckpoints,
                distance_traveled: this.distanceTraveled,
                time_used: this.totalTime - this.remainingTime
            });
        } catch (error) {
            console.error('更新会话失败:', error);
        }
        
        // 结束会话并获取评分
        let result;
        try {
            result = await API.sessions.finish(this.sessionId, this.replayData);
        } catch (error) {
            console.error('结束会话失败:', error);
            alert('结算失败，请重试');
            return;
        }
        
        // 显示结果
        this.showResult(result);
    }
    
    showResult(result) {
        // 存储当前会话ID以便导出
        window.currentSessionId = this.sessionId;
        
        // 更新分数显示
        document.getElementById('final-score').textContent = result.score;
        
        // 更新评分等级
        const ratingElement = document.getElementById('score-rating');
        let rating = '';
        let ratingClass = '';
        
        if (result.score >= 90) {
            rating = '优秀';
            ratingClass = 'excellent';
        } else if (result.score >= 70) {
            rating = '良好';
            ratingClass = 'good';
        } else if (result.score >= 50) {
            rating = '及格';
            ratingClass = 'average';
        } else {
            rating = '需要改进';
            ratingClass = 'poor';
        }
        
        ratingElement.textContent = rating;
        ratingElement.className = `score-rating ${ratingClass}`;
        
        // 更新检查点详情
        document.getElementById('detail-total-checkpoints').textContent = result.checkpoints.total;
        document.getElementById('detail-visited-checkpoints').textContent = result.checkpoints.visited;
        document.getElementById('detail-missed-checkpoints').textContent = result.checkpoints.missed;
        
        // 更新时间详情
        document.getElementById('detail-time-used').textContent = `${result.time.used}秒`;
        document.getElementById('detail-time-limit').textContent = `${result.time.limit}秒`;
        document.getElementById('detail-overtime').textContent = `${Math.max(0, result.time.used - result.time.limit)}秒`;
        
        // 更新路线详情
        document.getElementById('detail-actual-distance').textContent = Math.round(result.distance.actual);
        document.getElementById('detail-optimal-distance').textContent = Math.round(result.distance.optimal);
        
        const efficiency = result.distance.optimal > 0 
            ? Math.round((result.distance.optimal / result.distance.actual) * 100) 
            : 0;
        document.getElementById('detail-efficiency').textContent = `${efficiency}%`;
        
        // 更新扣分详情
        document.getElementById('penalty-missed').textContent = `-${result.penalties.missed}分`;
        document.getElementById('penalty-detour').textContent = `-${result.penalties.detour}分`;
        document.getElementById('penalty-overtime').textContent = `-${result.penalties.overtime}分`;
        
        // 显示结果界面
        showScreen('result-screen');
    }
}

// 全局游戏实例
const game = new Game();

// 重新开始游戏
function restartGame() {
    if (game.currentLevel) {
        game.start(game.currentLevel.id);
    }
}

// 导出Markdown
async function exportMarkdown() {
    if (!window.currentSessionId) {
        alert('没有可导出的会话数据');
        return;
    }
    
    try {
        const result = await API.exports.markdown(window.currentSessionId);
        downloadFile(result.content, result.filename, 'text/markdown');
        alert('Markdown复盘报告已下载');
    } catch (error) {
        alert('导出失败: ' + error.message);
    }
}

// 导出JSON
async function exportJson() {
    if (!window.currentSessionId) {
        alert('没有可导出的会话数据');
        return;
    }
    
    try {
        const result = await API.exports.json(window.currentSessionId);
        downloadFile(JSON.stringify(result.content, null, 2), result.filename, 'application/json');
        alert('JSON审计包已下载');
    } catch (error) {
        alert('导出失败: ' + error.message);
    }
}
