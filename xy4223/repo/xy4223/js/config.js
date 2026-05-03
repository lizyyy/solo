// 游戏配置模块
var Config = (function() {
    'use strict';
    
    return {
        // 游戏基础配置
        GAME: {
            CANVAS_WIDTH: 800,
            CANVAS_HEIGHT: 600,
            TILE_SIZE: 40,
            FPS: 60,
            TOTAL_TIME: 7 * 60, // 7分钟，单位：秒
            SPAWN_INTERVAL: 15, // 事件生成间隔，单位：秒
            MAX_EVENTS: 10 // 同时存在的最大事件数
        },
        
        // 玩家配置
        PLAYER: {
            START_X: 400,
            START_Y: 300,
            SPEED: 3,
            INTERACTION_RANGE: 60, // 互动范围
            COLOR: '#4ecdc4'
        },
        
        // 地图配置
        MAP: {
            WIDTH: 20,
            HEIGHT: 15,
            WALLS: [],
            DOORS: [],
            EXHIBITS: [],
            LIGHTS: []
        },
        
        // 事件类型定义
        EVENT_TYPES: {
            HIGH_LIGHT: {
                id: 'high_light',
                name: '高温灯',
                description: '需要关闭的高温灯',
                score: 10,
                false_alarm_penalty: -20,
                color: '#ff6b6b',
                duration: 30, // 事件持续时间（秒）
                icon: '💡'
            },
            TILTED_SIGN: {
                id: 'tilted_sign',
                name: '倾斜展牌',
                description: '需要扶正的倾斜展牌',
                score: 5,
                false_alarm_penalty: -10,
                color: '#fdcb6e',
                duration: 45,
                icon: '📋'
            },
            CROWDED_VISITORS: {
                id: 'crowded_visitors',
                name: '拥堵游客',
                description: '需要疏导的拥堵游客',
                score: 15,
                false_alarm_penalty: -30,
                color: '#e17055',
                duration: 25,
                icon: '👥'
            },
            MOVED_EXHIBIT: {
                id: 'moved_exhibit',
                name: '展品移动',
                description: '发现未登记的展品移动',
                score: 25,
                false_alarm_penalty: -50,
                color: '#a29bfe',
                duration: 20,
                icon: '🔍'
            }
        },
        
        // 关卡配置
        LEVELS: [
            {
                id: 1,
                name: '初级培训',
                description: '熟悉博物馆环境和基本操作',
                difficulty: 'easy',
                time_multiplier: 1.0,
                event_spawn_rate: 0.8,
                max_active_events: 5,
                required_score: 50,
                required_events: 3
            },
            {
                id: 2,
                name: '中级巡查',
                description: '处理更复杂的展厅状况',
                difficulty: 'medium',
                time_multiplier: 0.9,
                event_spawn_rate: 1.0,
                max_active_events: 7,
                required_score: 100,
                required_events: 5
            },
            {
                id: 3,
                name: '高级应对',
                description: '高效处理紧急情况',
                difficulty: 'hard',
                time_multiplier: 0.8,
                event_spawn_rate: 1.2,
                max_active_events: 10,
                required_score: 200,
                required_events: 8
            }
        ],
        
        // 评分配置
        SCORING: {
            BASE_EVENT_SCORE: 10,
            TIME_BONUS: 2, // 每秒剩余时间获得的分数
            FALSE_ALARM_PENALTY: -20,
            PERFECT_HANDLING_BONUS: 5,
            MISSED_EVENT_PENALTY: -10
        },
        
        // UI配置
        UI: {
            FONT_FAMILY: 'Microsoft YaHei, sans-serif',
            HUD_HEIGHT: 50,
            EVENT_LOG_MAX_ENTRIES: 10,
            COLORS: {
                primary: '#6c5ce7',
                secondary: '#4a4a6a',
                success: '#00b894',
                error: '#ff6b6b',
                warning: '#fdcb6e',
                info: '#74b9ff',
                text: '#ffffff',
                background: '#1a1a2e',
                panel: 'rgba(0, 0, 0, 0.7)'
            }
        },
        
        // 存档配置
        STORAGE: {
            PREFIX: 'museum_game_',
            MAX_HIGH_SCORES: 10,
            KEYS: {
                HIGH_SCORES: 'high_scores',
                SETTINGS: 'settings',
                UNLOCKED_LEVELS: 'unlocked_levels'
            }
        },
        
        // 地图实体类型
        ENTITY_TYPES: {
            WALL: 'wall',
            DOOR: 'door',
            EXHIBIT: 'exhibit',
            LIGHT: 'light',
            PLAYER: 'player',
            EVENT: 'event'
        }
    };
})();
