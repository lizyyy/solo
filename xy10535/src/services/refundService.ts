import { store } from '../store';
import { generateId, now } from '../utils';
import { ticketService } from './ticketService';
import { auditService } from './auditService';
import type { TicketRefund, RefundStatus } from '../types';

export class RefundService {
  requestRefund(data: {
    ticketId: string;
    holderId: string;
    reason: string;
    operatorId: string;
    operatorName: string;
  }): TicketRefund {
    const ticket = ticketService.findById(data.ticketId);
    if (!ticket) {
      throw new Error('票券不存在');
    }
    
    if (ticket.holderId !== data.holderId) {
      throw new Error('只有持票人可以申请退票');
    }
    
    if (['REFUNDED', 'USED', 'CANCELLED', 'EXPIRED'].includes(ticket.status)) {
      throw new Error('该票券状态不允许退票');
    }
    
    const existingRefund = this.findPendingByTicketId(data.ticketId);
    if (existingRefund) {
      throw new Error('该票券已有待处理的退票申请');
    }
    
    const refund: TicketRefund = {
      id: generateId(),
      ticketId: data.ticketId,
      holderId: data.holderId,
      status: 'REQUESTED',
      requestTime: now(),
      completedTime: null,
      reason: data.reason,
      refundAmount: ticket.price
    };
    
    store.saveRefund(refund);
    
    auditService.log({
      ticketId: ticket.id,
      refundId: refund.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'REFUND_REQUESTED',
      afterState: { reason: data.reason, amount: refund.refundAmount },
      reason: `申请退票: ${data.reason}`
    });
    
    return refund;
  }

  approveRefund(
    refundId: string,
    data: {
      operatorId: string;
      operatorName: string;
    }
  ): TicketRefund {
    const refund = this.findById(refundId);
    if (!refund) {
      throw new Error('退票申请不存在');
    }
    
    if (refund.status !== 'REQUESTED') {
      throw new Error('只有待审核的退票可以审批');
    }
    
    const ticket = ticketService.findById(refund.ticketId);
    if (!ticket) {
      throw new Error('票券不存在');
    }
    
    const beforeState = { ...ticket };
    
    ticketService.updateStatus(
      ticket.id,
      'REFUNDED',
      {
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        reason: '退票审批通过'
      }
    );
    
    const nowTime = now();
    refund.status = 'COMPLETED';
    refund.completedTime = nowTime;
    store.saveRefund(refund);
    
    const updatedTicket = ticketService.findById(ticket.id)!;
    
    auditService.log({
      ticketId: ticket.id,
      refundId: refund.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'REFUND_COMPLETED',
      beforeState,
      afterState: updatedTicket,
      reason: '完成退票'
    });
    
    return refund;
  }

  rejectRefund(
    refundId: string,
    rejectReason: string,
    data: {
      operatorId: string;
      operatorName: string;
    }
  ): TicketRefund {
    const refund = this.findById(refundId);
    if (!refund) {
      throw new Error('退票申请不存在');
    }
    
    if (refund.status !== 'REQUESTED') {
      throw new Error('只有待审核的退票可以拒绝');
    }
    
    const nowTime = now();
    refund.status = 'REJECTED';
    refund.completedTime = nowTime;
    refund.reason = `${refund.reason} | 拒绝原因: ${rejectReason}`;
    store.saveRefund(refund);
    
    auditService.log({
      ticketId: refund.ticketId,
      refundId: refund.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'REFUND_REJECTED',
      afterState: { rejectReason },
      reason: `拒绝退票: ${rejectReason}`
    });
    
    return refund;
  }

  findById(id: string): TicketRefund | null {
    return store.getRefund(id) || null;
  }

  findPendingByTicketId(ticketId: string): TicketRefund | null {
    const refunds = store.getRefunds()
      .filter(r => r.ticketId === ticketId && r.status === 'REQUESTED')
      .sort((a, b) => b.requestTime - a.requestTime);
    return refunds[0] || null;
  }

  findByTicketId(ticketId: string): TicketRefund[] {
    return store.getRefunds()
      .filter(r => r.ticketId === ticketId)
      .sort((a, b) => b.requestTime - a.requestTime);
  }

  findByHolderId(holderId: string): TicketRefund[] {
    return store.getRefunds()
      .filter(r => r.holderId === holderId)
      .sort((a, b) => b.requestTime - a.requestTime);
  }

  findAll(page: number = 1, pageSize: number = 50, filters?: {
    status?: RefundStatus;
  }): { refunds: TicketRefund[]; total: number } {
    let filtered = store.getRefunds();
    
    if (filters?.status) {
      filtered = filtered.filter(r => r.status === filters.status);
    }
    
    const sorted = filtered.sort((a, b) => b.requestTime - a.requestTime);
    const total = sorted.length;
    const offset = (page - 1) * pageSize;
    
    return {
      refunds: sorted.slice(offset, offset + pageSize),
      total
    };
  }
}

export const refundService = new RefundService();
