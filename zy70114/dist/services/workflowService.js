"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatOrderInfo = exports.getOrderFullInfo = exports.processOvertimeWorkflow = exports.processAssignRider = exports.processDeliver = exports.processRiderPickup = exports.processMealReady = exports.processStartCooking = exports.processMerchantAccept = exports.processCreateOrder = void 0;
const response_1 = require("../utils/response");
const orderService_1 = require("./orderService");
const mealTimerService_1 = require("./mealTimerService");
const liabilityService_1 = require("./liabilityService");
const compensationService_1 = require("./compensationService");
const idempotentService_1 = require("./idempotentService");
const processCreateOrder = (req) => {
    if (req.idempotentKey) {
        const existing = (0, idempotentService_1.checkIdempotent)(req.idempotentKey);
        if (existing) {
            const response = JSON.parse(existing.response_data);
            return {
                ...response,
                business_message: '订单已创建（幂等返回）',
                is_idempotent: true,
            };
        }
    }
    const order = (0, orderService_1.createOrder)(req.orderNo, req.merchantId, req.merchantName, req.userId, req.userName, req.orderAmount, req.expectedMealMinutes, req.operatorId, req.operatorRole);
    const response = {
        order_id: order.id,
        order_no: order.order_no,
        status: 'created',
        business_message: `订单 ${req.orderNo} 已创建成功，预计 ${req.expectedMealMinutes} 分钟出餐`,
    };
    if (req.idempotentKey) {
        (0, idempotentService_1.saveIdempotentResponse)(req.idempotentKey, 'create_order', JSON.stringify(response));
    }
    return response;
};
exports.processCreateOrder = processCreateOrder;
const processMerchantAccept = (orderId, operatorId, operatorRole) => {
    (0, orderService_1.updateOrderStatus)(orderId, 'merchant_accepted', operatorId, operatorRole);
    (0, orderService_1.addOrderNode)(orderId, 'merchant_accept', 'success', operatorId, operatorRole, '商家已接单');
    const order = (0, orderService_1.getOrderById)(orderId);
    (0, mealTimerService_1.startMealTimer)(orderId, order.expected_meal_minutes, operatorId, operatorRole);
    return {
        order_id: orderId,
        business_message: `商家「${order.merchant_name}」已接单，开始计时出餐，预计 ${order.expected_meal_minutes} 分钟`,
    };
};
exports.processMerchantAccept = processMerchantAccept;
const processStartCooking = (orderId, operatorId, operatorRole) => {
    (0, orderService_1.updateOrderStatus)(orderId, 'cooking', operatorId, operatorRole);
    (0, orderService_1.addOrderNode)(orderId, 'start_cooking', 'success', operatorId, operatorRole, '商家开始制作');
    const overtimeStatus = (0, mealTimerService_1.checkOvertimeStatus)(orderId);
    const remainingMinutes = overtimeStatus.expectedMinutes - overtimeStatus.elapsedMinutes;
    return {
        order_id: orderId,
        current_elapsed: overtimeStatus.elapsedMinutes.toFixed(1),
        remaining: Math.max(0, remainingMinutes).toFixed(1),
        business_message: `商家开始制作，已用时 ${overtimeStatus.elapsedMinutes.toFixed(1)} 分钟，剩余约 ${Math.max(0, Math.ceil(remainingMinutes))} 分钟`,
    };
};
exports.processStartCooking = processStartCooking;
const processMealReady = (orderId, operatorId, operatorRole) => {
    (0, orderService_1.updateOrderStatus)(orderId, 'meal_ready', operatorId, operatorRole);
    const timerResult = (0, mealTimerService_1.stopMealTimer)(orderId, operatorId, operatorRole);
    (0, orderService_1.addOrderNode)(orderId, 'meal_ready', 'success', operatorId, operatorRole, '商家已出餐');
    const timer = timerResult.timer;
    let businessMessage;
    let isOvertime = timerResult.isOvertime;
    let overtimeMinutes = timerResult.overtimeMinutes;
    if (isOvertime) {
        businessMessage = `商家已出餐，但超时了 ${overtimeMinutes} 分钟，预计用时 ${timer.expected_meal_minutes} 分钟，实际用时 ${(timer.actual_meal_minutes || 0).toFixed(1)} 分钟`;
    }
    else {
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
exports.processMealReady = processMealReady;
const processRiderPickup = (orderId, operatorId, operatorRole) => {
    (0, orderService_1.updateOrderStatus)(orderId, 'rider_picked_up', operatorId, operatorRole);
    (0, orderService_1.addOrderNode)(orderId, 'rider_pickup', 'success', operatorId, operatorRole, '骑手已取餐');
    return {
        order_id: orderId,
        business_message: '骑手已取餐，正在配送',
    };
};
exports.processRiderPickup = processRiderPickup;
const processDeliver = (orderId, operatorId, operatorRole) => {
    (0, orderService_1.updateOrderStatus)(orderId, 'delivered', operatorId, operatorRole);
    (0, orderService_1.addOrderNode)(orderId, 'deliver', 'success', operatorId, operatorRole, '订单已送达');
    return {
        order_id: orderId,
        business_message: '订单已送达，完成配送',
    };
};
exports.processDeliver = processDeliver;
const processAssignRider = (orderId, riderId, riderName, operatorId, operatorRole) => {
    const order = (0, orderService_1.assignRider)(orderId, riderId, riderName, operatorId, operatorRole);
    return {
        order_id: orderId,
        rider_id: riderId,
        rider_name: riderName,
        business_message: `已为订单分配骑手「${riderName}」`,
    };
};
exports.processAssignRider = processAssignRider;
const processOvertimeWorkflow = (orderId, operatorId, operatorRole) => {
    const judgment = (0, liabilityService_1.autoJudgeLiability)(orderId);
    const order = (0, orderService_1.getOrderById)(orderId);
    const compensations = (0, compensationService_1.generateCompensations)(orderId, order.order_amount, operatorId, operatorRole);
    const liablePartyName = (0, liabilityService_1.getLiabilityPartyName)(judgment.liable_party);
    const compensationSummary = compensations.map(c => ({
        type: (0, compensationService_1.getCompensationTypeName)(c.compensation_type),
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
exports.processOvertimeWorkflow = processOvertimeWorkflow;
const getOrderFullInfo = (orderId) => {
    const order = (0, orderService_1.getOrderById)(orderId);
    const nodes = (0, orderService_1.getOrderNodes)(orderId);
    const timer = (0, mealTimerService_1.getMealTimer)(orderId);
    const overtimeStatus = timer ? (0, mealTimerService_1.checkOvertimeStatus)(orderId) : null;
    const liability = (0, liabilityService_1.getLiabilityJudgment)(orderId);
    const compensations = (0, compensationService_1.getCompensations)(orderId);
    return {
        order,
        currentStatus: (0, orderService_1.getStatusName)(order.status),
        nodes: nodes.map(n => ({
            type: n.node_type,
            name: n.remark || n.node_type,
            time: (0, response_1.formatTime)(n.created_at),
        })),
        mealTimer: {
            expectedMinutes: timer ? timer.expected_meal_minutes : order.expected_meal_minutes,
            actualMinutes: timer?.actual_meal_minutes || undefined,
            isOvertime: timer ? !!timer.is_overtime : (overtimeStatus?.isOvertime || false),
            overtimeMinutes: timer?.overtime_minutes || overtimeStatus?.overtimeMinutes || undefined,
            isRunning: timer ? timer.status === 'running' : false,
        },
        liability: liability ? {
            liableParty: (0, liabilityService_1.getLiabilityPartyName)(liability.liable_party),
            reason: liability.reason,
            judgmentType: liability.judgment_type === 'manual' ? '人工' : '自动',
        } : undefined,
        compensations: compensations.map(c => ({
            type: (0, compensationService_1.getCompensationTypeName)(c.compensation_type),
            target: c.target_party === 'user' ? '用户' : c.target_party === 'rider' ? '骑手' : c.target_party === 'merchant' ? '商家' : '平台',
            amount: c.amount,
            status: (0, compensationService_1.getCompensationStatusName)(c.status),
        })),
    };
};
exports.getOrderFullInfo = getOrderFullInfo;
const formatOrderInfo = (info) => {
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
exports.formatOrderInfo = formatOrderInfo;
//# sourceMappingURL=workflowService.js.map