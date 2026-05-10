import { Order } from '../types';
import { BusinessError, formatTime } from '../utils/response';
import {
  createOrder,
  getOrderById,
  addOrderNode,
  updateOrderStatus,
  getOrderNodes,
  getStatusName,
  assignRider,
} from './orderService';
import {
  startMealTimer,
  stopMealTimer,
  getMealTimer,
  checkOvertimeStatus,
} from './mealTimerService';
import {
  autoJudgeLiability,
  getLiabilityJudgment,
  getLiabilityPartyName,
} from './liabilityService';
import {
  generateCompensations,
  getCompensations,
  getCompensationTypeName,
  getCompensationStatusName,
} from './compensationService';
import {
  checkIdempotent,
  saveIdempotentResponse,
} from './idempotentService';

export interface ProcessOrderResult {
  order: Order;
  currentStatus: string;
  nodes: { type: string; name: string; time: string }[];
  mealTimer: {
    expectedMinutes: number;
    actualMinutes?: number;
    isOvertime: boolean;
    overtimeMinutes?: number;
    isRunning: boolean;
  };
  liability?: {
    liableParty: string;
    reason: string;
    judgmentType: string;
  };
  compensations: {
    type: string;
    target: string;
    amount: number;
    status: string;
  }[];
}

export interface CreateOrderRequest {
  idempotentKey?: string;
  orderNo: string;
  merchantId: string;
  merchantName: string;
  userId: string;
  userName: string;
  orderAmount: number;
  expectedMealMinutes: number;
  operatorId: string;
  operatorRole: string;
}

export const processCreateOrder = (req: CreateOrderRequest) => {
  if (req.idempotentKey) {
    const existing = checkIdempotent(req.idempotentKey);
    
    if (existing) {
      const response = JSON.parse(existing.response_data);
      return {
        ...response,
        business_message: '订单已创建（幂等返回）',
        is_idempotent: true,
      };
    }
  }

  const order = createOrder(
    req.orderNo,
    req.merchantId,
    req.merchantName,
    req.userId,
    req.userName,
    req.orderAmount,
    req.expectedMealMinutes,
    req.operatorId,
    req.operatorRole
  );

  const response = {
    order_id: order.id,
    order_no: order.order_no,
    status: 'created',
    business_message: `订单 ${req.orderNo} 已创建成功，预计 ${req.expectedMealMinutes} 分钟出餐`,
  };

  if (req.idempotentKey) {
    saveIdempotentResponse(req.idempotentKey, 'create_order', JSON.stringify(response));
  }

  return response;
};

export const processMerchantAccept = (
  orderId: string,
  operatorId: string,
  operatorRole: string
) => {
  updateOrderStatus(orderId, 'merchant_accepted', operatorId, operatorRole);
  
  addOrderNode(orderId, 'merchant_accept', 'success', operatorId, operatorRole, '商家已接单');
  
  const order = getOrderById(orderId);
  
  startMealTimer(orderId, order.expected_meal_minutes, operatorId, operatorRole);

  return {
    order_id: orderId,
    business_message: `商家「${order.merchant_name}」已接单，开始计时出餐，预计 ${order.expected_meal_minutes} 分钟`,
  };
};

export const processStartCooking = (
  orderId: string,
  operatorId: string,
  operatorRole: string
) => {
  updateOrderStatus(orderId, 'cooking', operatorId, operatorRole);
  
  addOrderNode(orderId, 'start_cooking', 'success', operatorId, operatorRole, '商家开始制作');
  
  const overtimeStatus = checkOvertimeStatus(orderId);
  const remainingMinutes = overtimeStatus.expectedMinutes - overtimeStatus.elapsedMinutes;

  return {
    order_id: orderId,
    current_elapsed: overtimeStatus.elapsedMinutes.toFixed(1),
    remaining: Math.max(0, remainingMinutes).toFixed(1),
    business_message: `商家开始制作，已用时 ${overtimeStatus.elapsedMinutes.toFixed(1)} 分钟，剩余约 ${Math.max(0, Math.ceil(remainingMinutes))} 分钟`,
  };
};

export const processMealReady = (
  orderId: string,
  operatorId: string,
  operatorRole: string
) => {
  updateOrderStatus(orderId, 'meal_ready', operatorId, operatorRole);
  
  const timerResult = stopMealTimer(orderId, operatorId, operatorRole);
  
  addOrderNode(orderId, 'meal_ready', 'success', operatorId, operatorRole, '商家已出餐');

  const timer = timerResult.timer;
  let businessMessage: string;
  let isOvertime = timerResult.isOvertime;
  let overtimeMinutes = timerResult.overtimeMinutes;

  if (isOvertime) {
    businessMessage = `商家已出餐，但超时了 ${overtimeMinutes} 分钟，预计用时 ${timer.expected_meal_minutes} 分钟，实际用时 ${(timer.actual_meal_minutes || 0).toFixed(1)} 分钟`;
  } else {
    businessMessage = `商家已出餐，按时完成，实际用时 ${(timer.actual_meal_minutes || 0).toFixed(1)} 分钟`;
  }

  return {
    order_id: orderId,
    is_overtime: isOvertime,
    overtime_minutes: overtimeMinutes,
    expected_minutes: timer.expected_meal_minutes,
    actual_minutes: timer.actual_meal_minutes,
    business_message: businessMessage,
  };
};

export const processRiderPickup = (
  orderId: string,
  operatorId: string,
  operatorRole: string
) => {
  updateOrderStatus(orderId, 'rider_picked_up', operatorId, operatorRole);
  
  addOrderNode(orderId, 'rider_pickup', 'success', operatorId, operatorRole, '骑手已取餐');

  return {
    order_id: orderId,
    business_message: '骑手已取餐，正在配送',
  };
};

