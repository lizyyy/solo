import { Parser } from 'json2csv';
import { ticketService } from './ticketService';
import { validationService } from './validationService';
import { transferService } from './transferService';
import { refundService } from './refundService';
import { auditService } from './auditService';
import type { Ticket, ValidationRecord, TicketTransfer, TicketRefund, AuditLog } from '../types';

type TicketStatus = 'CREATED' | 'PAID' | 'USED' | 'REFUNDED' | 'PARTIALLY_USED' | 'EXPIRED' | 'CANCELLED' | 'TRANSFERRED';

export interface EventSummary {
  eventId: string;
  eventName: string;
  totalTickets: number;
  totalRevenue: number;
  ticketsByStatus: Record<TicketStatus, number>;
  validationStats: {
    totalAttempts: number;
    success: number;
    failed: number;
    duplicate: number;
    online: number;
    offline: number;
  };
  transferStats: {
    requested: number;
    completed: number;
    cancelled: number;
  };
  refundStats: {
    requested: number;
    completed: number;
    rejected: number;
    totalRefundAmount: number;
  };
  gateStats: Record<string, { total: number; success: number; failed: number; duplicate: number }>;
}

export interface TicketDetailReport {
  ticket: Ticket;
  validations: ValidationRecord[];
  transfers: TicketTransfer[];
  refunds: TicketRefund[];
  audits: AuditLog[];
  statusHistory: Array<{
    status: TicketStatus;
    changeTime: number;
    reason?: string;
    operatorName?: string;
  }>;
}

export class ReportService {
  getEventSummary(eventId: string): EventSummary {
    const ticketsResult = ticketService.findByEventId(eventId, 1, 100000);
    const tickets = ticketsResult.items;
    
    const totalRevenue = tickets
      .filter(t => t.status !== 'REFUNDED' && t.status !== 'CANCELLED')
      .reduce((sum, t) => sum + t.price, 0);
    
    const ticketsByStatus: Record<TicketStatus, number> = {
      CREATED: 0, PAID: 0, USED: 0, REFUNDED: 0,
      PARTIALLY_USED: 0, EXPIRED: 0, CANCELLED: 0, TRANSFERRED: 0
    };
    for (const t of tickets) {
      ticketsByStatus[t.status] = (ticketsByStatus[t.status] || 0) + 1;
    }
    
    const eventStats = validationService.getEventStats(eventId);
    
    const allTransfers = transferService.findAll(1, 100000).transfers;
    const eventTransfers = allTransfers.filter(transfer => {
      const ticket = ticketService.findById(transfer.ticketId);
      return ticket && ticket.eventId === eventId;
    });
    
    const allRefunds = refundService.findAll(1, 100000).refunds;
    const eventRefunds = allRefunds.filter(refund => {
      const ticket = ticketService.findById(refund.ticketId);
      return ticket && ticket.eventId === eventId;
    });
    
    const validationResult = validationService.findAll(1, 100000);
    const ticketIds = new Set(tickets.map(t => t.id));
    const eventValidations = validationResult.records.filter(v => ticketIds.has(v.ticketId));
    
    const gateStats: Record<string, { total: number; success: number; failed: number; duplicate: number }> = {};
    for (const v of eventValidations) {
      if (!gateStats[v.gateName]) {
        gateStats[v.gateName] = { total: 0, success: 0, failed: 0, duplicate: 0 };
      }
      gateStats[v.gateName].total++;
      if (v.status === 'SUCCESS') gateStats[v.gateName].success++;
      else if (v.status === 'FAILED') gateStats[v.gateName].failed++;
      else if (v.status === 'DUPLICATE') gateStats[v.gateName].duplicate++;
    }
    
    const eventName = tickets.length > 0 ? tickets[0].eventName : '未知活动';
    
    return {
      eventId,
      eventName,
      totalTickets: ticketsResult.total,
      totalRevenue,
      ticketsByStatus,
      validationStats: {
        totalAttempts: eventStats.successValidations + eventStats.failedValidations + eventStats.duplicateValidations,
        success: eventStats.successValidations,
        failed: eventStats.failedValidations,
        duplicate: eventStats.duplicateValidations,
        online: eventStats.onlineValidations,
        offline: eventStats.offlineValidations
      },
      transferStats: {
        requested: eventTransfers.filter(t => t.status === 'PENDING').length,
        completed: eventTransfers.filter(t => t.status === 'COMPLETED').length,
        cancelled: eventTransfers.filter(t => t.status === 'CANCELLED').length
      },
      refundStats: {
        requested: eventRefunds.filter(r => r.status === 'REQUESTED').length,
        completed: eventRefunds.filter(r => r.status === 'COMPLETED').length,
        rejected: eventRefunds.filter(r => r.status === 'REJECTED').length,
        totalRefundAmount: eventRefunds
          .filter(r => r.status === 'COMPLETED')
          .reduce((sum, r) => sum + (r.refundAmount || 0), 0)
      },
      gateStats
    };
  }

