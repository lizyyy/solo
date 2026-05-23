const crypto = require("crypto");
const Order = require("../models/order");
const PaymentRecord = require("../models/paymentRecord");
const ChargerLog = require("../models/chargerLog");
const Discrepancy = require("../models/discrepancy");
const ReconciliationTask = require("../models/reconciliationTask");
const DiffCalculator = require("../utils/diffCalculator");

const DISCREPANCY_TYPES = {
  UNDEDUCTED: "UNDEDUCTED",
  DUPLICATE_REFUND: "DUPLICATE_REFUND",
  CROSS_PLATFORM: "CROSS_PLATFORM",
  AMOUNT_MISMATCH: "AMOUNT_MISMATCH",
  TIME_MISMATCH: "TIME_MISMATCH",
  STATUS_MISMATCH: "STATUS_MISMATCH"
};

const ReconciliationService = {
  createReconciliationTask: (name, dateRange) => {
    return new Promise((resolve, reject) => {
      const taskId = "TASK_" + Date.now() + "_" + crypto.randomBytes(4).toString("hex");
      const task = {
        task_id: taskId,
        name: name || "对账任务",
        status: "PENDING",
        created_at: new Date().toISOString(),
        completed_at: null,
        statistics: JSON.stringify({ dateRange: dateRange, totalOrders: 0, discrepancies: 0 })
      };
      ReconciliationTask.create(task, (err) => {
        if (err) reject(err);
        else resolve({ taskId, task, traceId: DiffCalculator.generateTraceId() });
      });
    });
  },

  matchOrdersWithPayments: (taskId, orders, payments) => {
    const paymentMap = new Map();
    payments.forEach(p => { if (!paymentMap.has(p.order_id)) paymentMap.set(p.order_id, []); paymentMap.get(p.order_id).push(p); });
    const matched = []; const unmatched = [];
    orders.forEach(order => {
      const orderPayments = paymentMap.get(order.order_id) || [];
      if (orderPayments.length > 0) matched.push({ order, payments: orderPayments });
      else unmatched.push({ order, reason: "NO_PAYMENT_RECORD" });
    });
    return { matched, unmatched };
  },

  matchWithChargerLogs: (taskId, orders, chargerLogs) => {
    const logMap = new Map();
    chargerLogs.forEach(log => { if (log.order_id && !logMap.has(log.order_id)) logMap.set(log.order_id, []); if (log.order_id) logMap.get(log.order_id).push(log); });
    const matched = []; const unmatched = [];
    orders.forEach(order => {
      const orderLogs = logMap.get(order.order_id) || [];
      const hasChargeEnd = orderLogs.some(log => log.event_type === "CHARGE_END");
      if (hasChargeEnd) matched.push({ order, logs: orderLogs });
      else unmatched.push({ order, reason: hasChargeEnd ? "" : "NO_CHARGER_LOG" });
    });
    return { matched, unmatched };
  },

  detectDiscrepancies: (taskId, orders, payments, chargerLogs) => {
    return new Promise((resolve, reject) => {
      const discrepancies = [];
      const paymentMap = new Map();
      const logMap = new Map();
      payments.forEach(p => { if (!paymentMap.has(p.order_id)) paymentMap.set(p.order_id, []); paymentMap.get(p.order_id).push(p); });
      chargerLogs.forEach(log => { if (log.order_id) { if (!logMap.has(log.order_id)) logMap.set(log.order_id, []); logMap.get(log.order_id).push(log); }});

      orders.forEach(order => {
        const orderPayments = paymentMap.get(order.order_id) || [];
        const orderLogs = logMap.get(order.order_id) || [];
        const hasChargeEnd = orderLogs.some(log => log.event_type === "CHARGE_END");

        if (hasChargeEnd && orderPayments.length === 0) {
          discrepancies.push({ discrepancy_id: "DISCR_" + crypto.randomBytes(12).toString("hex"), task_id: taskId, order_id: order.order_id, discrepancy_type: DISCREPANCY_TYPES.UNDEDUCTED, description: JSON.stringify({ order: order.amount, logs: orderLogs.length }), status: "PENDING", result: null });
        }

        if (orderPayments.length > 1) {
          const refundCount = orderPayments.filter(p => p.refund_status === "refunded" || p.refund_amount > 0).length;
          if (refundCount > 1) {
            discrepancies.push({ discrepancy_id: "DISCR_" + crypto.randomBytes(12).toString("hex"), task_id: taskId, order_id: order.order_id, discrepancy_type: DISCREPANCY_TYPES.DUPLICATE_REFUND, description: JSON.stringify({ refundCount }), status: "PENDING", result: null });
          }
        }

        orderPayments.forEach(payment => {
          if (order.platform_source && payment.payment_channel && order.platform_source !== payment.payment_channel) {
            discrepancies.push({ discrepancy_id: "DISCR_" + crypto.randomBytes(12).toString("hex"), task_id: taskId, order_id: order.order_id, discrepancy_type: DISCREPANCY_TYPES.CROSS_PLATFORM, description: JSON.stringify({ order_platform: order.platform_source, payment_channel: payment.payment_channel }), status: "PENDING", result: null });
          }
          const amountDiff = Math.abs(order.amount - payment.amount);
          if (amountDiff > 0.01) {
            discrepancies.push({ discrepancy_id: "DISCR_" + crypto.randomBytes(12).toString("hex"), task_id: taskId, order_id: order.order_id, discrepancy_type: DISCREPANCY_TYPES.AMOUNT_MISMATCH, description: JSON.stringify({ order_amount: order.amount, payment_amount: payment.amount, diff: amountDiff }), status: "PENDING", result: null });
          }
        });

        orderPayments.forEach(payment => {
          const timeDiff = Math.abs(new Date(order.end_time) - new Date(payment.payment_time));
          if (timeDiff > 300000) {
            discrepancies.push({ discrepancy_id: "DISCR_" + crypto.randomBytes(12).toString("hex"), task_id: taskId, order_id: order.order_id, discrepancy_type: DISCREPANCY_TYPES.TIME_MISMATCH, description: JSON.stringify({ diffMinutes: timeDiff / 60000 }), status: "PENDING", result: null });
          }
          const orderStatus = String(order.status || "").toLowerCase();
          const paymentStatus = String(payment.payment_status || "").toLowerCase();
          if ((orderStatus === "completed" && !["success", "completed", "paid"].includes(paymentStatus)) ||
              (orderStatus === "refunded" && paymentStatus !== "refunded") ||
              (["cancelled", "failed"].includes(orderStatus) && paymentStatus === "success")) {
            discrepancies.push({ discrepancy_id: "DISCR_" + crypto.randomBytes(12).toString("hex"), task_id: taskId, order_id: order.order_id, discrepancy_type: DISCREPANCY_TYPES.STATUS_MISMATCH, description: JSON.stringify({ order_status: order.status, payment_status: payment.payment_status }), status: "PENDING", result: null });
          }
        });
      });

      if (discrepancies.length > 0) {
        Discrepancy.bulkInsert(discrepancies, (err) => { if (err) reject(err); else resolve({ discrepancies }); });
      } else { resolve({ discrepancies: [] }); }
    });
  },

  explainDiscrepancy: (discrepancy) => {
    const descriptions = {
      [DISCREPANCY_TYPES.UNDEDUCTED]: { title: "未扣费异常", explanation: "该订单存在已完成的充电记录，但系统中没有对应的支付记录。", action: "请核查支付状态，如确实未扣费，建议联系用户补扣或走坏账处理流程。", severity: "高" },
      [DISCREPANCY_TYPES.DUPLICATE_REFUND]: { title: "重复退款异常", explanation: "该订单存在多次退款记录。", action: "请核查退款明细，联系用户协商退回多退款金额。", severity: "极高" },
      [DISCREPANCY_TYPES.CROSS_PLATFORM]: { title: "跨平台订单异常", explanation: "订单来源平台与实际支付渠道不一致。", action: "请核查订单流转路径，确认是否为正常业务场景。", severity: "中" },
      [DISCREPANCY_TYPES.AMOUNT_MISMATCH]: { title: "金额不匹配异常", explanation: "订单金额与实际支付金额存在差异。", action: "请核查订单计费规则、优惠活动配置及支付渠道手续费设置。", severity: "高" },
      [DISCREPANCY_TYPES.TIME_MISMATCH]: { title: "时间不匹配异常", explanation: "充电结束时间与支付时间差异较大。", action: "请核查支付延迟原因，如为系统时间问题建议同步各服务器时间。", severity: "低" },
      [DISCREPANCY_TYPES.STATUS_MISMATCH]: { title: "状态不匹配异常", explanation: "订单状态与支付状态不一致。", action: "请核查订单状态流转记录，确认最终状态并进行数据修正。", severity: "中" }
    };
    const desc = descriptions[discrepancy.discrepancy_type] || { title: "未知异常", explanation: "该异常类型暂未定义详细解释。", action: "请联系技术支持进一步分析。", severity: "未知" };
    return { discrepancyId: discrepancy.discrepancy_id, orderId: discrepancy.order_id, type: discrepancy.discrepancy_type, typeName: desc.title, severity: desc.severity, explanation: desc.explanation, recommendedAction: desc.action, status: discrepancy.status };
  }
};

module.exports = ReconciliationService;
