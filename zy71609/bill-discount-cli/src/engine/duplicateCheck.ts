import { Application, CalculationResult, Anomaly } from '../types';

export function checkDuplicateDiscount(
  app: Application,
  allApps: Application[],
  existingCalcs: CalculationResult[]
): Anomaly[] {
  const anomalies: Anomaly[] = [];

  const sameBillApps = allApps.filter(
    (a) => a.billNo === app.billNo && a.appId !== app.appId
  );

  if (sameBillApps.length > 0) {
    const approvedDuplicate = sameBillApps.find(
      (a) => a.status === 'approved' || a.status === 'recalculated'
    );

    if (approvedDuplicate) {
      anomalies.push({
        id: `dup-discount-approved-${app.appId}-${approvedDuplicate.appId}`,
        billNo: app.billNo,
        category: 'rule',
        severity: 'error',
        code: 'DUPLICATE_DISCOUNT_APPROVED',
        message: '同一票据存在已审批的重复贴现',
        detail: `当前申请=${app.appId}, 已审批申请=${approvedDuplicate.appId}, 银行=${approvedDuplicate.bankName}`,
        resolved: false,
        resolvedAt: '',
        resolution: '',
        createdAt: new Date().toISOString(),
      });
    } else {
      anomalies.push({
        id: `dup-discount-pending-${app.appId}`,
        billNo: app.billNo,
        category: 'data',
        severity: 'warning',
        code: 'DUPLICATE_DISCOUNT_PENDING',
        message: '同一票据存在待处理的重复贴现申请',
        detail: `当前申请=${app.appId}, 其他申请号=[${sameBillApps.map((a) => a.appId).join(',')}]`,
        resolved: false,
        resolvedAt: '',
        resolution: '',
        createdAt: new Date().toISOString(),
      });
    }
  }

  const existingCalc = existingCalcs.find((c) => c.billNo === app.billNo && c.appId !== app.appId);
  if (existingCalc) {
    anomalies.push({
      id: `dup-calc-${app.appId}-${existingCalc.appId}`,
      billNo: app.billNo,
      category: 'data',
      severity: 'info',
      code: 'DUPLICATE_CALCULATION_EXISTS',
      message: '同一票据已有复算记录',
      detail: `当前申请=${app.appId}, 已有复算=${existingCalc.appId}, 银行=${existingCalc.bankName}`,
      resolved: false,
      resolvedAt: '',
      resolution: '',
      createdAt: new Date().toISOString(),
    });
  }

  return anomalies;
}
