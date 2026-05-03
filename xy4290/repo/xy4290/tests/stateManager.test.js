// 状态管理模块测试

import { StateManager } from '../js/stateManager.js';
import { GameState, CellType, UnitType } from '../js/types.js';

describe('StateManager', () => {
    let stateManager;
    let mockLevelConfig;

    beforeEach(() => {
        stateManager = new StateManager();
        
        mockLevelConfig = {
            id: 'test_level',
            name: '测试关卡',
            timeLimit: 300,
            grid: {
                width: 4,
                height: 4,
                cells: [
                    [
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 }
                    ],
                    [
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.BROADCAST_POINT, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: true, isBroadcastActive: false, broadcastRange: 2 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 }
                    ],
                    [
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 }
                    ],
                    [
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 },
                        { type: CellType.ROAD, isPassable: true, isRepairable: false, repairCost: 0, hasBroadcast: false, isBroadcastActive: false, broadcastRange: 0 }
                    ]
                ]
            },
            initialUnits: [
                {
                    id: 'repair_1',
                    type: UnitType.REPAIR_VEHICLE,
                    position: { x: 0, y: 0 },
                    moveSpeed: 5,
                    capacity: 100,
                    currentLoad: 0,
                    repairSpeed: 1,
                    fuel: 100,
                    maxFuel: 100
                },
                {
                    id: 'generator_1',
                    type: UnitType.GENERATOR,
                    position: { x: 3, y: 3 },
                    moveSpeed: 5,
                    fuel: 80,
                    maxFuel: 100,
                    powerOutput: 100,
                    isDeployed: false
                }
            ],
            scoring: {
                perfectTime: 90,
                goodTime: 180,
                perfectCoverage: 100,
                goodCoverage: 80
            }
        };
    });

    describe('initialize', () => {
        it('应该正确初始化游戏状态', () => {
            stateManager.initialize(mockLevelConfig);
            
            const state = stateManager.getCurrentState();
            
            expect(state).not.toBeNull();
            expect(state.currentTime).toBe(0);
            expect(state.coverage).toBe(0);
            expect(state.gameState).toBe(GameState.PLAYING);
            expect(state.units.length).toBe(2);
            expect(state.cells.length).toBe(4);
        });

        it('应该正确设置关卡配置', () => {
            stateManager.initialize(mockLevelConfig);
            
            expect(stateManager.getLevelConfig()).toBe(mockLevelConfig);
        });
    });

    describe('undo/redo', () => {
        it('在初始化后应该不能撤销', () => {
            stateManager.initialize(mockLevelConfig);
            
            expect(stateManager.canUndo()).toBe(false);
        });

        it('在初始化后应该不能重做', () => {
            stateManager.initialize(mockLevelConfig);
            
            expect(stateManager.canRedo()).toBe(false);
        });

        it('应该正确记录历史记录', () => {
            stateManager.initialize(mockLevelConfig);
            
            stateManager.updateTime(10);
            stateManager.saveState();
            
            expect(stateManager.canUndo()).toBe(true);
            expect(stateManager.getCurrentIndex()).toBe(1);
        });

        it('应该正确执行撤销操作', () => {
            stateManager.initialize(mockLevelConfig);
            
            stateManager.updateTime(10);
            stateManager.saveState();
            
            expect(stateManager.getCurrentState().currentTime).toBe(10);
            
            const result = stateManager.undo();
            
            expect(result).toBe(true);
            expect(stateManager.getCurrentState().currentTime).toBe(0);
        });

        it('应该正确执行重做操作', () => {
            stateManager.initialize(mockLevelConfig);
            
            stateManager.updateTime(10);
            stateManager.saveState();
            
            stateManager.undo();
            expect(stateManager.getCurrentState().currentTime).toBe(0);
            
            const result = stateManager.redo();
            
            expect(result).toBe(true);
            expect(stateManager.getCurrentState().currentTime).toBe(10);
        });
    });

    describe('commands', () => {
        beforeEach(() => {
            stateManager.initialize(mockLevelConfig);
        });

        it('应该正确添加待执行指令', () => {
            const command = {
                id: 'cmd_1',
                type: 'move',
                unitId: 'repair_1',
                target: { x: 1, y: 1 },
                estimatedTime: 10
            };

            stateManager.addCommand(command);
            
            const pendingCommands = stateManager.getPendingCommands();
            expect(pendingCommands.length).toBe(1);
            expect(pendingCommands[0].id).toBe('cmd_1');
        });

        it('应该正确移除指令', () => {
            const command = {
                id: 'cmd_1',
                type: 'move',
                unitId: 'repair_1',
                target: { x: 1, y: 1 },
                estimatedTime: 10
            };

            stateManager.addCommand(command);
            stateManager.removeCommand('repair_1');
            
            const pendingCommands = stateManager.getPendingCommands();
            expect(pendingCommands.length).toBe(0);
        });

        it('应该正确清空所有指令', () => {
            const command1 = {
                id: 'cmd_1',
                type: 'move',
                unitId: 'repair_1',
                target: { x: 1, y: 1 },
                estimatedTime: 10
            };

            const command2 = {
                id: 'cmd_2',
                type: 'move',
                unitId: 'generator_1',
                target: { x: 2, y: 2 },
                estimatedTime: 10
            };

            stateManager.addCommand(command1);
            stateManager.addCommand(command2);
            
            expect(stateManager.getPendingCommands().length).toBe(2);
            
            stateManager.clearCommands();
            
            expect(stateManager.getPendingCommands().length).toBe(0);
        });
    });

    describe('unit management', () => {
        beforeEach(() => {
            stateManager.initialize(mockLevelConfig);
        });

        it('应该正确获取单位', () => {
            const unit = stateManager.getUnitById('repair_1');
            
            expect(unit).not.toBeNull();
            expect(unit.id).toBe('repair_1');
            expect(unit.type).toBe(UnitType.REPAIR_VEHICLE);
        });

        it('应该在单位不存在时返回 null', () => {
            const unit = stateManager.getUnitById('non_existent');
            
            expect(unit).toBeNull();
        });

        it('应该正确更新单位', () => {
            const result = stateManager.updateUnit('repair_1', {
                fuel: 50,
                position: { x: 2, y: 2 }
            });
            
            expect(result).toBe(true);
            
            const unit = stateManager.getUnitById('repair_1');
            expect(unit.fuel).toBe(50);
            expect(unit.position.x).toBe(2);
            expect(unit.position.y).toBe(2);
        });
    });

    describe('cell management', () => {
        beforeEach(() => {
            stateManager.initialize(mockLevelConfig);
        });

        it('应该正确获取格子', () => {
            const cell = stateManager.getCell(1, 1);
            
            expect(cell).not.toBeNull();
            expect(cell.type).toBe(CellType.BROADCAST_POINT);
            expect(cell.hasBroadcast).toBe(true);
        });

        it('应该在格子超出范围时返回 null', () => {
            const cell = stateManager.getCell(100, 100);
            
            expect(cell).toBeNull();
        });

        it('应该正确更新格子', () => {
            const result = stateManager.updateCell(1, 1, {
                isBroadcastActive: true
            });
            
            expect(result).toBe(true);
            
            const cell = stateManager.getCell(1, 1);
            expect(cell.isBroadcastActive).toBe(true);
        });
    });

    describe('time and coverage', () => {
        beforeEach(() => {
            stateManager.initialize(mockLevelConfig);
        });

        it('应该正确更新时间', () => {
            stateManager.updateTime(10);
            
            expect(stateManager.getCurrentState().currentTime).toBe(10);
        });

        it('应该正确设置时间', () => {
            stateManager.setTime(100);
            
            expect(stateManager.getCurrentState().currentTime).toBe(100);
        });

        it('应该正确更新覆盖率', () => {
            stateManager.updateCoverage(50);
            
            expect(stateManager.getCurrentState().coverage).toBe(50);
        });

        it('应该限制覆盖率在 0-100 之间', () => {
            stateManager.updateCoverage(150);
            expect(stateManager.getCurrentState().coverage).toBe(100);
            
            stateManager.updateCoverage(-50);
            expect(stateManager.getCurrentState().coverage).toBe(0);
        });
    });

    describe('game state', () => {
        beforeEach(() => {
            stateManager.initialize(mockLevelConfig);
        });

        it('应该正确更新游戏状态', () => {
            stateManager.updateGameState(GameState.WON);
            
            expect(stateManager.getCurrentState().gameState).toBe(GameState.WON);
        });
    });

    describe('snapshot', () => {
        beforeEach(() => {
            stateManager.initialize(mockLevelConfig);
        });

        it('应该正确创建快照', () => {
            stateManager.updateTime(50);
            stateManager.updateCoverage(30);
            
            const snapshot = stateManager.createSnapshot();
            
            expect(snapshot.currentTime).toBe(50);
            expect(snapshot.coverage).toBe(30);
        });

        it('应该正确从快照恢复', () => {
            stateManager.updateTime(50);
            stateManager.updateCoverage(30);
            
            const snapshot = stateManager.createSnapshot();
            
            stateManager.updateTime(100);
            stateManager.updateCoverage(60);
            
            stateManager.restoreFromSnapshot(snapshot);
            
            expect(stateManager.getCurrentState().currentTime).toBe(50);
            expect(stateManager.getCurrentState().coverage).toBe(30);
        });
    });

    describe('reset', () => {
        beforeEach(() => {
            stateManager.initialize(mockLevelConfig);
        });

        it('应该正确重置到初始状态', () => {
            stateManager.updateTime(100);
            stateManager.updateCoverage(50);
            stateManager.updateGameState(GameState.WON);
            
            stateManager.reset();
            
            const state = stateManager.getCurrentState();
            expect(state.currentTime).toBe(0);
            expect(state.coverage).toBe(0);
            expect(state.gameState).toBe(GameState.PLAYING);
        });
    });
});
