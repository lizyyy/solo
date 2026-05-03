import { assert, describe, it } from './test-utils.js';
import { LevelParser } from '../src/levels/parser.js';

describe('LevelParser 关卡解析器测试', () => {
    it('应该正确解析简单的关卡数据', () => {
        const parser = new LevelParser();
        const testData = {
            id: 'test_1',
            name: '测试关卡',
            grid: [
                ['E', 'T-NS', 'E'],
                ['S-EW', 'J-NS', 'S-EW'],
                ['E', 'T-NS', 'E']
            ],
            maintenanceCars: [
                { id: 'car_1', name: '检修车 A', x: 1, y: 1, battery: 100 }
            ],
            lastTrains: [
                {
                    id: 'train_1',
                    name: '末班车 1',
                    route: [{ x: 0, y: 1 }, { x: 1, y: 1 }, { x: 2, y: 1 }],
                    startTime: 2
                }
            ],
            criticalSegments: [
                { x: 1, y: 0, repairTime: 2, deadline: 5 }
            ],
            winConditions: {
                repairAllCritical: true
            }
        };

        const level = parser.parse(testData);
        
        assert.equal(level.id, 'test_1');
        assert.equal(level.name, '测试关卡');
        assert.equal(level.grid.length, 3);
        assert.equal(level.maintenanceCars.length, 1);
        assert.equal(level.lastTrains.length, 1);
        assert.equal(level.criticalSegments.length, 1);
    });

    it('应该正确解析网格单元格类型', () => {
        const parser = new LevelParser();
        const testData = {
            id: 'test_2',
            name: '类型测试',
            grid: [
                ['E', 'T-NS', 'S-EW', 'J-NS', 'D', 'X']
            ],
            maintenanceCars: [],
            lastTrains: [],
            criticalSegments: [],
            winConditions: { repairAllCritical: true }
        };

        const level = parser.parse(testData);
        const row = level.grid[0];

        assert.equal(row[0].type, 'empty');
        assert.equal(row[1].type, 'track');
        assert.equal(row[2].type, 'station');
        assert.equal(row[3].type, 'junction');
        assert.equal(row[4].type, 'depot');
        assert.equal(row[5].type, 'terminus');
    });

    it('应该正确解析单元格连接方向', () => {
        const parser = new LevelParser();
        const testData = {
            id: 'test_3',
            name: '连接测试',
            grid: [
                ['T-NS', 'T-EW', 'T-NE', 'T-NSWE']
            ],
            maintenanceCars: [],
            lastTrains: [],
            criticalSegments: [],
            winConditions: { repairAllCritical: true }
        };

        const level = parser.parse(testData);
        const row = level.grid[0];

        assert.deepEqual(row[0].connections, ['N', 'S']);
        assert.deepEqual(row[1].connections, ['E', 'W']);
        assert.deepEqual(row[2].connections, ['N', 'E']);
        assert.deepEqual(row[3].connections, ['N', 'S', 'W', 'E']);
    });

    it('应该正确解析检修车数据', () => {
        const parser = new LevelParser();
        const testData = {
            id: 'test_4',
            name: '检修车测试',
            grid: [['T-NS']],
            maintenanceCars: [
                {
                    id: 'car_1',
                    name: '测试检修车',
                    x: 0,
                    y: 0,
                    battery: 80,
                    maxBattery: 100,
                    movementCost: 15,
                    repairCost: 8
                }
            ],
            lastTrains: [],
            criticalSegments: [],
            winConditions: { repairAllCritical: true }
        };

        const level = parser.parse(testData);
        const car = level.maintenanceCars[0];

        assert.equal(car.id, 'car_1');
        assert.equal(car.name, '测试检修车');
        assert.equal(car.x, 0);
        assert.equal(car.y, 0);
        assert.equal(car.battery, 80);
        assert.equal(car.maxBattery, 100);
        assert.equal(car.movementCost, 15);
        assert.equal(car.repairCost, 8);
    });

    it('应该正确解析末班车数据', () => {
        const parser = new LevelParser();
        const testData = {
            id: 'test_5',
            name: '末班车测试',
            grid: [['T-EW', 'T-EW', 'T-EW']],
            maintenanceCars: [],
            lastTrains: [
                {
                    id: 'train_1',
                    name: '测试末班车',
                    route: [
                        { x: 0, y: 0 },
                        { x: 1, y: 0 },
                        { x: 2, y: 0 }
                    ],
                    startTime: 3,
                    speed: 2
                }
            ],
            criticalSegments: [],
            winConditions: { repairAllCritical: true }
        };

        const level = parser.parse(testData);
        const train = level.lastTrains[0];

        assert.equal(train.id, 'train_1');
        assert.equal(train.name, '测试末班车');
        assert.equal(train.route.length, 3);
        assert.equal(train.startTime, 3);
        assert.equal(train.speed, 2);
        assert.equal(train.currentPosition, 0);
        assert.equal(train.status, 'waiting');
    });

    it('应该正确解析关键轨段数据', () => {
        const parser = new LevelParser();
        const testData = {
            id: 'test_6',
            name: '关键轨段测试',
            grid: [['T-NS']],
            maintenanceCars: [],
            lastTrains: [],
            criticalSegments: [
                {
                    id: 'seg_1',
                    x: 0,
                    y: 0,
                    repairTime: 3,
                    deadline: 8,
                    priority: 'high'
                }
            ],
            winConditions: { repairAllCritical: true }
        };

        const level = parser.parse(testData);
        const segment = level.criticalSegments[0];

        assert.equal(segment.id, 'seg_1');
        assert.equal(segment.x, 0);
        assert.equal(segment.y, 0);
        assert.equal(segment.repairTime, 3);
        assert.equal(segment.remainingTime, 3);
        assert.equal(segment.deadline, 8);
        assert.equal(segment.isRepaired, false);
        assert.equal(segment.priority, 'high');
    });

    it('应该在缺少必要字段时抛出错误', () => {
        const parser = new LevelParser();
        
        const invalidData = {
            id: 'test_invalid',
            name: '无效关卡'
        };

        assert.throws(() => {
            parser.parse(invalidData);
        }, '应该抛出错误，因为缺少必要字段');
    });

    it('应该正确验证关卡数据', () => {
        const parser = new LevelParser();
        const validData = {
            id: 'test_valid',
            name: '有效关卡',
            grid: [['T-NS', 'T-NS'], ['T-NS', 'T-NS']],
            maintenanceCars: [
                { id: 'car_1', x: 0, y: 0, battery: 100 }
            ],
            lastTrains: [
                {
                    id: 'train_1',
                    route: [{ x: 0, y: 0 }, { x: 0, y: 1 }],
                    startTime: 1
                }
            ],
            criticalSegments: [
                { x: 1, y: 1, repairTime: 2 }
            ],
            winConditions: { repairAllCritical: true }
        };

        const level = parser.parse(validData);
        const validation = parser.validateLevel(level);

        assert.isTrue(validation.isValid);
        assert.equal(validation.errors.length, 0);
    });

    it('应该检测到无效的检修车位置', () => {
        const parser = new LevelParser();
        const testData = {
            id: 'test_invalid_pos',
            name: '无效位置测试',
            grid: [['T-NS'], ['E']],
            maintenanceCars: [
                { id: 'car_1', x: 0, y: 1, battery: 100 }
            ],
            lastTrains: [],
            criticalSegments: [],
            winConditions: { repairAllCritical: true }
        };

        const level = parser.parse(testData);
        const validation = parser.validateLevel(level);

        assert.isFalse(validation.isValid);
        assert.arrayContains(validation.errors.map(e => e.includes('位置')), true);
    });
});
