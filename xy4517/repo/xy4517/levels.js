// 铁路货场调车演练 - 关卡定义
const LEVELS = {
    "level-1": {
        id: "level-1",
        name: "基础教程",
        description: "学习基本的调车操作，将车皮送到目的股道",
        difficulty: 1,
        timeLimit: 300, // 5分钟
        scorePerCar: 100,
        penaltyPerViolation: 50,
        bonusTimeLimit: 180, // 3分钟内完成获得额外奖励
        bonusScore: 200,
        
        // 轨道定义
        tracks: [
            { id: "main", name: "正线", x: 50, y: 300, length: 900, type: "main", direction: "horizontal" },
            { id: "siding-1", name: "股道1", x: 150, y: 200, length: 400, type: "siding", direction: "horizontal" },
            { id: "siding-2", name: "股道2", x: 150, y: 400, length: 400, type: "siding", direction: "horizontal" },
            { id: "connect-1", name: "连接道1", x: 100, y: 200, length: 100, type: "connect", direction: "diagonal", from: "main", to: "siding-1" },
            { id: "connect-2", name: "连接道2", x: 100, y: 400, length: 100, type: "connect", direction: "diagonal", from: "main", to: "siding-2" }
        ],
        
        // 道岔定义
        switches: [
            { id: "sw-1", name: "道岔1", trackId: "main", position: 100, connectingTracks: ["siding-1"], currentPosition: "main", locked: false },
            { id: "sw-2", name: "道岔2", trackId: "main", position: 100, connectingTracks: ["siding-2"], currentPosition: "main", locked: false }
        ],
        
        // 机车定义
        locomotives: [
            { id: "loc-1", name: "机车1", trackId: "main", position: 800, direction: "left", coupledCarId: null, maxSpeed: 10 }
        ],
        
        // 车皮定义
        cars: [
            { id: "car-1", name: "车皮1", trackId: "main", position: 400, direction: "left", coupledTo: null, destination: "siding-1", delivered: false, type: "freight" },
            { id: "car-2", name: "车皮2", trackId: "main", position: 500, direction: "left", coupledTo: null, destination: "siding-2", delivered: false, type: "freight" }
        ],
        
        // 目的股道
        destinations: [
            { id: "dest-1", name: "卸煤区", trackId: "siding-1", startPosition: 50, endPosition: 350, requiredCars: ["car-1"] },
            { id: "dest-2", name: "装货区", trackId: "siding-2", startPosition: 50, endPosition: 350, requiredCars: ["car-2"] }
        ],
        
        // 禁停区域
        noStopZones: [
            { id: "ns-1", name: "道岔区禁停", trackId: "main", startPosition: 80, endPosition: 120 },
            { id: "ns-2", name: "道岔区禁停", trackId: "main", startPosition: 80, endPosition: 120 }
        ]
    },
    
    "level-2": {
        id: "level-2",
        name: "多道岔作业",
        description: "复杂道岔布局，需要正确规划调车路线",
        difficulty: 2,
        timeLimit: 600, // 10分钟
        scorePerCar: 150,
        penaltyPerViolation: 75,
        bonusTimeLimit: 360, // 6分钟内完成获得额外奖励
        bonusScore: 300,
        
        tracks: [
            { id: "main", name: "正线", x: 50, y: 300, length: 900, type: "main", direction: "horizontal" },
            { id: "siding-1", name: "股道1", x: 200, y: 100, length: 500, type: "siding", direction: "horizontal" },
            { id: "siding-2", name: "股道2", x: 200, y: 200, length: 500, type: "siding", direction: "horizontal" },
            { id: "siding-3", name: "股道3", x: 200, y: 400, length: 500, type: "siding", direction: "horizontal" },
            { id: "siding-4", name: "股道4", x: 200, y: 500, length: 500, type: "siding", direction: "horizontal" },
            { id: "connect-1", name: "连接道1", x: 150, y: 100, length: 100, type: "connect", direction: "diagonal", from: "main", to: "siding-1" },
            { id: "connect-2", name: "连接道2", x: 150, y: 200, length: 100, type: "connect", direction: "diagonal", from: "main", to: "siding-2" },
            { id: "connect-3", name: "连接道3", x: 150, y: 400, length: 100, type: "connect", direction: "diagonal", from: "main", to: "siding-3" },
            { id: "connect-4", name: "连接道4", x: 150, y: 500, length: 100, type: "connect", direction: "diagonal", from: "main", to: "siding-4" }
        ],
        
        switches: [
            { id: "sw-1", name: "道岔1", trackId: "main", position: 150, connectingTracks: ["siding-1", "siding-2"], currentPosition: "main", locked: false },
            { id: "sw-2", name: "道岔2", trackId: "main", position: 150, connectingTracks: ["siding-3", "siding-4"], currentPosition: "main", locked: false },
            { id: "sw-3", name: "道岔3", trackId: "main", position: 300, connectingTracks: [], currentPosition: "main", locked: false }
        ],
        
        locomotives: [
            { id: "loc-1", name: "机车1", trackId: "main", position: 850, direction: "left", coupledCarId: null, maxSpeed: 10 }
        ],
        
        cars: [
            { id: "car-1", name: "车皮1", trackId: "main", position: 600, direction: "left", coupledTo: null, destination: "siding-1", delivered: false, type: "freight" },
            { id: "car-2", name: "车皮2", trackId: "main", position: 700, direction: "left", coupledTo: null, destination: "siding-2", delivered: false, type: "freight" },
            { id: "car-3", name: "车皮3", trackId: "main", position: 500, direction: "left", coupledTo: null, destination: "siding-3", delivered: false, type: "freight" },
            { id: "car-4", name: "车皮4", trackId: "main", position: 400, direction: "left", coupledTo: null, destination: "siding-4", delivered: false, type: "freight" }
        ],
        
        destinations: [
            { id: "dest-1", name: "卸煤区A", trackId: "siding-1", startPosition: 50, endPosition: 450, requiredCars: ["car-1"] },
            { id: "dest-2", name: "装货区B", trackId: "siding-2", startPosition: 50, endPosition: 450, requiredCars: ["car-2"] },
            { id: "dest-3", name: "检修区C", trackId: "siding-3", startPosition: 50, endPosition: 450, requiredCars: ["car-3"] },
            { id: "dest-4", name: "待发区D", trackId: "siding-4", startPosition: 50, endPosition: 450, requiredCars: ["car-4"] }
        ],
        
        noStopZones: [
            { id: "ns-1", name: "道岔区禁停", trackId: "main", startPosition: 130, endPosition: 170 },
            { id: "ns-2", name: "道岔区禁停", trackId: "main", startPosition: 280, endPosition: 320 }
        ]
    },
    
    "level-3": {
        id: "level-3",
        name: "双机车协同",
        description: "两台机车协同作业，需要注意避免冲突",
        difficulty: 3,
        timeLimit: 900, // 15分钟
        scorePerCar: 200,
        penaltyPerViolation: 100,
        bonusTimeLimit: 600, // 10分钟内完成获得额外奖励
        bonusScore: 500,
        
        tracks: [
            { id: "main-1", name: "正线1", x: 50, y: 250, length: 900, type: "main", direction: "horizontal" },
            { id: "main-2", name: "正线2", x: 50, y: 350, length: 900, type: "main", direction: "horizontal" },
            { id: "siding-1", name: "股道1", x: 200, y: 100, length: 400, type: "siding", direction: "horizontal" },
            { id: "siding-2", name: "股道2", x: 200, y: 500, length: 400, type: "siding", direction: "horizontal" },
            { id: "connect-1", name: "连接道1", x: 150, y: 100, length: 150, type: "connect", direction: "diagonal", from: "main-1", to: "siding-1" },
            { id: "connect-2", name: "连接道2", x: 150, y: 500, length: 150, type: "connect", direction: "diagonal", from: "main-2", to: "siding-2" },
            { id: "crossing", name: "渡线", x: 400, y: 250, length: 100, type: "crossing", direction: "vertical", from: "main-1", to: "main-2" }
        ],
        
        switches: [
            { id: "sw-1", name: "道岔1", trackId: "main-1", position: 150, connectingTracks: ["siding-1"], currentPosition: "main", locked: false },
            { id: "sw-2", name: "道岔2", trackId: "main-2", position: 150, connectingTracks: ["siding-2"], currentPosition: "main", locked: false },
            { id: "sw-3", name: "道岔3", trackId: "main-1", position: 400, connectingTracks: ["main-2"], currentPosition: "main", locked: false },
            { id: "sw-4", name: "道岔4", trackId: "main-2", position: 400, connectingTracks: ["main-1"], currentPosition: "main", locked: false }
        ],
        
        locomotives: [
            { id: "loc-1", name: "机车1", trackId: "main-1", position: 800, direction: "left", coupledCarId: null, maxSpeed: 10 },
            { id: "loc-2", name: "机车2", trackId: "main-2", position: 100, direction: "right", coupledCarId: null, maxSpeed: 10 }
        ],
        
        cars: [
            { id: "car-1", name: "车皮1", trackId: "main-1", position: 500, direction: "left", coupledTo: null, destination: "siding-1", delivered: false, type: "freight" },
            { id: "car-2", name: "车皮2", trackId: "main-1", position: 600, direction: "left", coupledTo: null, destination: "siding-1", delivered: false, type: "freight" },
            { id: "car-3", name: "车皮3", trackId: "main-2", position: 300, direction: "right", coupledTo: null, destination: "siding-2", delivered: false, type: "freight" },
            { id: "car-4", name: "车皮4", trackId: "main-2", position: 200, direction: "right", coupledTo: null, destination: "siding-2", delivered: false, type: "freight" },
            { id: "car-5", name: "车皮5", trackId: "main-1", position: 300, direction: "left", coupledTo: null, destination: "siding-2", delivered: false, type: "freight" }
        ],
        
        destinations: [
            { id: "dest-1", name: "编组区A", trackId: "siding-1", startPosition: 50, endPosition: 350, requiredCars: ["car-1", "car-2"] },
            { id: "dest-2", name: "编组区B", trackId: "siding-2", startPosition: 50, endPosition: 350, requiredCars: ["car-3", "car-4", "car-5"] }
        ],
        
        noStopZones: [
            { id: "ns-1", name: "道岔区禁停", trackId: "main-1", startPosition: 130, endPosition: 170 },
            { id: "ns-2", name: "道岔区禁停", trackId: "main-2", startPosition: 130, endPosition: 170 },
            { id: "ns-3", name: "渡线禁停", trackId: "main-1", startPosition: 380, endPosition: 420 },
            { id: "ns-4", name: "渡线禁停", trackId: "main-2", startPosition: 380, endPosition: 420 }
        ]
    }
};

// 获取所有关卡列表
function getLevelList() {
    return Object.values(LEVELS).map(level => ({
        id: level.id,
        name: level.name,
        difficulty: level.difficulty,
        description: level.description
    }));
}

// 获取特定关卡数据
function getLevel(levelId) {
    return JSON.parse(JSON.stringify(LEVELS[levelId]));
}
