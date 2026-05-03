const Utils = {
    generateId: function() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    formatTime: function(seconds) {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    },
    
    clamp: function(value, min, max) {
        return Math.max(min, Math.min(max, value));
    },
    
    random: function(min, max) {
        return Math.random() * (max - min) + min;
    },
    
    randomInt: function(min, max) {
        return Math.floor(this.random(min, max + 1));
    },
    
    randomChoice: function(array) {
        return array[Math.floor(Math.random() * array.length)];
    },
    
    probability: function(chance) {
        return Math.random() < chance;
    },
    
    deepClone: function(obj) {
        return JSON.parse(JSON.stringify(obj));
    },
    
    now: function() {
        return Date.now();
    },
    
    sum: function(array) {
        return array.reduce((a, b) => a + b, 0);
    },
    
    average: function(array) {
        if (array.length === 0) return 0;
        return this.sum(array) / array.length;
    },
    
    pad: function(num, width, char = '0') {
        return num.toString().padStart(width, char);
    },
    
    getPatienceColorClass: function(patience) {
        if (patience > CONFIG.PATIENCE.MEDIUM_THRESHOLD) return 'high';
        if (patience > CONFIG.PATIENCE.LOW_THRESHOLD) return 'medium';
        return 'low';
    },
    
    getTempColorClass: function(temp, maxTemp) {
        const percent = (temp / maxTemp) * 100;
        if (percent > 70) return 'high';
        if (percent > 40) return 'medium';
        return '';
    },
    
    getDifficultyClass: function(difficulty) {
        switch (difficulty) {
            case 'easy': return 'easy';
            case 'medium': return 'medium';
            case 'hard': return 'hard';
            default: return 'easy';
        }
    },
    
    getRankClass: function(rank) {
        switch (rank) {
            case 1: return 'gold';
            case 2: return 'silver';
            case 3: return 'bronze';
            default: return '';
        }
    },
    
    calculateGrade: function(score, maxScore) {
        const percent = (score / maxScore) * 100;
        if (percent >= 85) return { letter: 'S', class: 'excellent' };
        if (percent >= 70) return { letter: 'A', class: 'good' };
        if (percent >= 50) return { letter: 'B', class: 'average' };
        return { letter: 'C', class: 'poor' };
    },
    
    debounce: function(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    },
    
    throttle: function(func, limit) {
        let inThrottle;
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    downloadFile: function(content, filename, type = 'text/plain') {
        const blob = new Blob([content], { type });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },
    
    getCurrentDateString: function() {
        const now = new Date();
        return `${now.getFullYear()}-${this.pad(now.getMonth() + 1, 2)}-${this.pad(now.getDate(), 2)} ${this.pad(now.getHours(), 2)}:${this.pad(now.getMinutes(), 2)}`;
    }
};

const Storage = {
    PREFIX: 'coffee_game_',
    
    KEYS: {
        HIGH_SCORES: 'high_scores',
        SAVE_GAME: 'save_game',
        SETTINGS: 'settings'
    },
    
    set: function(key, value) {
        try {
            localStorage.setItem(this.PREFIX + key, JSON.stringify(value));
            return true;
        } catch (e) {
            console.error('Storage set error:', e);
            return false;
        }
    },
    
    get: function(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(this.PREFIX + key);
            if (item === null) return defaultValue;
            return JSON.parse(item);
        } catch (e) {
            console.error('Storage get error:', e);
            return defaultValue;
        }
    },
    
    remove: function(key) {
        try {
            localStorage.removeItem(this.PREFIX + key);
            return true;
        } catch (e) {
            console.error('Storage remove error:', e);
            return false;
        }
    },
    
    getHighScores: function() {
        return this.get(this.KEYS.HIGH_SCORES, []);
    },
    
    addHighScore: function(score, levelId, levelName) {
        const scores = this.getHighScores();
        scores.push({
            id: Utils.generateId(),
            score: score,
            levelId: levelId,
            levelName: levelName,
            date: Utils.getCurrentDateString()
        });
        
        scores.sort((a, b) => b.score - a.score);
        
        if (scores.length > 10) {
            scores.splice(10);
        }
        
        this.set(this.KEYS.HIGH_SCORES, scores);
        return scores;
    },
    
    getBestScore: function() {
        const scores = this.getHighScores();
        if (scores.length === 0) return 0;
        return scores[0].score;
    },
    
    saveGame: function(gameState) {
        const saveData = {
            state: gameState,
            timestamp: Date.now(),
            version: '1.0'
        };
        return this.set(this.KEYS.SAVE_GAME, saveData);
    },
    
    loadGame: function() {
        const saveData = this.get(this.KEYS.SAVE_GAME, null);
        if (!saveData) return null;
        
        const maxAge = 24 * 60 * 60 * 1000;
        if (Date.now() - saveData.timestamp > maxAge) {
            this.remove(this.KEYS.SAVE_GAME);
            return null;
        }
        
        return saveData.state;
    },
    
    hasSavedGame: function() {
        return this.loadGame() !== null;
    },
    
    clearSavedGame: function() {
        return this.remove(this.KEYS.SAVE_GAME);
    }
};

const EventBus = {
    events: {},
    
    on: function(event, callback) {
        if (!this.events[event]) {
            this.events[event] = [];
        }
        this.events[event].push(callback);
    },
    
    off: function(event, callback) {
        if (!this.events[event]) return;
        this.events[event] = this.events[event].filter(cb => cb !== callback);
    },
    
    emit: function(event, data) {
        if (!this.events[event]) return;
        this.events[event].forEach(callback => {
            try {
                callback(data);
            } catch (e) {
                console.error(`EventBus error for ${event}:`, e);
            }
        });
    },
    
    once: function(event, callback) {
        const wrapper = (data) => {
            callback(data);
            this.off(event, wrapper);
        };
        this.on(event, wrapper);
    }
};

const EVENTS = {
    GAME_START: 'game:start',
    GAME_PAUSE: 'game:pause',
    GAME_RESUME: 'game:resume',
    GAME_OVER: 'game:over',
    GAME_SPEED_CHANGE: 'game:speed_change',
    
    ORDER_CREATED: 'order:created',
    ORDER_STARTED: 'order:started',
    ORDER_COMPLETED: 'order:completed',
    ORDER_OVERDUE: 'order:overdue',
    ORDER_MISSED: 'order:missed',
    ORDER_CANCELLED: 'order:cancelled',
    
    EQUIPMENT_USED: 'equipment:used',
    EQUIPMENT_IDLE: 'equipment:idle',
    EQUIPMENT_OVERHEAT: 'equipment:overheat',
    EQUIPMENT_BROKEN: 'equipment:broken',
    EQUIPMENT_REPAIRED: 'equipment:repaired',
    
    STAFF_ASSIGNED: 'staff:assigned',
    STAFF_FREE: 'staff:free',
    
    STOCK_CHANGED: 'stock:changed',
    STOCK_LOW: 'stock:low',
    STOCK_EMPTY: 'stock:empty',
    
    SCORE_CHANGED: 'score:changed',
    COMBO_ACHIEVED: 'combo:achieved',
    
    UI_UPDATE: 'ui:update',
    ACTION_UNDONE: 'action:undone'
};
