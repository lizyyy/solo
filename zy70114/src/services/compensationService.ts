import { getDb, generateId, now, saveDatabase, executeGet, executeAll } from '../database';
import { Compensation, CompensationStatus, CompensationType, LiabilityParty, TargetParty } from '../types';
import { BusinessError } from '../utils/response';
import { getLiabilityJudgment, getLiabilityPartyName } from './liabilityService';
import { logOperation } from './idempotentService';

export const COMPENSATION_RULES: Record<LiabilityParty, { type: CompensationType; target: TargetParty; base: number; perMinute: number; min: number; max: number }[]> = {
  merchant: [
    { type: 'user_refund', target: 'user', base: 0, perMinute: 1, min: 5, max: 50 },
    { type: 'rider_waiting_fee', target: 'rider', base: 3, perMinute: 0.5, min: 3, max: 20 },
    { type: 'merchant_penalty', target: 'merchant', base: 10, perMinute: 2, min: 10, max: 200 },
  ],
  rider: [
    { type: 'user_coupon', target: 'user', base: 5, perMinute: 0.5, min: 5, max: 30 },
    { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
  ],
  platform: [
    { type: 'user_refund', target: 'user', base: 10, perMinute: 2, min: 10, max: 100 },
    { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
  ],
  user: [
    { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
  ],
  unknown: [
    { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
  ],
  none: [
    { type: 'platform_coverage', target: 'platform', base: 0, perMinute: 0, min: 0, max: 0 },
  ],
};

export const getCompensationTypeName = (type: CompensationType): string => {
  const names: Record<CompensationType, string> = {
    user_coupon: '用户优惠券',
    user_refund: '用户退款',
    rider_waiting_fee: '骑手等待费',
    merchant_penalty: '商家罚款',
    platform_coverage: '平台兜底',
  };
  return names[type] || type;
};

export const getCompensationStatusName = (status: CompensationStatus): string => {
  const names: Record<CompensationStatus, string> = {
    pending: '待审批',
    approved: '已审批',
    rejected: '已拒绝',
    executed: '已执行',
    appealed: '申诉中',
    rolled_back: '已回滚',
  };
  return names[status] || status;
};

export const calculateCompensation = (
  rule: typeof COMPENSATION_RULES['merchant'][0],
  overtimeMinutes: number,
  orderAmount: number
): number => {
  if (rule.min === 0 && rule.max === 0 && rule.perMinute === 0 && rule.base === 0) {
    return 0;
  }

  let amount = rule.base + (overtimeMinutes * rule.perMinute);
  
  if (rule.type === 'user_refund') {
    const maxByOrder = orderAmount * 0.3;
    amount = Math.min(amount, maxByOrder);
  }

  if (rule.min > 0) {
    amount = Math.max(amount, rule.min);
  }
  if (rule.max > 0) {
    amount = Math.min(amount, rule.max);
  }

  return Math.round(amount * 100) / 100;
};

export const generateCompensations = (
  orderId: string,
  orderAmount: number,
  operatorId: string,
  operatorRole: string
): Compensation[] => {
  const db = getDb();
  const judgment = getLiabilityJudgment(orderId);

  if (!judgment) {
    throw new BusinessError(
      '未找到责任判定',
      '请先完成责任判定再生成补偿',
      'NO_LIABILITY_JUDGMENT'
    );
  }

  const existing = getCompensations(orderId);
  if (existing.length > 0) {
    throw new BusinessError(
      '补偿已生成',
      `该订单已生成 ${existing.length} 条补偿记录`,
      'COMPENSATIONS_ALREADY_GENERATED'
    );
  }

  const rules = COMPENSATION_RULES[judgment.liable_party];
  
  const timer = executeGet<any>(
    'SELECT overtime_minutes FROM meal_timers WHERE order_id = ?',
    [orderId]
  );
  const overtimeMinutes = timer ? timer.overtime_minutes : 0;

  const compensations: Compensation[] = [];

  for (const rule of rules) {
    const amount = calculateCompensation(rule, overtimeMinutes, orderAmount);
    
    if (amount <= 0 && rule.min === 0) {
      continue;
    }

    const comp: Compensation = {
      id: generateId(),
      order_id: orderId,
      liability_judgment_id: judgment.id,
      compensation_type: rule.type,
      target_party: rule.target,
      amount,
      status: 'pending',
      remark: `${getLiabilityPartyName(judgment.liable_party)}责任，超时 ${overtimeMinutes} 分钟`,
      created_at: now(),
      updated_at: now(),
    };

    db.run(`
      INSERT INTO compensations (
        id, order_id, liability_judgment_id, compensation_type,
        target_party, amount, status, remark, created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      comp.id,
      comp.order_id,
      comp.liability_judgment_id,
      comp.compensation_type,
      comp.target_party,
      comp.amount,
      comp.status,
      comp.remark,
      comp.created_at,
      comp.updated_at,
    ]);

    compensations.push(comp);
  }

  logOperation(
    orderId,
    operatorId,
    operatorRole,
    'generate_compensations',
    `生成 ${compensations.length} 条补偿记录`,
    null,
    { compensations, liability: judgment.liable_party, overtimeMinutes }
  );

  saveDatabase();
  return compensations;
};

export const getCompensations = (orderId: string): Compensation[] => {
  return executeAll<Compensation>(
    `SELECT * FROM compensations WHERE order_id = ? ORDER BY created_at DESC`,
    [orderId]
  );
};

export const getCompensationById = (compensationId: string): Compensation => {
  const comp = executeGet<Compensation>(
    'SELECT * FROM compensations WHERE id = ?',
    [compensationId]
  );

  if (!comp) {
    throw new BusinessError(
      '补偿记录不存在',
      `找不到ID为「${compensationId}」的补偿记录`,
      'COMPENSATION_NOT_FOUND'
    );
  }

  return comp;
};

export const updateCompensationStatus = (
  compensationId: string,
  newStatus: CompensationStatus,
  operatorId: string,
  operatorRole: string,
  remark?: string
): Compensation => {
  const db = getDb();
  const comp = getCompensationById(compensationId);

  db.run(`
    UPDATE compensations 
    SET status = ?, updated_at = ?, remark = COALESCE(?, remark)
    WHERE id = ?
  `, [newStatus, now(), remark || null, compensationId]);

  logOperation(
    comp.order_id,
    operatorId,
    operatorRole,
    'update_compensation_status',
    `${getCompensationTypeName(comp.compensation_type)} 状态变更: ${getCompensationStatusName(comp.status)} -> ${getCompensationStatusName(newStatus)}`,
    { status: comp.status },
    { status: newStatus }
  );

  saveDatabase();
  return getCompensationById(compensationId);
};

export const approveCompensation = (
  compensationId: string,
  operatorId: string,
  operatorRole: string
): Compensation => {
  const comp = getCompensationById(compensationId);
  
  if (comp.status !== 'pending') {
    throw new BusinessError(
      '状态不允许',
      `当前状态「${getCompensationStatusName(comp.status)}」不能审批`,
      'INVALID_STATUS'
    );
  }

  return updateCompensationStatus(compensationId, 'approved', operatorId, operatorRole);
};

export const rejectCompensation = (
  compensationId: string,
  reason: string,
  operatorId: string,
  operatorRole: string
): Compensation => {
  if (!reason || !reason.trim()) {
    throw new BusinessError(
      '拒绝原因不能为空',
      '请填写拒绝补偿的原因',
      'INVALID_REASON'
    );
  }

  const comp = getCompensationById(compensationId);
  
  if (comp.status !== 'pending') {
    throw new BusinessError(
      '状态不允许',
      `当前状态「${getCompensationStatusName(comp.status)}」不能拒绝`,
      'INVALID_STATUS'
    );
  }

  return updateCompensationStatus(compensationId, 'rejected', operatorId, operatorRole, `拒绝原因: ${reason}`);
};

export const executeCompensation = (
  compensationId: string,
  operatorId: string,
  operatorRole: string
): Compensation => {
  const comp = getCompensationById(compensationId);
  
  if (comp.status !== 'approved') {
    throw new BusinessError(
      '状态不允许',
      `当前状态「${getCompensationStatusName(comp.status)}」不能执行，需要先审批通过`,
      'INVALID_STATUS'
    );
  }

  return updateCompensationStatus(compensationId, 'executed', operatorId, operatorRole);
};
