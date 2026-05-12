import { store } from '../store';
import { generateId, generatePackageId, now } from '../utils';
import { ticketService } from './ticketService';
import { auditService } from './auditService';
import type { 
  ValidationRecord, 
  ValidationStatus, 
  ValidationSource, 
  OfflinePackage,
  OfflineValidationItem,
  Ticket
} from '../types';

interface ValidateResult {
  success: boolean;
  record?: ValidationRecord;
  failureReason?: string;
}

interface PackageValidationProgress {
  total: number;
  used: number;
  remaining: number;
  usedTickets: string[];
  remainingTickets: string[];
}

export class ValidationService {
  validateTicket(data: {
    ticketCode: string;
    gateId: string;
    gateName: string;
    operatorId: string;
    operatorName: string;
    requestId?: string;
    validationTime?: number;
  }): ValidateResult {
    const requestId = data.requestId || generateId();
    
    const existingRecord = this.findByRequestId(requestId);
    if (existingRecord) {
      return {
        success: existingRecord.status === 'SUCCESS',
        record: existingRecord,
        failureReason: existingRecord.failureReason || undefined
      };
    }
    
    const ticket = ticketService.findByCode(data.ticketCode);
    if (!ticket) {
      return this.createFailedRecord({
        ticketId: 'UNKNOWN',
        ticketCode: data.ticketCode,
        holderId: 'UNKNOWN',
        holderName: 'UNKNOWN',
        gateId: data.gateId,
        gateName: data.gateName,
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        source: 'ONLINE',
        requestId,
        validationTime: data.validationTime || now(),
        failureReason: '票券不存在'
      });
    }
    
    const validationTime = data.validationTime || now();
    const validationCheck = this.canValidate(ticket, validationTime);
    if (!validationCheck.canValidate) {
      return this.createFailedRecord({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        holderId: ticket.holderId,
        holderName: ticket.holderName,
        gateId: data.gateId,
        gateName: data.gateName,
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        source: 'ONLINE',
        requestId,
        validationTime,
        failureReason: validationCheck.reason!
      });
    }
    
    const duplicateCheck = this.checkDuplicate(ticket.id, validationTime);
    if (duplicateCheck.isDuplicate) {
      return this.createDuplicateRecord({
        ticketId: ticket.id,
        ticketCode: ticket.ticketCode,
        holderId: ticket.holderId,
        holderName: ticket.holderName,
        gateId: data.gateId,
        gateName: data.gateName,
        operatorId: data.operatorId,
        operatorName: data.operatorName,
        source: 'ONLINE',
        requestId,
        validationTime,
        failureReason: duplicateCheck.reason!
      });
    }
    
    const record = this.createSuccessRecord({
      ticketId: ticket.id,
      ticketCode: ticket.ticketCode,
      holderId: ticket.holderId,
      holderName: ticket.holderName,
      gateId: data.gateId,
      gateName: data.gateName,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      source: 'ONLINE',
      requestId,
      validationTime
    });
    
    this.updateTicketStatusAfterValidation(ticket, data.operatorId, data.operatorName);
    
    return {
      success: true,
      record
    };
  }

  createOfflinePackage(data: {
    gateId: string;
    gateName: string;
    operatorId: string;
    operatorName: string;
    validHours: number;
  }): OfflinePackage {
    const currentTime = now();
    const pkg: OfflinePackage = {
      id: generateId(),
      packageId: generatePackageId(),
      gateId: data.gateId,
      gateName: data.gateName,
      operatorId: data.operatorId,
      validFrom: currentTime,
      validUntil: currentTime + data.validHours * 60 * 60 * 1000,
      uploadedAt: null,
      uploadStatus: 'PENDING',
      validationCount: 0,
      successCount: 0,
      failedCount: 0
    };
    
    store.saveOfflinePackage(pkg);
    
    auditService.log({
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'OFFLINE_PACKAGE_CREATED',
      afterState: { 
        packageId: pkg.packageId, 
        gateId: data.gateId, 
        validHours: data.validHours 
      },
      reason: '创建离线核销包'
    });
    
    return pkg;
  }

