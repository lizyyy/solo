/**
 * 窄水道避碰演练 - 测试用例
 * 用于验证各核心模块的功能正确性
 */

const TestRunner = {
    tests: [],
    passed: 0,
    failed: 0,

    addTest: function(name, testFn) {
        this.tests.push({ name, testFn });
    },

    run: function() {
        console.log('========================================');
        console.log('开始运行测试用例');
        console.log('========================================');

        this.passed = 0;
        this.failed = 0;

        for (const test of this.tests) {
            try {
                test.testFn();
                console.log(`✓ ${test.name}`);
                this.passed++;
            } catch (e) {
                console.log(`✗ ${test.name}`);
                console.error(`  错误: ${e.message}`);
                this.failed++;
            }
        }

        console.log('========================================');
        console.log(`测试完成: 通过 ${this.passed}/${this.tests.length}, 失败 ${this.failed}`);
        console.log('========================================');

        return { passed: this.passed, failed: this.failed, total: this.tests.length };
    },

    assert: function(condition, message = '断言失败') {
        if (!condition) {
            throw new Error(message);
        }
    },

    assertEqual: function(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message} 期望: ${expected}, 实际: ${actual}`);
        }
    },

    assertTrue: function(condition, message = '') {
        this.assert(condition, message || '应为 true');
    },

    assertFalse: function(condition, message = '') {
        this.assert(!condition, message || '应为 false');
    }
};

function assert(condition, message) {
    TestRunner.assert(condition, message);
}

function assertEqual(actual, expected, message) {
    TestRunner.assertEqual(actual, expected, message);
}

function assertTrue(condition, message) {
    TestRunner.assertTrue(condition, message);
}

function assertFalse(condition, message) {
    TestRunner.assertFalse(condition, message);
}

TestRunner.addTest('Board: 初始化棋盘尺寸正确', function() {
    const board = new Board(20, 16);
    assertEqual(board.width, 20);
    assertEqual(board.height, 16);
});

TestRunner.addTest('Board: 初始化后所有格子为深水航道', function() {
    const board = new Board(5, 5);
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 5; x++) {
            assertEqual(board.getTerrain(x, y), TerrainType.DEEP_WATER);
        }
    }
});

TestRunner.addTest('Board: 设置地形后正确读取', function() {
    const board = new Board(5, 5);
    board.setTerrain(2, 2, TerrainType.SHALLOW_WATER);
    assertEqual(board.getTerrain(2, 2), TerrainType.SHALLOW_WATER);
});

TestRunner.addTest('Board: 验证位置有效性', function() {
    const board = new Board(5, 5);
    assertTrue(board.isValidPos(0, 0));
    assertTrue(board.isValidPos(4, 4));
    assertFalse(board.isValidPos(-1, 0));
    assertFalse(board.isValidPos(5, 0));
    assertFalse(board.isValidPos(0, -1));
    assertFalse(board.isValidPos(0, 5));
});

TestRunner.addTest('Board: 越界位置返回边界地形', function() {
    const board = new Board(5, 5);
    assertEqual(board.getTerrain(-1, 0), TerrainType.BOUNDARY);
    assertEqual(board.getTerrain(5, 0), TerrainType.BOUNDARY);
});

TestRunner.addTest('Board: 浅滩不可进入', function() {
    const board = new Board(5, 5);
    board.setTerrain(2, 2, TerrainType.SHALLOW_WATER);
    assertFalse(board.canEnter(2, 2, ShipType.CARGO));
});

TestRunner.addTest('Board: 添加泊位后地形正确设置', function() {
    const board = new Board(5, 5);
    board.addBerth({ x: 2, y: 2, width: 1, height: 1, name: '测试泊位' });
    assertEqual(board.getTerrain(2, 2), TerrainType.BERTH);
});

TestRunner.addTest('Board: 添加潮流后可获取潮流影响', function() {
    const board = new Board(5, 5);
    board.addCurrent({ x: 1, y: 1, width: 2, height: 2, dx: 1, dy: 0, speed: 1, name: '测试潮流' });
    
    const effect = board.getCurrentEffect(1, 1);
    assertEqual(effect.dx, 1);
    assertEqual(effect.dy, 0);
});

TestRunner.addTest('Board: 非潮流区无潮流影响', function() {
    const board = new Board(5, 5);
    board.addCurrent({ x: 1, y: 1, width: 2, height: 2, dx: 1, dy: 0, speed: 1, name: '测试潮流' });
    
    const effect = board.getCurrentEffect(0, 0);
    assertEqual(effect.dx, 0);
    assertEqual(effect.dy, 0);
});

TestRunner.addTest('Ship: 初始化参数正确', function() {
    const ship = new Ship({
        id: 'test_ship',
        name: '测试船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED,
        maxSpeed: 2
    });
    
    assertEqual(ship.id, 'test_ship');
    assertEqual(ship.name, '测试船');
    assertEqual(ship.type, ShipType.CARGO);
    assertEqual(ship.x, 5);
    assertEqual(ship.y, 5);
    assertEqual(ship.mode, MovementMode.PLAYER_CONTROLLED);
    assertTrue(ship.isControllable());
});

TestRunner.addTest('Ship: 移动后位置正确', function() {
    const ship = new Ship({ x: 5, y: 5, mode: MovementMode.PLAYER_CONTROLLED });
    ship.move(2, 0);
    
    assertEqual(ship.x, 7);
    assertEqual(ship.y, 5);
    assertEqual(ship.dx, 2);
    assertEqual(ship.dy, 0);
});

TestRunner.addTest('Ship: 移动后记录上一位置', function() {
    const ship = new Ship({ x: 5, y: 5, mode: MovementMode.PLAYER_CONTROLLED });
    ship.move(1, 1);
    
    assertEqual(ship.prevX, 5);
    assertEqual(ship.prevY, 5);
});

TestRunner.addTest('Ship: 新船舶初始状态为活跃', function() {
    const ship = new Ship({ mode: MovementMode.PLAYER_CONTROLLED });
    assertTrue(ship.isActive());
    assertFalse(ship.isArrived());
});

TestRunner.addTest('Ship: 标记抵达后状态正确', function() {
    const ship = new Ship({ mode: MovementMode.PLAYER_CONTROLLED });
    ship.markArrived(10);
    
    assertTrue(ship.isArrived());
    assertFalse(ship.isActive());
    assertEqual(ship.arrivedAt, 10);
});

TestRunner.addTest('Ship: 不可控船舶不是玩家可控', function() {
    const aiShip = new Ship({ mode: MovementMode.AI_CONTROLLED });
    assertFalse(aiShip.isControllable());
    
    const presetShip = new Ship({ mode: MovementMode.PRESET_ROUTE });
    assertFalse(presetShip.isControllable());
});

TestRunner.addTest('Ship: 计算下一位置正确', function() {
    const ship = new Ship({ x: 5, y: 5, mode: MovementMode.PLAYER_CONTROLLED });
    const nextPos = ship.getNextPosition(2, -1);
    
    assertEqual(nextPos.x, 7);
    assertEqual(nextPos.y, 4);
});

TestRunner.addTest('Ship: 类型显示名称正确', function() {
    const tug = new Ship({ type: ShipType.TUG, mode: MovementMode.PLAYER_CONTROLLED });
    assertEqual(tug.getTypeDisplayName(), '拖轮');
    
    const cargo = new Ship({ type: ShipType.CARGO, mode: MovementMode.PLAYER_CONTROLLED });
    assertEqual(cargo.getTypeDisplayName(), '货船');
    
    const other = new Ship({ type: ShipType.OTHER, mode: MovementMode.PLAYER_CONTROLLED });
    assertEqual(other.getTypeDisplayName(), '来船');
});

TestRunner.addTest('Ship: 惯性初始为零', function() {
    const ship = new Ship({ mode: MovementMode.PLAYER_CONTROLLED });
    assertEqual(ship.inertia.dx, 0);
    assertEqual(ship.inertia.dy, 0);
});

TestRunner.addTest('Ship: 移动后设置惯性', function() {
    const ship = new Ship({ mode: MovementMode.PLAYER_CONTROLLED, inertiaDecay: 0.5 });
    ship.move(2, 0);
    
    assertEqual(ship.inertia.dx, 1);
    assertEqual(ship.inertia.dy, 0);
});

TestRunner.addTest('Level: 初始化默认值正确', function() {
    const level = new Level({ name: '测试关卡' });
    
    assertEqual(level.name, '测试关卡');
    assertEqual(level.difficulty, 'medium');
    assertEqual(level.boardData.width, 20);
    assertEqual(level.boardData.height, 16);
});

TestRunner.addTest('Level: 添加船舶后可获取', function() {
    const level = new Level({ name: '测试关卡' });
    
    level.addShip({
        name: '测试船1',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    
    assertEqual(level.ships.length, 1);
    assertEqual(level.ships[0].name, '测试船1');
});

TestRunner.addTest('Level: 删除船舶后数量正确', function() {
    const level = new Level({ name: '测试关卡' });
    
    const shipData = level.addShip({
        name: '测试船1',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    
    const shipId = shipData.id;
    assertEqual(level.ships.length, 1);
    
    level.removeShip(shipId);
    assertEqual(level.ships.length, 0);
});

TestRunner.addTest('Level: 验证无可控船舶时返回错误', function() {
    const level = new Level({ name: '测试关卡' });
    
    level.addShip({
        name: 'AI船',
        type: ShipType.OTHER,
        x: 5,
        y: 5,
        mode: MovementMode.AI_CONTROLLED
    });
    
    const validation = level.validate();
    assertFalse(validation.valid);
    assertTrue(validation.issues.some(i => i.type === 'error'));
});

TestRunner.addTest('Level: 有可控船舶时验证通过', function() {
    const level = new Level({ name: '测试关卡' });
    
    const boardData = level.boardData;
    boardData.grid = [];
    for (let y = 0; y < boardData.height; y++) {
        const row = [];
        for (let x = 0; x < boardData.width; x++) {
            row.push({
                terrain: TerrainType.DEEP_WATER,
                speedLimit: 2,
                berthId: null,
                currentId: null
            });
        }
        boardData.grid.push(row);
    }
    
    level.addShip({
        name: '可控船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    
    level.addBerth({ x: 10, y: 5, width: 1, height: 1, name: '泊位1' });
    
    const validation = level.validate();
    assertTrue(validation.valid);
});

TestRunner.addTest('GameEngine: 初始化模式为编辑', function() {
    const engine = new GameEngine();
    assertEqual(engine.getMode(), GameMode.EDIT);
});

TestRunner.addTest('GameEngine: 切换模式正确', function() {
    const engine = new GameEngine();
    engine.setMode(GameMode.PLAY);
    assertEqual(engine.getMode(), GameMode.PLAY);
});

TestRunner.addTest('GameEngine: 添加船舶后可获取', function() {
    const engine = new GameEngine();
    const ship = new Ship({
        name: '测试船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    engine.addShip(ship);
    
    assertEqual(engine.ships.length, 1);
    assertEqual(engine.getControllableShips().length, 1);
});

TestRunner.addTest('GameEngine: 选择船舶后可获取选中船舶', function() {
    const engine = new GameEngine();
    const ship = new Ship({
        id: 'test_id',
        name: '测试船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    engine.addShip(ship);
    
    engine.selectShip('test_id');
    const selected = engine.getSelectedShip();
    
    assertTrue(selected !== null);
    assertEqual(selected.id, 'test_id');
});

TestRunner.addTest('GameEngine: 不可选择AI控制船舶', function() {
    const engine = new GameEngine();
    const ship = new Ship({
        id: 'ai_id',
        name: 'AI船',
        type: ShipType.OTHER,
        x: 5,
        y: 5,
        mode: MovementMode.AI_CONTROLLED
    });
    engine.addShip(ship);
    
    assertFalse(engine.selectShip('ai_id'));
});

TestRunner.addTest('GameEngine: 规划有效移动返回成功', function() {
    const engine = new GameEngine();
    engine.board = new Board(10, 10);
    
    const ship = new Ship({
        id: 'test_id',
        name: '测试船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    engine.addShip(ship);
    
    const result = engine.planMove('test_id', 1, 0);
    assertTrue(result.valid);
});

TestRunner.addTest('GameEngine: 规划越界移动返回失败', function() {
    const engine = new GameEngine();
    engine.board = new Board(10, 10);
    
    const ship = new Ship({
        id: 'test_id',
        name: '测试船',
        type: ShipType.CARGO,
        x: 0,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    engine.addShip(ship);
    
    const result = engine.planMove('test_id', -1, 0);
    assertFalse(result.valid);
});

TestRunner.addTest('GameEngine: 规划驶向浅滩返回失败', function() {
    const engine = new GameEngine();
    engine.board = new Board(10, 10);
    engine.board.setTerrain(6, 5, TerrainType.SHALLOW_WATER);
    
    const ship = new Ship({
        id: 'test_id',
        name: '测试船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    engine.addShip(ship);
    
    const result = engine.planMove('test_id', 1, 0);
    assertFalse(result.valid);
});

TestRunner.addTest('GameEngine: 开始游戏后回合为1', function() {
    const engine = new GameEngine();
    engine.startGame();
    
    assertTrue(engine.gameStarted);
    assertEqual(engine.turn, 1);
});

TestRunner.addTest('GameEngine: 执行回合后回合递增', function() {
    const engine = new GameEngine();
    engine.board = new Board(10, 10);
    
    const ship = new Ship({
        id: 'test_id',
        name: '测试船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    engine.addShip(ship);
    
    engine.startGame();
    const initialTurn = engine.turn;
    
    engine.planMove('test_id', 1, 0);
    engine.executeTurn();
    
    assertEqual(engine.turn, initialTurn + 1);
});

TestRunner.addTest('GameEngine: 初始化关卡后数据正确', function() {
    const level = new Level({
        name: '测试关卡',
        totalTurns: 25
    });
    
    const boardData = level.boardData;
    boardData.grid = [];
    for (let y = 0; y < boardData.height; y++) {
        const row = [];
        for (let x = 0; x < boardData.width; x++) {
            row.push({
                terrain: TerrainType.DEEP_WATER,
                speedLimit: 2,
                berthId: null,
                currentId: null
            });
        }
        boardData.grid.push(row);
    }
    
    level.addShip({
        name: '测试船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    
    const engine = new GameEngine();
    engine.initLevel(level);
    
    assertEqual(engine.totalTurns, 25);
    assertEqual(engine.ships.length, 1);
});

TestRunner.addTest('GameEngine: 扣分初始为零', function() {
    const engine = new GameEngine();
    assertEqual(engine.penaltyPoints, 0);
});

TestRunner.addTest('GameEngine: 添加事故后扣分增加', function() {
    const engine = new GameEngine();
    engine.addIncident({
        type: IncidentType.COLLISION,
        turn: 1,
        ships: ['test_id'],
        description: '测试碰撞'
    });
    
    assertEqual(engine.penaltyPoints, 10);
    assertEqual(engine.incidents.length, 1);
});

TestRunner.addTest('GameEngine: 不同事故类型扣分不同', function() {
    const engine = new GameEngine();
    engine.addIncident({
        type: IncidentType.SHALLOW,
        turn: 1,
        ships: ['test_id'],
        description: '测试浅滩'
    });
    
    assertEqual(engine.penaltyPoints, 5);
});

TestRunner.addTest('GameEngine: 所有可控船舶都规划移动后返回true', function() {
    const engine = new GameEngine();
    engine.board = new Board(10, 10);
    
    const ship1 = new Ship({
        id: 'ship1',
        name: '船1',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    
    const ship2 = new Ship({
        id: 'ship2',
        name: '船2',
        type: ShipType.TUG,
        x: 5,
        y: 6,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    
    engine.addShip(ship1);
    engine.addShip(ship2);
    
    assertFalse(engine.allControllableShipsMoved());
    
    engine.planMove('ship1', 1, 0);
    assertFalse(engine.allControllableShipsMoved());
    
    engine.planMove('ship2', 1, 0);
    assertTrue(engine.allControllableShipsMoved());
});

TestRunner.addTest('SampleLevels: 能获取所有示例关卡', function() {
    const levels = SampleLevels.getAllLevels();
    assertEqual(levels.length, 3);
});

TestRunner.addTest('SampleLevels: 示例关卡名称正确', function() {
    const names = SampleLevels.getLevelNames();
    assertEqual(names.length, 3);
    assertTrue(names.includes('基础进港练习'));
    assertTrue(names.includes('潮流区避碰'));
    assertTrue(names.includes('复杂港内操纵'));
});

TestRunner.addTest('SampleLevels: 每个关卡有可控船舶', function() {
    const levels = SampleLevels.getAllLevels();
    
    for (const level of levels) {
        const controllable = level.ships.filter(s => s.mode === MovementMode.PLAYER_CONTROLLED);
        assertTrue(controllable.length > 0, `关卡 ${level.name} 应有可控船舶`);
    }
});

TestRunner.addTest('SampleLevels: 每个关卡有泊位', function() {
    const levels = SampleLevels.getAllLevels();
    
    for (const level of levels) {
        const berths = level.boardData.berths || [];
        assertTrue(berths.length > 0, `关卡 ${level.name} 应有泊位`);
    }
});

TestRunner.addTest('UndoManager: 初始无历史记录', function() {
    const engine = new GameEngine();
    const editor = new LevelEditor(engine);
    
    const undoManager = new UndoManager(engine, editor, null);
    assertFalse(undoManager.canUndo());
    assertFalse(undoManager.canRedo());
});

TestRunner.addTest('UndoManager: 保存状态后可撤销', function() {
    const engine = new GameEngine();
    engine.board = new Board(10, 10);
    
    const ship = new Ship({
        id: 'test_id',
        name: '测试船',
        type: ShipType.CARGO,
        x: 5,
        y: 5,
        mode: MovementMode.PLAYER_CONTROLLED
    });
    engine.addShip(ship);
    
    const editor = new LevelEditor(engine);
    const undoManager = new UndoManager(engine, editor, null);
    
    engine.turn = 5;
    undoManager.saveState();
    assertTrue(undoManager.canUndo());
});

TestRunner.addTest('Storage: 支持localStorage', function() {
    const storage = new Storage();
    assertTrue(storage.isSupported());
});

console.log('测试用例已加载。请在浏览器控制台运行 TestRunner.run() 执行测试。');
