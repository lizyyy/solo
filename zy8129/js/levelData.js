/**
 * 关卡数据模块
 * 包含游戏的所有关卡数据结构和示例关卡
 */

const LevelData = (function() {
    'use strict';

    // 船只类型枚举
    const ShipTypes = {
        CARGO: 'cargo',       // 货船
        PASSENGER: 'passenger', // 客船
        EMERGENCY: 'emergency'  // 应急船
    };

    // 船只优先级
    const ShipPriorities = {
        [ShipTypes.CARGO]: 1,      // 货船优先级最低
        [ShipTypes.PASSENGER]: 2,  // 客船优先级中等
        [ShipTypes.EMERGENCY]: 3   // 应急船优先级最高
    };

    // 船只等待成本（每单位时间）
    const WaitCosts = {
        [ShipTypes.CARGO]: 1,      // 货船等待成本最低
        [ShipTypes.PASSENGER]: 2,  // 客船等待成本中等
        [ShipTypes.EMERGENCY]: 5   // 应急船等待成本最高
    };

    // 船只大小（占用闸室空间）
    const ShipSizes = {
        [ShipTypes.CARGO]: 2,      // 货船占用空间大
        [ShipTypes.PASSENGER]: 1,  // 客船占用空间小
        [ShipTypes.EMERGENCY]: 1    // 应急船占用空间小
    };

    // 关卡列表
    const levels = [
        {
            id: 1,
            name: '新手教程',
            description: '学习基本的船闸调度操作',
            lockCapacity: 3,  // 闸室容量
            targetScore: 100, // 目标分数
            initialTime: 0,   // 初始时间（分钟）
            timeLimit: 120,   // 时间限制（分钟）
            
            // 潮汐窗口（开始时间，结束时间，水位状态）
            // 水位状态: 'high' 高水位（可上行）, 'low' 低水位（可下行）
            tidalWindows: [
                { start: 0, end: 60, level: 'high' },
                { start: 60, end: 120, level: 'low' }
            ],
            
            // 初始船只
            ships: [
                {
                    id: 'ship_1',
                    type: ShipTypes.PASSENGER,
                    name: '客船-001',
                    size: ShipSizes[ShipTypes.PASSENGER],
                    priority: ShipPriorities[ShipTypes.PASSENGER],
                    waitCost: WaitCosts[ShipTypes.PASSENGER],
                    targetDirection: 'up', // 目标方向: 'up' 上行, 'down' 下行
                    arrivalTime: 0,        // 到达时间（分钟）
                    deadline: 90,          // 截止时间（分钟）
                    baseScore: 20          // 基础分数
                },
                {
                    id: 'ship_2',
                    type: ShipTypes.CARGO,
                    name: '货船-001',
                    size: ShipSizes[ShipTypes.CARGO],
                    priority: ShipPriorities[ShipTypes.CARGO],
                    waitCost: WaitCosts[ShipTypes.CARGO],
                    targetDirection: 'up',
                    arrivalTime: 0,
                    deadline: 100,
                    baseScore: 30
                }
            ]
        },
        
        {
            id: 2,
            name: '繁忙时段',
            description: '应对更多船只和更复杂的潮汐窗口',
            lockCapacity: 4,
            targetScore: 200,
            initialTime: 0,
            timeLimit: 180,
            
            // 包含跨午夜的潮汐窗口（时间从23:00到次日01:00）
            tidalWindows: [
                { start: 0, end: 30, level: 'high' },
                { start: 30, end: 90, level: 'low' },
                { start: 90, end: 150, level: 'high' },
                { start: 150, end: 180, level: 'low' }
            ],
            
            ships: [
                {
                    id: 'ship_1',
                    type: ShipTypes.EMERGENCY,
                    name: '应急船-001',
                    size: ShipSizes[ShipTypes.EMERGENCY],
                    priority: ShipPriorities[ShipTypes.EMERGENCY],
                    waitCost: WaitCosts[ShipTypes.EMERGENCY],
                    targetDirection: 'up',
                    arrivalTime: 0,
                    deadline: 60,
                    baseScore: 50
                },
                {
                    id: 'ship_2',
                    type: ShipTypes.PASSENGER,
                    name: '客船-001',
                    size: ShipSizes[ShipTypes.PASSENGER],
                    priority: ShipPriorities[ShipTypes.PASSENGER],
                    waitCost: WaitCosts[ShipTypes.PASSENGER],
                    targetDirection: 'up',
                    arrivalTime: 0,
                    deadline: 90,
                    baseScore: 20
                },
                {
                    id: 'ship_3',
                    type: ShipTypes.CARGO,
                    name: '货船-001',
                    size: ShipSizes[ShipTypes.CARGO],
                    priority: ShipPriorities[ShipTypes.CARGO],
                    waitCost: WaitCosts[ShipTypes.CARGO],
                    targetDirection: 'down',
                    arrivalTime: 0,
                    deadline: 120,
                    baseScore: 30
                },
                {
                    id: 'ship_4',
                    type: ShipTypes.PASSENGER,
                    name: '客船-002',
                    size: ShipSizes[ShipTypes.PASSENGER],
                    priority: ShipPriorities[ShipTypes.PASSENGER],
                    waitCost: WaitCosts[ShipTypes.PASSENGER],
                    targetDirection: 'down',
                    arrivalTime: 30,
                    deadline: 150,
                    baseScore: 25
                }
            ]
        },
        
        {
            id: 3,
            name: '午夜挑战',
            description: '处理跨午夜的复杂潮汐窗口和紧急情况',
            lockCapacity: 5,
            targetScore: 350,
            initialTime: 22 * 60, // 从22:00开始（分钟数）
            timeLimit: 240,        // 4小时
            
            // 跨午夜的潮汐窗口（22:00 到 次日02:00）
            // 时间表示为从关卡开始的分钟数
            tidalWindows: [
                { start: 0, end: 60, level: 'high' },    // 22:00 - 23:00 高水位
                { start: 60, end: 120, level: 'low' },   // 23:00 - 00:00 低水位
                { start: 120, end: 180, level: 'high' }, // 00:00 - 01:00 高水位
                { start: 180, end: 240, level: 'low' }   // 01:00 - 02:00 低水位
            ],
            
            ships: [
                {
                    id: 'ship_1',
                    type: ShipTypes.EMERGENCY,
                    name: '应急船-001',
                    size: ShipSizes[ShipTypes.EMERGENCY],
                    priority: ShipPriorities[ShipTypes.EMERGENCY],
                    waitCost: WaitCosts[ShipTypes.EMERGENCY],
                    targetDirection: 'up',
                    arrivalTime: 0,
                    deadline: 90,
                    baseScore: 60
                },
                {
                    id: 'ship_2',
                    type: ShipTypes.EMERGENCY,
                    name: '应急船-002',
                    size: ShipSizes[ShipTypes.EMERGENCY],
                    priority: ShipPriorities[ShipTypes.EMERGENCY],
                    waitCost: WaitCosts[ShipTypes.EMERGENCY],
                    targetDirection: 'down',
                    arrivalTime: 30,
                    deadline: 120,
                    baseScore: 60
                },
                {
                    id: 'ship_3',
                    type: ShipTypes.PASSENGER,
                    name: '客船-001',
                    size: ShipSizes[ShipTypes.PASSENGER],
                    priority: ShipPriorities[ShipTypes.PASSENGER],
                    waitCost: WaitCosts[ShipTypes.PASSENGER],
                    targetDirection: 'up',
                    arrivalTime: 0,
                    deadline: 150,
                    baseScore: 30
                },
                {
                    id: 'ship_4',
                    type: ShipTypes.CARGO,
                    name: '货船-001',
                    size: ShipSizes[ShipTypes.CARGO],
                    priority: ShipPriorities[ShipTypes.CARGO],
                    waitCost: WaitCosts[ShipTypes.CARGO],
                    targetDirection: 'down',
                    arrivalTime: 0,
                    deadline: 180,
                    baseScore: 40
                },
                {
                    id: 'ship_5',
                    type: ShipTypes.CARGO,
                    name: '货船-002',
                    size: ShipSizes[ShipTypes.CARGO],
                    priority: ShipPriorities[ShipTypes.CARGO],
                    waitCost: WaitCosts[ShipTypes.CARGO],
                    targetDirection: 'up',
                    arrivalTime: 60,
                    deadline: 210,
                    baseScore: 45
                },
                {
                    id: 'ship_6',
                    type: ShipTypes.PASSENGER,
                    name: '客船-002',
                    size: ShipSizes[ShipTypes.PASSENGER],
                    priority: ShipPriorities[ShipTypes.PASSENGER],
                    waitCost: WaitCosts[ShipTypes.PASSENGER],
                    targetDirection: 'down',
                    arrivalTime: 90,
                    deadline: 240,
                    baseScore: 35
                }
            ]
        }
    ];

    // 公开API
    return {
        ShipTypes,
        ShipPriorities,
        WaitCosts,
        ShipSizes,
        
        // 获取所有关卡
        getAllLevels: function() {
            return levels;
        },
        
        // 根据ID获取关卡
        getLevelById: function(id) {
            return levels.find(level => level.id === id);
        },
        
        // 获取船只类型的显示名称
        getShipTypeName: function(type) {
            const names = {
                [ShipTypes.CARGO]: '货船',
                [ShipTypes.PASSENGER]: '客船',
                [ShipTypes.EMERGENCY]: '应急船'
            };
            return names[type] || '未知';
        },
        
        // 格式化时间显示（分钟数 -> HH:MM）
        formatTime: function(minutes, baseHours = 0) {
            const totalMinutes = baseHours * 60 + minutes;
            const hours = Math.floor(totalMinutes / 60) % 24;
            const mins = totalMinutes % 60;
            return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
        },
        
        // 解析时间显示（HH:MM -> 分钟数）
        parseTime: function(timeStr) {
            const parts = timeStr.split(':');
            return parseInt(parts[0]) * 60 + parseInt(parts[1]);
        },
        
        // 深拷贝关卡数据（用于游戏实例）
        cloneLevel: function(level) {
            return JSON.parse(JSON.stringify(level));
        }
    };
})();