  uploadOfflinePackage(data: {
    packageId: string;
    validations: Array<{
      ticketCode: string;
      gateId: string;
      validationTime: number;
    }>;
    operatorId: string;
    operatorName: string;
  }): { processedCount: number; successCount: number; failedCount: number; results: Array<{ticketCode: string; status: ValidationStatus; reason?: string}> } {
    const pkg = this.findOfflinePackageByPackageId(data.packageId);
    if (!pkg) {
      throw new Error('离线核销包不存在');
    }
    
    if (pkg.uploadStatus === 'UPLOADED') {
      throw new Error('离线核销包已上传，重复上传请使用幂等键');
    }
    
    const currentTime = now();
    let isExpired = false;
    if (currentTime > pkg.validUntil) {
      isExpired = true;
    }
    
    for (const item of data.validations) {
      const offlineItem: OfflineValidationItem = {
        id: generateId(),
        packageId: data.packageId,
        ticketCode: item.ticketCode,
        gateId: item.gateId,
        validationTime: item.validationTime,
        processed: false,
        processedResult: null,
        failureReason: null
      };
      store.saveOfflineItem(offlineItem);
    }
    
    pkg.uploadedAt = currentTime;
    pkg.uploadStatus = isExpired ? 'EXPIRED' : 'UPLOADED';
    store.saveOfflinePackage(pkg);
    
    return this.processOfflineValidations(
      data.packageId,
      data.operatorId,
      data.operatorName,
      isExpired
    );
  }

  private processOfflineValidations(
    packageId: string,
    operatorId: string,
    operatorName: string,
    isPackageExpired: boolean
  ): { processedCount: number; successCount: number; failedCount: number; results: Array<{ticketCode: string; status: ValidationStatus; reason?: string}> } {
    const pkg = this.findOfflinePackageByPackageId(packageId)!;
    const items = store.getOfflineItems().filter(i => i.packageId === packageId && !i.processed);
    const results: Array<{ticketCode: string; status: ValidationStatus; reason?: string}> = [];
    let successCount = 0;
    let failedCount = 0;
    
    for (const item of items) {
      let result: ValidateResult;
      
      if (isPackageExpired) {
        result = {
          success: false,
          failureReason: '离线核销包已过期'
        };
      } else {
        result = this.validateTicket({
          ticketCode: item.ticketCode,
          gateId: item.gateId,
          gateName: pkg.gateName,
          operatorId,
          operatorName,
          validationTime: item.validationTime
        });
      }
      
      const status = result.success ? 'SUCCESS' : 
                     (result.record?.status === 'DUPLICATE' ? 'DUPLICATE' : 'FAILED');
      
      if (result.success) successCount++;
      else failedCount++;
      
      results.push({
        ticketCode: item.ticketCode,
        status,
        reason: result.failureReason
      });
      
      item.processed = true;
      item.processedResult = status;
      item.failureReason = result.failureReason || null;
      store.saveOfflineItem(item);
    }
    
    pkg.validationCount = items.length;
    pkg.successCount = successCount;
    pkg.failedCount = failedCount;
    store.saveOfflinePackage(pkg);
    
    return {
      processedCount: items.length,
      successCount,
      failedCount,
      results
    };
  }

  findById(id: string): ValidationRecord | null {
    return store.getValidation(id) || null;
  }

  findByRequestId(requestId: string): ValidationRecord | null {
    return store.getValidationByRequestId(requestId) || null;
  }

  findByTicketId(ticketId: string): ValidationRecord[] {
    return store.getValidations()
      .filter(v => v.ticketId === ticketId)
      .sort((a, b) => b.validationTime - a.validationTime);
  }

  findByTicketCode(ticketCode: string): ValidationRecord[] {
    return store.getValidations()
      .filter(v => v.ticketCode === ticketCode)
      .sort((a, b) => b.validationTime - a.validationTime);
  }

  findAll(page: number = 1, pageSize: number = 50, filters?: {
    status?: ValidationStatus;
    source?: ValidationSource;
    gateId?: string;
  }): { records: ValidationRecord[]; total: number } {
    let filtered = store.getValidations();
    
    if (filters?.status) {
      filtered = filtered.filter(v => v.status === filters.status);
    }
    if (filters?.source) {
      filtered = filtered.filter(v => v.source === filters.source);
    }
    if (filters?.gateId) {
      filtered = filtered.filter(v => v.gateId === filters.gateId);
    }
    
    const sorted = filtered.sort((a, b) => b.validationTime - a.validationTime);
    const total = sorted.length;
    const offset = (page - 1) * pageSize;
    
    return {
      records: sorted.slice(offset, offset + pageSize),
      total
    };
  }

  findOfflinePackageByPackageId(packageId: string): OfflinePackage | null {
    return store.getOfflinePackageByPackageId(packageId) || null;
  }

  findAllOfflinePackages(page: number = 1, pageSize: number = 50): { packages: OfflinePackage[]; total: number } {
    const sorted = store.getOfflinePackages().sort((a, b) => b.validFrom - a.validFrom);
    const total = sorted.length;
    const offset = (page - 1) * pageSize;
    
    return {
      packages: sorted.slice(offset, offset + pageSize),
      total
    };
  }

