import { store } from '../store';
import { generateId, generateTicketCode, generatePackageId, now } from '../utils';
import { auditService } from './auditService';
import type { Ticket, TicketStatus, PaginationResult } from '../types';

export class TicketService {
  createTicket(data: {
    eventId: string;
    eventName: string;
    holderId: string;
    holderName: string;
    price: number;
    validFrom?: number;
    validUntil?: number;
    operatorId: string;
    operatorName: string;
  }): Ticket {
    const currentTime = now();
    const validFrom = data.validFrom || currentTime;
    const validUntil = data.validUntil || (currentTime + 30 * 24 * 60 * 60 * 1000);
    
    const ticket: Ticket = {
      id: generateId(),
      ticketCode: generateTicketCode(),
      eventId: data.eventId,
      eventName: data.eventName,
      holderId: data.holderId,
      holderName: data.holderName,
      originalHolderId: data.holderId,
      originalHolderName: data.holderName,
      ticketType: 'SINGLE',
      packageId: null,
      packageName: null,
      packageSequence: null,
      packageTotal: null,
      price: data.price,
      status: 'CREATED',
      createdAt: currentTime,
      updatedAt: currentTime,
      validFrom,
      validUntil
    };
    
    store.saveTicket(ticket);
    
    auditService.log({
      ticketId: ticket.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'TICKET_CREATED',
      afterState: { ...ticket },
      reason: '创建票券'
    });
    
    return ticket;
  }

  createPackageTicket(data: {
    eventId: string;
    eventName: string;
    holderId: string;
    holderName: string;
    packageName: string;
    ticketCount: number;
    totalPrice: number;
    validFrom?: number;
    validUntil?: number;
    operatorId: string;
    operatorName: string;
  }): { parentTicket: Ticket; childTickets: Ticket[] } {
    const currentTime = now();
    const validFrom = data.validFrom || currentTime;
    const validUntil = data.validUntil || (currentTime + 30 * 24 * 60 * 60 * 1000);
    const packageId = generatePackageId();
    const ticketPrice = data.totalPrice / data.ticketCount;
    
    const parentTicket: Ticket = {
      id: generateId(),
      ticketCode: generateTicketCode(),
      eventId: data.eventId,
      eventName: data.eventName,
      holderId: data.holderId,
      holderName: data.holderName,
      originalHolderId: data.holderId,
      originalHolderName: data.holderName,
      ticketType: 'PACKAGE_PARENT',
      packageId,
      packageName: data.packageName,
      packageSequence: 0,
      packageTotal: data.ticketCount,
      price: data.totalPrice,
      status: 'CREATED',
      createdAt: currentTime,
      updatedAt: currentTime,
      validFrom,
      validUntil
    };
    
    const childTickets: Ticket[] = [];
    for (let i = 1; i <= data.ticketCount; i++) {
      childTickets.push({
        id: generateId(),
        ticketCode: generateTicketCode(),
        eventId: data.eventId,
        eventName: data.eventName,
        holderId: data.holderId,
        holderName: data.holderName,
        originalHolderId: data.holderId,
        originalHolderName: data.holderName,
        ticketType: 'PACKAGE_CHILD',
        packageId,
        packageName: data.packageName,
        packageSequence: i,
        packageTotal: data.ticketCount,
        price: ticketPrice,
        status: 'CREATED',
        createdAt: currentTime,
        updatedAt: currentTime,
        validFrom,
        validUntil
      });
    }
    
    store.saveTicket(parentTicket);
    for (const child of childTickets) {
      store.saveTicket(child);
    }
    
    auditService.log({
      ticketId: parentTicket.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'PACKAGE_CREATED',
      afterState: { parentTicket, childCount: childTickets.length },
      reason: '创建套票'
    });
    
    return { parentTicket, childTickets };
  }

  findById(id: string): Ticket | null {
    return store.getTicket(id) || null;
  }

  findByCode(ticketCode: string): Ticket | null {
    return store.getTicketByCode(ticketCode) || null;
  }

