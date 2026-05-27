import { v4 as uuidv4 } from 'uuid';
import { Database } from '../database';
import { MaterialStatus, RegisterMaterialRequest } from '../types';

export interface ClassificationResult {
  status: MaterialStatus;
  reason: string;
  nextAction: string;
  overdueDays?: number;
  overdueFee?: number;
  deductionAmount?: number;
  deductionType?: 'overdue' | 'repair' | 'damage' | 'other';
}

export function classifyMaterial(
  material: RegisterMaterialRequest,
  hasDuplicate: boolean,
  equipmentHistory?: any
): ClassificationResult {
  if (hasDuplicate) {
    return {
      status: 'blocked',
      reason: '检测到重复扣款申请，同一订单/设备已有扣减记录',
      nextAction: '请核对原始凭证，确认是否为重复提交；如确需扣款请走特殊审批流程'
    };
  }

  const missingFields: string[] = [];
  if (!material.equipmentSerial) missingFields.push('设备序列号');
  if (!material.rentalStartDate) missingFields.push('租赁起始日期');
  if (!material.rentalEndDate) missingFields.push('租赁结束日期');
  if (material.depositAmount === undefined || material.depositAmount === null) missingFields.push('押金金额');

  if (missingFields.length > 0) {
    return {
      status: 'pending',
      reason: `材料信息不完整，缺少：${missingFields.join('、')}`,
      nextAction: '请联系业务员补充缺失信息后重新提交'
    };
  }

  const rentalEnd = new Date(material.rentalEndDate);
  const actualReturn = material.actualReturnDate ? new Date(material.actualReturnDate) : new Date();
  
  const overdueDays = Math.max(0, Math.ceil((actualReturn.getTime() - rentalEnd.getTime()) / (1000 * 60 * 60 * 24)));
  const dailyRate = material.depositAmount * 0.01;
  const overdueFee = overdueDays * dailyRate;

  let totalDeduction = 0;
  let deductionType: 'overdue' | 'repair' | 'damage' | 'other' | undefined;
  const reasons: string[] = [];

  if (overdueDays > 0) {
    totalDeduction += overdueFee;
    reasons.push(`逾期${overdueDays}天，产生逾期费用${overdueFee.toFixed(2)}元`);
    deductionType = 'overdue';
  }

  if (material.repairCost && material.repairCost > 0) {
    totalDeduction += material.repairCost;
    reasons.push(`维修费用${material.repairCost.toFixed(2)}元`);
    deductionType = deductionType ? 'other' : 'repair';
  }

  if (totalDeduction > material.depositAmount) {
    return {
      status: 'pending',
      reason: `扣减金额(${totalDeduction.toFixed(2)}元)超过押金(${material.depositAmount.toFixed(2)}元)，需特殊审批`,
      nextAction: '请提交超额扣款审批单，经主管签字后重新处理',
      overdueDays,
      overdueFee,
      deductionAmount: totalDeduction
    };
  }

  if (totalDeduction > 0) {
    return {
      status: 'normal',
      reason: `材料审核通过，${reasons.join('；')}`,
      nextAction: '执行押金扣减，剩余押金退还客户',
      overdueDays,
      overdueFee,
      deductionAmount: totalDeduction,
      deductionType
    };
  }

  return {
    status: 'normal',
    reason: '材料审核通过，无异常情况',
    nextAction: '押金全额退还客户',
    overdueDays: 0,
    overdueFee: 0,
    deductionAmount: 0
  };
}

export async function checkDuplicateDeduction(
  db: Database,
  orderNo: string,
  equipmentSerial: string,
  excludeMaterialId?: string
): Promise<{ isDuplicate: boolean; existingRecord?: any }> {
  let query = `
    SELECT dr.*, m.order_no, m.equipment_serial
    FROM deduction_records dr
    JOIN materials m ON dr.material_id = m.id
    WHERE (m.order_no = ? OR m.equipment_serial = ?)
    AND dr.is_duplicate = 0
  `;
  const params: any[] = [orderNo, equipmentSerial];

  if (excludeMaterialId) {
    query += ' AND m.id != ?';
    params.push(excludeMaterialId);
  }

  const existing = await db.get(query, ...params);
  
  if (existing) {
    return { isDuplicate: true, existingRecord: existing };
  }

  const sameOrder = await db.get(
    `SELECT * FROM materials WHERE order_no = ? AND status != 'blocked' AND deduction_amount > 0`,
    orderNo
  );

  if (sameOrder && (!excludeMaterialId || sameOrder.id !== excludeMaterialId)) {
    return { isDuplicate: true, existingRecord: sameOrder };
  }

  return { isDuplicate: false };
}
