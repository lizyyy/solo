const store = require('../stores/memoryStore');
const TechnicianService = require('./technicianService');
const PartsService = require('./partsService');
const moment = require('moment');

class ReportService {
  static generateOrderReport(orderId) {
    const order = store.getOrder(orderId);
    if (!order) {
      return { success: false, error: '订单不存在' };
    }

    const tech = order.technicianId ? store.getTechnician(order.technicianId) : null;
    const reschedules = store.listReschedulesByOrder(orderId);
    const compensations = store.listCompensations({ orderId });
    const events = store.listEvents(orderId);

    const timeline = this._buildTimeline(order, events, reschedules, compensations);

    return {
      success: true,
      report: {
        orderSummary: {
          orderId: order.id,
          customer: {
            name: order.customerName,
            phone: order.customerPhone,
            address: order.address
          },
          appliance: {
            type: order.applianceType,
            model: order.applianceModel
          },
          status: order.status,
          scheduling: {
            originalTime: order.originalScheduledTime,
            currentStartTime: order.scheduledStartTime,
            currentEndTime: order.scheduledEndTime,
            actualStartTime: order.actualStartTime,
            actualEndTime: order.actualEndTime
          },
          rescheduleSummary: {
            total: order.rescheduleCount,
            customerInitiated: order.customerRescheduleCount,
            technicianInitiated: order.technicianRescheduleCount
          }
        },
        technician: tech ? {
          id: tech.id,
          name: tech.name,
          phone: tech.phone,
          skills: tech.skills
        } : null,
        parts: order.partsAllocated,
        rescheduleHistory: reschedules,
        compensationHistory: compensations.map(c => ({
          id: c.id,
          type: c.type,
          amount: c.amount,
          reason: c.reason,
          status: c.status,
          initiatedAt: c.initiatedAt,
          paidAt: c.paidAt
        })),
        timeline,
        generatedAt: store.now()
      }
    };
  }

  static _buildTimeline(order, events, reschedules, compensations) {
    const timeline = [];

    for (const event of events) {
      timeline.push({
        timestamp: event.timestamp,
        type: 'event',
        eventType: event.eventType,
        details: event.details,
        operator: event.operator
      });
    }

    for (const reschedule of reschedules) {
      timeline.push({
        timestamp: reschedule.requestedAt,
        type: 'reschedule',
        rescheduleType: reschedule.type,
        status: reschedule.status,
        reason: reschedule.reason,
        from: {
          technicianId: reschedule.oldTechnicianId,
          startTime: reschedule.oldStartTime
        },
        to: {
          technicianId: reschedule.newTechnicianId,
          startTime: reschedule.newStartTime
        }
      });
    }

    for (const comp of compensations) {
      timeline.push({
        timestamp: comp.initiatedAt,
        type: 'compensation',
        compensationType: comp.type,
        amount: comp.amount,
        reason: comp.reason,
        status: comp.status
      });
    }

    return timeline.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  }

  static generateDashboardReport(startDate, endDate) {
    const orders = store.listOrders();
    const startMoment = moment(startDate);
    const endMoment = moment(endDate);

    const periodOrders = orders.filter(o => {
      const created = moment(o.createdAt);
      return created.isBetween(startMoment, endMoment, null, '[]');
    });

    const techWorkloads = TechnicianService.getAllTechniciansWorkload(startDate, endDate);
    const partsStatus = PartsService.getPartStatus();

    const compensations = store.listCompensations().filter(c => {
      const initiated = moment(c.initiatedAt);
      return initiated.isBetween(startMoment, endMoment, null, '[]');
    });

    const totalCompensationAmount = compensations
      .filter(c => c.status === 'paid')
      .reduce((sum, c) => sum + c.amount, 0);

    const rescheduledOrders = periodOrders.filter(o => o.rescheduleCount > 0);
    const completedOrders = periodOrders.filter(o => o.status === 'completed');
    const cancelledOrders = periodOrders.filter(o => o.status === 'cancelled');

    let totalDelayMinutes = 0;
    let delayedOrders = 0;
    for (const order of completedOrders) {
      if (order.delayMinutes && order.delayMinutes > 0) {
        totalDelayMinutes += order.delayMinutes;
        delayedOrders++;
      }
    }

    return {
      success: true,
      report: {
        period: {
          start: startDate,
          end: endDate
        },
        summary: {
          totalOrders: periodOrders.length,
          completedOrders: completedOrders.length,
          cancelledOrders: cancelledOrders.length,
          rescheduledOrders: rescheduledOrders.length,
          rescheduleRate: periodOrders.length > 0 
            ? Math.round((rescheduledOrders.length / periodOrders.length) * 10000) / 100 
            : 0,
          delayedOrders,
          totalDelayMinutes,
          averageDelayMinutes: delayedOrders > 0 
            ? Math.round(totalDelayMinutes / delayedOrders) 
            : 0
        },
        compensation: {
          totalCount: compensations.length,
          totalAmount: totalCompensationAmount,
          details: compensations.map(c => ({
            orderId: c.orderId,
            type: c.type,
            amount: c.amount,
            reason: c.reason,
            status: c.status
          }))
        },
        technicianWorkloads: techWorkloads,
        partsStatus,
        generatedAt: store.now()
      }
    };
  }

