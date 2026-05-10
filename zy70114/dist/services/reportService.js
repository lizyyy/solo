"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatReportForDisplay = exports.generateReport = void 0;
const database_1 = require("../database");
const getDateRange = (period) => {
    const end = (0, database_1.now)();
    let start;
    const endDate = new Date(end);
    if (period === 'day') {
        const startOfDay = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate());
        start = startOfDay.getTime();
    }
    else if (period === 'week') {
        const dayOfWeek = endDate.getDay();
        const diffToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        const startOfWeek = new Date(endDate);
        startOfWeek.setDate(endDate.getDate() - diffToMonday);
        startOfWeek.setHours(0, 0, 0, 0);
        start = startOfWeek.getTime();
    }
    else {
        const startOfMonth = new Date(endDate.getFullYear(), endDate.getMonth(), 1);
        start = startOfMonth.getTime();
    }
    const startDate = new Date(start).toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];
    return { start, end, startDate, endDate: endDateStr };
};
const generateReport = (period) => {
    const { start, end, startDate, endDate } = getDateRange(period);
    const totalOrdersResult = (0, database_1.executeGet)(`
    SELECT COUNT(*) as count FROM orders 
    WHERE created_at >= ? AND created_at <= ?
  `, [start, end]);
    const overtimeOrdersResult = (0, database_1.executeGet)(`
    SELECT COUNT(DISTINCT o.id) as count 
    FROM orders o
    JOIN meal_timers mt ON o.id = mt.order_id
    WHERE o.created_at >= ? AND o.created_at <= ?
      AND mt.is_overtime = 1
  `, [start, end]);
    const totalCompensationResult = (0, database_1.executeGet)(`
    SELECT SUM(amount) as total 
    FROM compensations 
    WHERE created_at >= ? AND created_at <= ?
      AND status IN ('approved', 'executed')
  `, [start, end]);
    const liabilityStats = (0, database_1.executeAll)(`
    SELECT lj.liable_party, COUNT(*) as count
    FROM liability_judgments lj
    JOIN orders o ON lj.order_id = o.id
    WHERE o.created_at >= ? AND o.created_at <= ?
    GROUP BY lj.liable_party
  `, [start, end]);
    const appealStats = (0, database_1.executeGet)(`
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved
    FROM appeals
    WHERE created_at >= ? AND created_at <= ?
  `, [start, end]);
    const merchantStats = (0, database_1.executeAll)(`
    SELECT 
      o.merchant_id,
      o.merchant_name,
      COUNT(DISTINCT o.id) as order_count,
      SUM(CASE WHEN mt.is_overtime = 1 THEN 1 ELSE 0 END) as overtime_count,
      SUM(CASE WHEN c.compensation_type = 'merchant_penalty' AND c.status IN ('approved', 'executed') THEN c.amount ELSE 0 END) as total_penalty
    FROM orders o
    LEFT JOIN meal_timers mt ON o.id = mt.order_id
    LEFT JOIN compensations c ON o.id = c.order_id
    WHERE o.created_at >= ? AND o.created_at <= ?
    GROUP BY o.merchant_id, o.merchant_name
    ORDER BY overtime_count DESC
  `, [start, end]);
    const riderStats = (0, database_1.executeAll)(`
    SELECT 
      o.rider_id,
      o.rider_name,
      COUNT(DISTINCT o.id) as order_count,
      SUM(CASE WHEN mt.is_overtime = 1 THEN 1 ELSE 0 END) as overtime_count,
      SUM(CASE WHEN c.compensation_type = 'rider_waiting_fee' AND c.status IN ('approved', 'executed') THEN c.amount ELSE 0 END) as total_waiting_fee
    FROM orders o
    LEFT JOIN meal_timers mt ON o.id = mt.order_id
    LEFT JOIN compensations c ON o.id = c.order_id
    WHERE o.created_at >= ? AND o.created_at <= ?
      AND o.rider_id IS NOT NULL
    GROUP BY o.rider_id, o.rider_name
    ORDER BY total_waiting_fee DESC
  `, [start, end]);
    const totalOrders = totalOrdersResult?.count || 0;
    const overtimeOrders = overtimeOrdersResult?.count || 0;
    const overtimeRate = totalOrders > 0 ? (overtimeOrders / totalOrders) * 100 : 0;
    const merchantDetails = merchantStats.map(m => ({
        merchant_id: m.merchant_id,
        merchant_name: m.merchant_name,
        order_count: m.order_count,
        overtime_count: m.overtime_count,
        overtime_rate: m.order_count > 0 ? (m.overtime_count / m.order_count) * 100 : 0,
        total_penalty: m.total_penalty || 0,
    }));
    const riderDetails = riderStats.map(r => ({
        rider_id: r.rider_id,
        rider_name: r.rider_name || '未知骑手',
        order_count: r.order_count,
        overtime_count: r.overtime_count,
        total_waiting_fee: r.total_waiting_fee || 0,
    }));
    let merchantLiabilityCount = 0;
    let riderLiabilityCount = 0;
    let platformLiabilityCount = 0;
    liabilityStats.forEach(stat => {
        if (stat.liable_party === 'merchant') {
            merchantLiabilityCount = stat.count;
        }
        else if (stat.liable_party === 'rider') {
            riderLiabilityCount = stat.count;
        }
        else if (stat.liable_party === 'platform') {
            platformLiabilityCount = stat.count;
        }
    });
    return {
        period,
        start_date: startDate,
        end_date: endDate,
        total_orders: totalOrders,
        overtime_orders: overtimeOrders,
        overtime_rate: Math.round(overtimeRate * 100) / 100,
        total_compensation: totalCompensationResult?.total || 0,
        merchant_liability_count: merchantLiabilityCount,
        rider_liability_count: riderLiabilityCount,
        platform_liability_count: platformLiabilityCount,
        appeal_count: appealStats?.total || 0,
        appeal_approved_count: appealStats?.approved || 0,
        merchant_details: merchantDetails,
        rider_details: riderDetails,
    };
};
exports.generateReport = generateReport;
const formatReportForDisplay = (report) => {
    const periodNames = {
        day: '今日',
        week: '本周',
        month: '本月',
    };
    let output = `\n========================================\n`;
    output += `      ${periodNames[report.period]}出餐超时补偿报表\n`;
    output += `========================================\n\n`;
    output += `统计周期: ${report.start_date} 至 ${report.end_date}\n\n`;
    output += `【整体概览】\n`;
    output += `  总订单数: ${report.total_orders}\n`;
    output += `  超时订单: ${report.overtime_orders}\n`;
    output += `  超时率: ${report.overtime_rate}%\n`;
    output += `  补偿总额: ¥${report.total_compensation.toFixed(2)}\n\n`;
    output += `【责任分布】\n`;
    output += `  商家责任: ${report.merchant_liability_count} 单\n`;
    output += `  骑手责任: ${report.rider_liability_count} 单\n`;
    output += `  平台责任: ${report.platform_liability_count} 单\n`;
    output += `  申诉数: ${report.appeal_count}, 通过: ${report.appeal_approved_count}\n\n`;
    if (report.merchant_details.length > 0) {
        output += `【商家详情】\n`;
        output += `  商家名称        订单数  超时数  超时率    罚款金额\n`;
        output += `  ------------------------------------------------\n`;
        report.merchant_details.forEach(m => {
            const name = (m.merchant_name || '').padEnd(12).slice(0, 12);
            output += `  ${name}  ${String(m.order_count).padStart(4)}   ${String(m.overtime_count).padStart(4)}   ${String(m.overtime_rate.toFixed(1) + '%').padEnd(6)}   ¥${String(m.total_penalty.toFixed(2)).padStart(6)}\n`;
        });
        output += `\n`;
    }
    if (report.rider_details.length > 0) {
        output += `【骑手详情】\n`;
        output += `  骑手姓名        订单数  超时数    等待费\n`;
        output += `  ----------------------------------------\n`;
        report.rider_details.forEach(r => {
            const name = (r.rider_name || '').padEnd(12).slice(0, 12);
            output += `  ${name}  ${String(r.order_count).padStart(4)}   ${String(r.overtime_count).padStart(4)}   ¥${String(r.total_waiting_fee.toFixed(2)).padStart(6)}\n`;
        });
        output += `\n`;
    }
    output += `========================================\n`;
    return output;
};
exports.formatReportForDisplay = formatReportForDisplay;
//# sourceMappingURL=reportService.js.map