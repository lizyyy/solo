/**
 * 测试运行器
 * 用于测试各个模块的功能
 */

const TestRunner = (function() {
    'use strict';

    let tests = [];
    let results = [];

    /**
     * 注册测试
     */
    function test(name, fn) {
        tests.push({ name, fn });
    }

    /**
     * 断言
     */
    function assert(condition, message = 'Assertion failed') {
        if (!condition) {
            throw new Error(message);
        }
    }

    function assertEqual(actual, expected, message = '') {
        if (actual !== expected) {
            throw new Error(`${message} Expected ${expected}, got ${actual}`);
        }
    }

    function assertDeepEqual(actual, expected, message = '') {
        if (JSON.stringify(actual) !== JSON.stringify(expected)) {
            throw new Error(`${message} Expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
        }
    }

    function assertTrue(condition, message = '') {
        assert(condition, message || 'Expected true, got false');
    }

    function assertFalse(condition, message = '') {
        assert(!condition, message || 'Expected false, got true');
    }

    function assertNull(value, message = '') {
        assert(value === null, message || 'Expected null');
    }

    function assertNotNull(value, message = '') {
        assert(value !== null, message || 'Expected not null');
    }

    /**
     * 运行所有测试
     */
    function runAll() {
        console.log('═══════════════════════════════════════════');
        console.log('  开始运行测试...');
        console.log('═══════════════════════════════════════════\n');

        results = [];
        let passed = 0;
        let failed = 0;

        tests.forEach(({ name, fn }, index) => {
            console.log(`[${index + 1}/${tests.length}] 测试: ${name}`);
            
            try {
                fn();
                console.log('  ✓ 通过\n');
                results.push({ name, status: 'passed', error: null });
                passed++;
            } catch (error) {
                console.log(`  ✗ 失败: ${error.message}\n`);
                results.push({ name, status: 'failed', error: error.message });
                failed++;
            }
        });

        console.log('═══════════════════════════════════════════');
        console.log('  测试结果汇总:');
        console.log(`  ✓ 通过: ${passed}/${tests.length}`);
        console.log(`  ✗ 失败: ${failed}/${tests.length}`);
        console.log('═══════════════════════════════════════════\n');

        return {
            total: tests.length,
            passed,
            failed,
            results
        };
    }

    /**
     * 获取测试结果
     */
    function getResults() {
        return results;
    }

    /**
     * 注册数据解析模块测试
     */
    function registerDataParserTests() {
        test('DataParser - 应该正确解析货架坐标JSON', function() {
            const testData = {
                metadata: {
                    warehouse: '测试仓库',
                    date: '2026-05-03'
                },
                racks: [
                    {
                        id: 'R1',
                        name: '货架1',
                        area: 'A区',
                        position: { x: 0, y: 0, z: 0 },
                        dimensions: { width: 2, height: 4, depth: 1 },
                        levels: 4,
                        slotsPerLevel: 5,
                        slots: []
                    }
                ]
            };

            const result = DataParser.parseRackCoordinates(testData);
            
            assertNotNull(result, '解析结果不应为null');
            assertEqual(result.metadata.warehouse, '测试仓库');
            assertEqual(result.racks.length, 1);
            assertEqual(result.racks[0].id, 'R1');
            assertTrue(result.rackMap.has('R1'));
            assertTrue(result.areas.includes('A区'));
        });

        test('DataParser - 应该正确解析CSV行', function() {
            const csvText = `货位ID,温度(°C),记录时间
A1-L1-P1,-16.2,2026-05-03T08:00:00
A1-L1-P2,-15.8,2026-05-03T08:00:00`;

            const result = DataParser.parseTemperatureCSV(csvText);
            
            assertNotNull(result, '解析结果不应为null');
            assertEqual(result.records.length, 2);
            assertEqual(result.records[0].temperature, -16.2);
            assertTrue(result.tempMap.has('A1-L1-P1'));
        });

        test('DataParser - 应该正确解析JSONL轨迹数据', function() {
            const jsonlText = `{"forkliftId": "叉车01", "timestamp": "2026-05-03T08:00:00", "x": 0, "y": 0, "z": 0}
{"forkliftId": "叉车01", "timestamp": "2026-05-03T08:05:00", "x": 1, "y": 0, "z": 1}`;

            const result = DataParser.parseForkliftTrajectory(jsonlText);
            
            assertNotNull(result, '解析结果不应为null');
            assertEqual(result.trajectories.size, 1);
            assertTrue(result.trajectories.has('叉车01'));
            assertEqual(result.allPoints.length, 2);
        });

        test('DataParser - 应该正确解析临期货品JSON', function() {
            const testData = {
                products: [
                    {
                        productId: 'PRD-001',
                        name: '进口牛排',
                        sku: 'SKU001',
                        slotId: 'A1-L1-P1',
                        daysUntilExpiry: 1,
                        priority: 'high',
                        isBlocked: true
                    }
                ]
            };

            const result = DataParser.parseExpiringProducts(testData, 'json');
            
            assertNotNull(result, '解析结果不应为null');
            assertEqual(result.products.length, 1);
            assertEqual(result.products[0].name, '进口牛排');
            assertTrue(result.productMap.has('A1-L1-P1'));
            assertEqual(result.highPriority.length, 1);
        });

        test('DataParser - 应该正确处理CSV中的引号', function() {
            const csvText = `"货位ID","货品名称","数量"
"A1-L1-P1","进口牛排,优质",50`;

            const result = DataParser.parseExpiringProducts(csvText, 'csv');
            
            assertNotNull(result, '解析结果不应为null');
            assertEqual(result.products.length, 1);
        });
    }

    /**
     * 注册风险规则模块测试
     */
    function registerRiskRulesTests() {
        test('RiskRules - 应该正确检测高温风险', function() {
            const tempData = {
                tempMap: new Map([
                    ['A1-L1-P1', [
                        { temperature: -10, timestamp: '2026-05-03T08:00:00' },
                        { temperature: -9, timestamp: '2026-05-03T09:00:00' }
                    ]],
                    ['A1-L1-P2', [
                        { temperature: -16, timestamp: '2026-05-03T08:00:00' }
                    ]]
                ]),
                timestamps: ['2026-05-03T08:00:00', '2026-05-03T09:00:00'],
                hasTimestamp: true
            };

            const rackData = {
                racks: [
                    { id: 'A1', slots: [{ id: 'A1-L1-P1' }, { id: 'A1-L1-P2' }] }
                ]
            };

            const result = RiskRules.detectTemperatureRisks(tempData, rackData);
            
            assertNotNull(result, '检测结果不应为null');
            assertTrue(result.risks.length > 0, '应该检测到高温风险');
            
            const highRisk = result.risks.find(r => r.slotKey === 'A1-L1-P1');
            assertNotNull(highRisk, 'A1-L1-P1应该有风险');
            assertEqual(highRisk.level, 'high');
        });

        test('RiskRules - 应该正确检测连续高温', function() {
            const tempData = {
                tempMap: new Map([
                    ['A1-L1-P1', [
                        { temperature: -10, timestamp: '2026-05-03T08:00:00' },
                        { temperature: -9.5, timestamp: '2026-05-03T09:00:00' },
                        { temperature: -8.8, timestamp: '2026-05-03T10:00:00' },
                        { temperature: -8.5, timestamp: '2026-05-03T11:00:00' }
                    ]]
                ]),
                timestamps: [],
                hasTimestamp: false
            };

            const rackData = {
                racks: [
                    { id: 'A1', slots: [{ id: 'A1-L1-P1' }] }
                ]
            };

            const result = RiskRules.detectTemperatureRisks(tempData, rackData);
            
            assertNotNull(result, '检测结果不应为null');
            assertTrue(result.summary.consecutiveHighSlots > 0, '应该检测到连续高温');
        });

        test('RiskRules - 应该正确检测漏检区域', function() {
            const trajectoryData = {
                trajectories: new Map([
                    ['叉车01', [
                        { forkliftId: '叉车01', x: 0, y: 0, z: 0 },
                        { forkliftId: '叉车01', x: 1, y: 0, z: 1 }
                    ]]
                ]),
                allPoints: [
                    { forkliftId: '叉车01', x: 0, y: 0, z: 0 },
                    { forkliftId: '叉车01', x: 1, y: 0, z: 1 }
                ],
                timestamps: []
            };

            const rackData = {
                racks: [
                    {
                        id: 'A1',
                        area: 'A区',
                        position: { x: 0, y: 0, z: 0 },
                        dimensions: { width: 2, height: 4, depth: 1 },
                        levels: 4,
                        slotsPerLevel: 5,
                        slots: [
                            { id: 'A1-L1-P1', level: 1, position: 1, occupied: true }
                        ]
                    }
                ],
                areas: ['A区']
            };

            const result = RiskRules.detectMissedAreas(trajectoryData, rackData);
            
            assertNotNull(result, '检测结果不应为null');
        });

        test('RiskRules - 应该正确检测临期货品风险', function() {
            const expiringData = {
                products: [
                    {
                        productId: 'PRD-001',
                        name: '进口牛排',
                        slotId: 'A1-L1-P1',
                        daysUntilExpiry: 1,
                        priority: 'high',
                        isBlocked: true
                    },
                    {
                        productId: 'PRD-002',
                        name: '冰淇淋',
                        slotId: 'A1-L1-P2',
                        daysUntilExpiry: 5,
                        priority: 'low',
                        isBlocked: false
                    }
                ],
                productMap: new Map(),
                highPriority: [],
                mediumPriority: [],
                lowPriority: []
            };

            const result = RiskRules.detectExpiringRisks(expiringData);
            
            assertNotNull(result, '检测结果不应为null');
            assertEqual(result.risks.length, 2);
            
            const blockedRisk = result.risks.find(r => r.isBlocked);
            assertNotNull(blockedRisk, '应该检测到被堵货品');
            assertEqual(blockedRisk.level, 'high', '被堵高优先级货品应该升级风险');
        });

        test('RiskRules - 应该根据温度返回正确颜色', function() {
            const highTempColor = RiskRules.getTemperatureColor(-10);
            const normalTempColor = RiskRules.getTemperatureColor(-16);
            const coldTempColor = RiskRules.getTemperatureColor(-20);

            assertNotNull(highTempColor);
            assertNotNull(highTempColor.hex);
            assertNotNull(highTempColor.rgb);

            assertNotNull(normalTempColor);
            assertNotNull(coldTempColor);
        });

        test('RiskRules - 应该正确综合分析所有风险', function() {
            const data = {
                racks: {
                    racks: [],
                    areas: []
                },
                temperature: null,
                trajectory: null,
                expiring: null
            };

            const result = RiskRules.analyzeAllRisks(data);
            
            assertNotNull(result, '分析结果不应为null');
            assertNotNull(result.summary);
            assertNotNull(result.allRisks);
        });
    }

    /**
     * 注册状态管理模块测试
     */
    function registerStateManagerTests() {
        test('StateManager - 应该正确初始化状态', function() {
            const state = StateManager.getState();
            assertNotNull(state, '状态不应为null');
            assertNotNull(state.data);
            assertNull(state.data.racks, '货架数据初始应为null');
            assertNull(state.selectedSlot, '选中货位初始应为null');
            assertEqual(state.filters.riskLevel, 'all');
            assertTrue(state.display.showHeatmap);
        });

        test('StateManager - 应该正确订阅和发布事件', function() {
            let eventFired = false;
            let eventData = null;

            const unsubscribe = StateManager.subscribe('test-event', function(data) {
                eventFired = true;
                eventData = data;
            });

            StateManager.publish('test-event', { value: 42 });

            assertTrue(eventFired, '事件应该被触发');
            assertEqual(eventData.value, 42);

            unsubscribe();
        });

        test('StateManager - 应该正确设置和获取筛选条件', function() {
            StateManager.setFilter('riskLevel', 'high');
            const filters = StateManager.getFilters();
            assertEqual(filters.riskLevel, 'high');
        });

        test('StateManager - 应该正确设置显示选项', function() {
            StateManager.setDisplayOption('showHeatmap', false);
            const display = StateManager.getDisplayOptions();
            assertFalse(display.showHeatmap);
        });

        test('StateManager - 应该正确管理标记', function() {
            const slotKey = 'test-slot-001';
            const mark = {
                status: 'resolved',
                notes: '测试标记'
            };

            StateManager.addMark(slotKey, mark);
            
            const savedMark = StateManager.getMark(slotKey);
            assertNotNull(savedMark);
            assertEqual(savedMark.status, 'resolved');
            assertEqual(savedMark.notes, '测试标记');

            const allMarks = StateManager.getAllMarks();
            assertTrue(allMarks.has(slotKey));

            StateManager.removeMark(slotKey);
            assertNull(StateManager.getMark(slotKey));
        });

        test('StateManager - 应该正确检查是否有数据', function() {
            assertFalse(StateManager.hasData());
        });

        test('StateManager - 应该正确重置状态', function() {
            StateManager.setFilter('riskLevel', 'high');
            StateManager.reset();
            
            const filters = StateManager.getFilters();
            assertEqual(filters.riskLevel, 'all');
        });
    }

    /**
     * 注册导出模块测试
     */
    function registerExporterTests() {
        test('Exporter - 应该正确生成Markdown报告', function() {
            const testState = {
                data: {
                    racks: {
                        metadata: {
                            warehouse: '测试仓库',
                            date: '2026-05-03'
                        }
                    }
                },
                riskAnalysis: {
                    summary: {
                        highRiskCount: 3,
                        mediumRiskCount: 5,
                        lowRiskCount: 2,
                        totalRisks: 10
                    }
                },
                marks: {},
                loadedFiles: {}
            };

            const markdown = Exporter.generateMarkdownReport(testState);
            
            assertNotNull(markdown, 'Markdown不应为null');
            assertTrue(markdown.includes('# 冷链仓库巡检风险报告'));
            assertTrue(markdown.includes('测试仓库'));
            assertTrue(markdown.includes('高风险'));
            assertTrue(markdown.includes('中风险'));
            assertTrue(markdown.includes('低风险'));
        });

        test('Exporter - 应该正确生成CSV报告', function() {
            const testState = {
                data: {},
                riskAnalysis: {
                    allRisks: [
                        {
                            slotKey: 'A1-L1-P1',
                            type: 'temperature',
                            level: 'high',
                            temperature: -10,
                            description: '高温告警'
                        }
                    ],
                    summary: {}
                },
                marks: {}
            };

            const csv = Exporter.generateCSVReport(testState);
            
            assertNotNull(csv, 'CSV不应为null');
            assertTrue(csv.includes('风险ID,风险类型,风险等级'));
            assertTrue(csv.includes('A1-L1-P1'));
            assertTrue(csv.includes('温度异常'));
            assertTrue(csv.includes('高风险'));
        });

        test('Exporter - 应该正确生成JSON报告', function() {
            const testState = {
                data: {
                    racks: {
                        metadata: {
                            warehouse: '测试仓库',
                            date: '2026-05-03'
                        }
                    }
                },
                riskAnalysis: {
                    allRisks: [],
                    summary: {
                        highRiskCount: 0
                    }
                },
                marks: {},
                loadedFiles: {}
            };

            const json = Exporter.generateJSONReport(testState);
            
            assertNotNull(json, 'JSON不应为null');
            
            const parsed = JSON.parse(json);
            assertNotNull(parsed);
            assertNotNull(parsed.metadata);
            assertNotNull(parsed.riskSummary);
        });
    }

    /**
     * 运行浏览器中的测试
     */
    function runInBrowser() {
        console.log('\n============================================');
        console.log('  浏览器环境测试');
        console.log('============================================\n');

        registerDataParserTests();
        registerRiskRulesTests();
        registerStateManagerTests();
        registerExporterTests();

        return runAll();
    }

    return {
        test,
        assert,
        assertEqual,
        assertDeepEqual,
        assertTrue,
        assertFalse,
        assertNull,
        assertNotNull,
        runAll,
        getResults,
        runInBrowser,
        registerDataParserTests,
        registerRiskRulesTests,
        registerStateManagerTests,
        registerExporterTests
    };
})();

// 导出到全局
if (typeof window !== 'undefined') {
    window.TestRunner = TestRunner;
}

// 在控制台输出测试入口
console.log('═══════════════════════════════════════════');
console.log('  测试运行器已加载');
console.log('  在浏览器控制台运行: TestRunner.runInBrowser()');
console.log('═══════════════════════════════════════════');
