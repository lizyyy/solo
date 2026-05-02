var TestRunner = function() {
    this.tests = [];
    this.results = [];
    this.passedCount = 0;
    this.failedCount = 0;
};

TestRunner.prototype.addTest = function(name, testFunction) {
    this.tests.push({
        name: name,
        test: testFunction
    });
};

TestRunner.prototype.runAll = function() {
    this.results = [];
    this.passedCount = 0;
    this.failedCount = 0;
    
    console.log('========================================');
    console.log('🤖 开始运行测试套件');
    console.log('========================================');
    
    for (var i = 0; i < this.tests.length; i++) {
        var test = this.tests[i];
        var result = this._runTest(test);
        this.results.push(result);
        
        if (result.passed) {
            this.passedCount++;
            console.log('✅ PASS: ' + test.name);
        } else {
            this.failedCount++;
            console.log('❌ FAIL: ' + test.name);
            console.log('   错误: ' + result.error);
        }
    }
    
    console.log('========================================');
    console.log('测试完成: ' + this.passedCount + '/' + this.tests.length + ' 通过');
    console.log('========================================');
    
    return {
        total: this.tests.length,
        passed: this.passedCount,
        failed: this.failedCount,
        results: this.results
    };
};

TestRunner.prototype._runTest = function(test) {
    try {
        test.test();
        return {
            name: test.name,
            passed: true,
            error: null
        };
    } catch (e) {
        return {
            name: test.name,
            passed: false,
            error: e.message
        };
    }
};

function assert(condition, message) {
    if (!condition) {
        throw new Error(message || '断言失败');
    }
}

function assertEqual(actual, expected, message) {
    if (actual !== expected) {
        throw new Error(message || ('期望值: ' + expected + ', 实际值: ' + actual));
    }
}

var testRunner = new TestRunner();

testRunner.addTest('Level: 创建新关卡', function() {
    var level = new Level('test_id', '测试关卡');
    assert(level.id === 'test_id', 'ID 不匹配');
    assert(level.name === '测试关卡', '名称不匹配');
    assert(level.mapWidth === Constants.DEFAULT_MAP_SIZE.width, '地图宽度不匹配');
    assert(level.mapHeight === Constants.DEFAULT_MAP_SIZE.height, '地图高度不匹配');
});

testRunner.addTest('Level: 设置和获取格子', function() {
    var level = new Level('test_level');
    level.setCell(2, 3, Constants.CELL_TYPE.CHECKPOINT);
    assertEqual(level.getCell(2, 3), Constants.CELL_TYPE.CHECKPOINT, '格子类型不匹配');
});

testRunner.addTest('Level: 设置起点', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    assert(level.startPosition !== null, '起点位置未设置');
    assertEqual(level.startPosition.x, 1, '起点X坐标不匹配');
    assertEqual(level.startPosition.y, 1, '起点Y坐标不匹配');
});

testRunner.addTest('Level: 获取检查点列表', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.CHECKPOINT);
    level.setCell(3, 3, Constants.CELL_TYPE.CHECKPOINT);
    level.setCell(5, 2, Constants.CELL_TYPE.OBSTACLE);
    
    var checkpoints = level.getCheckpoints();
    assertEqual(checkpoints.length, 2, '检查点数量不匹配');
});

testRunner.addTest('Level: 验证关卡有效性', function() {
    var level1 = new Level('test_level');
    var result1 = level1.validate();
    assert(!result1.valid, '没有起点和检查点的关卡应该无效');
    
    var level2 = new Level('test_level');
    level2.setCell(1, 1, Constants.CELL_TYPE.START);
    level2.setCell(3, 3, Constants.CELL_TYPE.CHECKPOINT);
    var result2 = level2.validate();
    assert(result2.valid, '有起点和检查点的关卡应该有效');
});

testRunner.addTest('Command: 创建指令', function() {
    var cmd = new Command(Constants.COMMAND_TYPE.FORWARD);
    assertEqual(cmd.type, Constants.COMMAND_TYPE.FORWARD, '指令类型不匹配');
    assertEqual(cmd.getName(), '前进', '指令名称不匹配');
});

