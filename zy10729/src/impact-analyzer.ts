import { CouponBatch, CouponRecord, OrderDetail, WithdrawalImpact, ImpactStatistics, UserImpactLevel } from './types';

export function analyzeWithdrawalImpact(
  batches: CouponBatch[],
  records: CouponRecord[],
  orders: OrderDetail[]
): { impacts: WithdrawalImpact[], statistics: ImpactStatistics } {
  
  const batchMap = new Map<string, CouponBatch>();
  batches.forEach(b => batchMap.set(b.batchId, b));

  const orderMap = new Map<string, OrderDetail>();
  orders.forEach(o => orderMap.set(o.orderId, o));

  const impacts: WithdrawalImpact[] = [];

  for (const record of records) {
    const batch = batchMap.get(record.batchId);
    if (!batch) {
      continue;
    }

    const order = record.orderId ? orderMap.get(record.orderId) : undefined;
    
    const { impactLevel, impactDescription, lossAmount } = calculateImpact(record, order);

    impacts.push({
      batchId: batch.batchId,
      batchName: batch.batchName,
      anchorId: batch.anchorId,
      anchorName: batch.anchorName,
      userId: record.userId,
      userName: record.userName,
      couponCode: record.couponCode,
      receiveTime: record.receiveTime,
      expireTime: record.expireTime,
      useStatus: record.useStatus,
      orderId: record.orderId,
      orderTime: order?.orderTime,
      orderAmount: order?.orderAmount,
      discountAmount: order?.discountAmount,
      refundStatus: order?.refundStatus,
      refundAmount: order?.refundAmount,
      impactLevel,
      impactDescription,
      lossAmount
    });
  }

  const sortedImpacts = sortImpacts(impacts);
  const statistics = calculateStatistics(sortedImpacts);

  return {
    impacts: sortedImpacts,
    statistics
  };
}

function calculateImpact(
  record: CouponRecord,
  order?: OrderDetail
): { impactLevel: UserImpactLevel; impactDescription: string; lossAmount: number } {
  
  let impactLevel: UserImpactLevel;
  let impactDescription: string;
  let lossAmount: number;

  switch (record.useStatus) {
    case 'USED':
      if (order) {
        if (order.refundStatus === 'FULL') {
          impactLevel = 'LOW';
          impactDescription = '已下单且全额退款，撤券影响较低';
          lossAmount = 0;
        } else if (order.refundStatus === 'PARTIAL') {
          impactLevel = 'MEDIUM';
          impactDescription = '已下单且部分退款，撤券影响中等';
          lossAmount = order.discountAmount - order.refundAmount;
        } else {
          impactLevel = 'HIGH';
          impactDescription = '已下单未退款，撤券影响严重 - 用户已实际享受优惠';
          lossAmount = order.discountAmount;
        }
      } else {
        impactLevel = 'HIGH';
        impactDescription = '已使用但订单信息缺失，需人工核实';
        lossAmount = 0;
      }
      break;

    case 'UNUSED':
      impactLevel = 'LOW';
      impactDescription = '未使用，撤券影响较低 - 用户尚未实际享受优惠';
      lossAmount = 0;
      break;

    case 'EXPIRED':
      impactLevel = 'LOW';
      impactDescription = '已过期，撤券影响较低';
      lossAmount = 0;
      break;

    case 'REFUNDED':
      impactLevel = 'LOW';
      impactDescription = '已退款，撤券影响较低';
      lossAmount = 0;
      break;

    default:
      impactLevel = 'MEDIUM';
      impactDescription = `未知使用状态(${record.useStatus})，需人工核实`;
      lossAmount = 0;
  }

  return { impactLevel, impactDescription, lossAmount: Math.max(0, lossAmount) };
}

function sortImpacts(impacts: WithdrawalImpact[]): WithdrawalImpact[] {
  return [...impacts].sort((a, b) => {
    const levelOrder: Record<UserImpactLevel, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
    const levelDiff = levelOrder[a.impactLevel] - levelOrder[b.impactLevel];
    if (levelDiff !== 0) return levelDiff;

    if (a.batchId !== b.batchId) return a.batchId.localeCompare(b.batchId);

    if (a.userId !== b.userId) return a.userId.localeCompare(b.userId);

    return a.couponCode.localeCompare(b.couponCode);
  });
}

function calculateStatistics(impacts: WithdrawalImpact[]): ImpactStatistics {
  const uniqueUsers = new Set(impacts.map(i => i.userId));
  
  const byImpactLevel = { HIGH: 0, MEDIUM: 0, LOW: 0 };
  const byUseStatus: Record<string, number> = {};
  let totalLossAmount = 0;

  for (const impact of impacts) {
    byImpactLevel[impact.impactLevel]++;
    byUseStatus[impact.useStatus] = (byUseStatus[impact.useStatus] || 0) + 1;
    totalLossAmount += impact.lossAmount;
  }

  return {
    totalAffectedUsers: uniqueUsers.size,
    totalAffectedCoupons: impacts.length,
    totalLossAmount,
    byImpactLevel,
    byUseStatus
  };
}
