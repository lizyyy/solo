// 关卡数据模块
var Level = (function() {
    'use strict';
    
    var currentLevel = null;
    
    // 预定义的博物馆地图布局
    // 0: 空地, 1: 墙, 2: 门, 3: 展品, 4: 灯, 5: 展区标志
    var MAP_LAYOUTS = [
        // 关卡1地图 - 简单布局
        {
            width: 20,
            height: 15,
            tiles: [
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,3,0,0,4,0,0,0,0,0,0,4,0,0,3,0,0,0,1],
                [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
                [1,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,4,0,0,3,0,0,0,0,0,0,0,3,0,0,4,0,0,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,1,1,0,1,1,1,1,1,1,1,1,1,1,0,1,1,1,1,1],
                [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,3,0,0,4,0,0,0,0,0,0,4,0,0,3,0,0,0,1],
                [1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
            ],
            spawnPoints: [
                {x: 120, y: 120},
                {x: 680, y: 120},
                {x: 120, y: 480},
                {x: 680, y: 480},
                {x: 400, y: 280},
                {x: 200, y: 280},
                {x: 600, y: 280},
                {x: 400, y: 120},
                {x: 400, y: 480},
                {x: 200, y: 480}
            ]
        },
        // 关卡2地图 - 中等复杂度
        {
            width: 20,
            height: 15,
            tiles: [
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
                [1,0,3,0,4,1,0,3,0,0,0,0,0,3,1,4,0,3,0,1],
                [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
                [1,0,4,0,0,0,0,0,0,1,0,1,0,0,0,0,0,4,0,1],
                [1,1,1,1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,3,0,4,0,0,3,0,0,0,0,0,3,0,0,4,0,3,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,1,1,1,0,1,1,1,0,1,0,1,0,1,1,1,0,1,1,1],
                [1,0,4,0,0,0,0,0,0,1,0,1,0,0,0,0,0,4,0,1],
                [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
                [1,0,3,0,4,1,0,3,0,0,0,0,0,3,1,4,0,3,0,1],
                [1,0,0,0,0,1,0,0,0,0,0,0,0,0,1,0,0,0,0,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
            ],
            spawnPoints: [
                {x: 80, y: 80},
                {x: 720, y: 80},
                {x: 80, y: 520},
                {x: 720, y: 520},
                {x: 400, y: 200},
                {x: 400, y: 400},
                {x: 200, y: 280},
                {x: 600, y: 280},
                {x: 320, y: 280},
                {x: 480, y: 280},
                {x: 200, y: 120},
                {x: 600, y: 480}
            ]
        },
        // 关卡3地图 - 复杂布局
        {
            width: 20,
            height: 15,
            tiles: [
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
                [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
                [1,0,3,0,1,0,3,0,4,0,0,4,0,3,0,1,0,3,0,1],
                [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
                [1,1,0,1,1,0,1,1,1,0,0,1,1,1,0,1,1,0,1,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,4,0,0,0,4,0,0,0,0,0,0,0,4,0,0,4,0,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,0,4,0,0,0,4,0,0,0,0,0,0,0,4,0,0,4,0,1],
                [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
                [1,1,0,1,1,0,1,1,1,0,0,1,1,1,0,1,1,0,1,1],
                [1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,1,0,0,0,1],
                [1,0,3,0,1,0,3,0,4,0,0,4,0,3,0,1,0,3,0,1],
                [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1]
            ],
            spawnPoints: [
                {x: 60, y: 60},
                {x: 740, y: 60},
                {x: 60, y: 540},
                {x: 740, y: 540},
                {x: 120, y: 280},
                {x: 680, y: 280},
                {x: 280, y: 120},
                {x: 520, y: 120},
                {x: 280, y: 480},
                {x: 520, y: 480},
                {x: 400, y: 200},
                {x: 400, y: 400},
                {x: 200, y: 200},
                {x: 600, y: 200},
                {x: 200, y: 400},
                {x: 600, y: 400}
            ]
        }
    ];
    
    return {
        // 获取所有关卡配置
        getAllLevels: function() {
            return Config.LEVELS;
        },
        
        // 根据ID获取关卡配置
        getLevelById: function(id) {
            var levels = Config.LEVELS;
            for (var i = 0; i < levels.length; i++) {
                if (levels[i].id === id) {
                    return levels[i];
                }
            }
            return null;
        },
        
        // 获取第一个可用的关卡
        getFirstLevel: function() {
            return Config.LEVELS[0] || null;
        },
        
        // 获取下一个关卡
        getNextLevel: function(currentId) {
            var levels = Config.LEVELS;
            for (var i = 0; i < levels.length; i++) {
                if (levels[i].id === currentId && i < levels.length - 1) {
                    return levels[i + 1];
                }
            }
            return null;
        },
        
        // 获取关卡的地图数据
        getMapForLevel: function(levelId) {
            var levelIndex = levelId - 1;
            if (levelIndex >= 0 && levelIndex < MAP_LAYOUTS.length) {
                return MAP_LAYOUTS[levelIndex];
            }
            // 默认返回第一个地图
            return MAP_LAYOUTS[0];
        },
        
        // 设置当前关卡
        setCurrentLevel: function(levelId) {
            var level = this.getLevelById(levelId);
            if (level) {
                currentLevel = Utils.deepClone(level);
                currentLevel.mapData = this.getMapForLevel(levelId);
                return true;
            }
            return false;
        },
        
        // 获取当前关卡
        getCurrentLevel: function() {
            return currentLevel;
        },
        
        // 获取当前关卡的实际时间（考虑时间乘数）
        getActualTime: function(levelId) {
            var level = this.getLevelById(levelId);
            if (level) {
                return Config.GAME.TOTAL_TIME * level.time_multiplier;
            }
            return Config.GAME.TOTAL_TIME;
        },
        
        // 检查是否通过关卡
        checkLevelComplete: function(score, eventsHandled, levelId) {
            var level = this.getLevelById(levelId);
            if (!level) return false;
            
            return score >= level.required_score && eventsHandled >= level.required_events;
        },
        
        // 获取关卡的事件生成间隔
        getSpawnInterval: function(levelId) {
            var level = this.getLevelById(levelId);
            if (level) {
                return Config.GAME.SPAWN_INTERVAL / level.event_spawn_rate;
            }
            return Config.GAME.SPAWN_INTERVAL;
        },
        
        // 获取关卡的最大同时事件数
        getMaxEvents: function(levelId) {
            var level = this.getLevelById(levelId);
            if (level) {
                return level.max_active_events;
            }
            return Config.GAME.MAX_EVENTS;
        },
        
        // 重置当前关卡
        reset: function() {
            currentLevel = null;
        }
    };
})();