testRunner.addTest('CommandQueue: 添加和移除指令', function() {
    var queue = new CommandQueue();
    assert(queue.isEmpty(), '新队列应该为空');
    
    queue.add(new Command(Constants.COMMAND_TYPE.FORWARD));
    queue.add(new Command(Constants.COMMAND_TYPE.TURN_LEFT));
    
    assertEqual(queue.length(), 2, '队列长度不匹配');
    
    var removed = queue.remove(0);
    assert(removed !== null, '应该能移除指令');
    assertEqual(queue.length(), 1, '移除后队列长度不匹配');
});

testRunner.addTest('CommandQueue: 从文本解析指令', function() {
    var text = 'forward\nturnLeft\nturnRight\nsample\ncharge';
    var queue = CommandQueue.fromText(text);
    
    assertEqual(queue.length(), 5, '解析出的指令数量不匹配');
    assertEqual(queue.get(0).type, 'forward', '第1条指令不匹配');
    assertEqual(queue.get(1).type, 'turnLeft', '第2条指令不匹配');
});

testRunner.addTest('RobotState: 初始化', function() {
    var level = new Level('test_level');
    level.setCell(2, 2, Constants.CELL_TYPE.START);
    level.startDirection = Constants.DIRECTION.RIGHT;
    
    var robot = new RobotState(level);
    assertEqual(robot.x, 2, '初始X坐标不匹配');
    assertEqual(robot.y, 2, '初始Y坐标不匹配');
    assertEqual(robot.direction, Constants.DIRECTION.RIGHT, '初始方向不匹配');
});

testRunner.addTest('RobotState: 前进', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.startDirection = Constants.DIRECTION.RIGHT;
    
    var robot = new RobotState(level);
    var result = robot.moveForward();
    
    assert(result.success, '前进应该成功');
    assertEqual(robot.x, 2, '前进后X坐标不匹配');
    assertEqual(robot.y, 1, '前进后Y坐标不匹配');
});

testRunner.addTest('RobotState: 转向', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.startDirection = Constants.DIRECTION.UP;
    
    var robot = new RobotState(level);
    
    robot.turnRight();
    assertEqual(robot.direction, Constants.DIRECTION.RIGHT, '右转后方向不匹配');
    
    robot.turnLeft();
    assertEqual(robot.direction, Constants.DIRECTION.UP, '左转后方向不匹配');
});

testRunner.addTest('RobotState: 撞墙检测', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.setCell(2, 1, Constants.CELL_TYPE.OBSTACLE);
    level.startDirection = Constants.DIRECTION.RIGHT;
    
    var robot = new RobotState(level);
    var result = robot.moveForward();
    
    assert(!result.success, '撞墙应该失败');
    assertEqual(result.error, Constants.ERROR_TYPE.HIT_WALL, '错误类型不匹配');
    assert(robot.isDead, '撞墙后机器人应该停止');
});

testRunner.addTest('RobotState: 能量消耗', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.initialEnergy = 10;
    
    var robot = new RobotState(level);
    var initialEnergy = robot.energy;
    
    robot.moveForward();
    assert(robot.energy < initialEnergy, '前进应该消耗能量');
    assertEqual(robot.energy, initialEnergy - Constants.ENERGY_COST.forward, '能量消耗不匹配');
});

testRunner.addTest('RobotState: 检查点访问', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.setCell(2, 1, Constants.CELL_TYPE.CHECKPOINT);
    level.setCell(3, 1, Constants.CELL_TYPE.CHECKPOINT);
    level.startDirection = Constants.DIRECTION.RIGHT;
    
    var robot = new RobotState(level);
    assert(!robot.hasVisitedAllCheckpoints(), '开始时不应访问所有检查点');
    
    robot.moveForward();
    assert(!robot.hasVisitedAllCheckpoints(), '只访问1个检查点');
    
    robot.moveForward();
    assert(robot.hasVisitedAllCheckpoints(), '访问所有检查点后应该返回true');
});

testRunner.addTest('RobotState: 取样', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.setCell(2, 1, Constants.CELL_TYPE.SAMPLE);
    level.startDirection = Constants.DIRECTION.RIGHT;
    
    var robot = new RobotState(level);
    
    var sampleResult1 = robot.sample();
    assert(!sampleResult1.success, '不在取样点不能取样');
    
    robot.moveForward();
    
    var sampleResult2 = robot.sample();
    assert(sampleResult2.success, '在取样点应该可以取样');
    assertEqual(robot.sampledPoints.length, 1, '取样记录应该增加');
    
    var sampleResult3 = robot.sample();
    assert(!sampleResult3.success, '同一取样点不能重复取样');
});

