import { dataStore } from './DataStore';
import { ReportData, ReportFilter, TimelineEvent, TimelineEventType } from '../types';

export class ReportService {
  generateReport(orderId: string): ReportData {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }

    const timeline = dataStore.getTimeline(orderId);
    const outOfStockItems = dataStore.getOutOfStockItems(orderId);
    const pickingRecords = dataStore.getPickingRecords(orderId);

    const events = timeline.map((event) => {
      const { responsiblePerson, responsibleRole } = this.getResponsibleInfo(event);
      return {
        eventType: event.eventType,
        eventName: event.eventName,
        description: event.description,
        operatorId: event.operatorId,
        operatorName: event.operatorName,
        timestamp: event.timestamp,
        responsiblePerson,
        responsibleRole
      };
    });

    dataStore.addTimelineEvent(orderId, {
      eventType: TimelineEventType.REPORT_GENERATED,
      eventName: '报告生成',
      description: '生成订单责任节点报告',
      operatorId: 'system',
      operatorName: '系统',
      details: { eventCount: events.length }
    });

    return {
      orderId: order.id,
      orderNo: order.orderNo,
      communityName: order.communityName,
      groupLeaderName: order.groupLeaderName,
      events,
      totalAmount: order.totalAmount,
      refundAmount: order.refundAmount,
      outOfStockCount: outOfStockItems.length,
      generatedAt: new Date().toISOString()
    };
  }

  filterReports(filter: ReportFilter): ReportData[] {
    const orders = dataStore.getAllOrders();
    const reports: ReportData[] = [];

    for (const order of orders) {
      const report = this.generateReport(order.id);
      const filteredEvents = report.events.filter((event) => {
        let match = true;

        if (filter.operatorId) {
          match = match && event.operatorId === filter.operatorId;
        }
        if (filter.operatorName) {
          match = match && event.operatorName === filter.operatorName;
        }
        if (filter.startTime) {
          match = match && new Date(event.timestamp) >= new Date(filter.startTime);
        }
        if (filter.endTime) {
          match = match && new Date(event.timestamp) <= new Date(filter.endTime);
        }
        if (filter.eventType) {
          match = match && event.eventType === filter.eventType;
        }

        return match;
      });

      if (filteredEvents.length > 0 || !filter.operatorId && !filter.operatorName && !filter.startTime && !filter.endTime && !filter.eventType) {
        reports.push({
          ...report,
          events: filteredEvents.length > 0 ? filteredEvents : report.events
        });
      }
    }

    return reports;
  }

  exportReportToCSV(orderId: string): string {
    const report = this.generateReport(orderId);
    const headers = ['事件类型', '事件名称', '描述', '操作人ID', '操作人', '责任人', '责任角色', '时间'];
    const rows = report.events.map((event) => [
      event.eventType,
      event.eventName,
      event.description,
      event.operatorId || '',
      event.operatorName || '',
      event.responsiblePerson,
      event.responsibleRole,
      event.timestamp
    ]);

    const csvContent = [
      `订单号,${report.orderNo}`,
      `小区,${report.communityName}`,
      `团长,${report.groupLeaderName}`,
      `总金额,${report.totalAmount}`,
      `退款金额,${report.refundAmount}`,
      `缺货数,${report.outOfStockCount}`,
      `生成时间,${report.generatedAt}`,
      '',
      headers.join(','),
      ...rows.map((row) => row.map((cell) => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  private getResponsibleInfo(event: TimelineEvent): { responsiblePerson: string; responsibleRole: string } {
    switch (event.eventType) {
      case TimelineEventType.ORDER_CREATED:
        return { responsiblePerson: event.operatorName || '用户', responsibleRole: '用户' };
      case TimelineEventType.STATUS_CHANGED:
        if (event.details?.newStatus === 'REFUNDED') {
          return { responsiblePerson: event.operatorName || '系统', responsibleRole: '系统' };
        }
        return { responsiblePerson: event.operatorName || '运营人员', responsibleRole: '运营' };
      case TimelineEventType.REPLACEMENT_CONFIRMED:
        return { responsiblePerson: event.operatorName || '客服人员', responsibleRole: '客服' };
      case TimelineEventType.REFUND_REQUESTED:
        return { responsiblePerson: event.operatorName || '用户', responsibleRole: '用户' };
      case TimelineEventType.REFUND_CALLBACK:
        return { responsiblePerson: event.operatorName || '系统', responsibleRole: '系统' };
      case TimelineEventType.INVENTORY_BLOCKED:
        return { responsiblePerson: event.operatorName || '系统', responsibleRole: '系统' };
      case TimelineEventType.INVENTORY_RELEASED:
        return { responsiblePerson: event.operatorName || '系统', responsibleRole: '系统' };
      case TimelineEventType.PICKING_STARTED:
      case TimelineEventType.PICKING_COMPLETED:
      case TimelineEventType.PICKING_RECORD:
        return { responsiblePerson: event.operatorName || '团长', responsibleRole: '团长' };
      case TimelineEventType.OUT_OF_STOCK_DETECTED:
        return { responsiblePerson: '供应商/仓库', responsibleRole: '供应链' };
      case TimelineEventType.ORDER_MODIFIED:
        return { responsiblePerson: event.operatorName || '运营人员', responsibleRole: '运营' };
      case TimelineEventType.REPORT_GENERATED:
        return { responsiblePerson: event.operatorName || '系统', responsibleRole: '系统' };
      default:
        return { responsiblePerson: event.operatorName || '未知', responsibleRole: '未知' };
    }
  }

  getModifiedHistory(orderId: string) {
    const order = dataStore.getOrder(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    return order.modifiedHistory;
  }
}

export const reportService = new ReportService();
