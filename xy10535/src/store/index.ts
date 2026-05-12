import type {
  Ticket,
  TicketTransfer,
  TicketRefund,
  ValidationRecord,
  OfflinePackage,
  OfflineValidationItem,
  AuditLog,
  IdempotentRequest
} from '../types';

class DataStore {
  tickets: Map<string, Ticket> = new Map();
  transfers: Map<string, TicketTransfer> = new Map();
  refunds: Map<string, TicketRefund> = new Map();
  validations: Map<string, ValidationRecord> = new Map();
  offlinePackages: Map<string, OfflinePackage> = new Map();
  offlineItems: Map<string, OfflineValidationItem> = new Map();
  auditLogs: Map<string, AuditLog> = new Map();
  idempotentRequests: Map<string, IdempotentRequest> = new Map();
  
  ticketCodeIndex: Map<string, string> = new Map();
  requestIdIndex: Map<string, string> = new Map();
  packageIdIndex: Map<string, string> = new Map();

  getTickets(): Ticket[] {
    return Array.from(this.tickets.values());
  }

  getTicket(id: string): Ticket | undefined {
    return this.tickets.get(id);
  }

  getTicketByCode(code: string): Ticket | undefined {
    const id = this.ticketCodeIndex.get(code);
    return id ? this.tickets.get(id) : undefined;
  }

  saveTicket(ticket: Ticket): void {
    this.tickets.set(ticket.id, ticket);
    this.ticketCodeIndex.set(ticket.ticketCode, ticket.id);
  }

  getTransfers(): TicketTransfer[] {
    return Array.from(this.transfers.values());
  }

  getTransfer(id: string): TicketTransfer | undefined {
    return this.transfers.get(id);
  }

  saveTransfer(transfer: TicketTransfer): void {
    this.transfers.set(transfer.id, transfer);
  }

  getRefunds(): TicketRefund[] {
    return Array.from(this.refunds.values());
  }

  getRefund(id: string): TicketRefund | undefined {
    return this.refunds.get(id);
  }

  saveRefund(refund: TicketRefund): void {
    this.refunds.set(refund.id, refund);
  }

  getValidations(): ValidationRecord[] {
    return Array.from(this.validations.values());
  }

  getValidation(id: string): ValidationRecord | undefined {
    return this.validations.get(id);
  }

  getValidationByRequestId(requestId: string): ValidationRecord | undefined {
    const id = this.requestIdIndex.get(requestId);
    return id ? this.validations.get(id) : undefined;
  }

  saveValidation(record: ValidationRecord): void {
    this.validations.set(record.id, record);
    this.requestIdIndex.set(record.requestId, record.id);
  }

  getOfflinePackages(): OfflinePackage[] {
    return Array.from(this.offlinePackages.values());
  }

  getOfflinePackage(id: string): OfflinePackage | undefined {
    return this.offlinePackages.get(id);
  }

  getOfflinePackageByPackageId(packageId: string): OfflinePackage | undefined {
    const id = this.packageIdIndex.get(packageId);
    return id ? this.offlinePackages.get(id) : undefined;
  }

  saveOfflinePackage(pkg: OfflinePackage): void {
    this.offlinePackages.set(pkg.id, pkg);
    this.packageIdIndex.set(pkg.packageId, pkg.id);
  }

  getOfflineItems(): OfflineValidationItem[] {
    return Array.from(this.offlineItems.values());
  }

  getOfflineItem(id: string): OfflineValidationItem | undefined {
    return this.offlineItems.get(id);
  }

  saveOfflineItem(item: OfflineValidationItem): void {
    this.offlineItems.set(item.id, item);
  }

  getAuditLogs(): AuditLog[] {
    return Array.from(this.auditLogs.values());
  }

  saveAuditLog(log: AuditLog): void {
    this.auditLogs.set(log.id, log);
  }

  getIdempotentRequest(key: string): IdempotentRequest | undefined {
    return this.idempotentRequests.get(key);
  }

  saveIdempotentRequest(req: IdempotentRequest): void {
    this.idempotentRequests.set(req.key, req);
  }
}

export const store = new DataStore();
