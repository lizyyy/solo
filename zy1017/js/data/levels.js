const LEVELS = [
    {
        name: "新手教程",
        objective: "引导绿色乘客到达绿色出口，熟悉基本操作",
        width: 10,
        height: 8,
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [2, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 3],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        entrances: [
            { x: 0, y: 2, color: 'green' }
        ],
        exits: [
            { x: 9, y: 5, color: 'green' }
        ],
        gates: [],
        obstacles: [],
        goals: [
            { color: 'green', count: 5 }
        ],
        spawnConfig: {
            total: 6,
            rate: 2.5,
            colorWeights: { green: 1 },
            entranceWeights: { 0: 1 }
        },
        tools: {
            fence: 3,
            staff: 2
        }
    },
    {
        name: "双色分流",
        objective: "绿色乘客去绿色出口，蓝色乘客去蓝色出口",
        width: 12,
        height: 10,
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 3],
            [1, 0, 0, 0, 0, 1, 1, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        entrances: [
            { x: 0, y: 2, color: 'green' },
            { x: 0, y: 7, color: 'blue' }
        ],
        exits: [
            { x: 11, y: 4, color: 'green' },
            { x: 11, y: 7, color: 'blue' }
        ],
        gates: [],
        obstacles: [],
        goals: [
            { color: 'green', count: 6 },
            { color: 'blue', count: 6 }
        ],
        spawnConfig: {
            total: 14,
            rate: 2,
            colorWeights: { green: 1, blue: 1 },
            entranceWeights: { 0: 1, 1: 1 }
        },
        tools: {
            fence: 5,
            staff: 3
        }
    },
    {
        name: "闸机控制",
        objective: "使用闸机控制人流方向，注意颜色匹配",
        width: 14,
        height: 10,
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 4, 0, 0, 4, 0, 0, 0, 0, 3],
            [2, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
            [2, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 3],
            [1, 0, 0, 0, 0, 1, 0, 0, 1, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 4, 0, 0, 4, 0, 0, 0, 0, 3],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        entrances: [
            { x: 0, y: 3, color: 'green' },
            { x: 0, y: 4, color: 'blue' }
        ],
        exits: [
            { x: 13, y: 2, color: 'green' },
            { x: 13, y: 4, color: 'blue' },
            { x: 13, y: 6, color: 'orange' }
        ],
        gates: [
            { x: 5, y: 2, open: true, defaultOpen: true },
            { x: 5, y: 6, open: true, defaultOpen: true },
            { x: 8, y: 2, open: false, defaultOpen: false },
            { x: 8, y: 6, open: false, defaultOpen: false }
        ],
        obstacles: [],
        goals: [
            { color: 'green', count: 5 },
            { color: 'blue', count: 5 }
        ],
        spawnConfig: {
            total: 12,
            rate: 2,
            colorWeights: { green: 1, blue: 1 },
            entranceWeights: { 0: 1, 1: 1 }
        },
        tools: {
            fence: 4,
            staff: 2
        }
    },
    {
        name: "复杂迷宫",
        objective: "三色乘客分流，迷宫中有多条路径可供选择",
        width: 16,
        height: 12,
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
            [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
            [2, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 3],
            [1, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [2, 0, 1, 1, 1, 1, 1, 0, 1, 1, 1, 1, 1, 0, 1, 1],
            [1, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 3],
            [1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1, 0, 1, 1, 0, 1],
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1],
            [2, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 3],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        entrances: [
            { x: 0, y: 3, color: 'green' },
            { x: 0, y: 6, color: 'blue' },
            { x: 0, y: 10, color: 'orange' }
        ],
        exits: [
            { x: 15, y: 3, color: 'green' },
            { x: 15, y: 7, color: 'blue' },
            { x: 15, y: 10, color: 'orange' }
        ],
        gates: [],
        obstacles: [],
        goals: [
            { color: 'green', count: 5 },
            { color: 'blue', count: 5 },
            { color: 'orange', count: 5 }
        ],
        spawnConfig: {
            total: 18,
            rate: 1.8,
            colorWeights: { green: 1, blue: 1, orange: 1 },
            entranceWeights: { 0: 1, 1: 1, 2: 1 }
        },
        tools: {
            fence: 8,
            staff: 4
        }
    },
    {
        name: "终极挑战",
        objective: "四色乘客在复杂环境中分流，需要精确控制",
        width: 18,
        height: 14,
        grid: [
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 3],
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1],
            [2, 0, 0, 1, 0, 4, 0, 0, 0, 0, 0, 4, 0, 1, 0, 0, 0, 3],
            [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
            [1, 0, 0, 1, 0, 1, 0, 0, 0, 0, 0, 1, 0, 1, 0, 0, 0, 1],
            [2, 0, 0, 1, 0, 4, 0, 0, 0, 0, 0, 4, 0, 1, 0, 0, 0, 3],
            [1, 0, 1, 1, 0, 1, 0, 1, 1, 1, 0, 1, 0, 1, 1, 0, 0, 1],
            [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 1],
            [2, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 4, 0, 0, 0, 0, 0, 3],
            [1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 1],
            [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1]
        ],
        entrances: [
            { x: 0, y: 2, color: 'green' },
            { x: 0, y: 5, color: 'blue' },
            { x: 0, y: 8, color: 'orange' },
            { x: 0, y: 11, color: 'purple' }
        ],
        exits: [
            { x: 17, y: 2, color: 'purple' },
            { x: 17, y: 5, color: 'orange' },
            { x: 17, y: 8, color: 'blue' },
            { x: 17, y: 11, color: 'green' }
        ],
        gates: [
            { x: 5, y: 2, open: true, defaultOpen: true },
            { x: 5, y: 5, open: true, defaultOpen: true },
            { x: 5, y: 8, open: false, defaultOpen: false },
            { x: 5, y: 11, open: false, defaultOpen: false },
            { x: 11, y: 2, open: false, defaultOpen: false },
            { x: 11, y: 5, open: false, defaultOpen: false },
            { x: 11, y: 8, open: true, defaultOpen: true },
            { x: 11, y: 11, open: true, defaultOpen: true }
        ],
        obstacles: [],
        goals: [
            { color: 'green', count: 6 },
            { color: 'blue', count: 6 },
            { color: 'orange', count: 6 },
            { color: 'purple', count: 6 }
        ],
        spawnConfig: {
            total: 28,
            rate: 1.5,
            colorWeights: { green: 1, blue: 1, orange: 1, purple: 1 },
            entranceWeights: { 0: 1, 1: 1, 2: 1, 3: 1 }
        },
        tools: {
            fence: 10,
            staff: 5
        }
    }
];

if (typeof module !== 'undefined') {
    module.exports = LEVELS;
}
