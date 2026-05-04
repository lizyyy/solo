const UI = {
    elements: {},

    init() {
        this.elements = {
            startScreen: document.getElementById('start-screen'),
            gameScreen: document.getElementById('game-screen'),
            resultScreen: document.getElementById('result-screen'),
            replayScreen: document.getElementById('replay-screen'),
            
            playerName: document.getElementById('player-name'),
            modeSimulated: document.getElementById('mode-simulated'),
            modeReal: document.getElementById('mode-real'),
            levelList: document.getElementById('level-list'),
            startBtn: document.getElementById('start-btn'),
            
            currentLevel: document.getElementById('current-level'),
            currentScore: document.getElementById('current-score'),
            countdown: document.getElementById('countdown'),
            statusMessage: document.getElementById('status-message'),
            driftIndicator: document.getElementById('drift-indicator'),
            
            radarCanvas: document.getElementById('radar-canvas'),
            directionArrow: document.getElementById('direction-arrow'),
            directionText: document.getElementById('direction-text'),
            distanceValue: document.getElementById('distance-value'),
            
            spotsFound: document.getElementById('spots-found'),
            spotsTotal: document.getElementById('spots-total'),
            
            sampleBtn: document.getElementById('sample-btn'),
            itemBtn: document.getElementById('item-btn'),
            itemCount: document.getElementById('item-count'),
            calibrateBtn: document.getElementById('calibrate-btn'),
            
            simulatedMap: document.getElementById('simulated-map'),
            mapCanvas: document.getElementById('map-canvas'),
            closeMapBtn: document.getElementById('close-map-btn'),
            
            resultIcon: document.getElementById('result-icon'),
            resultTitle: document.getElementById('result-title'),
            finalScore: document.getElementById('final-score'),
            finalFound: document.getElementById('final-found'),
            finalTotal: document.getElementById('final-total'),
            finalSamples: document.getElementById('final-samples'),
            replayBtn: document.getElementById('replay-btn'),
            exportBtn: document.getElementById('export-btn'),
            restartBtn: document.getElementById('restart-btn'),
            
            replayPlay: document.getElementById('replay-play'),
            replayPause: document.getElementById('replay-pause'),
            replayProgress: document.getElementById('replay-progress'),
            replayCanvas: document.getElementById('replay-canvas'),
            sampleList: document.getElementById('sample-list'),
            closeReplayBtn: document.getElementById('close-replay-btn'),
            
            toast: document.getElementById('toast')
        };
        
        this.setupEventListeners();
    },

    setupEventListeners() {
        this.elements.modeSimulated.addEventListener('click', () => {
            Game.setLocationMode('simulated');
            this.updateModeButtons('simulated');
        });
        
        this.elements.modeReal.addEventListener('click', () => {
            Game.setLocationMode('real');
            this.updateModeButtons('real');
        });
        
        this.elements.startBtn.addEventListener('click', this.handleStartGame.bind(this));
        
        this.elements.sampleBtn.addEventListener('click', this.handleSample.bind(this));
        this.elements.itemBtn.addEventListener('click', this.handleUseItem.bind(this));
        this.elements.calibrateBtn.addEventListener('click', this.handleCalibrate.bind(this));
        
        this.elements.closeMapBtn.addEventListener('click', () => {
            this.elements.simulatedMap.classList.add('hidden');
        });
        
        this.elements.replayBtn.addEventListener('click', this.handleShowReplay.bind(this));
        this.elements.exportBtn.addEventListener('click', this.handleExport.bind(this));
        this.elements.restartBtn.addEventListener('click', () => {
            this.showScreen('start');
        });
        
        this.elements.replayPlay.addEventListener('click', () => {
            Game.startReplay();
        });
        this.elements.replayPause.addEventListener('click', () => {
            Game.pauseReplay();
        });
        this.elements.closeReplayBtn.addEventListener('click', () => {
            Game.pauseReplay();
            this.showScreen('result');
        });
        
        this.elements.mapCanvas.addEventListener('click', this.handleMapClick.bind(this));
    },

    updateModeButtons(mode) {
        this.elements.modeSimulated.classList.toggle('active', mode === 'simulated');
        this.elements.modeReal.classList.toggle('active', mode === 'real');
    },

    showScreen(screenName) {
        const screens = ['start', 'game', 'result', 'replay'];
        screens.forEach(name => {
            const screen = document.getElementById(`${name}-screen`);
            screen.classList.toggle('active', name === screenName);
        });
    },

    renderLevels(levels) {
        this.elements.levelList.innerHTML = '';
        
        levels.forEach(level => {
            const card = document.createElement('div');
            card.className = 'level-card';
            card.innerHTML = `
                <h3>${level.name}</h3>
                <p>${level.description}</p>
                <div class="level-meta">
                    <span>🗺️ ${level.hidingSpots ? level.hidingSpots.length : 3} 个藏身点</span>
                    <span>⏱️ ${level.config.timeLimit} 秒</span>
                </div>
            `;
            
            card.addEventListener('click', () => {
                Game.selectLevel(level.id);
                document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
            });
            
            this.elements.levelList.appendChild(card);
        });
    },

    async handleStartGame() {
        const playerName = this.elements.playerName.value.trim();
        if (!playerName) {
            this.showToast('请输入玩家名称', 'error');
            return;
        }
        
        if (!Game.state.selectedLevel) {
            this.showToast('请选择一个关卡', 'error');
            return;
        }
        
        try {
            this.elements.startBtn.disabled = true;
            this.elements.startBtn.textContent = '创建游戏中...';
            
            await Game.createGame(playerName);
            
            this.showScreen('game');
            this.updateGameUI();
            this.initRadar();
            
            await Game.startGame();
            
            if (Game.state.locationMode === 'simulated') {
                this.elements.simulatedMap.classList.remove('hidden');
                this.initMap();
            }
            
            this.showToast('游戏开始！寻找藏身点吧！', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            this.elements.startBtn.disabled = false;
            this.elements.startBtn.textContent = '开始新游戏';
        }
    },

    async handleSample() {
        if (Game.state.locationMode === 'simulated' && !Game.state.currentPosition) {
            this.elements.simulatedMap.classList.remove('hidden');
            this.initMap();
            this.showToast('请在地图上点击设置位置', 'warning');
            return;
        }
        
        try {
            this.elements.sampleBtn.disabled = true;
            this.elements.statusMessage.textContent = '采样中...';
            
            const result = await Game.submitLocationSample();
            
            this.updateSampleResult(result);
            
            if (result.hit) {
                this.showToast(`找到 ${result.hit.spot.name}！+${result.hit.points} 分`, 'success');
                
                const game = Game.state.currentGame;
                const totalSpots = game.level.hidingSpots.length;
                const foundSpots = Game.state.hitSpots.length;
                
                this.elements.spotsFound.textContent = foundSpots;
                this.elements.currentScore.textContent = game.score;
                
                if (foundSpots >= totalSpots) {
                    this.showToast('恭喜！你找到了所有藏身点！', 'success');
                }
            }
        } catch (error) {
            this.showToast(error.message, 'error');
        } finally {
            this.elements.sampleBtn.disabled = false;
        }
    },

    async handleUseItem() {
        if (Game.state.expandScanUsed) {
            this.showToast('道具已使用', 'warning');
            return;
        }
        
        try {
            const result = await Game.useExpandScan();
            this.elements.itemCount.textContent = '0';
            this.elements.itemBtn.disabled = true;
            this.showToast(result.effect, 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    handleCalibrate() {
        if (Game.state.locationMode !== 'real') {
            this.showToast('只有真实GPS模式才能校准', 'warning');
            return;
        }
        this.showToast('请走到已知位置，然后点击地图上对应位置进行校准', 'info');
        this.elements.simulatedMap.classList.remove('hidden');
        this.initMap();
    },

    async handleShowReplay() {
        try {
            const gameId = Game.state.currentGame.id;
            await Game.loadReplay(gameId);
            
            this.showScreen('replay');
            this.initReplayCanvas();
            this.renderSampleList(Game.state.replayData);
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    async handleExport() {
        try {
            const markdown = await Game.exportReport('markdown');
            
            const blob = new Blob([markdown], { type: 'text/markdown' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `game-report-${Game.state.currentGame.id}.md`;
            a.click();
            URL.revokeObjectURL(url);
            
            this.showToast('报告已导出', 'success');
        } catch (error) {
            this.showToast(error.message, 'error');
        }
    },

    handleMapClick(event) {
        const canvas = this.elements.mapCanvas;
        const rect = canvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        
        const game = Game.state.currentGame;
        if (!game) return;
        
        const level = game.level;
        const scale = Math.min(canvas.width, canvas.height) / 2 / level.radius * 0.9;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        
        const dx = (x - centerX) / scale;
        const dy = (y - centerY) / scale;
        
        const lat = level.center_lat - dy / 111000;
        const lng = level.center_lng + dx / (111000 * Math.cos(Game.toRadians(level.center_lat)));
        
        Game.setSimulatedPosition(lat, lng);
        this.drawMap();
        
        this.showToast('位置已设置', 'success');
    },

    updateGameUI() {
        const game = Game.state.currentGame;
        if (!game) return;
        
        this.elements.currentLevel.textContent = game.level.name;
        this.elements.currentScore.textContent = '0';
        this.elements.spotsFound.textContent = '0';
        this.elements.spotsTotal.textContent = game.level.hidingSpots.length;
        this.elements.itemCount.textContent = '1';
        this.elements.itemBtn.disabled = false;
    },

    updateTimer(seconds) {
        const minutes = Math.floor(seconds / 60);
        const secs = seconds % 60;
        this.elements.countdown.textContent = `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        
        this.elements.countdown.classList.remove('warning', 'danger');
        if (seconds <= 30) {
            this.elements.countdown.classList.add('danger');
        } else if (seconds <= 60) {
            this.elements.countdown.classList.add('warning');
        }
    },

    updateSampleResult(result) {
        const sample = result.sample;
        const nearestSpot = result.nearestSpot;
        
        if (sample.driftLevel === 'high' || sample.inInterferenceZone) {
            this.elements.driftIndicator.classList.remove('hidden');
            if (sample.inInterferenceZone) {
                this.elements.statusMessage.textContent = `进入干扰区: ${sample.interferenceZoneName}`;
            } else {
                this.elements.statusMessage.textContent = '信号不稳定，注意观察';
            }
        } else {
            this.elements.driftIndicator.classList.add('hidden');
            this.elements.statusMessage.textContent = '信号正常';
        }
        
        if (sample.isSuspicious) {
            this.showToast('检测到异常跳点，已标记', 'warning');
        }
        
        if (nearestSpot) {
            this.elements.distanceValue.textContent = Math.round(nearestSpot.distance);
            this.elements.directionText.textContent = nearestSpot.direction;
            this.elements.directionArrow.style.transform = `rotate(${nearestSpot.bearing}deg)`;
            this.updateRadar(nearestSpot.distance, sample);
        }
    },

    updateResult(game, sampleCount) {
        const isWon = game.status === 'won';
        
        this.elements.resultIcon.textContent = isWon ? '🎉' : '😢';
        this.elements.resultTitle.textContent = isWon ? '恭喜获胜！' : '时间到了';
        this.elements.finalScore.textContent = game.score;
        this.elements.finalFound.textContent = Game.state.hitSpots.length;
        this.elements.finalTotal.textContent = game.level.hidingSpots.length;
        this.elements.finalSamples.textContent = sampleCount;
    },

    initRadar() {
        const canvas = this.elements.radarCanvas;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight;
        
        this.drawRadarBackground();
    },

    drawRadarBackground() {
        const canvas = this.elements.radarCanvas;
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const radius = Math.min(centerX, centerY) - 20;
        
        ctx.fillStyle = '#0a1628';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        for (let i = 1; i <= 4; i++) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, radius * i / 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#1a3a5c';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
        
        for (let i = 0; i < 8; i++) {
            const angle = (i * Math.PI) / 4;
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.lineTo(
                centerX + Math.cos(angle) * radius,
                centerY + Math.sin(angle) * radius
            );
            ctx.strokeStyle = '#1a3a5c';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    },

    updateRadar(distance, sample) {
        this.drawRadarBackground();
        
        const canvas = this.elements.radarCanvas;
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const maxRadius = Math.min(centerX, centerY) - 20;
        
        const game = Game.state.currentGame;
        if (!game) return;
        
        const config = game.level.config;
        const maxDistance = config.scanRadius * 20;
        const scale = maxRadius / maxDistance;
        
        const spotDistance = Math.min(distance, maxDistance);
        const displayRadius = spotDistance * scale;
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, 5, 0, Math.PI * 2);
        ctx.fillStyle = '#4a90d9';
        ctx.fill();
        
        const scanRadius = (Game.state.expandScanUsed ? config.scanRadius * 2 : config.scanRadius) * scale;
        ctx.beginPath();
        ctx.arc(centerX, centerY, scanRadius, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        if (sample.driftAmount > 3) {
            ctx.beginPath();
            ctx.arc(centerX, centerY, sample.driftAmount * scale, 0, Math.PI * 2);
            ctx.strokeStyle = 'rgba(250, 173, 20, 0.3)';
            ctx.lineWidth = 1;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        }
        
        const time = Date.now() / 1000;
        const scanAngle = (time * 2) % (Math.PI * 2);
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.lineTo(
            centerX + Math.cos(scanAngle) * maxRadius,
            centerY + Math.sin(scanAngle) * maxRadius
        );
        ctx.strokeStyle = 'rgba(0, 255, 136, 0.8)';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, maxRadius);
        gradient.addColorStop(0, 'rgba(0, 255, 136, 0.3)');
        gradient.addColorStop(1, 'rgba(0, 255, 136, 0)');
        
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, maxRadius, scanAngle - 0.3, scanAngle);
        ctx.closePath();
        ctx.fillStyle = gradient;
        ctx.fill();
    },

    initMap() {
        const canvas = this.elements.mapCanvas;
        const container = canvas.parentElement;
        
        canvas.width = container.clientWidth;
        canvas.height = container.clientHeight - 100;
        
        this.drawMap();
    },

    drawMap() {
        const canvas = this.elements.mapCanvas;
        const ctx = canvas.getContext('2d');
        const game = Game.state.currentGame;
        
        if (!game) return;
        
        const level = game.level;
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = Math.min(centerX, centerY) / level.radius * 0.9;
        
        ctx.fillStyle = '#f0f5f9';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, level.radius * scale, 0, Math.PI * 2);
        ctx.strokeStyle = '#4a90d9';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        level.interferenceZones.forEach(zone => {
            const x = centerX + (zone.lng - level.center_lng) * 111000 * Math.cos(Game.toRadians(level.center_lat)) * scale;
            const y = centerY - (zone.lat - level.center_lat) * 111000 * scale;
            
            ctx.beginPath();
            ctx.arc(x, y, zone.radius * scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(250, 173, 20, 0.2)';
            ctx.fill();
            ctx.strokeStyle = '#faad14';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            ctx.fillStyle = '#faad14';
            ctx.font = '12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText(zone.name, x, y - zone.radius * scale - 5);
        });
        
        level.hidingSpots.forEach(spot => {
            const x = centerX + (spot.lng - level.center_lng) * 111000 * Math.cos(Game.toRadians(level.center_lat)) * scale;
            const y = centerY - (spot.lat - level.center_lat) * 111000 * scale;
            
            const isFound = Game.state.hitSpots.includes(spot.id);
            
            ctx.beginPath();
            ctx.arc(x, y, spot.radius * scale, 0, Math.PI * 2);
            
            if (isFound) {
                ctx.fillStyle = 'rgba(82, 196, 26, 0.3)';
                ctx.fill();
                ctx.strokeStyle = '#52c41a';
            } else {
                ctx.fillStyle = 'rgba(255, 77, 79, 0.1)';
                ctx.strokeStyle = 'rgba(255, 77, 79, 0.5)';
            }
            ctx.lineWidth = 2;
            ctx.stroke();
            
            if (isFound) {
                ctx.fillStyle = '#52c41a';
                ctx.font = '11px sans-serif';
                ctx.textAlign = 'center';
                ctx.fillText(spot.name, x, y + 4);
            }
        });
        
        if (Game.state.currentPosition) {
            const pos = Game.state.currentPosition;
            const x = centerX + (pos.lng - level.center_lng) * 111000 * Math.cos(Game.toRadians(level.center_lat)) * scale;
            const y = centerY - (pos.lat - level.center_lat) * 111000 * scale;
            
            ctx.beginPath();
            ctx.arc(x, y, pos.accuracy * scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(74, 144, 217, 0.2)';
            ctx.fill();
            
            ctx.beginPath();
            ctx.arc(x, y, 8, 0, Math.PI * 2);
            ctx.fillStyle = '#4a90d9';
            ctx.fill();
            ctx.strokeStyle = '#fff';
            ctx.lineWidth = 2;
            ctx.stroke();
        }
    },

    initReplayCanvas() {
        const canvas = this.elements.replayCanvas;
        const ctx = canvas.getContext('2d');
        const container = canvas.parentElement;
        
        canvas.width = container.clientWidth;
        canvas.height = canvas.width;
        
        this.drawReplayBackground();
    },

    drawReplayBackground() {
        const canvas = this.elements.replayCanvas;
        const ctx = canvas.getContext('2d');
        const replay = Game.state.replayData;
        
        if (!replay) return;
        
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = Math.min(centerX, centerY) / replay.level.radius * 0.9;
        
        ctx.fillStyle = '#0a1628';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        
        ctx.beginPath();
        ctx.arc(centerX, centerY, replay.level.radius * scale, 0, Math.PI * 2);
        ctx.strokeStyle = '#1a3a5c';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        replay.level.interferenceZones.forEach(zone => {
            const x = centerX + (zone.lng - replay.level.center.lng) * 111000 * Math.cos(Game.toRadians(replay.level.center.lat)) * scale;
            const y = centerY - (zone.lat - replay.level.center.lat) * 111000 * scale;
            
            ctx.beginPath();
            ctx.arc(x, y, zone.radius * scale, 0, Math.PI * 2);
            ctx.fillStyle = 'rgba(250, 173, 20, 0.15)';
            ctx.fill();
        });
        
        replay.level.hidingSpots.forEach(spot => {
            const x = centerX + (spot.lng - replay.level.center.lng) * 111000 * Math.cos(Game.toRadians(replay.level.center.lat)) * scale;
            const y = centerY - (spot.lat - replay.level.center.lat) * 111000 * scale;
            
            const isHit = replay.hits.some(h => h.spot_id === spot.id);
            
            ctx.beginPath();
            ctx.arc(x, y, spot.radius * scale, 0, Math.PI * 2);
            ctx.fillStyle = isHit ? 'rgba(82, 196, 26, 0.3)' : 'rgba(255, 77, 79, 0.2)';
            ctx.fill();
            ctx.strokeStyle = isHit ? '#52c41a' : '#ff4d4f';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    },

    updateReplayDisplay(sample, index, replay) {
        this.elements.replayProgress.textContent = `${index + 1} / ${replay.samples.length}`;
        
        this.drawReplayBackground();
        
        const canvas = this.elements.replayCanvas;
        const ctx = canvas.getContext('2d');
        const centerX = canvas.width / 2;
        const centerY = canvas.height / 2;
        const scale = Math.min(centerX, centerY) / replay.level.radius * 0.9;
        
        if (index > 0) {
            ctx.beginPath();
            ctx.strokeStyle = 'rgba(74, 144, 217, 0.5)';
            ctx.lineWidth = 2;
            
            for (let i = 0; i <= index; i++) {
                const s = replay.samples[i];
                const x = centerX + (s.noisy.lng - replay.level.center.lng) * 111000 * Math.cos(Game.toRadians(replay.level.center.lat)) * scale;
                const y = centerY - (s.noisy.lat - replay.level.center.lat) * 111000 * scale;
                
                if (i === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.stroke();
        }
        
        const x = centerX + (sample.noisy.lng - replay.level.center.lng) * 111000 * Math.cos(Game.toRadians(replay.level.center.lat)) * scale;
        const y = centerY - (sample.noisy.lat - replay.level.center.lat) * 111000 * scale;
        
        ctx.beginPath();
        ctx.arc(x, y, sample.accuracy * scale, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(74, 144, 217, 0.2)';
        ctx.fill();
        
        ctx.beginPath();
        ctx.arc(x, y, 6, 0, Math.PI * 2);
        ctx.fillStyle = sample.isHit ? '#52c41a' : (sample.isSuspicious ? '#ff4d4f' : '#4a90d9');
        ctx.fill();
    },

    renderSampleList(replay) {
        this.elements.sampleList.innerHTML = '';
        
        replay.samples.forEach((sample, index) => {
            const item = document.createElement('div');
            item.className = `sample-item ${sample.isHit ? 'hit' : ''} ${sample.isSuspicious ? 'suspicious' : ''}`;
            
            item.innerHTML = `
                <span>#${index}</span>
                <span>${sample.distanceToTarget ? sample.distanceToTarget.toFixed(1) + 'm' : '-'}</span>
                <span>${sample.accuracy}m</span>
                <span>${sample.isHit ? '✓ 命中' : (sample.isSuspicious ? '⚠ 可疑' : sample.driftLevel}</span>
            `;
            
            this.elements.sampleList.appendChild(item);
        });
    },

    showToast(message, type = 'info') {
        const toast = this.elements.toast;
        toast.textContent = message;
        toast.className = `toast ${type}`;
        
        setTimeout(() => {
            toast.classList.add('hidden');
        }, 3000);
    }
};
