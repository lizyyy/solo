import { Ticket, TicketStatus, FaultType, RuleAction, ImportResult, ExportFilter, MonthlyReport } from '../types';
import { TicketRepository, AuditLogRepository, MaintenanceRecordRepository } from '../storage/repositories';
import { RuleEngine } from '../rules/ruleEngine';

export class TicketService {
  private ticketRepo: TicketRepository;
  private auditLogRepo: AuditLogRepository;
  private maintenanceRepo: MaintenanceRecordRepository;
  private ruleEngine: RuleEngine;

  constructor(
    ticketRepo: TicketRepository,
    auditLogRepo: AuditLogRepository,
    maintenanceRepo: MaintenanceRecordRepository,
    ruleEngine: RuleEngine
  ) {
    this.ticketRepo = ticketRepo;
    this.auditLogRepo = auditLogRepo;
    this.maintenanceRepo = maintenanceRepo;
    this.ruleEngine = ruleEngine;
  }

  async receiveTicket(
    externalId: string,
    cabinetId: string,
    cabinetName: string,
    faultType: FaultType,
    description: string,
    isOffline: boolean = false,
    operator: string = 'system'
  ): Promise<{ ticket: Ticket; action: RuleAction; mergedInto?: string }> {
    const existing = await this.ticketRepo.findByExternalId(externalId);
    if (existing) {
      return { ticket: existing, action: RuleAction.ALLOW };
    }

    const ticketData = {
      externalId,
      cabinetId,
      cabinetName,
      faultType,
      description,
      status: TicketStatus.PENDING,
      isOffline,
      reportedAt: new Date(),
      mergedTickets: [],
      ruleResults: []
    };

    const ticket = await this.ticketRepo.create(ticketData);
    
    const { finalAction, results } = await this.ruleEngine.execute(ticket);
    
    for (const result of results) {
      await this.ticketRepo.addRuleResult(ticket.id, result);
    }

    await this.auditLogRepo.create({
      ticketId: ticket.id,
      action: 'TICKET_RECEIVED',
      operator,
      details: { externalId, faultType, cabinetId, ruleResults: results },
      timestamp: new Date()
    });

    let mergedInto: string | undefined;

    if (finalAction === RuleAction.MERGE) {
      const mergeResult = results.find(r => r.action === RuleAction.MERGE);
      if (mergeResult?.details?.mergeIntoId) {
        mergedInto = mergeResult.details.mergeIntoId;
        await this.ticketRepo.mergeTickets(mergedInto, ticket.id);
        
        await this.auditLogRepo.create({
          ticketId: ticket.id,
          action: 'TICKET_MERGED',
          operator,
          details: { mergedInto, reason: mergeResult.reason },
          timestamp: new Date()
        });
      }
    } else if (finalAction === RuleAction.BLOCK) {
      await this.ticketRepo.update(ticket.id, { status: TicketStatus.REJECTED });
      
      await this.auditLogRepo.create({
        ticketId: ticket.id,
        action: 'TICKET_BLOCKED',
        operator,
        details: { reason: results.find(r => r.action === RuleAction.BLOCK)?.reason },
        timestamp: new Date()
      });
    } else {
      await this.ticketRepo.update(ticket.id, { 
        status: TicketStatus.RECEIVED,
        receivedAt: new Date()
      });
    }

    const updatedTicket = await this.ticketRepo.findById(ticket.id);
    if (!updatedTicket) {
      throw new Error('Failed to retrieve ticket after creation');
    }

    return { ticket: updatedTicket, action: finalAction, mergedInto };
  }