  getEventStats(eventId: string): {
    totalTickets: number;
    validatedTickets: number;
    successValidations: number;
    failedValidations: number;
    duplicateValidations: number;
    onlineValidations: number;
    offlineValidations: number;
    validationsByGate: Record<string, number>;
  } {
    const tickets = ticketService.findByEventId(eventId, 1, 100000);
    const totalTickets = tickets.total;
    
    const ticketIds = new Set(tickets.items.map(t => t.id));
    const validations = store.getValidations().filter(v => ticketIds.has(v.ticketId));
    
    const uniqueValidatedTicketIds = new Set<string>();
    const validationsByGate: Record<string, number> = {};
    
    let successValidations = 0;
    let failedValidations = 0;
    let duplicateValidations = 0;
    let onlineValidations = 0;
    let offlineValidations = 0;
    
    for (const v of validations) {
      if (v.status === 'SUCCESS') {
        uniqueValidatedTicketIds.add(v.ticketId);
        successValidations++;
      } else if (v.status === 'FAILED') {
        failedValidations++;
      } else if (v.status === 'DUPLICATE') {
        duplicateValidations++;
      }
      
      if (v.source === 'ONLINE') onlineValidations++;
      else offlineValidations++;
      
      validationsByGate[v.gateName] = (validationsByGate[v.gateName] || 0) + 1;
    }
    
    return {
      totalTickets,
      validatedTickets: uniqueValidatedTicketIds.size,
      successValidations,
      failedValidations,
      duplicateValidations,
      onlineValidations,
      offlineValidations,
      validationsByGate
    };
  }

  getPackageValidationProgress(ticket: Ticket): PackageValidationProgress | null {
    if (!ticket.packageId) return null;
    
    const packageTickets = ticketService.findByPackageId(ticket.packageId);
    const childTickets = packageTickets.filter(t => t.ticketType === 'PACKAGE_CHILD');
    
    const usedTickets: string[] = [];
    const remainingTickets: string[] = [];
    
    for (const t of childTickets) {
      const validations = this.findByTicketId(t.id);
      const hasSuccess = validations.some(v => v.status === 'SUCCESS');
      
      if (hasSuccess) {
        usedTickets.push(t.ticketCode);
      } else {
        remainingTickets.push(t.ticketCode);
      }
    }
    
    return {
      total: childTickets.length,
      used: usedTickets.length,
      remaining: remainingTickets.length,
      usedTickets,
      remainingTickets
    };
  }

  private canValidate(ticket: Ticket, validationTime: number): { canValidate: boolean; reason?: string } {
    if (validationTime < ticket.validFrom) {
      return { canValidate: false, reason: '票券尚未生效' };
    }
    if (validationTime > ticket.validUntil) {
      return { canValidate: false, reason: '票券已过期' };
    }
    
    if (ticket.status === 'REFUNDED') {
      return { canValidate: false, reason: '票券已退票' };
    }
    if (ticket.status === 'CANCELLED') {
      return { canValidate: false, reason: '票券已取消' };
    }
    if (ticket.status === 'EXPIRED') {
      return { canValidate: false, reason: '票券已过期' };
    }
    if (ticket.status === 'USED') {
      return { canValidate: false, reason: '票券已使用' };
    }
    
    return { canValidate: true };
  }

  private checkDuplicate(ticketId: string, validationTime: number): { isDuplicate: boolean; reason?: string } {
    const validations = this.findByTicketId(ticketId);
    const successValidations = validations.filter(v => v.status === 'SUCCESS');
    
    if (successValidations.length === 0) {
      return { isDuplicate: false };
    }
    
    const ticket = ticketService.findById(ticketId);
    if (!ticket) {
      return { isDuplicate: true, reason: '票券不存在' };
    }
    
    if (ticket.ticketType === 'PACKAGE_CHILD') {
      return { isDuplicate: true, reason: `套票子票已入场，上次入场时间: ${new Date(successValidations[0].validationTime).toLocaleString()}` };
    }
    
    if (ticket.ticketType === 'SINGLE') {
      return { isDuplicate: true, reason: `票券已入场，上次入场时间: ${new Date(successValidations[0].validationTime).toLocaleString()}，闸口: ${successValidations[0].gateName}` };
    }
    
    if (ticket.ticketType === 'PACKAGE_PARENT') {
      const progress = this.getPackageValidationProgress(ticket);
      if (progress && progress.remaining === 0) {
        return { isDuplicate: true, reason: '套票全部子票已入场完成' };
      }
      return { isDuplicate: false };
    }
    
    return { isDuplicate: false };
  }