testRunner.addTest('RobotState: 充电', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.setCell(2, 1, Constants.CELL_TYPE.CHARGE);
    level.initialEnergy = 10;
    level.startDirection = Constants.DIRECTION.RIGHT;
    
    var robot = new RobotState(level);
    
    var chargeResult1 = robot.charge();
    assert(!chargeResult1.success, '不在充电点不能充电');
    
    robot.moveForward();
    
    var chargeResult2 = robot.charge();
    assert(chargeResult2.success, '在充电点应该可以充电');
    assert(robot.energy > 10, '充电后能量应该增加');
});

testRunner.addTest('Validator: 验证执行结果', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.setCell(2, 1, Constants.CELL_TYPE.CHECKPOINT);
    level.startDirection = Constants.DIRECTION.RIGHT;
    
    var robot = new RobotState(level);
    robot.moveForward();
    
    var queue = new CommandQueue();
    queue.add(new Command(Constants.COMMAND_TYPE.FORWARD));
    queue.advance();
    
    var validator = new Validator();
    var result = validator.validateExecution(robot, queue, level);
    
    assert(result.success, '执行应该成功');
    assertEqual(result.stats.checkpointsVisited, 1, '检查点访问数量不匹配');
});

testRunner.addTest('Scorer: 计算评分', function() {
    var level = new Level('test_level');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.setCell(3, 1, Constants.CELL_TYPE.CHECKPOINT);
    level.startDirection = Constants.DIRECTION.RIGHT;
    
    var robot = new RobotState(level);
    robot.moveForward();
    robot.moveForward();
    
    var queue = new CommandQueue();
    queue.add(new Command(Constants.COMMAND_TYPE.FORWARD));
    queue.add(new Command(Constants.COMMAND_TYPE.FORWARD));
    queue.advance();
    queue.advance();
    
    var validator = new Validator();
    var executionResult = validator.validateExecution(robot, queue, level);
    
    var scorer = new Scorer();
    var optimalCommands = scorer.estimateOptimalCommands(level);
    var ratingResult = scorer.calculateRating(executionResult, level, optimalCommands);
    
    assert(ratingResult.rating >= 1, '成功完成应该至少1星');
});

testRunner.addTest('Storage: 保存和加载关卡', function() {
    var tempStorage = new Storage();
    tempStorage.clearAll();
    
    var level = new Level('test_save_level', '测试保存');
    level.setCell(1, 1, Constants.CELL_TYPE.START);
    level.setCell(3, 3, Constants.CELL_TYPE.CHECKPOINT);
    
    tempStorage.saveLevel(level);
    
    var loadedLevel = tempStorage.loadLevel('test_save_level');
    assert(loadedLevel !== null, '应该能加载保存的关卡');
    assertEqual(loadedLevel.name, '测试保存', '关卡名称不匹配');
});

testRunner.addTest('ImportExport: 验证关卡包格式', function() {
    var validPack = {
        version: '1.0',
        levels: [
            {
                id: 'test_1',
                name: '测试关卡',
                mapWidth: 10,
                mapHeight: 10,
                map: []
            }
        ]
    };
    
    var ie = new ImportExport(new Storage());
    var validation = ie.validateLevelPack(validPack);
    
    assert(validation.valid, '有效关卡包应该验证通过');
});

testRunner.addTest('SampleLevels: 示例关卡创建', function() {
    var levels = SampleLevels.getLevels();
    assert(levels.length >= 5, '应该有至少5个示例关卡');
    
    for (var i = 0; i < levels.length; i++) {
        var level = levels[i];
        var validation = level.validate();
        assert(validation.valid, '示例关卡 ' + level.name + ' 应该有效');
    }
});

window.runSelfTests = function() {
    return testRunner.runAll();
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        TestRunner: TestRunner,
        testRunner: testRunner,
        assert: assert,
        assertEqual: assertEqual
    };
}
