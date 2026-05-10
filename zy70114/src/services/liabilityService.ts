import { getDb, generateId, now, saveDatabase, executeGet, executeAll } from '../database';
import { LiabilityJudgment, LiabilityParty, Order, OrderNode } from '../types';
import { BusinessError } from '../utils/response';
import { getOrderById, getOrderNodes } from './orderService';
import { getMealTimer, getOvertimeOrders } from './mealTimerService';
import { logOperation } from './idempotentService';

export const getLiabilityPartyName = (party: LiabilityParty): string => {
  const names: Record<LiabilityParty, string> = {
    merchant: '商家',
    rider: '骑手',
    platform: '平台',
    user: '用户',
    unknown: '待确认',
    none: '无责任',
  };
  return names[party] || party;
};

const analyzeOrderNodes = (order: Order, nodes: OrderNode[]) => {
  let merchantCookingTime = 0;
  let riderWaitTime = 0;
  let hasMerchantDelay = false;
  let hasRiderDelay = false;

  let cookingStart: number | null = null;
  let mealReady: number | null = null;
  let riderAssigned: number | null = null;
  let riderPickedUp: number | null = null;

  for (const node of nodes) {
    if (node.node_type === 'start_cooking') {
      cookingStart = node.created_at;
    } else if (node.node_type === 'meal_ready') {
      mealReady = node.created_at;
    } else if (node.node_type === 'rider_assign') {
      riderAssigned = node.created_at;
    } else if (node.node_type === 'rider_pickup') {
      riderPickedUp = node.created_at;
    }
  }

  if (cookingStart && mealReady) {
    merchantCookingTime = (mealReady - cookingStart) / (1000 * 60);
    const threshold = order.expected_meal_minutes * 1.2;
    hasMerchantDelay = merchantCookingTime > threshold;
  } else if (order.status === 'created' || order.status === 'merchant_accepted' || order.status === 'cooking') {
    hasMerchantDelay = true;
    hasRiderDelay = false;
  }

  if (mealReady && riderPickedUp) {
    riderWaitTime = (riderPickedUp - mealReady) / (1000 * 60);
    hasRiderDelay = riderWaitTime > 15;
  }

  return {
    hasMerchantDelay: !!hasMerchantDelay,
    hasRiderDelay: !!hasRiderDelay,
    merchantCookingTime,
    riderWaitTime,
  };
};

