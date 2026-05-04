/**
 * 常量定义模块
 */

// 游戏状态
const GAME_STATE = {
    MENU: 'menu',
    PLAYING: 'playing',
    PAUSED: 'paused',
    REPLAY: 'replay',
    GAME_OVER: 'gameOver'
};

// 回合状态
const TURN_STATE = {
    PLANNING: 'planning',
    EXECUTING: 'executing',
    COMPLETED: 'completed'
};

// 对象类型
const OBJECT_TYPE = {
    RIVER: 'river',
    SHALLOW: 'shallow',
    STUDENT: 'student',
    BOAT: 'boat',
    ROPE: 'rope',
    SAFE_ZONE: 'safeZone'
};

// 颜色定义
const COLORS = {
    RIVER: '#4a90e2',
    RIVER_DEEP: '#2c5aa0',
    SHALLOW: '#a0d6b4',
    STUDENT: '#e74c3c',
    STUDENT_RESCUED: '#27ae60',
    BOAT: '#f39c12',
    ROPE: '#34495e',
    SAFE_ZONE: '#9b59b6',
    WATER_FLOW: '#5dade2',
    SHALLOW_BORDER: '#7f8c8d'
};

// 物理参数
const PHYSICS = {
    FRICTION: 0.95,
    WATER_FLOW_FORCE: 0.5,
    SHALLOW_SLOW_FACTOR: 0.3,
    BOAT_ACCELERATION: 2.0,
    BOAT_MAX_SPEED: 8.0,
    STUDENT_DRIFT_FACTOR: 0.8,
    COLLISION_DAMAGE: 10,
    ENERGY_CONSUMPTION_RATE: 0.5
};

// 游戏参数
const GAME = {
    MAX_TURNS: 20,
    TURN_DURATION: 30, // 秒
    TIMEOUT_LIMIT: 180, // 秒
    RESCUE_SCORE: 100,
    TIME_BONUS: 50,
    COLLISION_PENALTY: 50,
    TIMEOUT_PENALTY: 200,
    SAFE_ZONE_RADIUS: 50
};

// 渲染参数
const RENDER = {
    TILE_SIZE: 40,
    FONT_SIZE: 14,
    FONT_FAMILY: 'Arial, sans-serif',
    GRID_COLOR: 'rgba(0, 0, 0, 0.1)',
    HIGHLIGHT_COLOR: 'rgba(255, 255, 0, 0.3)',
    SELECTION_COLOR: 'rgba(0, 255, 0, 0.5)'
};

// 键盘按键
const KEYS = {
    UP: 38,
    DOWN: 40,
    LEFT: 37,
    RIGHT: 39,
    SPACE: 32,
    ENTER: 13,
    ESC: 27,
    W: 87,
    A: 65,
    S: 83,
    D: 68
};

// 鼠标按钮
const MOUSE_BUTTONS = {
    LEFT: 0,
    MIDDLE: 1,
    RIGHT: 2
};

// 存储键名
const STORAGE_KEYS = {
    LEVELS: 'kayak_rescue_levels',
    SAVED_GAMES: 'kayak_rescue_saved_games',
    REPLAYS: 'kayak_rescue_replays',
    SCORES: 'kayak_rescue_scores',
    SETTINGS: 'kayak_rescue_settings'
};

// 导出模块
window.constants = {
    GAME_STATE,
    TURN_STATE,
    OBJECT_TYPE,
    COLORS,
    PHYSICS,
    GAME,
    RENDER,
    KEYS,
    MOUSE_BUTTONS,
    STORAGE_KEYS
};