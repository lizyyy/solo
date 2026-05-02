/**
 * 关卡数据模块
 * 定义所有内置关卡
 */

export const TileType = {
    FLOOR: 0,
    WALL: 1,
    DOOR: 2,
    STAIRS: 3,
    EXIT: 4,
    SMOKE_SOURCE: 5,
    ROOM: 6,
    CORRIDOR: 0
};

export const Direction = {
    UP: 0,
    RIGHT: 1,
    DOWN: 2,
    LEFT: 3
};

const createLevel1 = () => {
    const width = 16;
    const height = 12;
    const grid = Array(height).fill(null).map(() => Array(width).fill(TileType.FLOOR));
    
    for (let x = 0; x < width; x++) {
        grid[0][x] = TileType.WALL;
        grid[height-1][x] = TileType.WALL;
    }
    for (let y = 0; y < height; y++) {
        grid[y][0] = TileType.WALL;
        grid[y][width-1] = TileType.WALL;
    }
    
    for (let x = 0; x < width; x++) {
        if (x !== 7 && x !== 8) {
            grid[4][x] = TileType.WALL;
        }
        if (x !== 7 && x !== 8) {
            grid[8][x] = TileType.WALL;
        }
    }
    
    for (let y = 0; y < height; y++) {
        if (y !== 2 && y !== 3) {
            grid[y][5] = TileType.WALL;
        }
        if (y !== 6 && y !== 7) {
            grid[y][10] = TileType.WALL;
        }
    }
    
    grid[4][7] = TileType.DOOR;
    grid[4][8] = TileType.DOOR;
    grid[8][7] = TileType.DOOR;
    grid[8][8] = TileType.DOOR;
    grid[2][5] = TileType.DOOR;
    grid[3][5] = TileType.DOOR;
    grid[6][10] = TileType.DOOR;
    grid[7][10] = TileType.DOOR;
    
    grid[0][2] = TileType.EXIT;
    grid[0][13] = TileType.EXIT;
    grid[height-1][7] = TileType.EXIT;
    
    grid[2][2] = TileType.SMOKE_SOURCE;
    grid[10][13] = TileType.SMOKE_SOURCE;
    
    grid[2][12] = TileType.STAIRS;
    grid[9][3] = TileType.STAIRS;
    
    return {
        id: 'level1',
        name: '初级关卡',
        title: '教学楼一层',
        description: '简单的楼层布局，学习基本的疏散路线规划。有2个烟雾源，3个出口。需要规划安全的疏散路线，注意避开烟雾区域。',
        difficulty: 'easy',
        timeLimit: 120,
        width,
        height,
        grid,
        people: [
            { x: 2, y: 2, type: 'normal', id: 'p1' },
            { x: 3, y: 3, type: 'normal', id: 'p2' },
            { x: 12, y: 2, type: 'normal', id: 'p3' },
            { x: 13, y: 3, type: 'normal', id: 'p4' },
            { x: 2, y: 9, type: 'disabled', id: 'p5', needsHelp: true },
            { x: 12, y: 9, type: 'normal', id: 'p6' },
            { x: 7, y: 6, type: 'normal', id: 'p7' },
            { x: 8, y: 6, type: 'normal', id: 'p8' }
        ],
        smokeSources: [
            { x: 2, y: 2, intensity: 1.0 },
            { x: 13, y: 10, intensity: 0.8 }
        ],
        exits: [
            { x: 2, y: 0, capacity: 5 },
            { x: 13, y: 0, capacity: 5 },
            { x: 7, y: 11, capacity: 8 }
        ],
        stairs: [
            { x: 12, y: 2, capacity: 3 },
            { x: 3, y: 9, capacity: 3 }
        ],
        maxExtinguishers: 2,
        maxArrows: 15,
        maxBlocks: 2,
        requiredAssemblyPoints: 1,
        hazards: [
            { x: 4, y: 2, type: 'blocked_door', description: '危险门-通往烟雾区' },
            { x: 11, y: 10, type: 'blocked_door', description: '危险门-通往烟雾区' }
        ],
        objectives: [
            '所有人员安全疏散',
            '救援行动不便人员',
            '避免进入烟雾区域',
            '确保楼梯口不拥堵'
        ]
    };
};

