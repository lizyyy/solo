var Constants = {
    DIRECTION: {
        UP: 0,
        RIGHT: 1,
        DOWN: 2,
        LEFT: 3
    },
    
    DIRECTION_NAMES: {
        0: '↑ 上',
        1: '→ 右',
        2: '↓ 下',
        3: '← 左'
    },
    
    DIRECTION_DELTA: {
        0: { x: 0, y: -1 },
        1: { x: 1, y: 0 },
        2: { x: 0, y: 1 },
        3: { x: -1, y: 0 }
    },
    
    CELL_TYPE: {
        EMPTY: 0,
        START: 1,
        OBSTACLE: 2,
        CHARGE: 3,
        CHECKPOINT: 4,
        DANGER: 5,
        SAMPLE: 6
    },
    
    CELL_TYPE_NAMES: {
        0: '空地',
        1: '起点',
        2: '障碍',
        3: '充电点',
        4: '检查点',
        5: '危险格',
        6: '取样点'
    },
    
    COMMAND_TYPE: {
        FORWARD: 'forward',
        TURN_LEFT: 'turnLeft',
        TURN_RIGHT: 'turnRight',
        SAMPLE: 'sample',
        CHARGE: 'charge'
    },
    
    COMMAND_NAMES: {
        'forward': '前进',
        'turnLeft': '左转',
        'turnRight': '右转',
        'sample': '取样',
        'charge': '充电'
    },
    
    COMMAND_ICONS: {
        'forward': '➡️',
        'turnLeft': '⬅️',
        'turnRight': '➡️',
        'sample': '📦',
        'charge': '🔋'
    },
    
    ENERGY_COST: {
        'forward': 1,
        'turnLeft': 0.5,
        'turnRight': 0.5,
        'sample': 2,
        'charge': 0
    },
    
    CHARGE_AMOUNT: 20,
    
    ERROR_TYPE: {
        HIT_WALL: 'hitWall',
        OUT_OF_BOUNDS: 'outOfBounds',
        ENERGY_DEPLETED: 'energyDepleted',
        MISSED_CHECKPOINT: 'missedCheckpoint',
        DUPLICATE_SAMPLE: 'duplicateSample',
        DANGER_ZONE: 'dangerZone',
        INVALID_SAMPLE: 'invalidSample',
        INVALID_CHARGE: 'invalidCharge'
    },
    
    ERROR_MESSAGES: {
        'hitWall': '撞墙了！机器人撞到了障碍物',
        'outOfBounds': '出界了！机器人离开了地图范围',
        'energyDepleted': '能量耗尽！无法继续执行指令',
        'missedCheckpoint': '漏检！有检查点未通过',
        'duplicateSample': '重复取样！同一取样点只能取一次',
        'dangerZone': '危险区域！机器人进入了危险格',
        'invalidSample': '无效取样！当前位置不是取样点',
        'invalidCharge': '无效充电！当前位置不是充电点'
    },
    
    STORAGE_KEYS: {
        LEVELS: 'robot_trainer_levels',
        RECORDS: 'robot_trainer_records',
        REPLAYS: 'robot_trainer_replays',
        SETTINGS: 'robot_trainer_settings'
    },
    
    DEFAULT_MAP_SIZE: { width: 10, height: 10 },
    DEFAULT_ENERGY: 50,
    MAX_ENERGY: 100,
    
    RATING: {
        THREE_STARS: 3,
        TWO_STARS: 2,
        ONE_STAR: 1,
        ZERO_STARS: 0
    },
    
    RATING_NAMES: {
        3: '三星',
        2: '二星',
        1: '一星',
        0: '失败'
    },
    
    MODE: {
        TRAIN: 'train',
        EDIT: 'edit'
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = Constants;
}
