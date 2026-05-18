"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.specialCaseRulesDescription = exports.weightCalculationFormula = exports.volumeCalculationFormula = exports.defaultEstimationConfig = void 0;
exports.defaultEstimationConfig = {
    volumeRules: {
        id: 'volume-default',
        name: '体积计算规则',
        description: '家具体积计算及堆放系数',
        enabled: true,
        paddingFactor: 1.2,
        stackingAllowance: 0.85
    },
    weightRules: {
        id: 'weight-default',
        name: '重量计算规则',
        description: '重量限制及分布系数',
        enabled: true,
        maxWeightPerTruck: 2000,
        weightDistributionFactor: 0.9
    },
    specialCaseRules: {
        id: 'special-case-default',
        name: '特殊情况处理规则',
        description: '大件不可拆、无电梯、可复跑等特殊情况',
        enabled: true,
        nonDisassemblableMultiplier: 1.5,
        noElevatorFloorPenalty: 0.1,
        reRunableItemDiscount: 0.1
    },
    truckTypes: [
        {
            id: 'small',
            name: '4.2米小货车',
            maxVolume: 12,
            maxWeight: 1500,
            baseCost: 300
        },
        {
            id: 'medium',
            name: '6.8米中货车',
            maxVolume: 35,
            maxWeight: 5000,
            baseCost: 600
        },
        {
            id: 'large',
            name: '9.6米大货车',
            maxVolume: 65,
            maxWeight: 10000,
            baseCost: 1200
        }
    ]
};
exports.volumeCalculationFormula = `
体积计算公式（默认口径）:
  单物体积 = 宽(m) × 高(m) × 深(m) × 数量
  总体积 = Σ(单物体积) × 堆放系数(0.85)
  调整后体积 = 总体积 × 填充系数(1.2)
`;
exports.weightCalculationFormula = `
重量计算公式（默认口径）:
  总重量 = Σ(单件重量 × 数量)
  调整后重量 = 总重量 × 分布系数(0.9)
`;
exports.specialCaseRulesDescription = `
特殊情况规则（默认口径）:
  1. 大件不可拆: 体积 × 1.5倍系数
  2. 无电梯: 每层增加 10% 搬运成本
  3. 可复跑物品: 享受 10% 折扣
`;
