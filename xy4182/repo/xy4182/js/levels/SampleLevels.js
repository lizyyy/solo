/**
 * 示例关卡数据
 * 提供预定义的练习关卡
 */

const SampleLevels = {
    getLevel1: function() {
        const level = new Level({
            name: '基础进港练习',
            description: '简单的进港场景，学习基本操船',
            author: '港航学院',
            difficulty: 'easy',
            totalTurns: 15,
            tags: ['入门', '进港', '无潮流']
        });
        
        const boardData = level.boardData;
        
        for (let y = 0; y < boardData.height; y++) {
            for (let x = 0; x < boardData.width; x++) {
                if (!boardData.grid[y]) boardData.grid[y] = [];
                boardData.grid[y][x] = {
                    terrain: TerrainType.DEEP_WATER,
                    speedLimit: 2,
                    berthId: null,
                    currentId: null
                };
            }
        }
        
        for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 3; x++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
        }
        
        for (let y = 11; y < 16; y++) {
            for (let x = 0; x < 3; x++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
        }
        
        for (let x = 0; x < 3; x++) {
            if (boardData.grid[5] && boardData.grid[5][x]) {
                boardData.grid[5][x].terrain = TerrainType.SHALLOW_WATER;
            }
            if (boardData.grid[10] && boardData.grid[10][x]) {
                boardData.grid[10][x].terrain = TerrainType.SHALLOW_WATER;
            }
        }
        
        level.addBerth({
            x: 18,
            y: 7,
            width: 1,
            height: 2,
            name: '货船泊位',
            shipType: ShipType.CARGO
        });
        
        level.addBerth({
            x: 18,
            y: 3,
            width: 1,
            height: 2,
            name: '拖轮泊位',
            shipType: ShipType.TUG
        });
        
        for (let x = 8; x < 15; x++) {
            for (let y = 6; y < 10; y++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SPEED_LIMIT;
                    boardData.grid[y][x].speedLimit = 1;
                }
            }
        }
        
        level.addShip({
            name: '货船-长江号',
            type: ShipType.CARGO,
            x: 2,
            y: 7,
            mode: MovementMode.PLAYER_CONTROLLED,
            targetBerthId: 0,
            maxSpeed: 2
        });
        
        level.addShip({
            name: '拖轮-港拖1号',
            type: ShipType.TUG,
            x: 2,
            y: 5,
            mode: MovementMode.PLAYER_CONTROLLED,
            targetBerthId: 1,
            maxSpeed: 2
        });
        
        level.addShip({
            name: '来船-外贸船',
            type: ShipType.OTHER,
            x: 15,
            y: 7,
            mode: MovementMode.PRESET_ROUTE,
            route: [
                { dx: -1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 0 },
                { dx: 0, dy: 0 }
            ],
            maxSpeed: 1
        });
        
        return level;
    },

    getLevel2: function() {
        const level = new Level({
            name: '潮流区避碰',
            description: '有潮流影响的复杂会遇场景',
            author: '港航学院',
            difficulty: 'medium',
            totalTurns: 20,
            tags: ['潮流', '会遇', '交叉相遇']
        });
        
        const boardData = level.boardData;
        
        for (let y = 0; y < boardData.height; y++) {
            for (let x = 0; x < boardData.width; x++) {
                if (!boardData.grid[y]) boardData.grid[y] = [];
                boardData.grid[y][x] = {
                    terrain: TerrainType.DEEP_WATER,
                    speedLimit: 2,
                    berthId: null,
                    currentId: null
                };
            }
        }
        
        for (let y = 0; y < 4; y++) {
            for (let x = 0; x < boardData.width; x++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
        }
        
        for (let y = 12; y < boardData.height; y++) {
            for (let x = 0; x < boardData.width; x++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
        }
        
        for (let y = 4; y < 12; y++) {
            for (let x = 0; x < 5; x++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
        }
        
        level.addBerth({
            x: 18,
            y: 6,
            width: 1,
            height: 4,
            name: '主泊位',
            shipType: null
        });
        
        level.addCurrent({
            x: 5,
            y: 4,
            width: 13,
            height: 8,
            dx: 1,
            dy: 0,
            speed: 1,
            name: '主航道东流'
        });
        
        level.addCurrent({
            x: 10,
            y: 5,
            width: 5,
            height: 6,
            dx: 1,
            dy: 1,
            speed: 1,
            name: '转向涡流'
        });
        
        level.addShip({
            name: '货船-海昌号',
            type: ShipType.CARGO,
            x: 6,
            y: 8,
            mode: MovementMode.PLAYER_CONTROLLED,
            targetBerthId: 0,
            maxSpeed: 2
        });
        
        level.addShip({
            name: '来船-A(交叉)',
            type: ShipType.OTHER,
            x: 12,
            y: 5,
            mode: MovementMode.PRESET_ROUTE,
            route: [
                { dx: 0, dy: 1 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: 0 },
                { dx: 0, dy: 0 }
            ],
            maxSpeed: 1
        });
        
        level.addShip({
            name: '来船-B(对遇)',
            type: ShipType.OTHER,
            x: 15,
            y: 7,
            mode: MovementMode.PRESET_ROUTE,
            route: [
                { dx: -1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 0 }
            ],
            maxSpeed: 1
        });
        
        return level;
    },

    getLevel3: function() {
        const level = new Level({
            name: '复杂港内操纵',
            description: '多船会遇、惯性停靠的高级场景',
            author: '港航学院',
            difficulty: 'hard',
            totalTurns: 25,
            tags: ['多船', '惯性', '泊位停靠']
        });
        
        const boardData = level.boardData;
        
        for (let y = 0; y < boardData.height; y++) {
            for (let x = 0; x < boardData.width; x++) {
                if (!boardData.grid[y]) boardData.grid[y] = [];
                boardData.grid[y][x] = {
                    terrain: TerrainType.DEEP_WATER,
                    speedLimit: 2,
                    berthId: null,
                    currentId: null
                };
            }
        }
        
        for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 2; y++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
            for (let y = 14; y < 16; y++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
        }
        
        for (let x = 17; x < 20; x++) {
            for (let y = 0; y < 3; y++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
            for (let y = 13; y < 16; y++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SHALLOW_WATER;
                }
            }
        }
        
        level.addBerth({
            x: 18,
            y: 4,
            width: 1,
            height: 2,
            name: '泊位A',
            shipType: ShipType.CARGO
        });
        
        level.addBerth({
            x: 18,
            y: 7,
            width: 1,
            height: 2,
            name: '泊位B',
            shipType: ShipType.CARGO
        });
        
        level.addBerth({
            x: 18,
            y: 10,
            width: 1,
            height: 2,
            name: '泊位C(拖轮)',
            shipType: ShipType.TUG
        });
        
        for (let x = 8; x < 18; x++) {
            for (let y = 3; y < 13; y++) {
                if (boardData.grid[y] && boardData.grid[y][x]) {
                    boardData.grid[y][x].terrain = TerrainType.SPEED_LIMIT;
                    boardData.grid[y][x].speedLimit = 1;
                }
            }
        }
        
        level.addCurrent({
            x: 5,
            y: 5,
            width: 10,
            height: 6,
            dx: 0,
            dy: 1,
            speed: 1,
            name: '港内南流'
        });
        
        level.addShip({
            name: '货船-明华轮',
            type: ShipType.CARGO,
            x: 3,
            y: 5,
            mode: MovementMode.PLAYER_CONTROLLED,
            targetBerthId: 0,
            maxSpeed: 2
        });
        
        level.addShip({
            name: '货船-远通号',
            type: ShipType.CARGO,
            x: 3,
            y: 8,
            mode: MovementMode.PLAYER_CONTROLLED,
            targetBerthId: 1,
            maxSpeed: 2
        });
        
        level.addShip({
            name: '拖轮-港拖3号',
            type: ShipType.TUG,
            x: 3,
            y: 11,
            mode: MovementMode.PLAYER_CONTROLLED,
            targetBerthId: 2,
            maxSpeed: 2
        });
        
        level.addShip({
            name: '来船-引航船',
            type: ShipType.OTHER,
            x: 10,
            y: 3,
            mode: MovementMode.PRESET_ROUTE,
            route: [
                { dx: 0, dy: 1 },
                { dx: 0, dy: 1 },
                { dx: 0, dy: 1 },
                { dx: -1, dy: 0 },
                { dx: -1, dy: 0 },
                { dx: 0, dy: 0 }
            ],
            maxSpeed: 1
        });
        
        level.addShip({
            name: '来船-巡逻艇',
            type: ShipType.OTHER,
            x: 12,
            y: 12,
            mode: MovementMode.AI_CONTROLLED,
            maxSpeed: 1
        });
        
        return level;
    },

    getAllLevels: function() {
        return [
            this.getLevel1(),
            this.getLevel2(),
            this.getLevel3()
        ];
    },

    getLevelNames: function() {
        return [
            '基础进港练习',
            '潮流区避碰',
            '复杂港内操纵'
        ];
    }
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { SampleLevels };
}