  static exportToJson(data) {
    return JSON.stringify(data, null, 2);
  }

  static exportToText(orderReport) {
    if (!orderReport.success) {
      return `报告生成失败: ${orderReport.error}`;
    }

    const r = orderReport.report;
    let text = '';

    text += '========================================\n';
    text += '家电安装订单履约报告\n';
    text += '========================================\n\n';

    text += '【订单概要】\n';
    text += `订单号: ${r.orderSummary.orderId}\n`;
    text += `客户: ${r.orderSummary.customer.name} (${r.orderSummary.customer.phone})\n`;
    text += `地址: ${r.orderSummary.customer.address}\n`;
    text += `家电: ${r.orderSummary.appliance.type} - ${r.orderSummary.appliance.model}\n`;
    text += `当前状态: ${r.orderSummary.status}\n\n`;

    text += '【时间线】\n';
    text += `原预约时间: ${r.orderSummary.scheduling.originalTime || '未设置'}\n`;
    text += `现预约时间: ${r.orderSummary.scheduling.currentStartTime || '未设置'}\n`;
    if (r.orderSummary.scheduling.actualStartTime) {
      text += `实际开始时间: ${r.orderSummary.scheduling.actualStartTime}\n`;
    }
    if (r.orderSummary.scheduling.actualEndTime) {
      text += `实际完成时间: ${r.orderSummary.scheduling.actualEndTime}\n`;
    }
    text += '\n';

    text += '【改约记录】\n';
    text += `总改约次数: ${r.orderSummary.rescheduleSummary.total}\n`;
    text += `客户发起: ${r.orderSummary.rescheduleSummary.customerInitiated}\n`;
    text += `师傅发起: ${r.orderSummary.rescheduleSummary.technicianInitiated}\n`;
    
    if (r.rescheduleHistory.length > 0) {
      for (let i = 0; i < r.rescheduleHistory.length; i++) {
        const rs = r.rescheduleHistory[i];
        text += `  ${i + 1}. [${rs.type}] ${rs.reason}\n`;
        text += `     从: ${rs.oldStartTime} -> 到: ${rs.newStartTime}\n`;
        text += `     状态: ${rs.status}\n`;
      }
    }
    text += '\n';

    text += '【赔付记录】\n';
    if (r.compensationHistory.length === 0) {
      text += '无赔付记录\n';
    } else {
      for (const comp of r.compensationHistory) {
        text += `金额: ¥${comp.amount}, 原因: ${comp.reason}, 状态: ${comp.status}\n`;
      }
    }
    text += '\n';

    text += '【配件占用】\n';
    if (r.parts.length === 0) {
      text += '无配件\n';
    } else {
      for (const part of r.parts) {
        text += `${part.partName} (${part.partCode})\n`;
      }
    }
    text += '\n';

    text += '【事件时间线】\n';
    for (const item of r.timeline) {
      const time = moment(item.timestamp).format('YYYY-MM-DD HH:mm:ss');
      if (item.type === 'event') {
        text += `[${time}] ${item.eventType} - ${JSON.stringify(item.details)}\n`;
      } else if (item.type === 'reschedule') {
        text += `[${time}] 改约 (${item.rescheduleType}): ${item.reason}\n`;
      } else if (item.type === 'compensation') {
        text += `[${time}] 赔付: ¥${item.amount} - ${item.reason}\n`;
      }
    }
    text += '\n';

    text += `报告生成时间: ${r.generatedAt}\n`;
    text += '========================================\n';

    return text;
  }
}

module.exports = ReportService;
