/**
 * 应用常量定义
 */

const Constants = {
    // 对象类型
    OBJECT_TYPES: {
        SHELF: 'shelf',
        ZONE: 'zone',
        ENTRANCE: 'entrance',
        FORBIDDEN: 'forbidden'
    },
    
    // 默认颜色
    COLORS: {
        SHELF: 0x3b82f6,
        ZONE: 0x10b981,
        ENTRANCE: 0xf59e0b,
        FORBIDDEN: 0xef4444,
        FLOOR: 0x1e1e3f,
        GRID: 0x2d2d5a,
        ROUTE_LINE: 0x4ade80,
        SELECTED: 0xffffff,
        HIGHLIGHT: 0xfbbf24
    },
    
    // 默认尺寸
    DEFAULT_SIZES: {
        WAREHOUSE_LENGTH: 20,
        WAREHOUSE_WIDTH: 15,
        WAREHOUSE_HEIGHT: 5,
        SHELF_LENGTH: 2,
        SHELF_WIDTH: 1,
        SHELF_HEIGHT: 2.5,
        AISLE_MIN_WIDTH: 1.2,
        GRID_SIZE: 1
    },
    
    // 冲突类型
    CONFLICT_TYPES: {
        OVERLAP: 'overlap',
        OUT_OF_BOUNDS: 'out_of_bounds',
        AISLE_TOO_NARROW: 'aisle_too_narrow',
        ENTRANCE_BLOCKED: 'entrance_blocked',
        FORBIDDEN_ZONE: 'forbidden_zone'
    },
    
    // 事件名称
    EVENTS: {
        OBJECT_ADDED: 'object:added',
        OBJECT_REMOVED: 'object:removed',
        OBJECT_UPDATED: 'object:updated',
        OBJECT_SELECTED: 'object:selected',
        CONFLICTS_UPDATED: 'conflicts:updated',
        PICKING_IMPORTED: 'picking:imported',
        ROUTE_UPDATED: 'route:updated',
        ROUTE_PLAY: 'route:play',
        ROUTE_PAUSE: 'route:pause',
        ROUTE_STOP: 'route:stop',
        VIEW_CHANGED: 'view:changed',
        TOOL_CHANGED: 'tool:changed',
        PROJECT_LOADED: 'project:loaded',
        PROJECT_SAVED: 'project:saved'
    },
    
    // 工具模式
    TOOLS: {
        SELECT: 'select',
        PAN: 'pan',
        ROTATE: 'rotate',
        MOVE: 'move'
    },
    
    // 视图类型
    VIEWS: {
        PERSPECTIVE: 'perspective',
        TOP: 'top',
        FRONT: 'front',
        LEFT: 'left'
    },
    
    // 存储键
    STORAGE_KEYS: {
        CURRENT_PROJECT: 'warehouse_planner:current_project',
        PROJECTS: 'warehouse_planner:projects',
        SETTINGS: 'warehouse_planner:settings'
    },
    
    // 默认仓库配置
    DEFAULT_WAREHOUSE: {
        id: 'warehouse-default',
        name: '我的仓库',
        length: 20,
        width: 15,
        height: 5,
        gridSize: 1,
        showGrid: true,
        groundColor: 0x1e1e3f
    }
};

// 冲突类型的中文描述
Constants.CONFLICT_TYPE_NAMES = {
    [Constants.CONFLICT_TYPES.OVERLAP]: '对象重叠',
    [Constants.CONFLICT_TYPES.OUT_OF_BOUNDS]: '越界警告',
    [Constants.CONFLICT_TYPES.AISLE_TOO_NARROW]: '通道宽度不足',
    [Constants.CONFLICT_TYPES.ENTRANCE_BLOCKED]: '出入口被阻挡',
    [Constants.CONFLICT_TYPES.FORBIDDEN_ZONE]: '禁放区冲突'
};

// 对象类型的中文名称
Constants.OBJECT_TYPE_NAMES = {
    [Constants.OBJECT_TYPES.SHELF]: '货架',
    [Constants.OBJECT_TYPES.ZONE]: '货区',
    [Constants.OBJECT_TYPES.ENTRANCE]: '出入口',
    [Constants.OBJECT_TYPES.FORBIDDEN]: '禁放区'
};

// 对象类型的图标
Constants.OBJECT_TYPE_ICONS = {
    [Constants.OBJECT_TYPES.SHELF]: '📦',
    [Constants.OBJECT_TYPES.ZONE]: '🟩',
    [Constants.OBJECT_TYPES.ENTRANCE]: '🚪',
    [Constants.OBJECT_TYPES.FORBIDDEN]: '⛔'
};