  getTicketDetailReport(ticketId: string): TicketDetailReport | null {
    const ticket = ticketService.findById(ticketId);
    if (!ticket) return null;
    
    const validations = validationService.findByTicketId(ticketId);
    const transfers = transferService.findByTicketId(ticketId);
    const refunds = refundService.findByTicketId(ticketId);
    const audits = auditService.findByTicketId(ticketId);
    
    const statusHistory: Array<{
      status: TicketStatus;
      changeTime: number;
      reason?: string;
      operatorName?: string;
    }> = [];
    
    statusHistory.push({
      status: ticket.status,
      changeTime: ticket.updatedAt,
      reason: '当前状态'
    });
    
    const statusChangeAudits = audits.filter(a => a.action.startsWith('STATUS_CHANGED'));
    for (const audit of statusChangeAudits) {
      if (audit.beforeState && typeof audit.beforeState === 'object' && 'status' in audit.beforeState) {
        statusHistory.push({
          status: audit.beforeState.status as TicketStatus,
          changeTime: audit.timestamp,
          reason: audit.reason,
          operatorName: audit.operatorName
        });
      }
    }
    
    statusHistory.sort((a, b) => b.changeTime - a.changeTime);
    
    return {
      ticket,
      validations,
      transfers,
      refunds,
      audits,
      statusHistory
    };
  }

  exportEventSummaryCSV(eventId: string): string {
    const summary = this.getEventSummary(eventId);
    
    const fields = [
      { label: '活动ID', value: 'eventId' },
      { label: '活动名称', value: 'eventName' },
      { label: '总票数', value: 'totalTickets' },
      { label: '总收入', value: 'totalRevenue' },
      { label: '已创建', value: (row: EventSummary) => row.ticketsByStatus.CREATED },
      { label: '已支付', value: (row: EventSummary) => row.ticketsByStatus.PAID },
      { label: '已使用', value: (row: EventSummary) => row.ticketsByStatus.USED },
      { label: '已部分使用', value: (row: EventSummary) => row.ticketsByStatus.PARTIALLY_USED },
      { label: '已退票', value: (row: EventSummary) => row.ticketsByStatus.REFUNDED },
      { label: '已过期', value: (row: EventSummary) => row.ticketsByStatus.EXPIRED },
      { label: '已取消', value: (row: EventSummary) => row.ticketsByStatus.CANCELLED },
      { label: '已转赠', value: (row: EventSummary) => row.ticketsByStatus.TRANSFERRED },
      { label: '核销总尝试', value: (row: EventSummary) => row.validationStats.totalAttempts },
      { label: '核销成功', value: (row: EventSummary) => row.validationStats.success },
      { label: '核销失败', value: (row: EventSummary) => row.validationStats.failed },
      { label: '重复核销', value: (row: EventSummary) => row.validationStats.duplicate },
      { label: '在线核销', value: (row: EventSummary) => row.validationStats.online },
      { label: '离线核销', value: (row: EventSummary) => row.validationStats.offline },
      { label: '转赠请求', value: (row: EventSummary) => row.transferStats.requested },
      { label: '转赠完成', value: (row: EventSummary) => row.transferStats.completed },
      { label: '转赠取消', value: (row: EventSummary) => row.transferStats.cancelled },
      { label: '退票请求', value: (row: EventSummary) => row.refundStats.requested },
      { label: '退票完成', value: (row: EventSummary) => row.refundStats.completed },
      { label: '退票拒绝', value: (row: EventSummary) => row.refundStats.rejected },
      { label: '退票总金额', value: (row: EventSummary) => row.refundStats.totalRefundAmount }
    ];
    
    const parser = new Parser({ fields });
    return parser.parse([summary]);
  }

