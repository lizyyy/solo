const CONFIG = {
    GAME: {
        MAX_TIME: 300,
        TICK_INTERVAL: 1000,
        GRID_SIZE: 40,
        MAP_PADDING: 20
    },

    MISSIONS: {
        FETCH: {
            name: '取机',
            timeLimit: 60,
            maxPoints: 25,
            weight: 0.25
        },
        ARRIVE: {
            name: '到场',
            timeLimit: 120,
            maxPoints: 25,
            weight: 0.25
        },
        DEFIBRILLATE: {
            name: '除颤',
            timeLimit: 240,
            maxPoints: 30,
            weight: 0.30
        },
        HANDOVER: {
            name: '交接',
            timeLimit: 300,
            maxPoints: 20,
            weight: 0.20
        }
    },

    RESOURCES: {
        AED: {
            type: 'aed',
            name: '自动体外除颤器',
            icon: 'AED',
            defibrillationTime: 30,
            batteryDrainRate: 0.1,
            baseBattery: 100
        },
        VOLUNTEER: {
            type: 'volunteer',
            name: '急救志愿者',
            icon: '志',
            baseSpeed: 80,
            fetchTime: 5
        },
        AMBULANCE: {
            type: 'ambulance',
            name: '救护车',
            icon: '救',
            responseTime: 30,
            baseSpeed: 60,
            handoverTime: 10
        }
    },

    EVENTS: {
        GATE: {
            type: 'gate',
            name: '门禁障碍',
            icon: '门',
            delay: 10,
            probability: 0.15,
            color: '#ff9800'
        },
        CONGESTION: {
            type: 'congestion',
            name: '交通拥堵',
            icon: '堵',
            delay: 20,
            probability: 0.12,
            color: '#9c27b0'
        },
        BATTERY: {
            type: 'battery',
            name: '电量不足',
            icon: '电',
            probability: 0.08,
            color: '#607d8b'
        },
        FALSE_ALARM: {
            type: 'false_alarm',
            name: '误报',
            icon: '误',
            probability: 0.05,
            color: '#f44336'
        }
    },

    COLORS: {
        BACKGROUND: '#f5f5f5',
        GRID: '#e0e0e0',
        ROAD: '#ffffff',
        BUILDING: '#b0bec5',
        PARK: '#c8e6c9',
        WATER: '#bbdefb',
        
        PATIENT: '#f44336',
        PATIENT_URGENT: '#d32f2f',
        AED_LOCATION: '#ff5722',
        VOLUNTEER: '#4caf50',
        AMBULANCE: '#2196f3',
        AED: '#f44336',
        
        PATH_AED: '#ff9800',
        PATH_VOLUNTEER: '#4caf50',
        PATH_AMBULANCE: '#2196f3',
        
        EVENT_GATE: '#ff9800',
        EVENT_CONGESTION: '#9c27b0',
        EVENT_BATTERY: '#607d8b',
        EVENT_FALSE: '#f44336'
    },

    STORAGE: {
        HIGH_SCORE_KEY: 'golden_four_minutes_high_score',
        GAME_RECORD_KEY: 'golden_four_minutes_records',
        SETTINGS_KEY: 'golden_four_minutes_settings'
    },

    STATES: {
        IDLE: 'idle',
        PREPARING: 'preparing',
        RUNNING: 'running',
        PAUSED: 'paused',
        COMPLETED: 'completed',
        FAILED: 'failed'
    }
};

window.CONFIG = CONFIG;