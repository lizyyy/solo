const StrategyStatus = {
  PENDING: 'pending',
  CONFIRMED: 'confirmed',
  BLOCKED: 'blocked',
  REVOKED: 'revoked',
  COMPENSATED: 'compensated'
};

const DegradationLevel = {
  L1: 'L1',
  L2: 'L2',
  L3: 'L3',
  L4: 'L4'
};

const StatusFlow = {
  [StrategyStatus.PENDING]: [StrategyStatus.CONFIRMED, StrategyStatus.REVOKED],
  [StrategyStatus.CONFIRMED]: [StrategyStatus.BLOCKED, StrategyStatus.REVOKED],
  [StrategyStatus.BLOCKED]: [StrategyStatus.COMPENSATED, StrategyStatus.REVOKED],
  [StrategyStatus.REVOKED]: [],
  [StrategyStatus.COMPENSATED]: []
};

const StatusDescriptions = {
  [StrategyStatus.PENDING]: '待处理 - 策略已创建等待审核',
  [StrategyStatus.CONFIRMED]: '已确认 - 策略已审核通过等待执行',
  [StrategyStatus.BLOCKED]: '被拦截 - 策略执行中，接口已被降级',
  [StrategyStatus.REVOKED]: '已撤销 - 策略已撤销',
  [StrategyStatus.COMPENSATED]: '已补偿 - 服务已恢复，补偿完成'
};

module.exports = {
  StrategyStatus,
  DegradationLevel,
  StatusFlow,
  StatusDescriptions
};