export const processDeliver = (
  orderId: string,
  operatorId: string,
  operatorRole: string
) => {
  updateOrderStatus(orderId, 'delivered', operatorId, operatorRole);
  
  addOrderNode(orderId, 'deliver', 'success', operatorId, operatorRole, '订单已送达');

  return {
    order_id: orderId,
    business_message: '订单已送达，完成配送',
  };
};

export const processAssignRider = (
  orderId: string,
  riderId: string,
  riderName: string,
  operatorId: string,
  operatorRole: string
) => {
  const order = assignRider(orderId, riderId, riderName, operatorId, operatorRole);

  return {
    order_id: orderId,
    rider_id: riderId,
    rider_name: riderName,
    business_message: `已为订单分配骑手「${riderName}」`,
  };
};

export const processOvertimeWorkflow = (
  orderId: string,
  operatorId: string,
  operatorRole: string
) => {
  const judgment = autoJudgeLiability(orderId);
  const order = getOrderById(orderId);
  const compensations = generateCompensations(orderId, order.order_amount, operatorId, operatorRole);

  const liablePartyName = getLiabilityPartyName(judgment.liable_party);

  const compensationSummary = compensations.map(c => ({
    type: getCompensationTypeName(c.compensation_type),
    target: c.target_party === 'user' ? '用户' : c.target_party === 'rider' ? '骑手' : c.target_party === 'merchant' ? '商家' : '平台',
    amount: c.amount,
  }));

  return {
    order_id: orderId,
    liability: {
      liable_party: judgment.liable_party,
      liable_party_name: liablePartyName,
      reason: judgment.reason,
      judgment_type: judgment.judgment_type,
    },
    compensations: compensationSummary,
    business_message: `已完成超时处理，责任方: ${liablePartyName}，生成 ${compensations.length} 条补偿记录`,
  };
};

export const getOrderFullInfo = (orderId: string): ProcessOrderResult => {
  const order = getOrderById(orderId);
  const nodes = getOrderNodes(orderId);
  const timer = getMealTimer(orderId);
  const overtimeStatus = timer ? checkOvertimeStatus(orderId) : null;
  const liability = getLiabilityJudgment(orderId);
  const compensations = getCompensations(orderId);

  return {
    order,
    currentStatus: getStatusName(order.status),
    nodes: nodes.map(n => ({
      type: n.node_type,
      name: n.remark || n.node_type,
      time: formatTime(n.created_at),
    })),
    mealTimer: {
      expectedMinutes: timer ? timer.expected_meal_minutes : order.expected_meal_minutes,
      actualMinutes: timer?.actual_meal_minutes || undefined,
      isOvertime: timer ? !!timer.is_overtime : (overtimeStatus?.isOvertime || false),
      overtimeMinutes: timer?.overtime_minutes || overtimeStatus?.overtimeMinutes || undefined,
      isRunning: timer ? timer.status === 'running' : false,
    },
    liability: liability ? {
      liableParty: getLiabilityPartyName(liability.liable_party),
      reason: liability.reason,
      judgmentType: liability.judgment_type === 'manual' ? '人工' : '自动',
    } : undefined,
    compensations: compensations.map(c => ({
      type: getCompensationTypeName(c.compensation_type),
      target: c.target_party === 'user' ? '用户' : c.target_party === 'rider' ? '骑手' : c.target_party === 'merchant' ? '商家' : '平台',
      amount: c.amount,
      status: getCompensationStatusName(c.status),
    })),
  };
};

export const formatOrderInfo = (info: ProcessOrderResult): string => {
  let output = `\n========================================\n`;
  output += `      订单详情: ${info.order.order_no}\n`;
  output += `========================================\n\n`;
  
  output += `【基本信息】\n`;
  output += `  订单号: ${info.order.order_no}\n`;
  output += `  商家: ${info.order.merchant_name}\n`;
  output += `  用户: ${info.order.user_name}\n`;
  output += `  骑手: ${info.order.rider_name || '未分配'}\n`;
  output += `  订单金额: ¥${info.order.order_amount.toFixed(2)}\n`;
  output += `  当前状态: ${info.currentStatus}\n\n`;

  output += `【状态流转】\n`;
  info.nodes.forEach((node, idx) => {
    output += `  ${idx + 1}. ${node.name} - ${node.time}\n`;
  });
  output += `\n`;

  output += `【出餐计时】\n`;
  output += `  预计用时: ${info.mealTimer.expectedMinutes} 分钟\n`;
  if (info.mealTimer.actualMinutes) {
    output += `  实际用时: ${info.mealTimer.actualMinutes.toFixed(1)} 分钟\n`;
  }
  output += `  是否超时: ${info.mealTimer.isOvertime ? '是' : '否'}\n`;
  if (info.mealTimer.overtimeMinutes && info.mealTimer.overtimeMinutes > 0) {
    output += `  超时时长: ${info.mealTimer.overtimeMinutes} 分钟\n`;
  }
  output += `  计时状态: ${info.mealTimer.isRunning ? '进行中' : '已结束'}\n\n`;

  if (info.liability) {
    output += `【责任判定】\n`;
    output += `  责任方: ${info.liability.liableParty}\n`;
    output += `  判定原因: ${info.liability.reason}\n`;
    output += `  判定方式: ${info.liability.judgmentType}\n\n`;
  }

  if (info.compensations.length > 0) {
    output += `【补偿记录】\n`;
    info.compensations.forEach((c, idx) => {
      output += `  ${idx + 1}. ${c.type} -> ${c.target}: ¥${c.amount.toFixed(2)} [${c.status}]\n`;
    });
    output += `\n`;
  }

  output += `========================================\n`;

  return output;
};