  exportTicketsCSV(eventId: string): string {
    const ticketsResult = ticketService.findByEventId(eventId, 1, 100000);
    const tickets = ticketsResult.items;
    
    const rows = tickets.map(ticket => ({
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      ticketType: ticket.ticketType,
      ticketTypeName: ticket.ticketTypeName,
      holderName: ticket.holderName,
      holderId: ticket.holderId,
      price: ticket.price,
      status: ticket.status,
      validFrom: new Date(ticket.validFrom).toLocaleString('zh-CN'),
      validUntil: new Date(ticket.validUntil).toLocaleString('zh-CN'),
      createdAt: new Date(ticket.createdAt).toLocaleString('zh-CN'),
      updatedAt: new Date(ticket.updatedAt).toLocaleString('zh-CN'),
      packageId: ticket.packageId || ''
    }));
    
    const fields = [
      { label: '票券ID', value: 'ticketId' },
      { label: '票码', value: 'ticketCode' },
      { label: '票类型', value: 'ticketType' },
      { label: '票类型名称', value: 'ticketTypeName' },
      { label: '持票人', value: 'holderName' },
      { label: '持票人ID', value: 'holderId' },
      { label: '票价', value: 'price' },
      { label: '状态', value: 'status' },
      { label: '生效时间', value: 'validFrom' },
      { label: '失效时间', value: 'validUntil' },
      { label: '创建时间', value: 'createdAt' },
      { label: '更新时间', value: 'updatedAt' },
      { label: '套票ID', value: 'packageId' }
    ];
    
    const parser = new Parser({ fields });
    return parser.parse(rows);
  }

  exportValidationsCSV(eventId: string): string {
    const ticketsResult = ticketService.findByEventId(eventId, 1, 100000);
    const ticketIds = new Set(ticketsResult.items.map(t => t.id));
    
    const validationResult = validationService.findAll(1, 100000);
    const validations = validationResult.records.filter(v => ticketIds.has(v.ticketId));
    
    const rows = validations.map(v => ({
      validationId: v.id,
      ticketCode: v.ticketCode,
      holderName: v.holderName,
      source: v.source,
      gateName: v.gateName,
      gateId: v.gateId,
      status: v.status,
      failureReason: v.failureReason || '',
      validationTime: new Date(v.validationTime).toLocaleString('zh-CN'),
      serverTime: new Date(v.serverTime).toLocaleString('zh-CN')
    }));
    
    const fields = [
      { label: '核销ID', value: 'validationId' },
      { label: '票码', value: 'ticketCode' },
      { label: '持票人', value: 'holderName' },
      { label: '核销来源', value: 'source' },
      { label: '闸口名称', value: 'gateName' },
      { label: '闸口ID', value: 'gateId' },
      { label: '状态', value: 'status' },
      { label: '失败原因', value: 'failureReason' },
      { label: '核销时间', value: 'validationTime' },
      { label: '服务端时间', value: 'serverTime' }
    ];
    
    const parser = new Parser({ fields });
    return parser.parse(rows);
  }

  exportAuditLogCSV(entityId: string, entityType: 'ticket' | 'transfer' | 'refund'): string {
    const audits = auditService.findByEntity(entityId, entityType);
    
    const rows = audits.map(a => ({
      auditId: a.id,
      action: a.action,
      operatorId: a.operatorId,
      operatorName: a.operatorName,
      beforeState: a.beforeState ? JSON.stringify(a.beforeState) : '',
      afterState: a.afterState ? JSON.stringify(a.afterState) : '',
      reason: a.reason || '',
      timestamp: new Date(a.timestamp).toLocaleString('zh-CN')
    }));
    
    const fields = [
      { label: '审计ID', value: 'auditId' },
      { label: '操作类型', value: 'action' },
      { label: '操作员ID', value: 'operatorId' },
      { label: '操作员名称', value: 'operatorName' },
      { label: '变更前状态', value: 'beforeState' },
      { label: '变更后状态', value: 'afterState' },
      { label: '原因', value: 'reason' },
      { label: '时间', value: 'timestamp' }
    ];
    
    const parser = new Parser({ fields });
    return parser.parse(rows);
  }
}

export const reportService = new ReportService();
