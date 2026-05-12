import { store } from '../store';
import { generateId, now } from '../utils';
import { ticketService } from './ticketService';
import { auditService } from './auditService';
import type { TicketTransfer, TransferStatus } from '../types';

export class TransferService {
  createTransfer(data: {
    ticketId: string;
    fromHolderId: string;
    fromHolderName: string;
    toHolderId: string;
    toHolderName: string;
    operatorId: string;
    operatorName: string;
  }): TicketTransfer {
    const ticket = ticketService.findById(data.ticketId);
    if (!ticket) {
      throw new Error('票券不存在');
    }
    
    if (ticket.holderId !== data.fromHolderId) {
      throw new Error('只有当前持票人才能发起转赠');
    }
    
    if (['REFUNDED', 'USED', 'CANCELLED', 'EXPIRED'].includes(ticket.status)) {
      throw new Error('该票券状态不允许转赠');
    }
    
    const pendingTransfer = this.findPendingByTicketId(data.ticketId);
    if (pendingTransfer) {
      throw new Error('该票券已有待确认的转赠');
    }
    
    const transfer: TicketTransfer = {
      id: generateId(),
      ticketId: data.ticketId,
      fromHolderId: data.fromHolderId,
      fromHolderName: data.fromHolderName,
      toHolderId: data.toHolderId,
      toHolderName: data.toHolderName,
      status: 'PENDING',
      requestTime: now(),
      completedTime: null,
      reason: null
    };
    
    store.saveTransfer(transfer);
    
    auditService.log({
      ticketId: ticket.id,
      transferId: transfer.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'TRANSFER_REQUESTED',
      beforeState: { holderId: ticket.holderId, holderName: ticket.holderName },
      afterState: { toHolderId: data.toHolderId, toHolderName: data.toHolderName },
      reason: '发起票券转赠'
    });
    
    return transfer;
  }

  completeTransfer(
    transferId: string,
    data: {
      operatorId: string;
      operatorName: string;
    }
  ): TicketTransfer {
    const transfer = this.findById(transferId);
    if (!transfer) {
      throw new Error('转赠记录不存在');
    }
    
    if (transfer.status !== 'PENDING') {
      throw new Error('转赠已完成或已取消');
    }
    
    const ticket = ticketService.findById(transfer.ticketId);
    if (!ticket) {
      throw new Error('票券不存在');
    }
    
    const beforeState = { ...ticket };
    
    ticketService.updateHolder(
      ticket.id,
      transfer.toHolderId,
      transfer.toHolderName,
      {
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        reason: '转赠完成'
      }
    );
    
    const updatedTicket = ticketService.findById(ticket.id)!;
    
    const nowTime = now();
    transfer.status = 'COMPLETED';
    transfer.completedTime = nowTime;
    store.saveTransfer(transfer);
    
    auditService.log({
      ticketId: ticket.id,
      transferId: transfer.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'TRANSFER_COMPLETED',
      beforeState,
      afterState: updatedTicket,
      reason: '完成票券转赠'
    });
    
    return transfer;
  }

  cancelTransfer(
    transferId: string,
    reason: string,
    data: {
      operatorId: string;
      operatorName: string;
    }
  ): TicketTransfer {
    const transfer = this.findById(transferId);
    if (!transfer) {
      throw new Error('转赠记录不存在');
    }
    
    if (transfer.status !== 'PENDING') {
      throw new Error('只有待确认的转赠可以取消');
    }
    
    const nowTime = now();
    transfer.status = 'CANCELLED';
    transfer.completedTime = nowTime;
    transfer.reason = reason;
    store.saveTransfer(transfer);
    
    auditService.log({
      ticketId: transfer.ticketId,
      transferId: transfer.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'TRANSFER_CANCELLED',
      afterState: { reason },
      reason: `取消转赠: ${reason}`
    });
    
    return transfer;
  }

  findById(id: string): TicketTransfer | null {
    return store.getTransfer(id) || null;
  }

  findPendingByTicketId(ticketId: string): TicketTransfer | null {
    const transfers = store.getTransfers()
      .filter(t => t.ticketId === ticketId && t.status === 'PENDING')
      .sort((a, b) => b.requestTime - a.requestTime);
    return transfers[0] || null;
  }

  findByTicketId(ticketId: string): TicketTransfer[] {
    return store.getTransfers()
      .filter(t => t.ticketId === ticketId)
      .sort((a, b) => b.requestTime - a.requestTime);
  }

  findByFromHolderId(holderId: string): TicketTransfer[] {
    return store.getTransfers()
      .filter(t => t.fromHolderId === holderId)
      .sort((a, b) => b.requestTime - a.requestTime);
  }

  findByToHolderId(holderId: string): TicketTransfer[] {
    return store.getTransfers()
      .filter(t => t.toHolderId === holderId)
      .sort((a, b) => b.requestTime - a.requestTime);
  }

  findAll(page: number = 1, pageSize: number = 50, filters?: {
    status?: TransferStatus;
  }): { transfers: TicketTransfer[]; total: number } {
    let filtered = store.getTransfers();
    
    if (filters?.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }
    
    const sorted = filtered.sort((a, b) => b.requestTime - a.requestTime);
    const total = sorted.length;
    const offset = (page - 1) * pageSize;
    
    return {
      transfers: sorted.slice(offset, offset + pageSize),
      total
    };
  }
}

export const transferService = new TransferService();
