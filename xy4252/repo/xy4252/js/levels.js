const LEVELS = {
    level1: {
        id: 'level1',
        name: '第1关 - 简单场景',
        description: '一个简单的小区场景，适合初学者熟悉操作',
        difficulty: 'easy',
        
        map: {
            width: 20,
            height: 15,
            gridSize: 40,
            
            buildings: [
                { x: 2, y: 2, width: 3, height: 3, type: 'building', name: '1号楼' },
                { x: 8, y: 2, width: 3, height: 3, type: 'building', name: '2号楼' },
                { x: 14, y: 2, width: 3, height: 3, type: 'building', name: '3号楼' },
                { x: 2, y: 10, width: 3, height: 3, type: 'building', name: '4号楼' },
                { x: 14, y: 10, width: 3, height: 3, type: 'building', name: '5号楼' }
            ],
            
            parks: [
                { x: 9, y: 8, width: 2, height: 2, type: 'park', name: '中心花园' }
            ],
            
            roads: [
                { x: 0, y: 5, width: 20, height: 1, type: 'road' },
                { x: 6, y: 0, width: 1, height: 15, type: 'road' },
                { x: 12, y: 0, width: 1, height: 15, type: 'road' }
            ],
            
            entrances: [
                { x: 0, y: 5, type: 'entrance', name: '小区东门' },
                { x: 19, y: 5, type: 'entrance', name: '小区西门' }
            ]
        },
        
        resources: {
            aedLocations: [
                { x: 5, y: 7, name: 'AED存放点1' },
                { x: 15, y: 7, name: 'AED存放点2' }
            ],
            volunteerStart: { x: 8, y: 5 },
            ambulanceStart: { x: 0, y: 5 }
        },
        
        patient: {
            x: 10,
            y: 12,
            name: '突发心脏病患者'
        },
        
        events: {
            enabled: true,
            eventChance: 0.3,
            maxEvents: 3
        },
        
        scoring: {
            bonusTime: 180,
            perfectTime: 120
        }
    },

    level2: {
        id: 'level2',
        name: '第2关 - 中等难度',
        description: '复杂的小区布局，需要规划更优路线',
        difficulty: 'medium',
        
        map: {
            width: 25,
            height: 18,
            gridSize: 40,
            
            buildings: [
                { x: 1, y: 1, width: 4, height: 4, type: 'building', name: '1号楼' },
                { x: 7, y: 1, width: 4, height: 4, type: 'building', name: '2号楼' },
                { x: 13, y: 1, width: 4, height: 4, type: 'building', name: '3号楼' },
                { x: 19, y: 1, width: 4, height: 4, type: 'building', name: '4号楼' },
                { x: 1, y: 7, width: 4, height: 3, type: 'building', name: '5号楼' },
                { x: 13, y: 7, width: 4, height: 3, type: 'building', name: '6号楼' },
                { x: 19, y: 7, width: 4, height: 3, type: 'building', name: '7号楼' },
                { x: 1, y: 13, width: 4, height: 4, type: 'building', name: '8号楼' },
                { x: 7, y: 13, width: 4, height: 4, type: 'building', name: '9号楼' },
                { x: 13, y: 13, width: 4, height: 4, type: 'building', name: '10号楼' },
                { x: 19, y: 13, width: 4, height: 4, type: 'building', name: '11号楼' }
            ],
            
            parks: [
                { x: 8, y: 8, width: 3, height: 3, type: 'park', name: '中心花园' },
                { x: 16, y: 11, width: 2, height: 1, type: 'park', name: '小广场' }
            ],
            
            waters: [
                { x: 10, y: 11, width: 3, height: 1, type: 'water', name: '景观池' }
            ],
            
            roads: [
                { x: 0, y: 5, width: 25, height: 1, type: 'road' },
                { x: 0, y: 10, width: 25, height: 1, type: 'road' },
                { x: 5, y: 0, width: 1, height: 18, type: 'road' },
                { x: 11, y: 0, width: 1, height: 18, type: 'road' },
                { x: 17, y: 0, width: 1, height: 18, type: 'road' }
            ],
            
            entrances: [
                { x: 0, y: 7, type: 'entrance', name: '小区北门' },
                { x: 24, y: 7, type: 'entrance', name: '小区南门' }
            ]
        },
        
        resources: {
            aedLocations: [
                { x: 3, y: 5, name: '北门AED' },
                { x: 14, y: 5, name: '中心AED' },
                { x: 21, y: 10, name: '南门AED' }
            ],
            volunteerStart: { x: 8, y: 5 },
            ambulanceStart: { x: 0, y: 7 }
        },
        
        patient: {
            x: 15,
            y: 15,
            name: '心跳骤停患者'
        },
        
        events: {
            enabled: true,
            eventChance: 0.5,
            maxEvents: 4
        },
        
        scoring: {
            bonusTime: 150,
            perfectTime: 100
        }
    },

    level3: {
        id: 'level3',
        name: '第3关 - 复杂场景',
        description: '大型社区，需要精准调度和快速决策',
        difficulty: 'hard',
        
        map: {
            width: 30,
            height: 22,
            gridSize: 40,
            
            buildings: [
                { x: 1, y: 1, width: 5, height: 5, type: 'building', name: 'A1座' },
                { x: 8, y: 1, width: 5, height: 5, type: 'building', name: 'A2座' },
                { x: 15, y: 1, width: 5, height: 5, type: 'building', name: 'A3座' },
                { x: 22, y: 1, width: 5, height: 5, type: 'building', name: 'A4座' },
                { x: 1, y: 8, width: 5, height: 4, type: 'building', name: 'B1座' },
                { x: 8, y: 8, width: 5, height: 4, type: 'building', name: 'B2座' },
                { x: 22, y: 8, width: 5, height: 4, type: 'building', name: 'B3座' },
                { x: 1, y: 15, width: 5, height: 5, type: 'building', name: 'C1座' },
                { x: 8, y: 15, width: 5, height: 5, type: 'building', name: 'C2座' },
                { x: 15, y: 15, width: 5, height: 5, type: 'building', name: 'C3座' },
                { x: 22, y: 15, width: 5, height: 5, type: 'building', name: 'C4座' }
            ],
            
            parks: [
                { x: 12, y: 10, width: 3, height: 3, type: 'park', name: '中央公园' },
                { x: 17, y: 7, width: 3, height: 2, type: 'park', name: '健身广场' }
            ],
            
            waters: [
                { x: 11, y: 13, width: 5, height: 1, type: 'water', name: '人工河' }
            ],
            
            roads: [
                { x: 0, y: 6, width: 30, height: 1, type: 'road' },
                { x: 0, y: 12, width: 30, height: 1, type: 'road' },
                { x: 6, y: 0, width: 1, height: 22, type: 'road' },
                { x: 13, y: 0, width: 1, height: 22, type: 'road' },
                { x: 20, y: 0, width: 1, height: 22, type: 'road' }
            ],
            
            entrances: [
                { x: 0, y: 9, type: 'entrance', name: '东门' },
                { x: 29, y: 9, type: 'entrance', name: '西门' },
                { x: 13, y: 0, type: 'entrance', name: '北门' }
            ]
        },
        
        resources: {
            aedLocations: [
                { x: 4, y: 6, name: '东区AED' },
                { x: 10, y: 6, name: '中区AED' },
                { x: 16, y: 6, name: '西区AED' },
                { x: 25, y: 12, name: '西南区AED' }
            ],
            volunteerStart: { x: 7, y: 9 },
            ambulanceStart: { x: 0, y: 9 }
        },
        
        patient: {
            x: 18,
            y: 18,
            name: '室颤患者'
        },
        
        events: {
            enabled: true,
            eventChance: 0.7,
            maxEvents: 5
        },
        
        scoring: {
            bonusTime: 120,
            perfectTime: 80
        }
    }
};

LEVELS.getLevel = function(levelId) {
    return LEVELS[levelId] || LEVELS.level1;
};

LEVELS.getAllLevels = function() {
    return Object.values(LEVELS).filter(level => typeof level === 'object' && level.id);
};

window.LEVELS = LEVELS;