export const autoJudgeLiability = (orderId: string): LiabilityJudgment => {
  const db = getDb();
  const order = getOrderById(orderId);
  const timer = getMealTimer(orderId);
  const nodes = getOrderNodes(orderId);

  if (!timer) {
    throw new BusinessError(
      '计时器不存在',
      '该订单没有启动出餐计时器，无法判定责任',
      'TIMER_NOT_FOUND'
    );
  }

  const existing = executeGet<LiabilityJudgment>(
    'SELECT * FROM liability_judgments WHERE order_id = ?',
    [orderId]
  );

  if (existing) {
    throw new BusinessError(
      '已存在判定',
      `该订单已存在责任判定（${getLiabilityPartyName(existing.liable_party)}）`,
      'JUDGMENT_ALREADY_EXISTS'
    );
  }

  const analysis = analyzeOrderNodes(order, nodes);

  let liableParty: LiabilityParty = 'unknown';
  let reason = '';
  let judgmentType = 'auto';

  if (analysis.hasMerchantDelay && !analysis.hasRiderDelay) {
    liableParty = 'merchant';
    reason = `商家出餐超时，预计 ${order.expected_meal_minutes} 分钟，实际用时 ${analysis.merchantCookingTime.toFixed(1)} 分钟`;
  } else if (analysis.hasMerchantDelay && analysis.hasRiderDelay) {
    liableParty = 'merchant';
    reason = `商家出餐超时（${analysis.merchantCookingTime.toFixed(1)}分钟）且骑手等待时间过长（${analysis.riderWaitTime.toFixed(1)}分钟），主要责任归商家`;
  } else if (!analysis.hasMerchantDelay && analysis.hasRiderDelay) {
    liableParty = 'rider';
    reason = `骑手等待时间过长，餐品准备好后 ${analysis.riderWaitTime.toFixed(1)} 分钟才取餐`;
  } else if (analysis.hasMerchantDelay === false && analysis.hasRiderDelay === false) {
    liableParty = 'none';
    reason = '未检测到明显的出餐超时责任方';
    judgmentType = 'auto';
  } else {
    liableParty = 'unknown';
    reason = '无法自动判定，需要人工介入';
  }

  const judgment: LiabilityJudgment = {
    id: generateId(),
    order_id: orderId,
    meal_timer_id: timer.id,
    liable_party: liableParty,
    judgment_type: judgmentType as any,
    reason,
    evidence: JSON.stringify(analysis),
    created_at: now(),
  };

  db.run(`
    INSERT INTO liability_judgments (
      id, order_id, meal_timer_id, liable_party, judgment_type,
      reason, evidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    judgment.id,
    judgment.order_id,
    judgment.meal_timer_id,
    judgment.liable_party,
    judgment.judgment_type,
    judgment.reason,
    judgment.evidence,
    judgment.created_at,
  ]);

  logOperation(
    orderId,
    'system',
    'system',
    'auto_judge_liability',
    `自动判定责任方: ${getLiabilityPartyName(liableParty)}，原因: ${reason}`,
    null,
    { judgment }
  );

  saveDatabase();
  return judgment;
};

export const manualJudgeLiability = (
  orderId: string,
  liableParty: LiabilityParty,
  reason: string,
  evidence: string | null,
  operatorId: string,
  operatorRole: string
): LiabilityJudgment => {
  if (!reason || !reason.trim()) {
    throw new BusinessError(
      '判定原因不能为空',
      '请填写责任判定的原因',
      'INVALID_REASON'
    );
  }

  const db = getDb();
  const order = getOrderById(orderId);
  const timer = getMealTimer(orderId);

  if (!timer) {
    throw new BusinessError(
      '计时器不存在',
      '该订单没有启动出餐计时器',
      'TIMER_NOT_FOUND'
    );
  }

  const existing = executeGet<LiabilityJudgment>(
    'SELECT * FROM liability_judgments WHERE order_id = ?',
    [orderId]
  );

  if (existing) {
    logOperation(
      orderId,
      operatorId,
      operatorRole,
      'manual_rejudge_liability',
      `人工重新判定: 从「${getLiabilityPartyName(existing.liable_party)}」改为「${getLiabilityPartyName(liableParty)}」，原因: ${reason}`,
      { liable_party: existing.liable_party, reason: existing.reason },
      { liable_party: liableParty, reason }
    );

    db.run(`
      UPDATE liability_judgments 
      SET liable_party = ?, judgment_type = 'manual', reason = ?, evidence = ?, created_at = ?
      WHERE id = ?
    `, [
      liableParty,
      reason,
      evidence,
      now(),
      existing.id,
    ]);

    saveDatabase();
    return executeGet<LiabilityJudgment>(
      'SELECT * FROM liability_judgments WHERE id = ?',
      [existing.id]
    )!;
  }

  const judgment: LiabilityJudgment = {
    id: generateId(),
    order_id: orderId,
    meal_timer_id: timer.id,
    liable_party: liableParty,
    judgment_type: 'manual',
    reason,
    evidence,
    created_at: now(),
  };

  db.run(`
    INSERT INTO liability_judgments (
      id, order_id, meal_timer_id, liable_party, judgment_type,
      reason, evidence, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
  `, [
    judgment.id,
    judgment.order_id,
    judgment.meal_timer_id,
    judgment.liable_party,
    judgment.judgment_type,
    judgment.reason,
    judgment.evidence,
    judgment.created_at,
  ]);

  logOperation(
    orderId,
    operatorId,
    operatorRole,
    'manual_judge_liability',
    `人工判定责任方: ${getLiabilityPartyName(liableParty)}，原因: ${reason}`,
    null,
    { judgment }
  );

  saveDatabase();
  return judgment;
};

export const getLiabilityJudgment = (orderId: string): LiabilityJudgment | null => {
  return executeGet<LiabilityJudgment>(
    'SELECT * FROM liability_judgments WHERE order_id = ?',
    [orderId]
  );
};

export const getPendingLiabilityOrders = () => {
  const overtimeOrders = getOvertimeOrders();
  const result: { orderId: string; overtimeMinutes: number; analysis: any }[] = [];

  for (const item of overtimeOrders) {
    const existing = getLiabilityJudgment(item.orderId);
    if (!existing) {
      const order = getOrderById(item.orderId);
      const nodes = getOrderNodes(item.orderId);
      const analysis = analyzeOrderNodes(order, nodes);
      result.push({
        orderId: item.orderId,
        overtimeMinutes: item.overtimeMinutes,
        analysis,
      });
    }
  }

  return result;
};