  findByHolderId(holderId: string, page: number = 1, pageSize: number = 50): PaginationResult<Ticket> {
    const filtered = store.getTickets().filter(t => t.holderId === holderId);
    const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
    const total = sorted.length;
    const offset = (page - 1) * pageSize;
    
    return {
      items: sorted.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  findByEventId(eventId: string, page: number = 1, pageSize: number = 50): PaginationResult<Ticket> {
    const filtered = store.getTickets().filter(t => t.eventId === eventId);
    const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
    const total = sorted.length;
    const offset = (page - 1) * pageSize;
    
    return {
      items: sorted.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  findByPackageId(packageId: string): Ticket[] {
    return store.getTickets()
      .filter(t => t.packageId === packageId)
      .sort((a, b) => (a.packageSequence || 0) - (b.packageSequence || 0));
  }

  findAll(page: number = 1, pageSize: number = 50, filters?: {
    status?: TicketStatus;
    holderId?: string;
    eventId?: string;
  }): PaginationResult<Ticket> {
    let filtered = store.getTickets();
    
    if (filters?.status) {
      filtered = filtered.filter(t => t.status === filters.status);
    }
    if (filters?.holderId) {
      filtered = filtered.filter(t => t.holderId === filters.holderId);
    }
    if (filters?.eventId) {
      filtered = filtered.filter(t => t.eventId === filters.eventId);
    }
    
    const sorted = filtered.sort((a, b) => b.createdAt - a.createdAt);
    const total = sorted.length;
    const offset = (page - 1) * pageSize;
    
    return {
      items: sorted.slice(offset, offset + pageSize),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };
  }

  updateStatus(
    id: string,
    newStatus: TicketStatus,
    options: {
      operatorId: string;
      operatorName: string;
      reason: string;
    }
  ): Ticket {
    const ticket = this.findById(id);
    if (!ticket) {
      throw new Error('票券不存在');
    }
    
    const beforeState = { ...ticket };
    ticket.status = newStatus;
    ticket.updatedAt = now();
    
    store.saveTicket(ticket);
    
    auditService.log({
      ticketId: ticket.id,
      operatorId: options.operatorId,
      operatorName: options.operatorName,
      action: 'STATUS_UPDATED',
      beforeState,
      afterState: { ...ticket },
      reason: options.reason
    });
    
    return ticket;
  }

  updateHolder(
    id: string,
    newHolderId: string,
    newHolderName: string,
    options: {
      operatorId: string;
      operatorName: string;
      reason: string;
    }
  ): Ticket {
    const ticket = this.findById(id);
    if (!ticket) {
      throw new Error('票券不存在');
    }
    
    const beforeState = { ...ticket };
    ticket.holderId = newHolderId;
    ticket.holderName = newHolderName;
    ticket.updatedAt = now();
    
    store.saveTicket(ticket);
    
    auditService.log({
      ticketId: ticket.id,
      operatorId: options.operatorId,
      operatorName: options.operatorName,
      action: 'HOLDER_UPDATED',
      beforeState,
      afterState: { ...ticket },
      reason: options.reason
    });
    
    return ticket;
  }

  manualCorrect(
    id: string,
    updates: Partial<{
      status: TicketStatus;
      holderId: string;
      holderName: string;
      validFrom: number;
      validUntil: number;
    }>,
    options: {
      operatorId: string;
      operatorName: string;
      reason: string;
    }
  ): Ticket {
    const ticket = this.findById(id);
    if (!ticket) {
      throw new Error('票券不存在');
    }
    
    const beforeState = { ...ticket };
    
    if (updates.status !== undefined) ticket.status = updates.status;
    if (updates.holderId !== undefined) ticket.holderId = updates.holderId;
    if (updates.holderName !== undefined) ticket.holderName = updates.holderName;
    if (updates.validFrom !== undefined) ticket.validFrom = updates.validFrom;
    if (updates.validUntil !== undefined) ticket.validUntil = updates.validUntil;
    ticket.updatedAt = now();
    
    store.saveTicket(ticket);
    
    auditService.log({
      ticketId: ticket.id,
      operatorId: options.operatorId,
      operatorName: options.operatorName,
      action: 'MANUAL_CORRECTION',
      beforeState,
      afterState: { ...ticket },
      reason: options.reason
    });
    
    return ticket;
  }
}

export const ticketService = new TicketService();
