class MuseumSecurityGame {
    constructor() {
        this.gameId = null;
        this.gameState = null;
        this.isPaused = false;
        this.gameLoop = null;
        this.selectedEvent = null;
        this.currentMuseumFile = 'sample-museum.json';
        this.animationFrame = 0;
        
        this.initElements();
        this.initEventListeners();
    }

    initElements() {
        // 屏幕元素
        this.mainMenu = document.getElementById('main-menu');
        this.museumSelect = document.getElementById('museum-select');
        this.saveSelect = document.getElementById('save-select');
        this.importScreen = document.getElementById('import-screen');
        this.gameScreen = document.getElementById('game-screen');
        this.gameOverScreen = document.getElementById('game-over-screen');
        this.pauseMenu = document.getElementById('pause-menu');
        
        // 游戏界面元素
        this.canvas = document.getElementById('game-map');
        this.ctx = this.canvas.getContext('2d');
        this.mapOverlay = document.getElementById('map-overlay');
        
        // UI元素
        this.timeDisplay = document.getElementById('game-time');
        this.scoreDisplay = document.getElementById('game-score');
        this.staminaBar = document.getElementById('stamina-bar');
        this.staminaValue = document.getElementById('stamina-value');
        this.guardsCount = document.getElementById('guards-count');
        this.locksCount = document.getElementById('locks-count');
        this.currentLocation = document.getElementById('current-location');
        this.activeEventsList = document.getElementById('active-events');
        this.museumNameDisplay = document.getElementById('museum-name');
        
        // 弹出框元素
        this.popupEventName = document.getElementById('popup-event-name');
        this.popupEventDesc = document.getElementById('popup-event-desc');
        
        // 游戏结束元素
        this.finalScore = document.getElementById('final-score');
        this.totalPenalties = document.getElementById('total-penalties');
        this.finalRating = document.getElementById('final-rating');
        this.statTotal = document.getElementById('stat-total');
        this.statResolved = document.getElementById('stat-resolved');
        this.statExpired = document.getElementById('stat-expired');
        this.statDispatches = document.getElementById('stat-dispatches');
        this.statLocks = document.getElementById('stat-locks');
        this.statPatrols = document.getElementById('stat-patrols');
        
        // 列表元素
        this.museumList = document.getElementById('museum-list');
        this.saveList = document.getElementById('save-list');
        this.importInput = document.getElementById('museum-json-input');
        
        // 通知
        this.notification = document.getElementById('notification');
        this.notificationText = document.getElementById('notification-text');
    }

