const CONFIG = {
    ARENA: {
        WIDTH: 60,
        HEIGHT: 40,
        GATE_COUNT: 6,
        SECURITY_STATIONS: 4
    },
    SIMULATION: {
        TICK_RATE: 60,
        PERSON_SPEED: 2,
        SCAN_TIME: 3,
        GATE_TIME: 1
    },
    COLORS: {
        FLOOR: 0x1a1a2e,
        WALL: 0x2d3748,
        GATE_OPEN: 0x48bb78,
        GATE_CLOSED: 0xf56565,
        SECURITY: 0x4299e1,
        PERSON_NORMAL: 0x00d4ff,
        PERSON_WAITING: 0xed8936,
        PERSON_ANGRY: 0xf56565,
        HEATMAP_LOW: 0x48bb78,
        HEATMAP_MEDIUM: 0xed8936,
        HEATMAP_HIGH: 0xf56565
    }
};

const EXAMPLES = {
    normal: {
        name: "正常场景",
        description: "6个闸机全开，人流均匀到达",
        gates: [
            { id: 1, x: -20, open: true, scanRate: 1 },
            { id: 2, x: -12, open: true, scanRate: 1 },
            { id: 3, x: -4, open: true, scanRate: 1 },
            { id: 4, x: 4, open: true, scanRate: 1 },
            { id: 5, x: 12, open: true, scanRate: 1 },
            { id: 6, x: 20, open: true, scanRate: 1 }
        ],
        batches: [
            { id: 1, time: 0, count: 100, spread: 10 },
            { id: 2, time: 30, count: 150, spread: 15 },
            { id: 3, time: 60, count: 200, spread: 20 },
            { id: 4, time: 90, count: 150, spread: 15 }
        ],
        closedAreas: []
    },
    conflict: {
        name: "冲突场景",
        description: "部分闸机关闭，高峰集中到达",
        gates: [
            { id: 1, x: -20, open: false, scanRate: 1 },
            { id: 2, x: -12, open: true, scanRate: 0.8 },
            { id: 3, x: -4, open: true, scanRate: 1 },
            { id: 4, x: 4, open: false, scanRate: 1 },
            { id: 5, x: 12, open: true, scanRate: 0.8 },
            { id: 6, x: 20, open: true, scanRate: 1 }
        ],
        batches: [
            { id: 1, time: 0, count: 200, spread: 5 },
            { id: 2, time: 20, count: 300, spread: 8 },
            { id: 3, time: 40, count: 250, spread: 6 }
        ],
        closedAreas: [
            { x: -15, z: 10, width: 8, height: 8 }
        ]
    },
    empty: {
        name: "空结果场景",
        description: "无观众，用于测试配置",
        gates: [
            { id: 1, x: -20, open: true, scanRate: 1 },
            { id: 2, x: -12, open: true, scanRate: 1 },
            { id: 3, x: -4, open: true, scanRate: 1 },
            { id: 4, x: 4, open: true, scanRate: 1 },
            { id: 5, x: 12, open: true, scanRate: 1 },
            { id: 6, x: 20, open: true, scanRate: 1 }
        ],
        batches: [],
        closedAreas: []
    }
};
