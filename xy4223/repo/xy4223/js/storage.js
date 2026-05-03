// 本地存储模块
var Storage = (function() {
    'use strict';
    
    var PREFIX = Config.STORAGE.PREFIX;
    var KEYS = Config.STORAGE.KEYS;
    
    function getFullKey(key) {
        return PREFIX + key;
    }
    
    function safeParse(data) {
        try {
            return JSON.parse(data);
        } catch (e) {
            return null;
        }
    }
    
    function safeStringify(data) {
        try {
            return JSON.stringify(data);
        } catch (e) {
            return null;
        }
    }
    
    return {
        // 保存数据到本地存储
        save: function(key, value) {
            var fullKey = getFullKey(key);
            var stringified = safeStringify(value);
            if (stringified !== null) {
                try {
                    localStorage.setItem(fullKey, stringified);
                    return true;
                } catch (e) {
                    console.warn('无法保存到本地存储:', e);
                    return false;
                }
            }
            return false;
        },
        
        // 从本地存储读取数据
        load: function(key, defaultValue) {
            var fullKey = getFullKey(key);
            try {
                var data = localStorage.getItem(fullKey);
                if (data === null) {
                    return defaultValue;
                }
                var parsed = safeParse(data);
                return parsed !== null ? parsed : defaultValue;
            } catch (e) {
                console.warn('无法从本地存储读取:', e);
                return defaultValue;
            }
        },
        
        // 移除数据
        remove: function(key) {
            var fullKey = getFullKey(key);
            try {
                localStorage.removeItem(fullKey);
                return true;
            } catch (e) {
                console.warn('无法从本地存储移除:', e);
                return false;
            }
        },
        
        // 清除所有游戏相关数据
        clear: function() {
            var keys = [];
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key && key.indexOf(PREFIX) === 0) {
                    keys.push(key);
                }
            }
            keys.forEach(function(key) {
                localStorage.removeItem(key);
            });
            return true;
        },
        
        // 保存高分记录
        saveHighScore: function(score, level, timeRemaining) {
            var highScores = this.getHighScores();
            var newScore = {
                score: score,
                level: level,
                timeRemaining: timeRemaining,
                date: new Date().toISOString(),
                id: Utils.generateId()
            };
            
            highScores.push(newScore);
            highScores.sort(function(a, b) {
                return b.score - a.score;
            });
            
            if (highScores.length > Config.STORAGE.MAX_HIGH_SCORES) {
                highScores = highScores.slice(0, Config.STORAGE.MAX_HIGH_SCORES);
            }
            
            this.save(KEYS.HIGH_SCORES, highScores);
            return highScores;
        },
        
        // 获取高分记录
        getHighScores: function() {
            return this.load(KEYS.HIGH_SCORES, []);
        },
        
        // 清除高分记录
        clearHighScores: function() {
            this.remove(KEYS.HIGH_SCORES);
        },
        
        // 保存解锁的关卡
        saveUnlockedLevel: function(levelId) {
            var unlockedLevels = this.getUnlockedLevels();
            if (unlockedLevels.indexOf(levelId) === -1) {
                unlockedLevels.push(levelId);
                this.save(KEYS.UNLOCKED_LEVELS, unlockedLevels);
            }
            return unlockedLevels;
        },
        
        // 获取解锁的关卡
        getUnlockedLevels: function() {
            return this.load(KEYS.UNLOCKED_LEVELS, [1]);
        },
        
        // 检查关卡是否解锁
        isLevelUnlocked: function(levelId) {
            var unlockedLevels = this.getUnlockedLevels();
            return unlockedLevels.indexOf(levelId) !== -1;
        },
        
        // 保存游戏设置
        saveSettings: function(settings) {
            var currentSettings = this.getSettings();
            var mergedSettings = Object.assign({}, currentSettings, settings);
            this.save(KEYS.SETTINGS, mergedSettings);
            return mergedSettings;
        },
        
        // 获取游戏设置
        getSettings: function() {
            return this.load(KEYS.SETTINGS, {
                soundEnabled: true,
                musicEnabled: true,
                difficulty: 'normal'
            });
        },
        
        // 检查本地存储是否可用
        isAvailable: function() {
            try {
                var testKey = PREFIX + 'test';
                localStorage.setItem(testKey, 'test');
                localStorage.removeItem(testKey);
                return true;
            } catch (e) {
                return false;
            }
        },
        
        // 获取本地存储使用情况
        getUsage: function() {
            var total = 0;
            var gameTotal = 0;
            
            for (var i = 0; i < localStorage.length; i++) {
                var key = localStorage.key(i);
                if (key) {
                    var value = localStorage.getItem(key) || '';
                    var size = (key.length + value.length) * 2;
                    total += size;
                    
                    if (key.indexOf(PREFIX) === 0) {
                        gameTotal += size;
                    }
                }
            }
            
            return {
                totalBytes: total,
                gameBytes: gameTotal,
                gameUsage: (gameTotal / 5000000 * 100).toFixed(2) + '%'
            };
        }
    };
})();
