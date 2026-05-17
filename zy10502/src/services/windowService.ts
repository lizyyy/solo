import { v4 as uuidv4 } from 'uuid';
import {
  ReadonlyWindow,
  WindowStatus,
  CreateWindowRequest,
  UpdateWindowStatusRequest,
  AffectedService,
  RecoveryCondition,
  BlockedWrite,
  WindowReport
} from '../types';
import { store } from '../store/memoryStore';

const VALID_TRANSITIONS: Record<WindowStatus, WindowStatus[]> = {
  [WindowStatus.DRAFT]: [WindowStatus.SCHEDULED, WindowStatus.CANCELLED],
  [WindowStatus.SCHEDULED]: [WindowStatus.ACTIVE, WindowStatus.CANCELLED, WindowStatus.DRAFT],
  [WindowStatus.ACTIVE]: [WindowStatus.BLOCKING, WindowStatus.CANCELLED, WindowStatus.ERROR],
  [WindowStatus.BLOCKING]: [WindowStatus.RECOVERING, WindowStatus.ERROR],
  [WindowStatus.RECOVERING]: [WindowStatus.COMPLETED, WindowStatus.ERROR],
  [WindowStatus.COMPLETED]: [],
  [WindowStatus.CANCELLED]: [],
  [WindowStatus.ERROR]: [WindowStatus.RECOVERING, WindowStatus.CANCELLED]
};

export class WindowService {
  private validateTransition(current: WindowStatus, next: WindowStatus): boolean {
    return VALID_TRANSITIONS[current].includes(next);
  }

  createWindow(request: CreateWindowRequest): ReadonlyWindow {
    const affectedServices: AffectedService[] = request.affectedServices.map(s => ({
      ...s,
      id: uuidv4(),
      notified: false
    }));

    const recoveryConditions: RecoveryCondition[] = request.recoveryConditions.map(c => ({
      ...c,
      satisfied: false
    }));

    return store.createWindow({
      databaseName: request.databaseName,
      databaseHost: request.databaseHost,
      windowName: request.windowName,
      description: request.description,
      status: WindowStatus.DRAFT,
      scheduledStartTime: new Date(request.scheduledStartTime),
      scheduledEndTime: new Date(request.scheduledEndTime),
      createdBy: request.createdBy,
      affectedServices,
      recoveryConditions,
      dbaContact: request.dbaContact,
      reason: request.reason,
      tags: request.tags
    });
  }

  getWindow(id: string): ReadonlyWindow | undefined {
    return store.getWindow(id);
  }

  getWindows(filters?: { databaseName?: string; status?: WindowStatus }): ReadonlyWindow[] {
    return store.getWindows(filters);
  }

  updateWindowStatus(
    id: string,
    request: UpdateWindowStatusRequest
  ): ReadonlyWindow | null {
    const window = store.getWindow(id);
    if (!window) {
      store.recordException({
        windowId: id,
        operation: 'updateWindowStatus',
        originalInput: request,
        errorMessage: `Window not found: ${id}`
      });
      return null;
    }

    if (!this.validateTransition(window.status, request.status)) {
      store.recordException({
        windowId: id,
        operation: 'updateWindowStatus',
        originalInput: request,
        errorMessage: `Invalid status transition from ${window.status} to ${request.status}`
      });
      return null;
    }

    const updates: Partial<ReadonlyWindow> = { status: request.status };

    if (request.status === WindowStatus.ACTIVE) {
      updates.actualStartTime = new Date();
    } else if (request.status === WindowStatus.COMPLETED) {
      updates.actualEndTime = new Date();
    }

    store.recordCorrection({
      windowId: id,
      correctedBy: request.updatedBy,
      correctionType: 'STATUS_CHANGE',
      oldValue: window.status,
      newValue: request.status,
      reason: request.note || 'Status update'
    });

    const result = store.updateWindow(id, updates);
    return result || null;
  }

  blockWrite(windowId: string, serviceName: string, operation: string, sqlStatement?: string, blockedBy?: string): BlockedWrite | null {
    const window = store.getWindow(windowId);
    if (!window) {
      store.recordException({
        windowId,
        operation: 'blockWrite',
        originalInput: { serviceName, operation, sqlStatement },
        errorMessage: `Window not found: ${windowId}`
      });
      return null;
    }

    if (window.status !== WindowStatus.BLOCKING) {
      store.recordException({
        windowId,
        operation: 'blockWrite',
        originalInput: { serviceName, operation, sqlStatement },
        errorMessage: `Window ${windowId} is not in BLOCKING state, current state: ${window.status}`
      });
      return null;
    }

    return store.addBlockedWrite({
      windowId,
      serviceName,
      operation,
      sqlStatement,
      blockedBy: blockedBy || 'system'
    });
  }

