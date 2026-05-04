const APP_CONFIG = {
    VERSION: '1.0.0',
    STORAGE_KEY: 'hoist_point_safety_tool',
    AUTO_SAVE_INTERVAL: 30000,
    
    RISK_THRESHOLDS: {
        OVERLOAD_RATIO_CRITICAL: 1.1,
        OVERLOAD_RATIO_WARNING: 0.9,
        UNBALANCE_PERCENT_CRITICAL: 30,
        UNBALANCE_PERCENT_WARNING: 15,
        CONFLICT_DISTANCE_CRITICAL: 0.5,
        CONFLICT_DISTANCE_WARNING: 1.0,
    },
    
    SCENE: {
        GRID_SIZE: 20,
        GRID_DIVISIONS: 20,
        DEFAULT_CAMERA_POSITION: { x: 15, y: 15, z: 15 },
        DEFAULT_CAMERA_TARGET: { x: 0, y: 0, z: 0 },
        SNAP_GRID_SIZE: 0.5,
    },
    
    COLORS: {
        TRUSS: 0x8b8b8b,
        HOIST_SAFE: 0x22c55e,
        HOIST_WARNING: 0xf59e0b,
        HOIST_CRITICAL: 0xef4444,
        EQUIPMENT_FIXTURE: 0x3b82f6,
        EQUIPMENT_SPEAKER: 0x8b5cf6,
        EQUIPMENT_OTHER: 0x6b7280,
        SAFETY_ROPE: 0x22c55e,
        NO_SAFETY_ROPE: 0xef4444,
        GRID: 0x444444,
        AXES_X: 0xff0000,
        AXES_Y: 0x00ff00,
        AXES_Z: 0x0000ff,
    },
    
    EXPORT: {
        MARKDOWN_TEMPLATE: '# 吊点安全风险评估报告\n\n## 项目信息\n- 预演名称: {{rehearsalName}}\n- 评估时间: {{assessmentTime}}\n- 评估状态: {{reviewStatus}}\n\n## 风险总览\n- 严重风险: {{criticalCount}}\n- 警告: {{warningCount}}\n- 提示: {{infoCount}}\n\n## 风险详情\n{{riskDetails}}\n\n## 数据概览\n- 吊点数量: {{trussCount}}\n- 设备数量: {{equipmentCount}}\n- 葫芦数量: {{hoistCount}}\n\n## 人工复核备注\n{{reviewNotes}}\n',
    },
};

const DEFAULT_DATA = {
    rehearsalName: '新预演',
    trusses: [
        {
            id: 'truss-1',
            name: '主桁架',
            type: 'box-truss',
            length: 10,
            width: 0.5,
            height: 0.5,
            position: { x: 0, y: 5, z: 0 },
            rotation: { x: 0, y: 0, z: 0 },
            points: [
                { id: 'point-1', position: { x: -4, y: 5, z: 0 }, name: 'A' },
                { id: 'point-2', position: { x: 4, y: 5, z: 0 }, name: 'B' },
            ],
        },
    ],
    hoists: [
        {
            id: 'hoist-1',
            name: '葫芦 A',
            ratedLoad: 1000,
            attachedTo: 'point-1',
            position: { x: -4, y: 8, z: 0 },
            hasSafetyRope: true,
        },
        {
            id: 'hoist-2',
            name: '葫芦 B',
            ratedLoad: 1000,
            attachedTo: 'point-2',
            position: { x: 4, y: 8, z: 0 },
            hasSafetyRope: true,
        },
    ],
    equipment: [
        {
            id: 'eq-1',
            name: '摇头灯 MH-1',
            type: 'fixture',
            weight: 25,
            mountedOn: null,
            position: { x: 0, y: 5, z: 0 },
            hasSafetyRope: true,
        },
        {
            id: 'eq-2',
            name: '线阵列音箱 LA-1',
            type: 'speaker',
            weight: 80,
            mountedOn: null,
            position: { x: -2, y: 5, z: 0 },
            hasSafetyRope: true,
        },
    ],
    loadCells: [],
    reviewNotes: '',
    reviewStatus: 'pending',
    createdAt: null,
    updatedAt: null,
};
