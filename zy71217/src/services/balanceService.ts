import { ConsumptionRecord, BalanceCalculationResult } from '../types';

export function recalculateBalance(
  initialBalance: number,
  records: ConsumptionRecord[]
): BalanceCalculationResult {
  const totalConsume = records
    .filter(r => r.type === 'consume')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalRefund = records
    .filter(r => r.type === 'refund')
    .reduce((sum, r) => sum + r.amount, 0);

  const totalRecharge = records
    .filter(r => r.type === 'recharge')
    .reduce((sum, r) => sum + r.amount, 0);

  const currentBalance = initialBalance - totalConsume + totalRefund + totalRecharge;

  const calculationProcess = `初始余额: ${initialBalance.toFixed(2)}元\n- 累计消费: ${totalConsume.toFixed(2)}元\n+ 累计退款: ${totalRefund.toFixed(2)}元\n+ 累计充值: ${totalRecharge.toFixed(2)}元\n= 当前余额: ${currentBalance.toFixed(2)}元`;

  return { currentBalance, totalConsume, totalRefund, totalRecharge, calculationProcess };
}

export const BALANCE_CALCULATION_RULES = {
  name: '余额计算规则',
  formula: '当前余额 = 初始余额 - 消费总额 + 退款总额 + 充值总额',
  description: '根据消费流水自动计算兑付余额，确保金额准确',
  keyValues: ['初始余额', '累计消费', '累计退款', '累计充值', '当前余额'],
  explanation: `
    规则说明：
    1. 初始余额：会员卡登记时的账面余额
    2. 累计消费：所有消费类型流水的金额总和
    3. 累计退款：所有退款类型流水的金额总和
    4. 累计充值：所有充值类型流水的金额总和
    5. 当前余额：通过公式计算得出的最终兑付金额
    
    注意事项：
    - 所有金额保留两位小数
    - 负余额需要人工审核确认
    - 计算结果需与系统记录核对
  `
};
