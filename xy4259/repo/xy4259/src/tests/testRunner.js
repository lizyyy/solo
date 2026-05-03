// 测试运行器 - 游戏核心功能测试

import { Point, Level, MapElement, ElementType, createDefaultLevel } from '../models/level.js';
import { PhysicsEngine, ScoreCalculator } from '../physics/physics.js';
import { PathValidator, ValidationErrorType } from '../validation/pathValidator.js';
import { PathHistoryManager } from '../storage/storage.js';

class TestResult {
    constructor(name, passed, message = '') {
        this.name = name;
        this.passed = passed;
        this.message = message;
        this.timestamp = new Date().toISOString();
    }
}

class TestSuite {
    constructor(name) {
        this.name = name;
        this.tests = [];
        this.results = [];
    }
    
    test(name, testFunction) {
        this.tests.push({ name, testFunction });
    }
    
    async run() {
        console.log(`\n=== 测试套件: ${this.name} ===\n`);
        this.results = [];
        
        for (const { name, testFunction } of this.tests) {
            try {
                await testFunction();
                this.results.push(new TestResult(name, true));
                console.log(`✓ ${name}`);
            } catch (error) {
                this.results.push(new TestResult(name, false, error.message));
                console.log(`✗ ${name}: ${error.message}`);
            }
        }
        
        const passed = this.results.filter(r => r.passed).length;
        const failed = this.results.filter(r => !r.passed).length;
        
        console.log(`\n--- 结果: ${passed} 通过, ${failed} 失败 ---\n`);
        
        return {
            name: this.name,
            passed,
            failed,
            total: this.results.length,
            results: this.results
        };
    }
}

function assert(condition, message = '断言失败') {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual, expected, message = '') {
    if (actual !== expected) {
        throw new Error(`${message} 期望: ${expected}, 实际: ${actual}`);
    }
}

function assertClose(actual, expected, tolerance = 0.001, message = '') {
    if (Math.abs(actual - expected) > tolerance) {
        throw new Error(`${message} 期望: ${expected} ± ${tolerance}, 实际: ${actual}`);
    }
}