const createLevel2 = () => {
    const width = 20;
    const height = 14;
    const grid = Array(height).fill(null).map(() => Array(width).fill(TileType.FLOOR));
    
    for (let x = 0; x < width; x++) {
        grid[0][x] = TileType.WALL;
        grid[height-1][x] = TileType.WALL;
    }
    for (let y = 0; y < height; y++) {
        grid[y][0] = TileType.WALL;
        grid[y][width-1] = TileType.WALL;
    }
    
    for (let x = 1; x < width - 1; x++) {
        if (x !== 5 && x !== 6 && x !== 14 && x !== 15) {
            grid[5][x] = TileType.WALL;
        }
        if (x !== 9 && x !== 10) {
            grid[10][x] = TileType.WALL;
        }
    }
    
    for (let y = 1; y < height - 1; y++) {
        if (y !== 3 && y !== 4 && y !== 8 && y !== 9) {
            grid[y][6] = TileType.WALL;
        }
        if (y !== 2 && y !== 3 && y !== 7 && y !== 8) {
            grid[y][13] = TileType.WALL;
        }
    }
    
    for (let x = 8; x <= 11; x++) {
        grid[3][x] = TileType.WALL;
    }
    for (let y = 3; y <= 5; y++) {
        grid[y][8] = TileType.WALL;
        grid[y][11] = TileType.WALL;
    }
    grid[5][9] = TileType.DOOR;
    grid[5][10] = TileType.DOOR;
    
    grid[5][5] = TileType.DOOR;
    grid[5][6] = TileType.DOOR;
    grid[5][14] = TileType.DOOR;
    grid[5][15] = TileType.DOOR;
    grid[10][9] = TileType.DOOR;
    grid[10][10] = TileType.DOOR;
    grid[3][6] = TileType.DOOR;
    grid[4][6] = TileType.DOOR;
    grid[8][6] = TileType.DOOR;
    grid[9][6] = TileType.DOOR;
    grid[2][13] = TileType.DOOR;
    grid[3][13] = TileType.DOOR;
    grid[7][13] = TileType.DOOR;
    grid[8][13] = TileType.DOOR;
    
    grid[0][3] = TileType.EXIT;
    grid[0][10] = TileType.EXIT;
    grid[0][17] = TileType.EXIT;
    grid[height-1][10] = TileType.EXIT;
    
    grid[3][3] = TileType.SMOKE_SOURCE;
    grid[11][16] = TileType.SMOKE_SOURCE;
    grid[7][4] = TileType.SMOKE_SOURCE;
    
    grid[2][9] = TileType.STAIRS;
    grid[2][10] = TileType.STAIRS;
    grid[11][9] = TileType.STAIRS;
    grid[11][10] = TileType.STAIRS;
    
    return {
        id: 'level2',
        name: '中级关卡',
        title: '办公楼三层',
        description: '复杂的办公楼布局，包含多个房间和走廊。有3个烟雾源，4个出口。需要仔细规划路线，特别注意行动不便人员的救援和楼梯口的拥堵问题。',
        difficulty: 'medium',
        timeLimit: 180,
        width,
        height,
        grid,
        people: [
            { x: 3, y: 3, type: 'normal', id: 'p1' },
            { x: 4, y: 3, type: 'normal', id: 'p2' },
            { x: 9, y: 4, type: 'normal', id: 'p3' },
            { x: 10, y: 4, type: 'normal', id: 'p4' },
            { x: 16, y: 3, type: 'normal', id: 'p5' },
            { x: 17, y: 4, type: 'normal', id: 'p6' },
            { x: 3, y: 8, type: 'disabled', id: 'p7', needsHelp: true },
            { x: 4, y: 8, type: 'normal', id: 'p8' },
            { x: 9, y: 8, type: 'normal', id: 'p9' },
            { x: 10, y: 8, type: 'normal', id: 'p10' },
            { x: 16, y: 8, type: 'normal', id: 'p11' },
            { x: 17, y: 8, type: 'disabled', id: 'p12', needsHelp: true },
            { x: 3, y: 12, type: 'normal', id: 'p13' },
            { x: 17, y: 12, type: 'normal', id: 'p14' }
        ],
        smokeSources: [
            { x: 3, y: 3, intensity: 1.2 },
            { x: 16, y: 11, intensity: 1.0 },
            { x: 4, y: 7, intensity: 0.9 }
        ],
        exits: [
            { x: 3, y: 0, capacity: 6 },
            { x: 10, y: 0, capacity: 8 },
            { x: 17, y: 0, capacity: 6 },
            { x: 10, y: 13, capacity: 8 }
        ],
        stairs: [
            { x: 9, y: 2, capacity: 4 },
            { x: 10, y: 2, capacity: 4 },
            { x: 9, y: 11, capacity: 4 },
            { x: 10, y: 11, capacity: 4 }
        ],
        maxExtinguishers: 3,
        maxArrows: 25,
        maxBlocks: 4,
        requiredAssemblyPoints: 2,
        hazards: [
            { x: 5, y: 4, type: 'blocked_door', description: '危险门-直接通往烟雾区' },
            { x: 14, y: 4, type: 'blocked_door', description: '危险门-通往潜在烟雾区' },
            { x: 5, y: 9, type: 'blocked_door', description: '危险门-通往烟雾区' }
        ],
        objectives: [
            '所有人员安全疏散',
            '救援所有行动不便人员（2人）',
            '避免路线进入烟雾区域',
            '确保所有楼梯口不拥堵',
            '设置2个集合点'
        ]
    };
};

