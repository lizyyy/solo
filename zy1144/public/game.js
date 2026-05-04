const Game = {
    state: {
        locationMode: 'simulated',
        selectedLevel: null,
        currentGame: null,
        currentPosition: null,
        calibrationOffset: { lat: 0, lng: 0 },
        timerInterval: null,
        remainingTime: 0,
        samples: [],
        hitSpots: [],
        expandScanUsed: false,
        replayData: null,
        replayIndex: 0,
        replayInterval: null,
        isReplaying: false
    },

    EARTH_RADIUS: 6371000,

    toRadians(degrees) {
        return degrees * Math.PI / 180;
    },

    calculateDistance(lat1, lng1, lat2, lng2) {
        const dLat = this.toRadians(lat2 - lat1);
        const dLng = this.toRadians(lng2 - lng1);
        
        const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                  Math.cos(this.toRadians(lat1)) * Math.cos(this.toRadians(lat2)) *
                  Math.sin(dLng / 2) * Math.sin(dLng / 2);
        
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        
        return this.EARTH_RADIUS * c;
    },

    calculateBearing(lat1, lng1, lat2, lng2) {
        const dLng = this.toRadians(lng2 - lng1);
        const lat1Rad = this.toRadians(lat1);
        const lat2Rad = this.toRadians(lat2);
        
        const y = Math.sin(dLng) * Math.cos(lat2Rad);
        const x = Math.cos(lat1Rad) * Math.sin(lat2Rad) -
                  Math.sin(lat1Rad) * Math.cos(lat2Rad) * Math.cos(dLng);
        
        let bearing = Math.atan2(y, x);
        bearing = (bearing * 180 / Math.PI + 360) % 360;
        
        return bearing;
    },

    getDirectionFromBearing(bearing) {
        const directions = ['北', '东北', '东', '东南', '南', '西南', '西', '西北'];
        const index = Math.round(bearing / 45) % 8;
        return directions[index];
    },

    setLocationMode(mode) {
        this.state.locationMode = mode;
    },

    selectLevel(levelId) {
        this.state.selectedLevel = levelId;
    },

    async createGame(playerName) {
        if (!this.state.selectedLevel) {
            throw new Error('请先选择关卡');
        }
        
        const result = await API.createGame(this.state.selectedLevel, playerName);
        this.state.currentGame = result.data;
        this.state.remainingTime = this.state.currentGame.time_limit;
        this.state.samples = [];
        this.state.hitSpots = [];
        this.state.expandScanUsed = false;
        
        if (this.state.locationMode === 'simulated') {
            const level = this.state.currentGame.level;
            this.state.currentPosition = {
                lat: level.center_lat,
                lng: level.center_lng,
                accuracy: 10
            };
        }
        
        return this.state.currentGame;
    },

    async startGame() {
        if (!this.state.currentGame) {
            throw new Error('游戏未创建');
        }
        
        const result = await API.startGame(this.state.currentGame.id);
        this.state.currentGame = result.data;
        this.startTimer();
        
        return this.state.currentGame;
    },

    startTimer() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
        }
        
        this.state.timerInterval = setInterval(() => {
            this.state.remainingTime--;
            
            if (this.state.remainingTime <= 0) {
                this.endGame('lost');
            }
            
            UI.updateTimer(this.state.remainingTime);
        }, 1000);
    },

    stopTimer() {
        if (this.state.timerInterval) {
            clearInterval(this.state.timerInterval);
            this.state.timerInterval = null;
        }
    },

    async getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (this.state.locationMode === 'simulated') {
                if (this.state.currentPosition) {
                    resolve(this.state.currentPosition);
                } else {
                    reject(new Error('请在地图上设置模拟位置'));
                }
                return;
            }
            
            if (!navigator.geolocation) {
                reject(new Error('您的设备不支持地理定位'));
                return;
            }
            
            navigator.geolocation.getCurrentPosition(
                (position) => {
                    resolve({
                        lat: position.coords.latitude + this.state.calibrationOffset.lat,
                        lng: position.coords.longitude + this.state.calibrationOffset.lng,
                        accuracy: position.coords.accuracy || 10
                    });
                },
                (error) => {
                    reject(new Error('定位失败: ' + error.message));
                },
                {
                    enableHighAccuracy: true,
                    timeout: 10000,
                    maximumAge: 0
                }
            );
        });
    },

    setSimulatedPosition(lat, lng) {
        this.state.currentPosition = {
            lat: lat,
            lng: lng,
            accuracy: 10
        };
    },

    calibrate(targetLat, targetLng) {
        if (this.state.currentPosition) {
            this.state.calibrationOffset = {
                lat: targetLat - this.state.currentPosition.lat,
                lng: targetLng - this.state.currentPosition.lng
            };
        }
    },

    async submitLocationSample() {
        if (!this.state.currentGame || this.state.currentGame.status !== 'playing') {
            throw new Error('游戏未进行中');
        }
        
        const position = await this.getCurrentPosition();
        
        const result = await API.submitSample(
            this.state.currentGame.id,
            position.lat,
            position.lng,
            position.accuracy,
            this.state.locationMode === 'simulated'
        );
        
        const data = result.data;
        this.state.samples.push(data.sample);
        
        if (data.hit) {
            this.state.hitSpots.push(data.hit.spot.id);
            this.state.currentGame.score += data.hit.points;
        }
        
        return data;
    },

    async useExpandScan() {
        if (this.state.expandScanUsed) {
            throw new Error('道具已使用');
        }
        
        const result = await API.useItem(this.state.currentGame.id, 'expand_scan');
        this.state.expandScanUsed = true;
        
        return result.data;
    },

    async endGame(status) {
        this.stopTimer();
        
        if (this.state.currentGame && this.state.currentGame.status === 'playing') {
            const result = await API.endGame(this.state.currentGame.id, status);
            this.state.currentGame = result.data;
        }
        
        UI.showScreen('result');
        UI.updateResult(this.state.currentGame, this.state.samples.length);
    },

    async loadReplay(gameId) {
        const result = await API.getReplay(gameId);
        this.state.replayData = result.data;
        this.state.replayIndex = 0;
        return this.state.replayData;
    },

    startReplay() {
        if (!this.state.replayData || this.state.replayData.samples.length === 0) {
            return;
        }
        
        this.state.isReplaying = true;
        this.state.replayIndex = 0;
        
        if (this.state.replayInterval) {
            clearInterval(this.state.replayInterval);
        }
        
        this.state.replayInterval = setInterval(() => {
            if (this.state.replayIndex >= this.state.replayData.samples.length) {
                this.pauseReplay();
                return;
            }
            
            const sample = this.state.replayData.samples[this.state.replayIndex];
            UI.updateReplayDisplay(sample, this.state.replayIndex, this.state.replayData);
            this.state.replayIndex++;
        }, 500);
    },

    pauseReplay() {
        this.state.isReplaying = false;
        if (this.state.replayInterval) {
            clearInterval(this.state.replayInterval);
            this.state.replayInterval = null;
        }
    },

    async exportReport(format) {
        if (!this.state.currentGame) {
            throw new Error('没有游戏数据');
        }
        
        const report = await API.getReport(this.state.currentGame.id, format);
        return report;
    },

    async loadLevels() {
        const result = await API.getLevels();
        return result.data;
    }
};
