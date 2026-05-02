const LEVELS = [
    {
        id: 1,
        name: "入门：单线调车",
        description: "学习基础操作：切换道岔、开放信号、推进列车",
        mapWidth: 800,
        mapHeight: 500,
        tracks: [
            { id: "t1", type: "straight", x1: 100, y1: 250, x2: 300, y2: 250 },
            { id: "t2", type: "switch", x: 300, y: 250, straightX: 500, straightY: 250, divergingX: 500, divergingY: 350 },
            { id: "t3", type: "straight", x1: 500, y1: 250, x2: 700, y2: 250 },
            { id: "t4", type: "straight", x1: 500, y1: 350, x2: 700, y2: 350 }
        ],
        switches: [
            { id: "sw1", trackId: "t2", position: "straight" }
        ],
        signals: [
            { id: "sig1", trackId: "t1", x: 280, y: 250, state: "closed" }
        ],
        sections: [
            { id: "sec1", tracks: ["t1"], occupied: false },
            { id: "sec2", tracks: ["t2"], occupied: false },
            { id: "sec3", tracks: ["t3"], occupied: false },
            { id: "sec4", tracks: ["t4"], occupied: false }
        ],
        trains: [
            { id: "train1", name: "货物1号", sectionId: "sec1", position: 0.3, color: "#ff6b6b", goalSection: "sec4", goalPosition: 0.5 }
        ],
        forbiddenMoves: [],
        maxMoves: 10
    },
    {
        id: 2,
        name: "双车交会",
        description: "两列车会车，注意调度顺序，避免冲突",
        mapWidth: 800,
        mapHeight: 500,
        tracks: [
            { id: "t1", type: "straight", x1: 50, y1: 200, x2: 250, y2: 200 },
            { id: "t2", type: "switch", x: 250, y: 200, straightX: 450, straightY: 200, divergingX: 450, divergingY: 300 },
            { id: "t3", type: "straight", x1: 450, y1: 200, x2: 750, y2: 200 },
            { id: "t4", type: "switch", x: 450, y: 300, straightX: 250, straightY: 300, divergingX: 250, divergingY: 400 },
            { id: "t5", type: "straight", x1: 250, y1: 300, x2: 50, y2: 300 },
            { id: "t6", type: "straight", x1: 450, y1: 300, x2: 750, y2: 300 }
        ],
        switches: [
            { id: "sw1", trackId: "t2", position: "straight" },
            { id: "sw2", trackId: "t4", position: "straight" }
        ],
        signals: [
            { id: "sig1", trackId: "t1", x: 230, y: 200, state: "closed" },
            { id: "sig2", trackId: "t5", x: 230, y: 300, state: "closed" }
        ],
        sections: [
            { id: "sec1", tracks: ["t1"], occupied: false },
            { id: "sec2", tracks: ["t2"], occupied: false },
            { id: "sec3", tracks: ["t3"], occupied: false },
            { id: "sec4", tracks: ["t4"], occupied: false },
            { id: "sec5", tracks: ["t5"], occupied: false },
            { id: "sec6", tracks: ["t6"], occupied: false }
        ],
        trains: [
            { id: "train1", name: "上行1号", sectionId: "sec1", position: 0.3, color: "#ff6b6b", goalSection: "sec3", goalPosition: 0.5 },
            { id: "train2", name: "下行2号", sectionId: "sec5", position: 0.3, color: "#4ecdc4", goalSection: "sec6", goalPosition: 0.5 }
        ],
        forbiddenMoves: [],
        maxMoves: 15
    },
    {
        id: 3,
        name: "复杂站场调度",
        description: "三列车调度，考验策略规划能力",
        mapWidth: 900,
        mapHeight: 600,
        tracks: [
            { id: "t1", type: "straight", x1: 50, y1: 150, x2: 200, y2: 150 },
            { id: "t2", type: "switch", x: 200, y: 150, straightX: 400, straightY: 150, divergingX: 400, divergingY: 300 },
            { id: "t3", type: "straight", x1: 400, y1: 150, x2: 850, y2: 150 },
            { id: "t4", type: "switch", x: 400, y: 300, straightX: 200, straightY: 300, divergingX: 200, divergingY: 450 },
            { id: "t5", type: "straight", x1: 200, y1: 300, x2: 50, y2: 300 },
            { id: "t6", type: "straight", x1: 400, y1: 300, x2: 600, y2: 300 },
            { id: "t7", type: "switch", x: 600, y: 300, straightX: 850, straightY: 300, divergingX: 850, divergingY: 450 },
            { id: "t8", type: "straight", x1: 200, y1: 450, x2: 50, y2: 450 },
            { id: "t9", type: "straight", x1: 400, y1: 450, x2: 200, y2: 450 },
            { id: "t10", type: "straight", x1: 600, y1: 450, x2: 400, y2: 450 }
        ],
        switches: [
            { id: "sw1", trackId: "t2", position: "straight" },
            { id: "sw2", trackId: "t4", position: "straight" },
            { id: "sw3", trackId: "t7", position: "straight" }
        ],
        signals: [
            { id: "sig1", trackId: "t1", x: 180, y: 150, state: "closed" },
            { id: "sig2", trackId: "t5", x: 180, y: 300, state: "closed" },
            { id: "sig3", trackId: "t8", x: 180, y: 450, state: "closed" }
        ],
        sections: [
            { id: "sec1", tracks: ["t1"], occupied: false },
            { id: "sec2", tracks: ["t2"], occupied: false },
            { id: "sec3", tracks: ["t3"], occupied: false },
            { id: "sec4", tracks: ["t4"], occupied: false },
            { id: "sec5", tracks: ["t5"], occupied: false },
            { id: "sec6", tracks: ["t6"], occupied: false },
            { id: "sec7", tracks: ["t7"], occupied: false },
            { id: "sec8", tracks: ["t8"], occupied: false },
            { id: "sec9", tracks: ["t9"], occupied: false },
            { id: "sec10", tracks: ["t10"], occupied: false }
        ],
        trains: [
            { id: "train1", name: "红列", sectionId: "sec1", position: 0.3, color: "#ff6b6b", goalSection: "sec3", goalPosition: 0.6 },
            { id: "train2", name: "蓝列", sectionId: "sec5", position: 0.3, color: "#4ecdc4", goalSection: "sec7", goalPosition: 0.5 },
            { id: "train3", name: "黄列", sectionId: "sec8", position: 0.3, color: "#ffd369", goalSection: "sec10", goalPosition: 0.5 }
        ],
        forbiddenMoves: [],
        maxMoves: 20
    }
];

function getLevel(levelId) {
    return LEVELS.find(l => l.id === levelId);
}

function getAllLevels() {
    return LEVELS;
}
