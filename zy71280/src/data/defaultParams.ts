import type { CalculationParams, CommissionTier } from '../types/auction';
import rules from './rules.json';

export const defaultCommissionTiers: CommissionTier[] = [
  { tier: 1, minAmount: 0, maxAmount: 50000, rate: 25, description: '5万元及以下' },
  { tier: 2, minAmount: 50000, maxAmount: 200000, rate: 20, description: '5万-20万元' },
  { tier: 3, minAmount: 200000, maxAmount: 1000000, rate: 15, description: '20万-100万元' },
  { tier: 4, minAmount: 1000000, maxAmount: null, rate: 12, description: '100万元以上' },
];

export const defaultParams: CalculationParams = {
  riskTolerance: 0.5,
  commissionTiers: defaultCommissionTiers,
  unsoldCostCoefficient: rules.unsoldCostComponents.reduce((sum, c) => sum + c.default, 0),
  buyerWeight: 0.6,
  minReserveRatio: 0.5,
  maxReserveRatio: 0.9,
  maxUnsoldProbability: 0.4,
  minCommissionGuarantee: 5000,
};

export const RULE_NOTES = `
## 核心算法规则说明

### 1. 收益期望计算公式
期望收益 = Σ(成交价格 × 成交概率) - Σ(流拍成本 × 流拍概率)
- 成交概率基于历史数据的正态分布拟合
- 买家活跃度加权调整出价概率
- 佣金按阶梯分段计算

### 2. 风险约束条件
- 流拍概率 ≤ 最大可接受流拍概率（默认40%）
- 期望佣金 ≥ 最低佣金保障（默认5000元）
- 保留价/估值 ∈ [下限比例, 上限比例]（默认50%-90%）

### 3. 情景参数调整
- 保守情景：买家活跃度×0.8，流拍概率×1.2
- 中性情景：使用原始参数
- 乐观情景：买家活跃度×1.2，流拍概率×0.8

### 4. 异常检测规则
- 样本量<10：严重警告，置信度<70%
- 样本量<30：警告，置信度<85%
- 流拍成本缺项：检查仓储、营销、机会成本
- 佣金阶梯异常：断点、倒转、偏离行业标准±3%

### 5. 置信度计算
置信度 = min(1, 样本量/50) × (1 - |风险容忍度-0.5|) × 数据完整性系数
`;