  async analyzeTicket(ticketId: string, rootCause: string, operator: string): Promise<Ticket | null> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) return null;

    if (ticket.status === TicketStatus.REJECTED || ticket.mergedInto) {
      throw new Error('无法分析已被拒绝或合并的工单');
    }

    const updated = await this.ticketRepo.update(ticketId, {
      status: TicketStatus.ANALYZED,
      analyzedAt: new Date(),
      rootCause
    });

    await this.auditLogRepo.create({
      ticketId,
      action: 'TICKET_ANALYZED',
      operator,
      details: { rootCause },
      timestamp: new Date()
    });

    return updated;
  }

  async dispatchTicket(ticketId: string, technician: string, scheduledAt: Date, operator: string): Promise<Ticket | null> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) return null;

    if (ticket.status === TicketStatus.REJECTED || ticket.mergedInto) {
      throw new Error('无法派修已被拒绝或合并的工单');
    }

    if (ticket.status !== TicketStatus.ANALYZED) {
      throw new Error('工单需先完成归因分析');
    }

    const updated = await this.ticketRepo.update(ticketId, {
      status: TicketStatus.DISPATCHED,
      dispatchedAt: new Date(),
      assignedTo: technician
    });

    await this.maintenanceRepo.create({
      ticketId,
      cabinetId: ticket.cabinetId,
      technician,
      scheduledAt,
      statusBefore: ticket.faultType,
      notes: ticket.rootCause
    });

    await this.auditLogRepo.create({
      ticketId,
      action: 'TICKET_DISPATCHED',
      operator,
      details: { technician, scheduledAt: scheduledAt.toISOString() },
      timestamp: new Date()
    });

    return updated;
  }

  async reviewTicket(ticketId: string, resolution: string, statusAfter: string, operator: string): Promise<Ticket | null> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) return null;

    if (ticket.status !== TicketStatus.DISPATCHED) {
      throw new Error('工单需先完成派修');
    }

    const updated = await this.ticketRepo.update(ticketId, {
      status: TicketStatus.REVIEWED,
      reviewedAt: new Date(),
      resolution
    });

    const maintenanceRecords = await this.maintenanceRepo.findByTicketId(ticketId);
    if (maintenanceRecords.length > 0) {
      await this.maintenanceRepo.update(maintenanceRecords[0].id, {
        completedAt: new Date(),
        statusAfter,
        notes: resolution
      });
    }

    await this.auditLogRepo.create({
      ticketId,
      action: 'TICKET_REVIEWED',
      operator,
      details: { resolution, statusAfter },
      timestamp: new Date()
    });

    return updated;
  }

  async resolveTicket(ticketId: string, operator: string): Promise<Ticket | null> {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) return null;

    if (ticket.status !== TicketStatus.REVIEWED) {
      throw new Error('工单需先完成复核');
    }

    const updated = await this.ticketRepo.update(ticketId, {
      status: TicketStatus.RESOLVED,
      resolvedAt: new Date()
    });

    await this.auditLogRepo.create({
      ticketId,
      action: 'TICKET_RESOLVED',
      operator,
      details: {},
      timestamp: new Date()
    });

    return updated;
  }

  async importTickets(tickets: Array<{
    externalId: string;
    cabinetId: string;
    cabinetName: string;
    faultType: FaultType;
    description: string;
    isOffline?: boolean;
  }>, operator: string): Promise<ImportResult> {
    const result: ImportResult = {
      success: 0,
      failed: 0,
      skipped: 0,
      merged: 0,
      errors: []
    };

    for (const t of tickets) {
      try {
        const { ticket, action, mergedInto } = await this.receiveTicket(
          t.externalId,
          t.cabinetId,
          t.cabinetName,
          t.faultType,
          t.description,
          t.isOffline || false,
          operator
        );

        if (action === RuleAction.MERGE && mergedInto) {
          result.merged++;
        } else if (action === RuleAction.BLOCK) {
          result.skipped++;
        } else {
          result.success++;
        }
      } catch (error: any) {
        result.failed++;
        result.errors.push({
          externalId: t.externalId,
          reason: error.message,
          details: { error: String(error) }
        });
      }
    }

    await this.auditLogRepo.create({
      action: 'BATCH_IMPORT',
      operator,
      details: result,
      timestamp: new Date()
    });

    return result;
  }

  async getTicket(ticketId: string): Promise<Ticket | null> {
    return this.ticketRepo.findById(ticketId);
  }

  async getTicketByExternalId(externalId: string): Promise<Ticket | null> {
    return this.ticketRepo.findByExternalId(externalId);
  }

  async listTickets(filters?: { status?: TicketStatus; cabinetId?: string; startDate?: Date; endDate?: Date }): Promise<Ticket[]> {
    return this.ticketRepo.findAll(filters);
  }

  async getTicketHistory(ticketId: string) {
    const ticket = await this.ticketRepo.findById(ticketId);
    if (!ticket) return null;

    const auditLogs = await this.auditLogRepo.findByTicketId(ticketId);
    const maintenanceRecords = await this.maintenanceRepo.findByTicketId(ticketId);

    return {
      ticket,
      auditLogs,
      maintenanceRecords,
      ruleResults: ticket.ruleResults
    };
  }

  async exportTickets(filter: ExportFilter): Promise<Ticket[]> {
    return this.ticketRepo.findAll({
      status: filter.status,
      cabinetId: filter.cabinetId,
      startDate: filter.startDate,
      endDate: filter.endDate
    });
  }

  async generateMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 0, 23, 59, 59);

    const tickets = await this.ticketRepo.findAll({ startDate, endDate });

    const byFaultType: Record<FaultType, number> = {
      [FaultType.CABINET_DOOR_FAILURE]: 0,
      [FaultType.SCAN_FAILURE]: 0,
      [FaultType.FALSE_EMPTY_SLOT_ALARM]: 0,
      [FaultType.OTHER]: 0
    };

    const byStatus: Record<TicketStatus, number> = {
      [TicketStatus.PENDING]: 0,
      [TicketStatus.RECEIVED]: 0,
      [TicketStatus.ANALYZED]: 0,
      [TicketStatus.DISPATCHED]: 0,
      [TicketStatus.REVIEWED]: 0,
      [TicketStatus.RESOLVED]: 0,
      [TicketStatus.REJECTED]: 0
    };

    let mergedCount = 0;
    let offlineExcludedCount = 0;
    let dispatchedCount = 0;
    let reviewedCount = 0;
    let totalResolutionTime = 0;
    let resolvedCount = 0;

    for (const ticket of tickets) {
      byFaultType[ticket.faultType]++;
      byStatus[ticket.status]++;

      if (ticket.mergedInto) {
        mergedCount++;
      }

      if (ticket.isOffline) {
        offlineExcludedCount++;
      }

      if (ticket.status === TicketStatus.DISPATCHED || 
          ticket.status === TicketStatus.REVIEWED ||
          ticket.status === TicketStatus.RESOLVED) {
        dispatchedCount++;
      }

      if (ticket.status === TicketStatus.REVIEWED ||
          ticket.status === TicketStatus.RESOLVED) {
        reviewedCount++;
      }

      if (ticket.resolvedAt && ticket.receivedAt) {
        totalResolutionTime += ticket.resolvedAt.getTime() - ticket.receivedAt.getTime();
        resolvedCount++;
      }
    }

    return {
      period: `${year}-${String(month).padStart(2, '0')}`,
      totalTickets: tickets.length,
      byFaultType,
      byStatus,
      mergedTickets: mergedCount,
      offlineExcluded: offlineExcludedCount,
      averageResolutionTime: resolvedCount > 0 ? totalResolutionTime / resolvedCount : undefined,
      dispatchedCount,
      reviewedCount
    };
  }
}