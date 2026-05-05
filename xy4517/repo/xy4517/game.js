// 铁路货场调车演练 - 游戏逻辑和渲染层

class Game {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.engine = null;
        this.isRunning = false;
        this.animationId = null;
        this.lastUpdateTime = 0;
        this.updateInterval = 1000 / 60; // 60 FPS
        
        // 事件相关
        this.selectedLocomotive = null;
        this.hoveredElement = null;
        
        // 存储管理
        this.storage = new GameStorage();
        
        // 初始化
        this.setupEventListeners();
    }

    // 加载关卡
    loadLevel(levelId) {
        const levelData = getLevel(levelId);
        this.engine = new GameEngine(levelData);
        this.updateUI();
        this.render();
    }

    // 开始游戏
    start() {
        if (!this.engine) return;
        
        this.engine.startGame();
        this.isRunning = true;
        this.lastUpdateTime = performance.now();
        this.gameLoop();
    }

    // 暂停游戏
    pause() {
        if (!this.engine) return;
        this.engine.pauseGame();
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
    }

    // 恢复游戏
    resume() {
        if (!this.engine) return;
        this.engine.resumeGame();
        this.isRunning = true;
        this.lastUpdateTime = performance.now();
        this.gameLoop();
    }

    // 游戏主循环
    gameLoop() {
        if (!this.isRunning) return;

        const currentTime = performance.now();
        const deltaTime = currentTime - this.lastUpdateTime;

        if (deltaTime >= this.updateInterval) {
            this.update(deltaTime);
            this.render();
            this.lastUpdateTime = currentTime - (deltaTime % this.updateInterval);
        }

        this.animationId = requestAnimationFrame(() => this.gameLoop());
    }

    // 更新游戏状态
    update(deltaTime) {
        if (!this.engine) return;

        // 检查超时
        if (this.engine.checkOvertime()) {
            this.endGame(false);
            return;
        }

        // 检查胜利条件
        if (this.engine.checkWinCondition()) {
            this.endGame(true);
            return;
        }

        // 更新UI
        this.updateUI();
    }

    // 渲染游戏画面
    render() {
        if (!this.engine || !this.ctx) return;

        const gameState = this.engine.gameState;
        
        // 清空画布
        this.ctx.fillStyle = '#0a0a1a';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // 绘制网格背景
        this.drawGrid();

        // 绘制轨道
        this.drawTracks(gameState.tracks);

        // 绘制目的股道
        this.drawDestinations(gameState.destinations);

        // 绘制禁停区域
        this.drawNoStopZones(gameState.noStopZones);

        // 绘制道岔
        this.drawSwitches(gameState.switches);

        // 绘制车皮
        this.drawCars(gameState.cars);

        // 绘制机车
        this.drawLocomotives(gameState.locomotives);

        // 绘制选中状态
        this.drawSelection();
    }

    // 绘制网格
    drawGrid() {
        this.ctx.strokeStyle = 'rgba(15, 52, 96, 0.3)';
        this.ctx.lineWidth = 1;
        
        const gridSize = 50;
        
        for (let x = 0; x < this.canvas.width; x += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, this.canvas.height);
            this.ctx.stroke();
        }
        
        for (let y = 0; y < this.canvas.height; y += gridSize) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(this.canvas.width, y);
            this.ctx.stroke();
        }
    }

    // 绘制轨道
    drawTracks(tracks) {
        tracks.forEach(track => {
            this.ctx.save();
            
            // 轨道主体
            this.ctx.strokeStyle = track.type === 'main' ? '#4a6fa5' : '#3a5a85';
            this.ctx.lineWidth = 8;
            this.ctx.lineCap = 'round';
            
            let startX, startY, endX, endY;
            
            if (track.direction === 'horizontal') {
                startX = track.x;
                startY = track.y;
                endX = track.x + track.length;
                endY = track.y;
            } else if (track.direction === 'vertical') {
                startX = track.x;
                startY = track.y;
                endX = track.x;
                endY = track.y + track.length;
            } else if (track.direction === 'diagonal') {
                startX = track.x;
                startY = track.y;
                endX = track.x + track.length * 0.7;
                endY = track.y + track.length * 0.3;
            } else {
                startX = track.x;
                startY = track.y;
                endX = track.x + track.length;
                endY = track.y;
            }
            
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
            
            // 轨道内线
            this.ctx.strokeStyle = 'rgba(74, 111, 165, 0.5)';
            this.ctx.lineWidth = 4;
            this.ctx.beginPath();
            this.ctx.moveTo(startX, startY);
            this.ctx.lineTo(endX, endY);
            this.ctx.stroke();
            
            // 轨道名称
            this.ctx.fillStyle = '#a0a0a0';
            this.ctx.font = '12px Microsoft YaHei';
            this.ctx.textAlign = 'center';
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            this.ctx.fillText(track.name, midX, midY - 15);
            
            this.ctx.restore();
        });
    }

    // 绘制目的股道
    drawDestinations(destinations) {
        destinations.forEach(dest => {
            const track = this.engine.gameState.tracks.find(t => t.id === dest.trackId);
            if (!track) return;
            
            this.ctx.save();
            
            // 计算显示位置
            let startX, startY, endX, endY;
            
            if (track.direction === 'horizontal') {
                startX = track.x + dest.startPosition;
                startY = track.y;
                endX = track.x + dest.endPosition;
                endY = track.y;
            } else {
                startX = track.x;
                startY = track.y + dest.startPosition;
                endX = track.x;
                endY = track.y + dest.endPosition;
            }
            
            // 绘制高亮区域
            this.ctx.strokeStyle = '#4caf50';
            this.ctx.lineWidth = 3;
            this.ctx.setLineDash([10, 5]);
            this.ctx.beginPath();
            
            // 绘制矩形边框表示目的地
            const padding = 20;
            if (track.direction === 'horizontal') {
                this.ctx.strokeRect(
                    startX - padding,
                    startY - padding,
                    endX - startX + padding * 2,
                    padding * 2
                );
            } else {
                this.ctx.strokeRect(
                    startX - padding,
                    startY - padding,
                    padding * 2,
                    endY - startY + padding * 2
                );
            }
            
            this.ctx.setLineDash([]);
            
            // 目的地名称
            this.ctx.fillStyle = '#4caf50';
            this.ctx.font = 'bold 14px Microsoft YaHei';
            this.ctx.textAlign = 'center';
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            this.ctx.fillText(`🎯 ${dest.name}`, midX, midY + 30);
            
            this.ctx.restore();
        });
    }

    // 绘制禁停区域
    drawNoStopZones(zones) {
        zones.forEach(zone => {
            const track = this.engine.gameState.tracks.find(t => t.id === zone.trackId);
            if (!track) return;
            
            this.ctx.save();
            
            let startX, startY, endX, endY;
            
            if (track.direction === 'horizontal') {
                startX = track.x + zone.startPosition;
                startY = track.y;
                endX = track.x + zone.endPosition;
                endY = track.y;
            } else {
                startX = track.x;
                startY = track.y + zone.startPosition;
                endX = track.x;
                endY = track.y + zone.endPosition;
            }
            
            // 绘制红色虚线区域
            this.ctx.strokeStyle = '#ff9800';
            this.ctx.lineWidth = 2;
            this.ctx.setLineDash([5, 3]);
            this.ctx.beginPath();
            
            const padding = 15;
            if (track.direction === 'horizontal') {
                this.ctx.strokeRect(
                    startX - padding,
                    startY - padding,
                    endX - startX + padding * 2,
                    padding * 2
                );
            } else {
                this.ctx.strokeRect(
                    startX - padding,
                    startY - padding,
                    padding * 2,
                    endY - startY + padding * 2
                );
            }
            
            this.ctx.setLineDash([]);
            
            // 禁停标识
            this.ctx.fillStyle = '#ff9800';
            this.ctx.font = '12px Microsoft YaHei';
            this.ctx.textAlign = 'center';
            const midX = (startX + endX) / 2;
            const midY = (startY + endY) / 2;
            this.ctx.fillText('⚠️ 禁停', midX, midY - 20);
            
            this.ctx.restore();
        });
    }

    // 绘制道岔
    drawSwitches(switches) {
        switches.forEach(switchObj => {
            const track = this.engine.gameState.tracks.find(t => t.id === switchObj.trackId);
            if (!track) return;
            
            this.ctx.save();
            
            let x, y;
            
            if (track.direction === 'horizontal') {
                x = track.x + switchObj.position;
                y = track.y;
            } else {
                x = track.x;
                y = track.y + switchObj.position;
            }
            
            // 道岔主体
            const isSelected = this.hoveredElement && 
                              this.hoveredElement.type === 'switch' && 
                              this.hoveredElement.id === switchObj.id;
            
            // 道岔指示器
            this.ctx.beginPath();
            this.ctx.arc(x, y, 18, 0, Math.PI * 2);
            
            if (switchObj.locked) {
                this.ctx.fillStyle = '#666';
            } else if (switchObj.currentPosition === 'main') {
                this.ctx.fillStyle = isSelected ? '#00bcd4' : '#4a6fa5';
            } else {
                this.ctx.fillStyle = isSelected ? '#ff9800' : '#e94560';
            }
            
            this.ctx.fill();
            
            // 道岔边框
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 2;
            this.ctx.stroke();
            
            // 道岔状态指示
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 12px Microsoft YaHei';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(
                switchObj.currentPosition === 'main' ? '直' : '曲',
                x, y
            );
            
            // 道岔名称
            this.ctx.fillStyle = '#a0a0a0';
            this.ctx.font = '10px Microsoft YaHei';
            this.ctx.fillText(switchObj.name, x, y + 28);
            
            this.ctx.restore();
        });
    }

    // 绘制车皮
    drawCars(cars) {
        cars.forEach(car => {
            const track = this.engine.gameState.tracks.find(t => t.id === car.trackId);
            if (!track) return;
            
            this.ctx.save();
            
            let x, y;
            
            if (track.direction === 'horizontal') {
                x = track.x + car.position;
                y = track.y;
            } else {
                x = track.x;
                y = track.y + car.position;
            }
            
            // 车皮颜色
            let carColor;
            if (car.delivered) {
                carColor = '#4caf50'; // 绿色 - 已送达
            } else if (car.coupledTo) {
                carColor = '#00bcd4'; // 青色 - 已连挂
            } else {
                carColor = '#e94560'; // 红色 - 待送
            }
            
            // 车皮主体
            const width = 35;
            const height = 20;
            
            this.ctx.fillStyle = carColor;
            this.ctx.fillRect(x - width/2, y - height/2, width, height);
            
            // 车皮边框
            this.ctx.strokeStyle = '#fff';
            this.ctx.lineWidth = 1;
            this.ctx.strokeRect(x - width/2, y - height/2, width, height);
            
            // 车皮名称
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 10px Microsoft YaHei';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(car.name, x, y);
            
            // 目的地指示
            if (!car.delivered) {
                this.ctx.fillStyle = '#ff9800';
                this.ctx.font = '8px Microsoft YaHei';
                this.ctx.fillText(`→${car.destination}`, x, y + height/2 + 10);
            } else {
                this.ctx.fillStyle = '#4caf50';
                this.ctx.font = '8px Microsoft YaHei';
                this.ctx.fillText('✓ 已送达', x, y + height/2 + 10);
            }
            
            this.ctx.restore();
        });
    }

    // 绘制机车
    drawLocomotives(locomotives) {
        locomotives.forEach(loco => {
            const track = this.engine.gameState.tracks.find(t => t.id === loco.trackId);
            if (!track) return;
            
            this.ctx.save();
            
            let x, y;
            
            if (track.direction === 'horizontal') {
                x = track.x + loco.position;
                y = track.y;
            } else {
                x = track.x;
                y = track.y + loco.position;
            }
            
            // 检查是否被选中
            const isSelected = this.engine.gameState.selectedLocomotiveId === loco.id;
            const isHovered = this.hoveredElement && 
                             this.hoveredElement.type === 'locomotive' && 
                             this.hoveredElement.id === loco.id;
            
            // 机车主体
            const width = 50;
            const height = 25;
            
            // 选中高亮
            if (isSelected) {
                this.ctx.shadowColor = '#e94560';
                this.ctx.shadowBlur = 15;
            }
            
            this.ctx.fillStyle = isHovered ? '#ff6b6b' : '#e94560';
            this.ctx.fillRect(x - width/2, y - height/2, width, height);
            
            // 机车边框
            this.ctx.strokeStyle = isSelected ? '#fff' : '#c73e54';
            this.ctx.lineWidth = isSelected ? 3 : 2;
            this.ctx.strokeRect(x - width/2, y - height/2, width, height);
            
            this.ctx.shadowBlur = 0;
            
            // 机车窗户
            this.ctx.fillStyle = '#00a8cc';
            this.ctx.fillRect(x - width/4, y - height/4, width/2, height/2);
            
            // 机车方向指示
            this.ctx.fillStyle = '#fff';
            const arrowX = loco.direction === 'right' ? x + width/2 + 5 : x - width/2 - 5;
            this.ctx.beginPath();
            if (loco.direction === 'right') {
                this.ctx.moveTo(arrowX - 8, y - 5);
                this.ctx.lineTo(arrowX, y);
                this.ctx.lineTo(arrowX - 8, y + 5);
            } else {
                this.ctx.moveTo(arrowX + 8, y - 5);
                this.ctx.lineTo(arrowX, y);
                this.ctx.lineTo(arrowX + 8, y + 5);
            }
            this.ctx.fill();
            
            // 机车名称
            this.ctx.fillStyle = '#fff';
            this.ctx.font = 'bold 11px Microsoft YaHei';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(loco.name, x, y);
            
            // 连挂状态指示
            if (loco.coupledCarId) {
                this.ctx.fillStyle = '#4caf50';
                this.ctx.font = '8px Microsoft YaHei';
                this.ctx.fillText(`⛓ ${loco.coupledCarId}`, x, y + height/2 + 10);
            }
            
            this.ctx.restore();
        });
    }

    // 绘制选中状态
    drawSelection() {
        // 可以在这里添加额外的选择高亮
    }

    // 设置事件监听
    setupEventListeners() {
        // 点击事件
        this.canvas.addEventListener('click', (e) => this.handleClick(e));
        
        // 移动事件
        this.canvas.addEventListener('mousemove', (e) => this.handleMouseMove(e));
        
        // 键盘事件
        document.addEventListener('keydown', (e) => this.handleKeyDown(e));
    }

    // 处理点击事件
    handleClick(e) {
        if (!this.engine || this.engine.gameState.isGameOver) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        // 检查点击的元素
        const element = this.getElementAtPosition(x, y);
        
        if (element) {
            switch (element.type) {
                case 'locomotive':
                    this.engine.selectLocomotive(element.id);
                    this.updateControlPanel();
                    break;
                    
                case 'switch':
                    const result = this.engine.toggleSwitch(element.id);
                    if (!result.success) {
                        this.showMessage(result.error, 'error');
                    }
                    this.updateSwitchPanel();
                    break;
                    
                case 'car':
                    // 检查是否可以连挂
                    const selectedLoco = this.engine.getSelectedLocomotive();
                    if (selectedLoco && !selectedLoco.coupledCarId) {
                        const coupleResult = this.engine.coupleCar(selectedLoco.id, element.id);
                        if (!coupleResult.success) {
                            this.showMessage(coupleResult.error, 'warning');
                        }
                        this.updateControlPanel();
                        this.updateCarsPanel();
                    }
                    break;
            }
        }
        
        this.render();
    }

    // 处理鼠标移动事件
    handleMouseMove(e) {
        if (!this.engine) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        this.hoveredElement = this.getElementAtPosition(x, y);
        
        // 更新鼠标样式
        if (this.hoveredElement) {
            this.canvas.style.cursor = 'pointer';
        } else {
            this.canvas.style.cursor = 'default';
        }
        
        this.render();
    }

    // 处理键盘事件
    handleKeyDown(e) {
        if (!this.engine || this.engine.gameState.isGameOver) return;
        
        const selectedLoco = this.engine.getSelectedLocomotive();
        if (!selectedLoco) return;
        
        switch (e.key) {
            case 'ArrowRight':
            case 'd':
            case 'D':
                this.engine.moveLocomotive(selectedLoco.id, 'forward', 50);
                break;
                
            case 'ArrowLeft':
            case 'a':
            case 'A':
                this.engine.moveLocomotive(selectedLoco.id, 'backward', 50);
                break;
                
            case ' ':
                // 空格键：连挂/摘钩
                if (selectedLoco.coupledCarId) {
                    this.engine.uncoupleCar(selectedLoco.id);
                } else {
                    // 尝试连挂最近的车皮
                    const nearbyCar = this.findNearbyCar(selectedLoco);
                    if (nearbyCar) {
                        this.engine.coupleCar(selectedLoco.id, nearbyCar.id);
                    }
                }
                break;
        }
        
        this.updateUI();
        this.render();
    }

    // 查找附近的车皮
    findNearbyCar(locomotive) {
        const cars = this.engine.gameState.cars.filter(car => 
            car.trackId === locomotive.trackId && !car.coupledTo
        );
        
        for (const car of cars) {
            const distance = Math.abs(locomotive.position - car.position);
            if (distance <= 50) {
                return car;
            }
        }
        
        return null;
    }

    // 获取指定位置的元素
    getElementAtPosition(x, y) {
        if (!this.engine) return null;
        
        const gameState = this.engine.gameState;
        
        // 检查机车（优先级最高）
        for (const loco of gameState.locomotives) {
            const track = gameState.tracks.find(t => t.id === loco.trackId);
            if (!track) continue;
            
            let locoX, locoY;
            if (track.direction === 'horizontal') {
                locoX = track.x + loco.position;
                locoY = track.y;
            } else {
                locoX = track.x;
                locoY = track.y + loco.position;
            }
            
            const distance = Math.sqrt((x - locoX) ** 2 + (y - locoY) ** 2);
            if (distance < 30) {
                return { type: 'locomotive', id: loco.id, element: loco };
            }
        }
        
        // 检查道岔
        for (const switchObj of gameState.switches) {
            const track = gameState.tracks.find(t => t.id === switchObj.trackId);
            if (!track) continue;
            
            let swX, swY;
            if (track.direction === 'horizontal') {
                swX = track.x + switchObj.position;
                swY = track.y;
            } else {
                swX = track.x;
                swY = track.y + switchObj.position;
            }
            
            const distance = Math.sqrt((x - swX) ** 2 + (y - swY) ** 2);
            if (distance < 25) {
                return { type: 'switch', id: switchObj.id, element: switchObj };
            }
        }
        
        // 检查车皮
        for (const car of gameState.cars) {
            const track = gameState.tracks.find(t => t.id === car.trackId);
            if (!track) continue;
            
            let carX, carY;
            if (track.direction === 'horizontal') {
                carX = track.x + car.position;
                carY = track.y;
            } else {
                carX = track.x;
                carY = track.y + car.position;
            }
            
            const distance = Math.sqrt((x - carX) ** 2 + (y - carY) ** 2);
            if (distance < 25) {
                return { type: 'car', id: car.id, element: car };
            }
        }
        
        return null;
    }

    // 更新UI
    updateUI() {
        if (!this.engine) return;
        
        const stats = this.engine.getStats();
        
        // 更新时间
        const timeEl = document.getElementById('game-time');
        if (timeEl) {
            timeEl.textContent = this.formatTime(stats.currentTime);
        }
        
        // 更新时间窗
        const timeWindowEl = document.getElementById('time-window');
        if (timeWindowEl) {
            timeWindowEl.textContent = this.formatTime(stats.timeLimit);
        }
        
        // 更新得分
        const scoreEl = document.getElementById('current-score');
        if (scoreEl) {
            scoreEl.textContent = stats.score;
        }
        
        // 更新违规次数
        const violationCountEl = document.getElementById('violation-count');
        if (violationCountEl) {
            violationCountEl.textContent = stats.violationCount;
        }
        
        // 更新各面板
        this.updateCarsPanel();
        this.updateDestinationsPanel();
        this.updateSwitchPanel();
        this.updateViolationsPanel();
    }

    // 更新控制面板
    updateControlPanel() {
        const selectedLoco = this.engine ? this.engine.getSelectedLocomotive() : null;
        const infoEl = document.getElementById('selected-train-info');
        
        if (!infoEl) return;
        
        if (selectedLoco) {
            infoEl.innerHTML = `
                <p><strong>${selectedLoco.name}</strong></p>
                <p>位置: ${selectedLoco.trackId}:${Math.round(selectedLoco.position)}</p>
                <p>方向: ${selectedLoco.direction === 'right' ? '→ 向右' : '← 向左'}</p>
                <p>连挂: ${selectedLoco.coupledCarId || '无'}</p>
            `;
            
            // 启用/禁用按钮
            const btnPush = document.getElementById('btn-push');
            const btnPull = document.getElementById('btn-pull');
            const btnCouple = document.getElementById('btn-couple');
            const btnUncouple = document.getElementById('btn-uncouple');
            
            if (btnPush) btnPush.disabled = false;
            if (btnPull) btnPull.disabled = false;
            if (btnCouple) btnCouple.disabled = selectedLoco.coupledCarId !== null;
            if (btnUncouple) btnUncouple.disabled = selectedLoco.coupledCarId === null;
        } else {
            infoEl.innerHTML = '<p>未选择机车</p>';
            
            // 禁用所有按钮
            const buttons = ['btn-push', 'btn-pull', 'btn-couple', 'btn-uncouple'];
            buttons.forEach(id => {
                const btn = document.getElementById(id);
                if (btn) btn.disabled = true;
            });
        }
    }

    // 更新车皮面板
    updateCarsPanel() {
        const listEl = document.getElementById('cars-list');
        if (!listEl || !this.engine) return;
        
        const cars = this.engine.gameState.cars;
        listEl.innerHTML = '';
        
        cars.forEach(car => {
            const item = document.createElement('div');
            item.className = `car-item ${car.delivered ? 'delivered' : car.coupledTo ? 'occupied' : ''}`;
            item.innerHTML = `
                <div><strong>${car.name}</strong></div>
                <div>位置: ${car.trackId}:${Math.round(car.position)}</div>
                <div>目的地: ${car.destination}</div>
                <div>状态: ${car.delivered ? '✓ 已送达' : car.coupledTo ? '⛓ 已连挂' : '待送'}</div>
            `;
            listEl.appendChild(item);
        });
    }

    // 更新目的股道面板
    updateDestinationsPanel() {
        const listEl = document.getElementById('destinations-list');
        if (!listEl || !this.engine) return;
        
        const destinations = this.engine.gameState.destinations;
        listEl.innerHTML = '';
        
        destinations.forEach(dest => {
            const deliveredCars = dest.requiredCars.filter(carId => {
                const car = this.engine.gameState.cars.find(c => c.id === carId);
                return car && car.delivered;
            }).length;
            
            const item = document.createElement('div');
            item.className = 'destination-item';
            item.innerHTML = `
                <div><strong>${dest.name}</strong></div>
                <div>轨道: ${dest.trackId}</div>
                <div>进度: ${deliveredCars}/${dest.requiredCars.length} 车皮</div>
            `;
            listEl.appendChild(item);
        });
    }

    // 更新道岔面板
    updateSwitchPanel() {
        const listEl = document.getElementById('switches-list');
        if (!listEl || !this.engine) return;
        
        const switches = this.engine.gameState.switches;
        listEl.innerHTML = '';
        
        switches.forEach(sw => {
            const item = document.createElement('div');
            item.className = 'switch-item';
            item.innerHTML = `
                <div>
                    <strong>${sw.name}</strong>
                    <div class="switch-position">${sw.currentPosition === 'main' ? '直向' : '侧向: ' + sw.currentPosition}</div>
                </div>
                <div style="color: ${sw.locked ? '#ff9800' : '#4caf50'}">
                    ${sw.locked ? '🔒 锁定' : '🔓 可用'}
                </div>
            `;
            listEl.appendChild(item);
        });
    }

    // 更新违规面板
    updateViolationsPanel() {
        const panelEl = document.querySelector('.violations-panel');
        const listEl = document.getElementById('violations-list');
        
        if (!panelEl || !listEl || !this.engine) return;
        
        const violations = this.engine.violations;
        
        if (violations.length > 0) {
            panelEl.style.display = 'block';
            listEl.innerHTML = '';
            
            // 显示最近的违规（最多5条）
            const recentViolations = violations.slice(-5).reverse();
            
            recentViolations.forEach(v => {
                const item = document.createElement('div');
                item.className = 'violation-item';
                item.innerHTML = `
                    <div class="violation-type">${v.name}</div>
                    <div>${v.description}</div>
                    <div class="violation-time">时间: ${this.formatTime(v.gameTime)} | 扣分: ${v.penalty}</div>
                `;
                listEl.appendChild(item);
            });
        } else {
            panelEl.style.display = 'none';
        }
    }

    // 显示消息
    showMessage(message, type = 'info') {
        // 简单的消息提示
        console.log(`[${type.toUpperCase()}] ${message}`);
        
        // 可以在这里实现更复杂的消息提示UI
        const overlay = document.getElementById('game-overlay');
        if (overlay && type === 'error') {
            // 临时显示错误消息
            const title = document.getElementById('overlay-title');
            const msg = document.getElementById('overlay-message');
            if (title) title.textContent = '操作错误';
            if (msg) msg.textContent = message;
            overlay.style.display = 'flex';
            
            // 3秒后自动关闭
            setTimeout(() => {
                overlay.style.display = 'none';
            }, 3000);
        }
    }

    // 结束游戏
    endGame(isWin) {
        this.isRunning = false;
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
        }
        
        // 保存游戏数据
        const gameData = this.engine.exportGameData();
        this.storage.saveGame(gameData);
        
        // 显示结束界面
        const overlay = document.getElementById('game-overlay');
        const title = document.getElementById('overlay-title');
        const message = document.getElementById('overlay-message');
        const stats = document.querySelector('.overlay-stats');
        
        if (overlay) overlay.style.display = 'flex';
        if (title) title.textContent = isWin ? '🎉 任务完成！' : '😔 任务失败';
        if (message) message.textContent = isWin ? 
            '恭喜你成功完成了所有调车任务！' : 
            '很遗憾，任务未能在规定时间内完成或发生了严重违规。';
        
        if (stats) {
            const gameStats = this.engine.getStats();
            stats.innerHTML = `
                <div class="stat">
                    <div class="stat-label">最终得分</div>
                    <div class="stat-value">${gameStats.score}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">用时</div>
                    <div class="stat-value">${this.formatTime(gameStats.currentTime)}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">已送达车皮</div>
                    <div class="stat-value">${gameStats.deliveredCars}/${gameStats.totalCars}</div>
                </div>
                <div class="stat">
                    <div class="stat-label">违规次数</div>
                    <div class="stat-value">${gameStats.violationCount}</div>
                </div>
            `;
        }
    }

    // 格式化时间
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    // 保存当前游戏
    saveCurrentGame() {
        if (!this.engine) return null;
        const gameData = this.engine.exportGameData();
        return this.storage.saveGame(gameData);
    }

    // 加载存档
    loadGame(gameId) {
        const gameData = this.storage.loadGame(gameId);
        if (!gameData) return false;
        
        // 重建游戏状态
        const levelData = getLevel(gameData.levelId);
        this.engine = new GameEngine(levelData);
        
        // 恢复状态（简化版本，实际可能需要更复杂的恢复逻辑）
        this.engine.gameState = gameData.finalState.gameState;
        this.engine.violations = gameData.violations;
        this.engine.actionHistory = gameData.actionHistory;
        
        this.updateUI();
        this.render();
        
        return true;
    }

    // 获取存档列表
    getSaveList() {
        return this.storage.getGameList();
    }

    // 导出Markdown
    exportMarkdown() {
        if (!this.engine) return null;
        return this.engine.exportMarkdownReport();
    }

    // 导出JSON
    exportJSON() {
        if (!this.engine) return null;
        return this.engine.exportGameData();
    }
}
