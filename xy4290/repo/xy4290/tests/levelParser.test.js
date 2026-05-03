// 关卡解析模块测试

import { LevelParser } from '../js/levelParser.js';
import { CellType, UnitType } from '../js/types.js';

describe('LevelParser', () => {
    let parser;

    beforeEach(() => {
        parser = new LevelParser();
    });

    describe('parse', () => {
        it('应该正确解析有效的 JSON 字符串', () => {
            const jsonString = JSON.stringify({
                id: 'test_level',
                name: '测试关卡',
                timeLimit: 300,
                grid: {
                    width: 4,
                    height: 4,
                    cells: [
                        ['road', 'road', 'road', 'road'],
                        ['road', 'broadcast_point', 'road', 'road'],
                        ['road', 'road', 'road', 'road'],
                        ['road', 'road', 'road', 'road']
                    ]
                },
                initialUnits: [
                    {
                        id: 'unit_1',
                        type: 'repair_vehicle',
                        position: { x: 0, y: 0 }
                    }
                ]
            });

            const result = parser.parse(jsonString);

            expect(result.id).toBe('test_level');
            expect(result.name).toBe('测试关卡');
            expect(result.timeLimit).toBe(300);
            expect(result.grid.width).toBe(4);
            expect(result.grid.height).toBe(4);
            expect(result.grid.cells[1][1].type).toBe(CellType.BROADCAST_POINT);
            expect(result.grid.cells[1][1].hasBroadcast).toBe(true);
            expect(result.initialUnits.length).toBe(1);
            expect(result.initialUnits[0].type).toBe(UnitType.REPAIR_VEHICLE);
        });

        it('应该在 JSON 语法错误时抛出错误', () => {
            const invalidJson = '{invalid json';
            
            expect(() => parser.parse(invalidJson)).toThrow();
        });

        it('应该在缺少必需字段时抛出错误', () => {
            const jsonString = JSON.stringify({
                name: '测试关卡'
            });

            expect(() => parser.parse(jsonString)).toThrow();
        });

        it('应该在没有广播点时抛出错误', () => {
            const jsonString = JSON.stringify({
                id: 'test_level',
                name: '测试关卡',
                timeLimit: 300,
                grid: {
                    width: 2,
                    height: 2,
                    cells: [
                        ['road', 'road'],
                        ['road', 'road']
                    ]
                },
                initialUnits: [
                    {
                        id: 'unit_1',
                        type: 'repair_vehicle',
                        position: { x: 0, y: 0 }
                    }
                ]
            });

            expect(() => parser.parse(jsonString)).toThrow('关卡中必须至少有一个广播点');
        });
    });

    describe('cellTypeToCell', () => {
        it('应该正确转换道路类型', () => {
            const cell = parser.cellTypeToCell(CellType.ROAD);
            
            expect(cell.type).toBe(CellType.ROAD);
            expect(cell.isPassable).toBe(true);
            expect(cell.hasBroadcast).toBe(false);
        });

        it('应该正确转换阻断类型', () => {
            const cell = parser.cellTypeToCell(CellType.BLOCKED);
            
            expect(cell.type).toBe(CellType.BLOCKED);
            expect(cell.isPassable).toBe(false);
            expect(cell.isRepairable).toBe(true);
            expect(cell.repairCost).toBe(30);
        });

        it('应该正确转换广播点类型', () => {
            const cell = parser.cellTypeToCell(CellType.BROADCAST_POINT);
            
            expect(cell.type).toBe(CellType.BROADCAST_POINT);
            expect(cell.isPassable).toBe(true);
            expect(cell.hasBroadcast).toBe(true);
            expect(cell.broadcastRange).toBe(2);
        });
    });

    describe('stringify', () => {
        it('应该正确转换关卡配置为 JSON 字符串', () => {
            const config = {
                id: 'test_level',
                name: '测试关卡',
                description: '测试描述',
                timeLimit: 300,
                targetCoverage: 80,
                grid: {
                    width: 2,
                    height: 2,
                    cells: [
                        [
                            { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                            { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 }
                        ],
                        [
                            { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                            { type: CellType.BROADCAST_POINT, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: true, isBroadcastActive: false, broadcastRange: 2 }
                        ]
                    ]
                },
                initialUnits: [
                    {
                        id: 'unit_1',
                        type: UnitType.REPAIR_VEHICLE,
                        position: { x: 0, y: 0 },
                        moveSpeed: 5,
                        capacity: 100,
                        currentLoad: 0,
                        repairSpeed: 1,
                        fuel: 100,
                        maxFuel: 100
                    }
                ],
                scoring: {
                    perfectTime: 90,
                    goodTime: 180,
                    perfectCoverage: 100,
                    goodCoverage: 80
                }
            };

            const result = parser.stringify(config);
            
            expect(typeof result).toBe('string');
            
            const parsed = JSON.parse(result);
            expect(parsed.id).toBe('test_level');
            expect(parsed.name).toBe('测试关卡');
        });
    });
});