  satisfyRecoveryCondition(windowId: string, conditionType: string, verifiedBy: string): boolean {
    const window = store.getWindow(windowId);
    if (!window) return false;

    const conditionIndex = window.recoveryConditions.findIndex(c => c.type === conditionType);
    if (conditionIndex === -1) return false;

    const newConditions = [...window.recoveryConditions];
    newConditions[conditionIndex] = {
      ...newConditions[conditionIndex],
      satisfied: true,
      satisfiedTime: new Date(),
      verifiedBy
    };

    store.recordCorrection({
      windowId,
      correctedBy: verifiedBy,
      correctionType: 'CONDITION_UPDATE',
      oldValue: window.recoveryConditions[conditionIndex],
      newValue: newConditions[conditionIndex],
      reason: 'Recovery condition satisfied'
    });

    store.updateWindow(windowId, { recoveryConditions: newConditions });

    const allSatisfied = newConditions.every(c => c.satisfied);
    if (allSatisfied && window.status === WindowStatus.BLOCKING) {
      this.updateWindowStatus(windowId, {
        status: WindowStatus.RECOVERING,
        updatedBy: verifiedBy,
        note: 'All recovery conditions satisfied, entering recovery phase'
      });
    }

    return true;
  }

  addAffectedService(windowId: string, serviceData: Omit<AffectedService, 'id' | 'notified' | 'notificationTime'>, addedBy: string): AffectedService | null {
    const window = store.getWindow(windowId);
    if (!window) return null;

    const newService: AffectedService = {
      ...serviceData,
      id: uuidv4(),
      notified: false
    };

    store.recordCorrection({
      windowId,
      correctedBy: addedBy,
      correctionType: 'SERVICE_ADD',
      oldValue: null,
      newValue: newService,
      reason: 'Add affected service'
    });

    store.updateWindow(windowId, {
      affectedServices: [...window.affectedServices, newService]
    });

    return newService;
  }

  removeAffectedService(windowId: string, serviceId: string, removedBy: string): boolean {
    const window = store.getWindow(windowId);
    if (!window) return false;

    const serviceToRemove = window.affectedServices.find(s => s.id === serviceId);
    if (!serviceToRemove) return false;

    store.recordCorrection({
      windowId,
      correctedBy: removedBy,
      correctionType: 'SERVICE_REMOVE',
      oldValue: serviceToRemove,
      newValue: null,
      reason: 'Remove affected service'
    });

    store.updateWindow(windowId, {
      affectedServices: window.affectedServices.filter(s => s.id !== serviceId)
    });

    return true;
  }

  generateReport(windowId: string, exportedBy?: string): WindowReport | null {
    const window = store.getWindow(windowId);
    if (!window) return null;

    const stats = store.getWindowStats(windowId);
    const blockedWrites = store.getBlockedWrites(windowId);
    
    const startTime = window.actualStartTime || window.scheduledStartTime;
    const endTime = window.actualEndTime || new Date();
    const durationMinutes = Math.round((endTime.getTime() - startTime.getTime()) / 60000);

    const recoveryTimeMinutes = window.actualStartTime && window.actualEndTime
      ? Math.round((window.actualEndTime.getTime() - window.actualStartTime.getTime()) / 60000)
      : undefined;

    const anomalies: string[] = [];
    if (window.status === WindowStatus.ERROR) {
      anomalies.push('Window ended in ERROR state');
    }
    if (blockedWrites.filter(b => !b.resolved).length > 0) {
      anomalies.push(`There are ${blockedWrites.filter(b => !b.resolved).length} unresolved blocked writes`);
    }

    return store.createReport({
      windowId,
      totalBlockedWrites: stats.totalBlocked,
      affectedServicesCount: window.affectedServices.length,
      peakBlockedPerMinute: Math.ceil(stats.totalBlocked / Math.max(durationMinutes, 1)),
      durationMinutes,
      recoveryTimeMinutes,
      statusSummary: `Window ${window.windowName} for ${window.databaseName} ended with status ${window.status}`,
      anomalies,
      exportedBy
    });
  }

  manualCorrect(
    windowId: string,
    correctionType: 'STATUS_CHANGE' | 'SERVICE_ADD' | 'SERVICE_REMOVE' | 'CONDITION_UPDATE' | 'OTHER',
    oldValue: any,
    newValue: any,
    correctedBy: string,
    reason: string
  ): boolean {
    const window = store.getWindow(windowId);
    if (!window) return false;

    store.recordCorrection({
      windowId,
      correctedBy,
      correctionType,
      oldValue,
      newValue,
      reason
    });

    return true;
  }

  handleException(exceptionId: string, handledBy: string, handlingNote: string): boolean {
    return !!store.updateException(exceptionId, {
      handled: true,
      handledBy,
      handlingNote
    });
  }

  getExceptions(windowId?: string) {
    return store.getExceptions(windowId);
  }

  getCorrections(windowId?: string) {
    return store.getCorrections(windowId);
  }

  getBlockedWrites(windowId?: string) {
    return store.getBlockedWrites(windowId);
  }

  getReports(windowId?: string) {
    return store.getReports(windowId);
  }
}

export const windowService = new WindowService();
