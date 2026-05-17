import { recycleStore } from '../store/recycleStore';
import { RecycleStatus, CreateRecycleRequest, StatusTransitionRequest, ManualCorrectionRequest, ExceptionHandleRequest, GrayConfigRecycle } from '../types';

const VALID_TRANSITIONS: Record<RecycleStatus, RecycleStatus[]> = {
  [RecycleStatus.PENDING]: [RecycleStatus.IN_PROGRESS, RecycleStatus.CANCELLED, RecycleStatus.EXPIRED],
  [RecycleStatus.IN_PROGRESS]: [RecycleStatus.COMPLETED, RecycleStatus.ERROR, RecycleStatus.CANCELLED],
  [RecycleStatus.COMPLETED]: [],
  [RecycleStatus.CANCELLED]: [],
  [RecycleStatus.EXPIRED]: [RecycleStatus.PENDING],
  [RecycleStatus.ERROR]: [RecycleStatus.PENDING, RecycleStatus.CANCELLED]
};

export class RecycleService {
  create(request: CreateRecycleRequest): GrayConfigRecycle {
    return recycleStore.create(request);
  }

  findById(id: string): GrayConfigRecycle | undefined {
    return recycleStore.findById(id);
  }

  query(params: any) {
    return recycleStore.query(params);
  }

  transitionStatus(id: string, request: StatusTransitionRequest): GrayConfigRecycle | null {
    const record = recycleStore.findById(id);
    if (!record) {
      return null;
    }

    const validTransitions = VALID_TRANSITIONS[record.status];
    if (!validTransitions.includes(request.status)) {
      throw new Error(`Invalid status transition from ${record.status} to ${request.status}`);
    }

    return recycleStore.updateStatus(id, request.status, request.operator, request.remark);
  }

  addException(id: string, originalInput: any, errorMessage: string) {
    return recycleStore.addException(id, originalInput, errorMessage);
  }

  handleException(id: string, exceptionId: string, request: ExceptionHandleRequest) {
    return recycleStore.handleException(id, exceptionId, request.handler, request.resolution);
  }

  manualCorrection(id: string, request: ManualCorrectionRequest): GrayConfigRecycle | null {
    const { operator, reason, configKey, grayScope, owner, recycleDate, hitTenants } = request;
    
    const updateData: Partial<GrayConfigRecycle> = {};
    if (configKey !== undefined) updateData.configKey = configKey;
    if (grayScope !== undefined) updateData.grayScope = grayScope;
    if (owner !== undefined) updateData.owner = owner;
    if (recycleDate !== undefined) updateData.recycleDate = new Date(recycleDate);
    if (hitTenants !== undefined) updateData.hitTenants = hitTenants;

    return recycleStore.manualCorrection(id, updateData, operator, reason);
  }

  getAllForExport() {
    return recycleStore.getAll();
  }

  checkExpirations() {
    const now = new Date();
    const records = recycleStore.getAll();
    
    for (const record of records) {
      if (record.status === RecycleStatus.PENDING && record.recycleDate <= now) {
        recycleStore.updateStatus(record.id, RecycleStatus.EXPIRED, 'system');
      }
    }
  }

  sendReminders() {
    const now = new Date();
    const threeDaysLater = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);
    const records = recycleStore.getAll();
    
    for (const record of records) {
      if (record.status === RecycleStatus.PENDING && 
          record.recycleDate <= threeDaysLater &&
          record.remindersSent < 3) {
        recycleStore.incrementReminder(record.id);
      }
    }
  }

  updateHitTenants(id: string, tenants: string[]) {
    return recycleStore.updateHitTenants(id, tenants);
  }
}

export const recycleService = new RecycleService();