    initEventListeners() {
        // 主菜单按钮
        document.getElementById('btn-new-game').addEventListener('click', () => this.showMuseumSelect());
        document.getElementById('btn-load-game').addEventListener('click', () => this.showSaveSelect());
        document.getElementById('btn-import-museum').addEventListener('click', () => this.showImportScreen());
        
        // 博物馆选择
        document.getElementById('btn-back-from-museum').addEventListener('click', () => this.showMainMenu());
        
        // 存档选择
        document.getElementById('btn-back-from-save').addEventListener('click', () => this.showMainMenu());
        
        // 导入屏幕
        document.getElementById('btn-confirm-import').addEventListener('click', () => this.importMuseum());
        document.getElementById('btn-back-from-import').addEventListener('click', () => this.showMainMenu());
        
        // 游戏控制
        document.getElementById('btn-pause').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-save').addEventListener('click', () => this.saveCurrentGame());
        
        // 暂停菜单
        document.getElementById('btn-resume').addEventListener('click', () => this.togglePause());
        document.getElementById('btn-quit').addEventListener('click', () => this.quitGame());
        
        // 事件弹出框
        document.getElementById('btn-dispatch').addEventListener('click', () => this.handleDispatch());
        document.getElementById('btn-lock').addEventListener('click', () => this.handleLock());
        document.getElementById('btn-close-popup').addEventListener('click', () => this.closeEventPopup());
        
        // 游戏结束
        document.getElementById('btn-export-md').addEventListener('click', () => this.exportMarkdown());
        document.getElementById('btn-export-json').addEventListener('click', () => this.exportJSON());
        document.getElementById('btn-back-to-menu').addEventListener('click', () => this.showMainMenu());
        document.getElementById('btn-play-again').addEventListener('click', () => this.showMuseumSelect());
        
        // 画布点击
        this.canvas.addEventListener('click', (e) => this.handleCanvasClick(e));
        
        // 键盘事件
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.gameState && this.gameState.status === 'active') {
                this.togglePause();
            }
        });
    }

    // 屏幕切换
    showMainMenu() {
        this.hideAllScreens();
        this.mainMenu.classList.remove('hidden');
        this.stopGameLoop();
    }

    async showMuseumSelect() {
        this.hideAllScreens();
        this.museumSelect.classList.remove('hidden');
        
        try {
            const museums = await API.getMuseums();
            this.renderMuseumList(museums);
        } catch (error) {
            this.showNotification('无法加载博物馆列表，请确保服务器已启动');
            console.error(error);
        }
    }

    async showSaveSelect() {
        this.hideAllScreens();
        this.saveSelect.classList.remove('hidden');
        
        try {
            const saves = await API.getSaves();
            this.renderSaveList(saves);
        } catch (error) {
            this.showNotification('无法加载存档列表');
            console.error(error);
        }
    }

    showImportScreen() {
        this.hideAllScreens();
        this.importScreen.classList.remove('hidden');
    }

    showGameScreen() {
        this.hideAllScreens();
        this.gameScreen.classList.remove('hidden');
    }

    showGameOverScreen() {
        this.hideAllScreens();
        this.gameOverScreen.classList.remove('hidden');
        this.renderGameOver();
    }

    hideAllScreens() {
        this.mainMenu.classList.add('hidden');
        this.museumSelect.classList.add('hidden');
        this.saveSelect.classList.add('hidden');
        this.importScreen.classList.add('hidden');
        this.gameScreen.classList.add('hidden');
        this.gameOverScreen.classList.add('hidden');
        this.pauseMenu.classList.add('hidden');
        this.mapOverlay.style.display = 'none';
    }

    // 列表渲染
    renderMuseumList(museums) {
        this.museumList.innerHTML = '';
        
        if (museums.length === 0) {
            this.museumList.innerHTML = '<div class="no-events">暂无可用馆区数据</div>';
            return;
        }

        museums.forEach(museum => {
            const item = document.createElement('div');
            item.className = 'museum-item';
            item.innerHTML = `
                <div class="museum-item-name">${museum.name}</div>
                <div style="color: #888; font-size: 0.85rem;">文件: ${museum.filename}</div>
            `;
            item.addEventListener('click', () => this.startNewGame(museum.filename));
            this.museumList.appendChild(item);
        });
    }

    renderSaveList(saves) {
        this.saveList.innerHTML = '';
        
        if (saves.length === 0) {
            this.saveList.innerHTML = '<div class="no-events">暂无存档</div>';
            return;
        }

        saves.forEach(save => {
            const item = document.createElement('div');
            item.className = 'save-item';
            const savedDate = new Date(save.savedAt).toLocaleString();
            const timeFormatted = this.formatTime(save.elapsedTime);
            
            item.innerHTML = `
                <div class="museum-item-name">${save.name}</div>
                <div class="save-item-info">
                    <span>时间: ${timeFormatted}</span>
                    <span>得分: ${save.score}</span>
                </div>
                <div style="color: #888; font-size: 0.75rem; margin-top: 5px;">
                    保存时间: ${savedDate}
                </div>
            `;
            item.addEventListener('click', () => this.loadGame(save.id));
            this.saveList.appendChild(item);
        });
    }

    // 游戏控制
    async startNewGame(museumFile) {
        try {
            this.showNotification('正在初始化游戏...');
            const result = await API.initGame(museumFile);
            this.gameId = result.gameId;
            this.gameState = result.state;
            this.currentMuseumFile = museumFile;
            
            this.showGameScreen();
            this.startGameLoop();
            this.updateUI();
            this.renderMap();
            this.showNotification('游戏开始！');
        } catch (error) {
            this.showNotification('启动游戏失败');
            console.error(error);
        }
    }

    async loadGame(saveId) {
        try {
            this.showNotification('正在加载存档...');
            const result = await API.loadGame(saveId);
            this.gameId = result.gameId;
            this.gameState = result.state;
            
            this.showGameScreen();
            this.startGameLoop();
            this.updateUI();
            this.renderMap();
            this.showNotification('存档加载成功！');
        } catch (error) {
            this.showNotification('加载存档失败');
            console.error(error);
        }
    }

    startGameLoop() {
        this.isPaused = false;
        if (this.gameLoop) clearInterval(this.gameLoop);
        
        this.gameLoop = setInterval(async () => {
            if (!this.isPaused && this.gameState && this.gameState.status === 'active') {
                try {
                    const result = await API.tickGame(this.gameId, 1);
                    this.gameState = result.state;
                    
                    if (result.gameEnded) {
                        this.stopGameLoop();
                        this.showGameOverScreen();
                    } else {
                        this.updateUI();
                        this.renderMap();
                    }
                } catch (error) {
                    console.error('游戏循环错误:', error);
                }
            }
        }, CONFIG.GAME_TICK_INTERVAL);
    }

    stopGameLoop() {
        if (this.gameLoop) {
            clearInterval(this.gameLoop);
            this.gameLoop = null;
        }
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        if (this.isPaused) {
            this.pauseMenu.classList.remove('hidden');
        } else {
            this.pauseMenu.classList.add('hidden');
        }
    }

    async saveCurrentGame() {
        try {
            const saveName = `save-${Date.now()}`;
            await API.saveGame(this.gameId, saveName);
            this.showNotification('游戏已保存！');
        } catch (error) {
            this.showNotification('保存失败');
            console.error(error);
        }
    }

    quitGame() {
        this.stopGameLoop();
        this.showMainMenu();
    }

    // UI更新
    updateUI() {
        if (!this.gameState) return;
        
        const state = this.gameState;
        
        // 更新时间
        this.timeDisplay.textContent = this.formatTime(state.elapsedTime);
        
        // 更新分数
        this.scoreDisplay.textContent = state.score;
        
        // 更新体力
        const staminaPercent = (state.player.stamina / state.settings.initialStamina) * 100;
        this.staminaBar.style.width = `${staminaPercent}%`;
        this.staminaValue.textContent = state.player.stamina;
        
        // 更新资源
        this.guardsCount.textContent = state.resources.availableGuards;
        this.locksCount.textContent = state.resources.availableLocks;
        
        // 更新当前位置
        const currentPatrolPoint = state.museum.patrolPoints.find(
            p => p.id === state.player.currentPatrolPoint
        );
        this.currentLocation.textContent = currentPatrolPoint?.name || '未知位置';
        
        // 更新博物馆名称
        this.museumNameDisplay.textContent = state.museum.name;
        
        // 更新事件列表
        this.updateEventsList();
        
        // 动画帧
        this.animationFrame++;
    }

    updateEventsList() {
        const activeEvents = this.gameState.events.filter(e => e.status === 'active');
        
        if (activeEvents.length === 0) {
            this.activeEventsList.innerHTML = '<div class="no-events">暂无活跃事件</div>';
            return;
        }

        this.activeEventsList.innerHTML = activeEvents.map(event => {
            const severity = event.type.severity;
            const timeLeft = Math.max(0, event.timeToLive);
            
            return `
                <div class="event-item ${severity}" data-event-id="${event.id}">
                    <div class="event-name">${event.type.name}</div>
                    <div class="event-time">剩余时间: ${timeLeft}秒</div>
                </div>
            `;
        }).join('');

        // 添加点击事件
        this.activeEventsList.querySelectorAll('.event-item').forEach(item => {
            item.addEventListener('click', () => {
                const eventId = item.dataset.eventId;
                this.selectEvent(eventId);
            });
        });
    }

    // 地图渲染
    renderMap() {
        const ctx = this.ctx;
        const state = this.gameState;
        const museum = state.museum;
        
        // 清除画布
        ctx.fillStyle = CONFIG.COLORS.background;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // 绘制展区
        museum.zones.forEach(zone => {
            const { x, y, width, height } = zone.position;
            
            // 填充
            ctx.fillStyle = zone.type === 'temporary' 
                ? CONFIG.COLORS.zoneTemporary 
                : CONFIG.COLORS.zonePermanent;
            ctx.fillRect(x, y, width, height);
            
            // 边框
            ctx.strokeStyle = zone.type === 'temporary'
                ? CONFIG.COLORS.zoneTemporaryBorder
                : CONFIG.COLORS.zonePermanentBorder;
            ctx.lineWidth = 2;
            ctx.strokeRect(x, y, width, height);
            
            // 标签
            ctx.fillStyle = CONFIG.COLORS.text;
            ctx.font = '12px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(zone.name, x + width / 2, y + 15);
        });
        
        // 绘制盲区
        museum.zones.forEach(zone => {
            zone.blindSpots.forEach(spot => {
                ctx.fillStyle = CONFIG.COLORS.blindSpot;
                ctx.beginPath();
                ctx.arc(spot.position.x, spot.position.y, spot.size, 0, Math.PI * 2);
                ctx.fill();
                
                // 标签
                ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
                ctx.font = '10px Microsoft YaHei';
                ctx.textAlign = 'center';
                ctx.fillText('盲区', spot.position.x, spot.position.y + 4);
            });
        });
        
        // 绘制摄像头
        museum.zones.forEach(zone => {
            zone.cameras.forEach(camera => {
                // 摄像头图标
                ctx.fillStyle = CONFIG.COLORS.camera;
                ctx.beginPath();
                ctx.arc(camera.position.x, camera.position.y, 6, 0, Math.PI * 2);
                ctx.fill();
                
                // 视野范围
                ctx.strokeStyle = 'rgba(255, 204, 0, 0.2)';
                ctx.lineWidth = 1;
                ctx.beginPath();
                ctx.arc(camera.position.x, camera.position.y, camera.coverage / 2, 0, Math.PI * 2);
                ctx.stroke();
            });
        });
        
        // 绘制门
        museum.doors.forEach(door => {
            ctx.fillStyle = door.isAccessControl ? '#e94560' : '#4a90d9';
            ctx.fillRect(door.position.x - 15, door.position.y - 5, 30, 10);
            
            // 标签
            ctx.fillStyle = CONFIG.COLORS.text;
            ctx.font = '10px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(door.name, door.position.x, door.position.y + 20);
            
            if (door.isAccessControl) {
                ctx.fillStyle = '#ffcc00';
                ctx.fillText('🔐', door.position.x, door.position.y - 8);
            }
        });
        
        // 绘制巡逻点
        museum.patrolPoints.forEach(point => {
            const isCurrent = point.id === state.player.currentPatrolPoint;
            const isBase = point.isBase;
            
            // 绘制圆形
            ctx.fillStyle = isBase ? CONFIG.COLORS.basePoint : CONFIG.COLORS.patrolPoint;
            ctx.beginPath();
            ctx.arc(point.position.x, point.position.y, isCurrent ? 15 : 12, 0, Math.PI * 2);
            ctx.fill();
            
            // 边框
            if (isCurrent) {
                ctx.strokeStyle = '#fff';
                ctx.lineWidth = 3;
                ctx.stroke();
            }
            
            // 标签
            ctx.fillStyle = CONFIG.COLORS.text;
            ctx.font = '10px Microsoft YaHei';
            ctx.textAlign = 'center';
            ctx.fillText(point.name, point.position.x, point.position.y + 25);
            
            if (isBase) {
                ctx.fillStyle = '#000';
                ctx.font = '12px Microsoft YaHei';
                ctx.fillText('🏠', point.position.x, point.position.y + 5);
            }
        });
        
        // 绘制玩家（当前位置）
        const playerPos = state.player.position;
        const pulse = Math.sin(this.animationFrame * 0.1) * 3;
        
        ctx.fillStyle = CONFIG.COLORS.player;
        ctx.beginPath();
        ctx.arc(playerPos.x, playerPos.y, 10 + pulse, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 玩家图标
        ctx.fillStyle = '#000';
        ctx.font = '14px Microsoft YaHei';
        ctx.textAlign = 'center';
        ctx.fillText('👮', playerPos.x, playerPos.y + 5);
        
        // 绘制事件
        state.events.filter(e => e.status === 'active').forEach(event => {
            this.renderEvent(event);
        });
    }

    renderEvent(event) {
        const ctx = this.ctx;
        const severity = event.type.severity;
        const pulse = Math.sin(this.animationFrame * 0.15) * 5;
        
        let color;
        switch (severity) {
            case 'critical':
                color = CONFIG.COLORS.eventCritical;
                break;
            case 'high':
                color = CONFIG.COLORS.eventHigh;
                break;
            default:
                color = CONFIG.COLORS.eventMedium;
        }
        
        // 外圈脉冲
        ctx.fillStyle = color + '33';
        ctx.beginPath();
        ctx.arc(event.location.x, event.location.y, 25 + pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // 内圈
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(event.location.x, event.location.y, 18, 0, Math.PI * 2);
        ctx.fill();
        
        // 边框
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // 图标
        ctx.fillStyle = '#fff';
        ctx.font = '16px Microsoft YaHei';
        ctx.textAlign = 'center';
        
        let icon = '⚠️';
        if (event.type.id === 'glass_vibration') icon = '📦';
        else if (event.type.id === 'access_card_anomaly') icon = '🔐';
        else if (event.type.id === 'camera_blind_spot') icon = '📷';
        else if (event.type.id === 'security_breach') icon = '🚨';
        
        ctx.fillText(icon, event.location.x, event.location.y + 6);
        
        // 倒计时
        const timeLeft = Math.max(0, event.timeToLive);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px Microsoft YaHei';
        ctx.fillText(`${timeLeft}s`, event.location.x, event.location.y + 30);
    }

    // 交互处理
    handleCanvasClick(e) {
        if (this.isPaused || !this.gameState) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const state = this.gameState;
        
        // 检查是否点击了事件
        const clickedEvent = state.events.find(event => {
            if (event.status !== 'active') return false;
            const dx = x - event.location.x;
            const dy = y - event.location.y;
            return Math.sqrt(dx * dx + dy * dy) < 25;
        });
        
        if (clickedEvent) {
            this.selectEvent(clickedEvent.id);
            return;
        }
        
        // 检查是否点击了巡逻点
        const clickedPatrolPoint = state.museum.patrolPoints.find(point => {
            const dx = x - point.position.x;
            const dy = y - point.position.y;
            return Math.sqrt(dx * dx + dy * dy) < 15;
        });
        
        if (clickedPatrolPoint && clickedPatrolPoint.id !== state.player.currentPatrolPoint) {
            this.moveToPatrolPoint(clickedPatrolPoint.id);
        }
    }

    async moveToPatrolPoint(patrolPointId) {
        try {
            const result = await API.movePlayer(this.gameId, patrolPointId);
            if (result.success) {
                this.gameState = result.state;
                this.updateUI();
                this.renderMap();
                
                const point = this.gameState.museum.patrolPoints.find(p => p.id === patrolPointId);
                this.showNotification(`已移动到: ${point?.name}`);
            }
        } catch (error) {
            if (error.message?.includes('体力不足')) {
                this.showNotification('体力不足！请返回中控室恢复体力');
            } else {
                this.showNotification('移动失败');
            }
            console.error(error);
        }
    }

    selectEvent(eventId) {
        const event = this.gameState.events.find(e => e.id === eventId);
        if (!event || event.status !== 'active') return;
        
        this.selectedEvent = event;
        
        // 更新弹出框
        this.popupEventName.textContent = event.type.name;
        this.popupEventDesc.textContent = event.type.description;
        
        // 更新按钮状态
        const btnDispatch = document.getElementById('btn-dispatch');
        const btnLock = document.getElementById('btn-lock');
        
        btnDispatch.disabled = this.gameState.resources.availableGuards <= 0;
        btnLock.disabled = this.gameState.resources.availableLocks <= 0;
        
        // 显示弹出框
        this.mapOverlay.style.display = 'flex';
    }

    closeEventPopup() {
        this.selectedEvent = null;
        this.mapOverlay.style.display = 'none';
    }

    async handleDispatch() {
        if (!this.selectedEvent) return;
        
        try {
            const result = await API.dispatchGuard(this.gameId, this.selectedEvent.id);
            if (result.success) {
                this.gameState = result.state;
                this.showNotification(`派遣保安成功！+${result.scoreGain}分`);
                this.closeEventPopup();
                this.updateUI();
                this.renderMap();
            }
        } catch (error) {
            this.showNotification('派遣失败');
            console.error(error);
        }
    }

    async handleLock() {
        if (!this.selectedEvent) return;
        
        try {
            const result = await API.lockZone(this.gameId, this.selectedEvent.id);
            if (result.success) {
                this.gameState = result.state;
                this.showNotification(`区域封锁成功！+${result.scoreGain}分`);
                this.closeEventPopup();
                this.updateUI();
                this.renderMap();
            }
        } catch (error) {
            this.showNotification('锁区失败');
            console.error(error);
        }
    }

    // 导入导出
    async importMuseum() {
        const jsonText = this.importInput.value.trim();
        if (!jsonText) {
            this.showNotification('请输入JSON数据');
            return;
        }
        
        try {
            const museumData = JSON.parse(jsonText);
            const name = museumData.museum?.name || `custom-${Date.now()}`;
            
            const result = await API.uploadMuseum(museumData, name);
            this.showNotification(`成功导入馆区: ${result.museumName}`);
            this.showMuseumSelect();
        } catch (error) {
            this.showNotification('导入失败，请检查JSON格式');
            console.error(error);
        }
    }

    async exportMarkdown() {
        try {
            const result = await API.exportReport(this.gameId);
            
            // 创建下载链接
            const blob = new Blob([result.markdown.content], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${result.reportId}.md`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('Markdown复盘已导出！');
        } catch (error) {
            this.showNotification('导出失败');
            console.error(error);
        }
    }

    async exportJSON() {
        try {
            const result = await API.exportReport(this.gameId);
            
            // 创建下载链接
            const blob = new Blob([JSON.stringify(result.json.content, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `${result.reportId}.json`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showNotification('JSON事件记录已导出！');
        } catch (error) {
            this.showNotification('导出失败');
            console.error(error);
        }
    }

    // 游戏结束
    renderGameOver() {
        const state = this.gameState;
        const actions = state.actions || [];
        
        // 计算统计
        const resolvedEvents = state.resolvedEvents || [];
        const totalEvents = resolvedEvents.length;
        const resolvedOnTime = resolvedEvents.filter(e => e.status === 'resolved').length;
        const expiredEvents = resolvedEvents.filter(e => e.status === 'expired').length;
        const dispatches = actions.filter(a => a.type === 'dispatch_guard').length;
        const locks = actions.filter(a => a.type === 'lock_zone').length;
        const patrols = actions.filter(a => a.type === 'patrol').length;
        
        // 计算评级
        let rating = 'D';
        if (totalEvents > 0) {
            const successRate = resolvedOnTime / totalEvents;
            if (successRate >= 0.9) rating = 'S';
            else if (successRate >= 0.75) rating = 'A';
            else if (successRate >= 0.5) rating = 'B';
            else if (successRate >= 0.3) rating = 'C';
        }
        
        // 更新UI
        this.finalScore.textContent = state.score;
        this.totalPenalties.textContent = state.penalties;
        this.finalRating.textContent = rating;
        
        this.statTotal.textContent = totalEvents;
        this.statResolved.textContent = resolvedOnTime;
        this.statExpired.textContent = expiredEvents;
        this.statDispatches.textContent = dispatches;
        this.statLocks.textContent = locks;
        this.statPatrols.textContent = patrols;
    }

    // 工具方法
    formatTime(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }

    showNotification(message) {
        this.notificationText.textContent = message;
        this.notification.classList.remove('hidden');
        
        setTimeout(() => {
            this.notification.classList.add('hidden');
        }, 3000);
    }
}

// 初始化游戏
document.addEventListener('DOMContentLoaded', () => {
    new MuseumSecurityGame();
});
