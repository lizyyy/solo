const CONSTANTS = {
    GRID_SIZE: 40,
    
    TILE_TYPES: {
        EMPTY: 0,
        WALL: 1,
        ENTRANCE: 2,
        EXIT: 3,
        GATE: 4,
        OBSTACLE: 5
    },
    
    COLOR_TYPES: {
        GREEN: 'green',
        BLUE: 'blue',
        ORANGE: 'orange',
        PURPLE: 'purple'
    },
    
    COLOR_VALUES: {
        green: '#4CAF50',
        blue: '#2196F3',
        orange: '#FF9800',
        purple: '#9C27B0'
    },
    
    COLOR_NAMES: {
        green: '绿色',
        blue: '蓝色',
        orange: '橙色',
        purple: '紫色'
    },
    
    PASSENGER: {
        BASE_SPEED: 0.8,
        STAFF_BOOST: 1.5,
        BASE_PATIENCE: 100,
        PATIENCE_DECAY: 0.15,
        CONGESTION_PATIENCE_PENALTY: 0.3
    },
    
    SCORE: {
        CORRECT_EXIT: 100,
        WRONG_EXIT: -50,
        PATIENCE_ZERO: -30,
        CONGESTION_PENALTY: -5,
        STAFF_USED: -10,
        FENCE_USED: -5,
        TIME_BONUS_MULTIPLIER: 2
    },
    
    STARS: {
        THREE_STAR: 0.8,
        TWO_STAR: 0.5,
        ONE_STAR: 0.2
    },
    
    EVENT_TYPES: {
        PASSENGER_SPAWN: 'spawn',
        PASSENGER_EXIT: 'exit',
        PASSENGER_WRONG_EXIT: 'wrong_exit',
        PASSENGER_PATIENCE_ZERO: 'patience_zero',
        CONGESTION_START: 'congestion',
        CONGESTION_END: 'congestion_end',
        TOOL_USED: 'tool_used',
        TOOL_REMOVED: 'tool_removed',
        GATE_TOGGLE: 'gate_toggle',
        VICTORY: 'victory',
        DEFEAT: 'defeat',
        INFO: 'info',
        WARNING: 'warning'
    }
};

if (typeof module !== 'undefined') {
    module.exports = CONSTANTS;
}