export async function runAllTests() {
    const allResults = [];
    
    const levelTests = new TestSuite('关卡模型测试');
    
    levelTests.test('Point 距离计算', () => {
        const p1 = new Point(0, 0);
        const p2 = new Point(3, 4);
        assertClose(p1.distanceTo(p2), 5);
    });
    
    levelTests.test('Level 创建默认关卡', () => {
        const level = createDefaultLevel();
        assert(level.startPoint !== null, '缺少起点');
        assert(level.rescuePoints.length > 0, '缺少求救点');
        assert(level.validate().valid, '默认关卡验证失败');
    });
    
    levelTests.test('MapElement 创建与类型', () => {
        const element = new MapElement(ElementType.RESCUE_POINT, new Point(100, 100));
        assertEqual(element.type, ElementType.RESCUE_POINT);
        assert(element.id.length > 0);
    });
    
    levelTests.test('Level 添加/移除元素', () => {
        const level = new Level('测试关卡');
        const rescuePoint = new MapElement(
            ElementType.RESCUE_POINT, 
            new Point(200, 200)
        );
        
        level.addElement(rescuePoint);
        assertEqual(level.rescuePoints.length, 1);
        
        level.removeElement(rescuePoint.id);
        assertEqual(level.rescuePoints.length, 0);
    });
    
    levelTests.test('Level 验证 - 缺少起点', () => {
        const level = new Level('无效关卡');
        const result = level.validate();
        assert(!result.valid, '应该验证失败');
        assert(result.errors.includes('缺少起点/终点'));
    });
    
    levelTests.test('Level JSON 序列化/反序列化', () => {
        const original = createDefaultLevel();
        const json = original.toJSON();
        const restored = Level.fromJSON(json);
        
        assertEqual(restored.name, original.name);
        assertEqual(restored.rescuePoints.length, original.rescuePoints.length);
        assert(restored.validate().valid);
    });
    
    allResults.push(await levelTests.run());
    
    const physicsTests = new TestSuite('物理引擎测试');
    
    physicsTests.test('PhysicsEngine 基础能耗计算', () => {
        const engine = new PhysicsEngine({ baseEnergyConsumption: 0.1 });
        const p1 = new Point(0, 0);
        const p2 = new Point(100, 0);
        
        const energy = engine.calculateSegmentEnergy(p1, p2);
        assertClose(energy, 10);
    });
    
    physicsTests.test('PhysicsEngine 路径总能耗', () => {
        const engine = new PhysicsEngine({ baseEnergyConsumption: 0.1 });
        const path = [
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100)
        ];
        
        const totalEnergy = engine.calculatePathEnergy(path);
        assertClose(totalEnergy, 20);
    });
    
    physicsTests.test('PhysicsEngine 风向角度计算', () => {
        const engine = new PhysicsEngine();
        const p1 = new Point(0, 0);
        const p2 = new Point(100, 0);
        
        const direction = engine.calculateDirection(p1, p2);
        assertClose(direction, 0);
    });
    
    physicsTests.test('PhysicsEngine 点在多边形内检测', () => {
        const engine = new PhysicsEngine();
        const polygon = [
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100),
            new Point(0, 100)
        ];
        
        assert(engine.isPointInPolygon(new Point(50, 50), polygon));
        assert(!engine.isPointInPolygon(new Point(150, 50), polygon));
    });
    
    physicsTests.test('PhysicsEngine 线段相交检测', () => {
        const engine = new PhysicsEngine();
        
        const p1 = new Point(0, 0);
        const p2 = new Point(100, 100);
        const p3 = new Point(0, 100);
        const p4 = new Point(100, 0);
        
        const intersection = engine.lineIntersection(p1, p2, p3, p4);
        assert(intersection !== null);
        assertClose(intersection.x, 50);
        assertClose(intersection.y, 50);
    });
    
    physicsTests.test('ScoreCalculator 基础评分', () => {
        const calculator = new ScoreCalculator();
        const level = createDefaultLevel();
        
        const gameResult = {
            success: true,
            remainingBattery: 50,
            totalDistance: 500,
            rescuePointsVisited: level.rescuePoints.length,
            totalRescuePoints: level.rescuePoints.length
        };
        
        const scoreResult = calculator.calculateScore(gameResult, level);
        assert(scoreResult.score > 0);
        assert(scoreResult.grade !== 'F');
    });
    
    physicsTests.test('ScoreCalculator 失败评分', () => {
        const calculator = new ScoreCalculator();
        const level = createDefaultLevel();
        
        const gameResult = {
            success: false,
            remainingBattery: 0,
            totalDistance: 100,
            rescuePointsVisited: 0,
            totalRescuePoints: level.rescuePoints.length
        };
        
        const scoreResult = calculator.calculateScore(gameResult, level);
        assertEqual(scoreResult.score, 0);
        assertEqual(scoreResult.grade, 'F');
    });
    
    allResults.push(await physicsTests.run());
    
    const validatorTests = new TestSuite('路径校验测试');
    
    validatorTests.test('PathValidator 越界检测', () => {
        const level = createDefaultLevel();
        level.settings.mapSize = { width: 500, height: 500 };
        const validator = new PathValidator(level);
        
        const path = [
            new Point(100, 100),
            new Point(600, 100)
        ];
        
        const result = validator.validatePath(path, false);
        assert(!result.valid, '应该检测到越界');
        assert(result.errors.some(e => e.type === ValidationErrorType.OUT_OF_BOUNDS));
    });
    
    validatorTests.test('PathValidator 求救点覆盖检测', () => {
        const level = createDefaultLevel();
        const validator = new PathValidator(level);
        
        const rescuePoint = level.rescuePoints[0];
        const path = [
            level.startPoint.position.clone(),
            new Point(
                rescuePoint.position.x + 5,
                rescuePoint.position.y + 5
            )
        ];
        
        const coverage = validator.checkRescuePointCoverage(path);
        assert(coverage.visited.length > 0, '应该检测到访问过的求救点');
    });
    
    validatorTests.test('PathValidator 返航检测', () => {
        const level = createDefaultLevel();
        const validator = new PathValidator(level);
        
        const path = [
            level.startPoint.position.clone(),
            new Point(200, 200),
            level.startPoint.position.clone()
        ];
        
        const result = validator.checkReturnToStart(path);
        assert(result.returnsToStart, '应该检测到返航路径');
    });
    
    validatorTests.test('PathValidator 路径统计', () => {
        const level = createDefaultLevel();
        const validator = new PathValidator(level);
        
        const path = [
            new Point(0, 0),
            new Point(100, 0),
            new Point(100, 100)
        ];
        
        const stats = validator.getPathStatistics(path);
        assertClose(stats.totalDistance, 200);
        assertEqual(stats.segmentCount, 2);
    });
    
    allResults.push(await validatorTests.run());
    
    const historyTests = new TestSuite('路径历史管理测试');
    
    historyTests.test('PathHistoryManager 基本操作', () => {
        const manager = new PathHistoryManager();
        const path1 = [new Point(0, 0), new Point(100, 100)];
        const path2 = [new Point(0, 0), new Point(50, 50), new Point(100, 100)];
        
        manager.push(path1);
        manager.push(path2);
        
        assert(manager.canUndo());
        assert(!manager.canRedo());
    });
    
    historyTests.test('PathHistoryManager 撤销', () => {
        const manager = new PathHistoryManager();
        const path1 = [new Point(0, 0), new Point(100, 100)];
        const path2 = [new Point(0, 0), new Point(50, 50), new Point(100, 100)];
        
        manager.push(path1);
        manager.push(path2);
        
        const undone = manager.undo();
        assert(undone !== null);
        assertEqual(undone.length, 2);
    });
    
    historyTests.test('PathHistoryManager 重做', () => {
        const manager = new PathHistoryManager();
        const path1 = [new Point(0, 0), new Point(100, 100)];
        const path2 = [new Point(0, 0), new Point(50, 50), new Point(100, 100)];
        
        manager.push(path1);
        manager.push(path2);
        manager.undo();
        
        assert(manager.canRedo());
        
        const redone = manager.redo();
        assert(redone !== null);
        assertEqual(redone.length, 3);
    });
    
    historyTests.test('PathHistoryManager 清空', () => {
        const manager = new PathHistoryManager();
        const path = [new Point(0, 0), new Point(100, 100)];
        
        manager.push(path);
        manager.clear();
        
        assert(!manager.canUndo());
        assertEqual(manager.getHistoryLength(), 0);
    });
    
    allResults.push(await historyTests.run());
    
    const totalPassed = allResults.reduce((sum, r) => sum + r.passed, 0);
    const totalFailed = allResults.reduce((sum, r) => sum + r.failed, 0);
    const totalTests = allResults.reduce((sum, r) => sum + r.total, 0);
    
    console.log('\n' + '='.repeat(50));
    console.log('总体测试结果');
    console.log('='.repeat(50));
    console.log(`总测试数: ${totalTests}`);
    console.log(`通过: ${totalPassed}`);
    console.log(`失败: ${totalFailed}`);
    console.log(`成功率: ${((totalPassed / totalTests) * 100).toFixed(1)}%`);
    
    return {
        totalPassed,
        totalFailed,
        totalTests,
        suites: allResults
    };
}