const createLevel3 = () => {
    const width = 24;
    const height = 16;
    const grid = Array(height).fill(null).map(() => Array(width).fill(TileType.FLOOR));
    
    for (let x = 0; x < width; x++) {
        grid[0][x] = TileType.WALL;
        grid[height-1][x] = TileType.WALL;
    }
    for (let y = 0; y < height; y++) {
        grid[y][0] = TileType.WALL;
        grid[y][width-1] = TileType.WALL;
    }
    
    for (let x = 1; x < width - 1; x++) {
        if (x !== 4 && x !== 5 && x !== 11 && x !== 12 && x !== 18 && x !== 19) {
            grid[4][x] = TileType.WALL;
        }
        if (x !== 4 && x !== 5 && x !== 11 && x !== 12 && x !== 18 && x !== 19) {
            grid[8][x] = TileType.WALL;
        }
        if (x !== 11 && x !== 12) {
            grid[12][x] = TileType.WALL;
        }
    }
    
    for (let y = 1; y < height - 1; y++) {
        if (y !== 2 && y !== 3 && y !== 6 && y !== 7 && y !== 10 && y !== 11) {
            grid[y][8] = TileType.WALL;
        }
        if (y !== 2 && y !== 3 && y !== 6 && y !== 7 && y !== 10 && y !== 11) {
            grid[y][15] = TileType.WALL;
        }
    }
    
    for (let x = 3; x <= 6; x++) {
        grid[6][x] = TileType.WALL;
    }
    for (let y = 2; y <= 6; y++) {
        grid[y][3] = TileType.WALL;
        grid[y][6] = TileType.WALL;
    }
    grid[6][4] = TileType.DOOR;
    grid[6][5] = TileType.DOOR;
    
    for (let x = 17; x <= 20; x++) {
        grid[6][x] = TileType.WALL;
    }
    for (let y = 2; y <= 6; y++) {
        grid[y][17] = TileType.WALL;
        grid[y][20] = TileType.WALL;
    }
    grid[6][18] = TileType.DOOR;
    grid[6][19] = TileType.DOOR;
    
    grid[4][4] = TileType.DOOR;
    grid[4][5] = TileType.DOOR;
    grid[4][11] = TileType.DOOR;
    grid[4][12] = TileType.DOOR;
    grid[4][18] = TileType.DOOR;
    grid[4][19] = TileType.DOOR;
    grid[8][4] = TileType.DOOR;
    grid[8][5] = TileType.DOOR;
    grid[8][11] = TileType.DOOR;
    grid[8][12] = TileType.DOOR;
    grid[8][18] = TileType.DOOR;
    grid[8][19] = TileType.DOOR;
    grid[12][11] = TileType.DOOR;
    grid[12][12] = TileType.DOOR;
    grid[2][8] = TileType.DOOR;
    grid[3][8] = TileType.DOOR;
    grid[6][8] = TileType.DOOR;
    grid[7][8] = TileType.DOOR;
    grid[10][8] = TileType.DOOR;
    grid[11][8] = TileType.DOOR;
    grid[2][15] = TileType.DOOR;
    grid[3][15] = TileType.DOOR;
    grid[6][15] = TileType.DOOR;
    grid[7][15] = TileType.DOOR;
    grid[10][15] = TileType.DOOR;
    grid[11][15] = TileType.DOOR;
    
    grid[0][2] = TileType.EXIT;
    grid[0][11] = TileType.EXIT;
    grid[0][12] = TileType.EXIT;
    grid[0][21] = TileType.EXIT;
    grid[height-1][11] = TileType.EXIT;
    grid[height-1][12] = TileType.EXIT;
    
    grid[4][4] = TileType.SMOKE_SOURCE;
    grid[4][19] = TileType.SMOKE_SOURCE;
    grid[10][4] = TileType.SMOKE_SOURCE;
    grid[10][19] = TileType.SMOKE_SOURCE;
    
    grid[2][10] = TileType.STAIRS;
    grid[2][13] = TileType.STAIRS;
    grid[13][10] = TileType.STAIRS;
    grid[13][13] = TileType.STAIRS;
    
    return {
        id: 'level3',
        name: '高级关卡',
        title: '医院病房楼',
        description: '最复杂的医院布局，包含多个病房区和走廊。有4个烟雾源，6个出口。需要救援多名行动不便的病人，特别注意楼梯口的拥堵和烟雾的快速扩散。',
        difficulty: 'hard',
        timeLimit: 240,
        width,
        height,
        grid,
        people: [
            { x: 4, y: 3, type: 'normal', id: 'p1' },
            { x: 5, y: 3, type: 'normal', id: 'p2' },
            { x: 11, y: 3, type: 'normal', id: 'p3' },
            { x: 12, y: 3, type: 'normal', id: 'p4' },
            { x: 18, y: 3, type: 'normal', id: 'p5' },
            { x: 19, y: 3, type: 'normal', id: 'p6' },
            { x: 4, y: 5, type: 'disabled', id: 'p7', needsHelp: true },
            { x: 5, y: 5, type: 'normal', id: 'p8' },
            { x: 18, y: 5, type: 'disabled', id: 'p9', needsHelp: true },
            { x: 19, y: 5, type: 'normal', id: 'p10' },
            { x: 4, y: 7, type: 'normal', id: 'p11' },
            { x: 5, y: 7, type: 'normal', id: 'p12' },
            { x: 11, y: 7, type: 'normal', id: 'p13' },
            { x: 12, y: 7, type: 'normal', id: 'p14' },
            { x: 18, y: 7, type: 'normal', id: 'p15' },
            { x: 19, y: 7, type: 'normal', id: 'p16' },
            { x: 4, y: 10, type: 'disabled', id: 'p17', needsHelp: true },
            { x: 5, y: 10, type: 'normal', id: 'p18' },
            { x: 11, y: 10, type: 'normal', id: 'p19' },
            { x: 12, y: 10, type: 'normal', id: 'p20' },
            { x: 18, y: 10, type: 'disabled', id: 'p21', needsHelp: true },
            { x: 19, y: 10, type: 'normal', id: 'p22' },
            { x: 4, y: 14, type: 'normal', id: 'p23' },
            { x: 5, y: 14, type: 'normal', id: 'p24' },
            { x: 18, y: 14, type: 'normal', id: 'p25' },
            { x: 19, y: 14, type: 'normal', id: 'p26' }
        ],
        smokeSources: [
            { x: 4, y: 4, intensity: 1.5 },
            { x: 19, y: 4, intensity: 1.3 },
            { x: 4, y: 10, intensity: 1.4 },
            { x: 19, y: 10, intensity: 1.2 }
        ],
        exits: [
            { x: 2, y: 0, capacity: 6 },
            { x: 11, y: 0, capacity: 10 },
            { x: 12, y: 0, capacity: 10 },
            { x: 21, y: 0, capacity: 6 },
            { x: 11, y: 15, capacity: 10 },
            { x: 12, y: 15, capacity: 10 }
        ],
        stairs: [
            { x: 10, y: 2, capacity: 5 },
            { x: 13, y: 2, capacity: 5 },
            { x: 10, y: 13, capacity: 5 },
            { x: 13, y: 13, capacity: 5 }
        ],
        maxExtinguishers: 4,
        maxArrows: 35,
        maxBlocks: 6,
        requiredAssemblyPoints: 3,
        hazards: [
            { x: 6, y: 4, type: 'blocked_door', description: '危险门-通往烟雾病房' },
            { x: 17, y: 4, type: 'blocked_door', description: '危险门-通往烟雾病房' },
            { x: 6, y: 10, type: 'blocked_door', description: '危险门-通往烟雾区' },
            { x: 17, y: 10, type: 'blocked_door', description: '危险门-通往烟雾区' }
        ],
        objectives: [
            '所有26名人员安全疏散',
            '救援所有行动不便人员（4人）',
            '完全避开所有烟雾区域',
            '确保所有楼梯口不拥堵',
            '设置3个集合点',
            '在时间限制内完成疏散'
        ]
    };
};

export const levels = {
    level1: createLevel1(),
    level2: createLevel2(),
    level3: createLevel3()
};

export const getLevelById = (id) => {
    return levels[id] || null;
};

export const getAllLevels = () => {
    return Object.values(levels);
};

export const getLevelNames = () => {
    return Object.values(levels).map(level => ({
        id: level.id,
        name: level.name,
        title: level.title,
        difficulty: level.difficulty
    }));
};