  private updateTicketStatusAfterValidation(
    ticket: Ticket,
    operatorId: string,
    operatorName: string
  ): void {
    if (ticket.ticketType === 'SINGLE' || ticket.ticketType === 'PACKAGE_CHILD') {
      ticketService.updateStatus(
        ticket.id,
        'USED',
        {
          operatorId,
          operatorName,
          reason: '核销通过，票券已使用'
        }
      );
    } else if (ticket.ticketType === 'PACKAGE_PARENT') {
      ticketService.updateStatus(
        ticket.id,
        'PARTIALLY_USED',
        {
          operatorId,
          operatorName,
          reason: '套票部分入场'
        }
      );
    }
  }

  private createSuccessRecord(data: {
    ticketId: string;
    ticketCode: string;
    holderId: string;
    holderName: string;
    gateId: string;
    gateName: string;
    operatorId: string;
    operatorName: string;
    source: ValidationSource;
    requestId: string;
    validationTime: number;
  }): ValidationRecord {
    const record: ValidationRecord = {
      id: generateId(),
      ticketId: data.ticketId,
      ticketCode: data.ticketCode,
      holderId: data.holderId,
      holderName: data.holderName,
      source: data.source,
      gateId: data.gateId,
      gateName: data.gateName,
      offlinePackageId: null,
      validationTime: data.validationTime,
      serverTime: now(),
      status: 'SUCCESS',
      failureReason: null,
      requestId: data.requestId
    };
    
    store.saveValidation(record);
    
    auditService.log({
      ticketId: record.ticketId,
      validationId: record.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'VALIDATION_SUCCESS',
      afterState: { 
        ticketCode: record.ticketCode, 
        gateName: record.gateName,
        source: record.source
      },
      reason: '核销成功'
    });
    
    return record;
  }

  private createFailedRecord(data: {
    ticketId: string;
    ticketCode: string;
    holderId: string;
    holderName: string;
    gateId: string;
    gateName: string;
    operatorId: string;
    operatorName: string;
    source: ValidationSource;
    requestId: string;
    validationTime: number;
    failureReason: string;
  }): ValidateResult {
    const record: ValidationRecord = {
      id: generateId(),
      ticketId: data.ticketId,
      ticketCode: data.ticketCode,
      holderId: data.holderId,
      holderName: data.holderName,
      source: data.source,
      gateId: data.gateId,
      gateName: data.gateName,
      offlinePackageId: null,
      validationTime: data.validationTime,
      serverTime: now(),
      status: 'FAILED',
      failureReason: data.failureReason,
      requestId: data.requestId
    };
    
    store.saveValidation(record);
    
    auditService.log({
      ticketId: record.ticketId !== 'UNKNOWN' ? record.ticketId : undefined,
      validationId: record.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'VALIDATION_FAILED',
      afterState: { 
        ticketCode: record.ticketCode, 
        reason: data.failureReason 
      },
      reason: `核销失败: ${data.failureReason}`
    });
    
    return {
      success: false,
      record,
      failureReason: data.failureReason
    };
  }

  private createDuplicateRecord(data: {
    ticketId: string;
    ticketCode: string;
    holderId: string;
    holderName: string;
    gateId: string;
    gateName: string;
    operatorId: string;
    operatorName: string;
    source: ValidationSource;
    requestId: string;
    validationTime: number;
    failureReason: string;
  }): ValidateResult {
    const record: ValidationRecord = {
      id: generateId(),
      ticketId: data.ticketId,
      ticketCode: data.ticketCode,
      holderId: data.holderId,
      holderName: data.holderName,
      source: data.source,
      gateId: data.gateId,
      gateName: data.gateName,
      offlinePackageId: null,
      validationTime: data.validationTime,
      serverTime: now(),
      status: 'DUPLICATE',
      failureReason: data.failureReason,
      requestId: data.requestId
    };
    
    store.saveValidation(record);
    
    auditService.log({
      ticketId: record.ticketId,
      validationId: record.id,
      operatorId: data.operatorId,
      operatorName: data.operatorName,
      action: 'VALIDATION_DUPLICATE',
      afterState: { 
        ticketCode: record.ticketCode, 
        reason: data.failureReason 
      },
      reason: `重复核销: ${data.failureReason}`
    });
    
    return {
      success: false,
      record,
      failureReason: data.failureReason
    };
  }
}

export const validationService = new ValidationService();