export function createTestHTMLReport(results) {
    let html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>测试报告</title>
    <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        .summary { 
            background: #f5f5f5; 
            padding: 20px; 
            margin-bottom: 20px;
            border-radius: 5px;
        }
        .suite { margin-bottom: 20px; }
        .suite-header { 
            background: #2c3e50; 
            color: white; 
            padding: 10px;
            border-radius: 5px;
        }
        .test { 
            padding: 8px; 
            margin: 5px 0;
            border-radius: 3px;
        }
        .passed { background: #d4edda; color: #155724; }
        .failed { background: #f8d7da; color: #721c24; }
        .stats { 
            display: flex; 
            gap: 20px; 
            font-size: 1.2em;
        }
    </style>
</head>
<body>
    <h1>无人机救援航线挑战 - 测试报告</h1>
    <div class="summary">
        <h2>总体统计</h2>
        <div class="stats">
            <span>总测试: ${results.totalTests}</span>
            <span style="color: green;">通过: ${results.totalPassed}</span>
            <span style="color: red;">失败: ${results.totalFailed}</span>
        </div>
        <p>成功率: ${((results.totalPassed / results.totalTests) * 100).toFixed(1)}%</p>
        <p>生成时间: ${new Date().toLocaleString()}</p>
    </div>
`;
    
    for (const suite of results.suites) {
        html += `
    <div class="suite">
        <div class="suite-header">
            <h3>${suite.name} (${suite.passed}/${suite.total})</h3>
        </div>
`;
        
        for (const result of suite.results) {
            const className = result.passed ? 'passed' : 'failed';
            const icon = result.passed ? '✓' : '✗';
            html += `
        <div class="test ${className}">
            ${icon} ${result.name}
            ${result.message ? `<br><small>${result.message}</small>` : ''}
        </div>
`;
        }
        
        html += `    </div>\n`;
    }
    
    html += `
</body>
</html>
`;
    
    return html;
}

document.addEventListener('DOMContentLoaded', () => {
    window.runTests = runAllTests;
});
