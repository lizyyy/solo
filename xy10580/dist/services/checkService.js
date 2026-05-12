"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.checkAppeal = checkAppeal;
exports.checkPendingAppeals = checkPendingAppeals;
exports.correctAppeal = correctAppeal;
const database_1 = require("../db/database");
const historyService_1 = require("./historyService");
const config_1 = require("../utils/config");
async function getOrderContext(orderNo) {
    const orderStmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, order_no as orderNo, rider_id as riderId, rider_name as riderName,
      merchant_id as merchantId, merchant_name as merchantName,
      user_id as userId, user_name as userName,
      merchant_address as merchantAddress, delivery_address as deliveryAddress,
      estimated_delivery_time as estimatedDeliveryTime,
      actual_delivery_time as actualDeliveryTime,
      promised_time as promisedTime, create_time as createTime,
      accept_time as acceptTime, arrive_merchant_time as arriveMerchantTime,
      pick_up_time as pickUpTime, deliver_time as deliverTime,
      status, cancel_reason as cancelReason,
      cancel_time as cancelTime, cancel_initiator as cancelInitiator
    FROM orders WHERE order_no = ?
  `);
    const orderRow = await orderStmt.get(orderNo);
    if (!orderRow)
        return null;
    const trajStmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, order_no as orderNo, rider_id as riderId,
      timestamp, latitude, longitude, speed, accuracy, event_type as eventType
    FROM rider_trajectories 
    WHERE order_no = ? 
    ORDER BY timestamp ASC
  `);
    const trajectories = await trajStmt.all(orderNo);
    const mealStmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, order_no as orderNo, merchant_id as merchantId,
      expected_ready_time as expectedReadyTime,
      actual_ready_time as actualReadyTime,
      prepare_start_time as prepareStartTime, note
    FROM merchant_meals WHERE order_no = ?
  `);
    const merchantMeal = await mealStmt.get(orderNo);
    const order = orderRow;
    const orderTime = order.actualDeliveryTime || order.deliverTime || order.createTime;
    const startTime = orderTime - config_1.CONFIG.WEATHER_AFFECTED_WINDOW_BEFORE;
    const endTime = orderTime + config_1.CONFIG.WEATHER_AFFECTED_WINDOW_AFTER;
    const weatherStmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, city, region, start_time as startTime,
      end_time as endTime, weather_type as weatherType,
      description, intensity
    FROM weather_events
  `);
    const allWeather = await weatherStmt.all();
    const weatherEvents = allWeather.filter(w => w.startTime <= endTime && w.endTime >= startTime);
    const penaltyStmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, order_no as orderNo, rider_id as riderId,
      penalty_type as penaltyType, penalty_amount as penaltyAmount,
      penalty_reason as penaltyReason, create_time as createTime,
      status, reverted_amount as revertedAmount
    FROM platform_penalties 
    WHERE order_no = ? AND rider_id = ?
  `);
    const penalty = await penaltyStmt.get(orderNo, order.riderId);
    return { order, trajectories, merchantMeal, weatherEvents, penalty };
}
function isBadWeather(weather) {
    return config_1.CONFIG.BAD_WEATHER_TYPES.includes(weather.weatherType) ||
        weather.intensity === 'heavy';
}
function isWeatherAffectingOrder(weather, order) {
    const orderStartTime = order.acceptTime || order.createTime;
    const orderEndTime = order.actualDeliveryTime || order.deliverTime || order.cancelTime || Date.now();
    return !(weather.endTime < orderStartTime || weather.startTime > orderEndTime);
}
function checkTrajectoryGaps(trajectories) {
    const gaps = [];
    if (trajectories.length < config_1.CONFIG.MIN_TRAJECTORY_POINTS) {
        return { hasGaps: true, gaps: [`轨迹点不足，仅 ${trajectories.length} 个点，最少需要 ${config_1.CONFIG.MIN_TRAJECTORY_POINTS} 个`] };
    }
    for (let i = 1; i < trajectories.length; i++) {
        const gap = trajectories[i].timestamp - trajectories[i - 1].timestamp;
        if (gap > config_1.CONFIG.TRAJECTORY_GAP_THRESHOLD) {
            gaps.push(`第 ${i} 个点与第 ${i + 1} 个点间隔 ${(gap / 60000).toFixed(1)} 分钟，超过阈值 ${config_1.CONFIG.TRAJECTORY_GAP_THRESHOLD / 60000} 分钟`);
        }
    }
    return { hasGaps: gaps.length > 0, gaps };
}
function checkMerchantTimeout(meal) {
    const delay = meal.actualReadyTime - meal.expectedReadyTime;
    return {
        isTimeout: delay > config_1.CONFIG.MERCHANT_PREPARE_TIMEOUT_THRESHOLD,
        delayMinutes: delay / 60000
    };
}
function buildEvidence(ctx, appealType) {
    const evidences = [];
    const { order, trajectories, merchantMeal, weatherEvents, penalty } = ctx;
    evidences.push({
        type: 'order',
        title: '订单基本信息',
        content: `订单号: ${order.orderNo}\n骑手: ${order.riderName} (${order.riderId})\n商家: ${order.merchantName}\n用户: ${order.userName}\n状态: ${order.status}\n预计配送: ${order.estimatedDeliveryTime / 60000} 分钟\n承诺送达: ${new Date(order.promisedTime).toLocaleString()}\n实际送达: ${order.actualDeliveryTime ? new Date(order.actualDeliveryTime).toLocaleString() : '未知'}`,
        timestamp: order.createTime
    });
    if (trajectories.length > 0) {
        const first = trajectories[0];
        const last = trajectories[trajectories.length - 1];
        const gapCheck = checkTrajectoryGaps(trajectories);
        evidences.push({
            type: 'trajectory',
            title: '轨迹信息',
            content: `轨迹点数: ${trajectories.length}\n起点时间: ${new Date(first.timestamp).toLocaleString()}\n终点时间: ${new Date(last.timestamp).toLocaleString()}\n轨迹间隔检查: ${gapCheck.hasGaps ? '存在断点' : '正常'}\n${gapCheck.gaps.map(g => '- ' + g).join('\n')}`,
            timestamp: first.timestamp
        });
    }
    else {
        evidences.push({
            type: 'trajectory',
            title: '轨迹信息',
            content: '未找到轨迹数据',
            timestamp: order.createTime
        });
    }
    if (merchantMeal) {
        const timeoutCheck = checkMerchantTimeout(merchantMeal);
        evidences.push({
            type: 'merchant',
            title: '商家出餐信息',
            content: `预计出餐: ${new Date(merchantMeal.expectedReadyTime).toLocaleString()}\n实际出餐: ${new Date(merchantMeal.actualReadyTime).toLocaleString()}\n出餐延迟: ${timeoutCheck.delayMinutes.toFixed(1)} 分钟\n出餐超时: ${timeoutCheck.isTimeout ? '是' : '否'}\n备注: ${merchantMeal.note || '无'}`,
            timestamp: merchantMeal.actualReadyTime
        });
    }
    else {
        evidences.push({
            type: 'merchant',
            title: '商家出餐信息',
            content: '未找到商家出餐数据',
            timestamp: order.createTime
        });
    }
    if (weatherEvents.length > 0) {
        const affectingWeather = weatherEvents.filter(w => isWeatherAffectingOrder(w, order));
        evidences.push({
            type: 'weather',
            title: '天气事件',
            content: affectingWeather.length > 0
                ? affectingWeather.map(w => `- ${w.weatherType}${w.intensity ? `(${w.intensity})` : ''}: ${w.description}\n  时间: ${new Date(w.startTime).toLocaleString()} ~ ${new Date(w.endTime).toLocaleString()}\n  恶劣天气: ${isBadWeather(w) ? '是' : '否'}`).join('\n\n')
                : '订单配送时段无天气事件',
            timestamp: order.createTime
        });
    }
    else {
        evidences.push({
            type: 'weather',
            title: '天气事件',
            content: '未找到天气数据',
            timestamp: order.createTime
        });
    }
    if (penalty) {
        evidences.push({
            type: 'penalty',
            title: '平台处罚信息',
            content: `处罚类型: ${penalty.penaltyType}\n处罚金额: ¥${penalty.penaltyAmount}\n处罚原因: ${penalty.penaltyReason}\n处罚状态: ${penalty.status}\n已退回金额: ¥${penalty.revertedAmount || 0}`,
            timestamp: penalty.createTime
        });
    }
    return evidences;
}
async function checkAppeal(appealId) {
    const appealStmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, order_no as orderNo, rider_id as riderId,
      appeal_type as appealType, appeal_reason as appealReason,
      submit_time as submitTime, status,
      check_result as checkResult, check_evidence as checkEvidence,
      check_time as checkTime, reverted_amount as revertedAmount,
      operator
    FROM appeals WHERE id = ?
  `);
    const appealRow = await appealStmt.get(appealId);
    if (!appealRow) {
        throw new Error(`未找到申诉记录: ${appealId}`);
    }
    const appeal = appealRow;
    if (['approved', 'rejected'].includes(appeal.status)) {
        return {
            appealId: appeal.id,
            orderNo: appeal.orderNo,
            appealType: appeal.appealType,
            status: appeal.status,
            evidences: [],
            rules: [],
            finalDecision: appeal.checkResult || '已审核',
            revertedAmount: appeal.revertedAmount,
            checkTime: appeal.checkTime || Date.now()
        };
    }
    await (0, historyService_1.addHistory)(appeal.orderNo, appeal.id, '开始审核', `审核申诉类型: ${appeal.appealType}`, undefined, appeal.status, 'processing');
    const updateStatusStmt = await (0, database_1.dbPrepare)(`
    UPDATE appeals SET status = 'processing', updated_at = ? WHERE id = ?
  `);
    await updateStatusStmt.run(Date.now(), appeal.id);
    const ctx = await getOrderContext(appeal.orderNo);
    if (!ctx) {
        const rejectStmt = await (0, database_1.dbPrepare)(`
      UPDATE appeals SET 
        status = 'rejected',
        check_result = ?,
        check_evidence = ?,
        check_time = ?,
        updated_at = ?
      WHERE id = ?
    `);
        await rejectStmt.run('未找到订单数据，无法审核', JSON.stringify([]), Date.now(), Date.now(), appeal.id);
        await (0, historyService_1.addHistory)(appeal.orderNo, appeal.id, '审核完成', '未找到订单数据，申诉被驳回', undefined, 'processing', 'rejected');
        return {
            appealId: appeal.id,
            orderNo: appeal.orderNo,
            appealType: appeal.appealType,
            status: 'rejected',
            evidences: [],
            rules: [],
            finalDecision: '未找到订单数据，无法审核',
            checkTime: Date.now()
        };
    }
    const evidences = buildEvidence(ctx, appeal.appealType);
    const rules = applyRules(ctx, appeal);
    const passedRules = rules.filter(r => r.passed);
    const totalWeight = rules.reduce((sum, r) => sum + r.weight, 0);
    const passedWeight = passedRules.reduce((sum, r) => sum + r.weight, 0);
    const passRatio = totalWeight > 0 ? passedWeight / totalWeight : 0;
    let finalDecision;
    let newStatus;
    let revertedAmount = 0;
    if (passRatio >= 0.6) {
        newStatus = 'approved';
        revertedAmount = ctx.penalty?.penaltyAmount || 0;
        finalDecision = `申诉通过，退回处罚金额 ¥${revertedAmount.toFixed(2)}`;
        if (ctx.penalty) {
            const updatePenaltyStmt = await (0, database_1.dbPrepare)(`
        UPDATE platform_penalties SET 
          status = 'reverted', 
          reverted_amount = ?,
          updated_at = ?
        WHERE id = ?
      `);
            await updatePenaltyStmt.run(revertedAmount, Date.now(), ctx.penalty.id);
        }
    }
    else {
        newStatus = 'rejected';
        const failReasons = rules.filter(r => !r.passed).map(r => r.reason);
        finalDecision = `申诉驳回，不满足申诉条件。原因: ${failReasons.join('; ') || '未提供有效证据'}`;
    }
    const finalUpdateStmt = await (0, database_1.dbPrepare)(`
    UPDATE appeals SET 
      status = ?,
      check_result = ?,
      check_evidence = ?,
      check_time = ?,
      reverted_amount = ?,
      updated_at = ?
    WHERE id = ?
  `);
    await finalUpdateStmt.run(newStatus, finalDecision, JSON.stringify(evidences), Date.now(), revertedAmount, Date.now(), appeal.id);
    await (0, historyService_1.addHistory)(appeal.orderNo, appeal.id, '审核完成', finalDecision, undefined, 'processing', newStatus);
    return {
        appealId: appeal.id,
        orderNo: appeal.orderNo,
        appealType: appeal.appealType,
        status: newStatus,
        evidences,
        rules,
        finalDecision,
        revertedAmount,
        checkTime: Date.now()
    };
}
function applyRules(ctx, appeal) {
    const rules = [];
    const { order, trajectories, merchantMeal, weatherEvents, penalty } = ctx;
    rules.push({
        ruleId: 'R001',
        ruleName: '订单存在处罚记录',
        passed: !!penalty && penalty.status !== 'reverted',
        reason: penalty
            ? (penalty.status === 'reverted' ? '处罚已被退回' : `存在${penalty.penaltyType}处罚，金额 ¥${penalty.penaltyAmount}`)
            : '未找到该订单的处罚记录',
        weight: 10
    });
    if (appeal.appealType === 'timeout') {
        const actualTime = order.actualDeliveryTime || order.deliverTime;
        const isTimeout = actualTime ? actualTime > order.promisedTime : false;
        rules.push({
            ruleId: 'R002',
            ruleName: '订单确实超时',
            passed: isTimeout,
            reason: actualTime
                ? `承诺送达: ${new Date(order.promisedTime).toLocaleString()}，实际送达: ${new Date(actualTime).toLocaleString()}，${isTimeout ? '已超时' : '未超时'}`
                : '无实际送达时间',
            weight: 15
        });
        if (merchantMeal) {
            const merchantCheck = checkMerchantTimeout(merchantMeal);
            rules.push({
                ruleId: 'R003',
                ruleName: '商家出餐超时',
                passed: merchantCheck.isTimeout,
                reason: `预计出餐: ${new Date(merchantMeal.expectedReadyTime).toLocaleString()}，实际出餐: ${new Date(merchantMeal.actualReadyTime).toLocaleString()}，延迟 ${merchantCheck.delayMinutes.toFixed(1)} 分钟`,
                weight: 25
            });
        }
        else {
            rules.push({
                ruleId: 'R003',
                ruleName: '商家出餐超时',
                passed: false,
                reason: '缺少商家出餐数据，无法判定',
                weight: 25
            });
        }
        const badWeather = weatherEvents.filter(w => isBadWeather(w) && isWeatherAffectingOrder(w, order));
        rules.push({
            ruleId: 'R004',
            ruleName: '恶劣天气影响',
            passed: badWeather.length > 0,
            reason: badWeather.length > 0
                ? `配送时段存在恶劣天气: ${badWeather.map(w => w.weatherType).join(', ')}`
                : '配送时段无恶劣天气记录',
            weight: 25
        });
        const gapCheck = checkTrajectoryGaps(trajectories);
        rules.push({
            ruleId: 'R005',
            ruleName: '轨迹完整无断点',
            passed: !gapCheck.hasGaps,
            reason: gapCheck.hasGaps
                ? `轨迹存在问题: ${gapCheck.gaps.join('; ')}`
                : `轨迹正常，共 ${trajectories.length} 个点`,
            weight: 15
        });
        if (order.pickUpTime && order.arriveMerchantTime) {
            const waitTime = order.pickUpTime - order.arriveMerchantTime;
            const waitMinutes = waitTime / 60000;
            rules.push({
                ruleId: 'R006',
                ruleName: '骑手到店后等待时间过长',
                passed: waitMinutes > 10,
                reason: `骑手 ${new Date(order.arriveMerchantTime).toLocaleTimeString()} 到店，${new Date(order.pickUpTime).toLocaleTimeString()} 取餐，等待 ${waitMinutes.toFixed(1)} 分钟`,
                weight: 10
            });
        }
    }
    else if (appeal.appealType === 'bad_review') {
        if (merchantMeal) {
            const merchantCheck = checkMerchantTimeout(merchantMeal);
            rules.push({
                ruleId: 'R011',
                ruleName: '商家出餐超时导致差评',
                passed: merchantCheck.isTimeout,
                reason: `商家出餐延迟 ${merchantCheck.delayMinutes.toFixed(1)} 分钟${merchantCheck.isTimeout ? '，可能影响用户体验' : ''}`,
                weight: 30
            });
        }
        const badWeather = weatherEvents.filter(w => isBadWeather(w) && isWeatherAffectingOrder(w, order));
        rules.push({
            ruleId: 'R012',
            ruleName: '恶劣天气影响配送',
            passed: badWeather.length > 0,
            reason: badWeather.length > 0
                ? `配送时段存在恶劣天气: ${badWeather.map(w => w.weatherType).join(', ')}`
                : '配送时段无恶劣天气',
            weight: 25
        });
        const gapCheck = checkTrajectoryGaps(trajectories);
        rules.push({
            ruleId: 'R013',
            ruleName: '骑手配送轨迹正常',
            passed: !gapCheck.hasGaps && trajectories.length >= config_1.CONFIG.MIN_TRAJECTORY_POINTS,
            reason: !gapCheck.hasGaps && trajectories.length >= config_1.CONFIG.MIN_TRAJECTORY_POINTS
                ? `轨迹正常，共 ${trajectories.length} 个点，无异常断点`
                : `轨迹存在问题: ${gapCheck.gaps.join('; ') || `点数不足(${trajectories.length}点)`}`,
            weight: 25
        });
        const actualTime = order.actualDeliveryTime || order.deliverTime;
        const promisedDelay = actualTime ? actualTime - order.promisedTime : 0;
        const delayMinutes = promisedDelay / 60000;
        const merchantTimeout = merchantMeal ? checkMerchantTimeout(merchantMeal).isTimeout : false;
        rules.push({
            ruleId: 'R014',
            ruleName: '配送时间在合理范围',
            passed: delayMinutes > 30 || merchantTimeout,
            reason: delayMinutes > 0
                ? `超时 ${delayMinutes.toFixed(1)} 分钟`
                : '配送未超时',
            weight: 20
        });
    }
    else if (appeal.appealType === 'cancellation') {
        rules.push({
            ruleId: 'R021',
            ruleName: '订单已取消',
            passed: order.status === 'cancelled',
            reason: `订单状态: ${order.status}`,
            weight: 10
        });
        rules.push({
            ruleId: 'R022',
            ruleName: '取消发起方非骑手',
            passed: order.cancelInitiator !== 'rider' && order.cancelInitiator !== undefined,
            reason: order.cancelInitiator
                ? `取消发起方: ${order.cancelInitiator}`
                : '无取消发起方记录',
            weight: 30
        });
        if (merchantMeal && order.acceptTime) {
            const merchantDelay = merchantMeal.actualReadyTime - order.acceptTime;
            rules.push({
                ruleId: 'R023',
                ruleName: '商家出餐过慢导致取消',
                passed: merchantDelay > config_1.CONFIG.MERCHANT_PREPARE_TIMEOUT_THRESHOLD * 2,
                reason: `骑手接单后 ${(merchantDelay / 60000).toFixed(1)} 分钟商家才出餐`,
                weight: 30
            });
        }
        const badWeather = weatherEvents.filter(w => isBadWeather(w) && isWeatherAffectingOrder(w, order));
        rules.push({
            ruleId: 'R024',
            ruleName: '恶劣天气导致取消',
            passed: badWeather.length > 0,
            reason: badWeather.length > 0
                ? `取消时段存在恶劣天气: ${badWeather.map(w => w.weatherType).join(', ')}`
                : '取消时段无恶劣天气',
            weight: 30
        });
    }
    return rules;
}
async function checkPendingAppeals() {
    const pendingStmt = await (0, database_1.dbPrepare)(`
    SELECT id FROM appeals WHERE status IN ('pending', 'processing')
  `);
    const pendingAppeals = await pendingStmt.all();
    const results = [];
    for (const appeal of pendingAppeals) {
        results.push(await checkAppeal(appeal.id));
    }
    return results;
}
async function correctAppeal(appealId, newStatus, newRevertedAmount, reason, operator) {
    const appealStmt = await (0, database_1.dbPrepare)(`
    SELECT 
      id, order_no as orderNo, rider_id as riderId,
      status, check_result as checkResult, reverted_amount as revertedAmount
    FROM appeals WHERE id = ?
  `);
    const appeal = await appealStmt.get(appealId);
    if (!appeal) {
        throw new Error(`未找到申诉记录: ${appealId}`);
    }
    const correctionId = `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const insertCorrStmt = await (0, database_1.dbPrepare)(`
    INSERT INTO appeal_corrections (
      id, appeal_id, operator, before_status, after_status,
      before_reverted_amount, after_reverted_amount,
      before_check_result, after_check_result, reason, create_time
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
    await insertCorrStmt.run(correctionId, appealId, operator, appeal.status, newStatus, appeal.revertedAmount, newRevertedAmount, appeal.checkResult, `人工修正: ${reason}`, reason, Date.now());
    const updateAppealStmt = await (0, database_1.dbPrepare)(`
    UPDATE appeals SET 
      status = 'corrected',
      check_result = ?,
      reverted_amount = ?,
      operator = ?,
      updated_at = ?
    WHERE id = ?
  `);
    await updateAppealStmt.run(`人工修正: ${reason} (原状态: ${appeal.status} -> ${newStatus})`, newRevertedAmount, operator, Date.now(), appealId);
    await (0, historyService_1.addHistory)(appeal.orderNo, appealId, '人工修正', `修正原因: ${reason}，金额: ¥${appeal.revertedAmount} -> ¥${newRevertedAmount}`, operator, appeal.status, newStatus);
}
//# sourceMappingURL=checkService.js.map