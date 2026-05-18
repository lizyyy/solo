import { Visitor, VisitorStatus, HistoryRecord, ApprovalAction, AccessControl, AccessType } from '../types';
import { store } from '../models/Store';

export class VisitorService {
  private counter = 0;
  
  private generateId(): string {
    this.counter++;
    return `visitor-${Date.now()}-${this.counter}`;
  }

  private getNow(): string {
    return new Date().toISOString();
  }

  createVisitor(data: Omit<Visitor, "id" | "createdAt" | "updatedAt" | "status" | "createdBy">, createdBy: string): Visitor {
    const visitor: Visitor = {
      ...data,
      id: this.generateId(),
      status: VisitorStatus.DRAFT,
      createdAt: this.getNow(),
      updatedAt: this.getNow(),
      createdBy
    };
    store.saveVisitor(visitor);
    return visitor;
  }

  getVisitor(id: string): Visitor | undefined {
    return store.getVisitor(id);
  }

  getAllVisitors(): Visitor[] {
    return store.getAllVisitors();
  }

  private createHistoryRecord(
    visitorId: string,
    action: ApprovalAction,
    operator: string,
    operatorRole: string,
    oldValues: Partial<Visitor>,
    newValues: Partial<Visitor>,
    comment?: string
  ): void {
    const changedFields = Object.keys(newValues).filter(key => 
      JSON.stringify(oldValues[key as keyof Visitor]) !== JSON.stringify(newValues[key as keyof Visitor])
    );

    const record: HistoryRecord = {
      id: this.generateId(),
      visitorId,
      action,
      operator,
      operatorRole,
      comment,
      oldValues,
      newValues,
      changedFields,
      createdAt: this.getNow()
    };
    store.saveHistory(record);
  }

  submitVisitor(id: string, operator: string, operatorRole: string): Visitor | null {
    const visitor = store.getVisitor(id);
    if (!visitor) return null;

    const oldValues = { ...visitor };
    visitor.status = VisitorStatus.SUBMITTED;
    visitor.updatedAt = this.getNow();
    
    store.saveVisitor(visitor);
    this.createHistoryRecord(id, ApprovalAction.SUBMIT, operator, operatorRole, oldValues, visitor, '提交访客放行申请');
    return visitor;
  }

  approveVisitor(id: string, operator: string, operatorRole: string, comment?: string): Visitor | null {
    const visitor = store.getVisitor(id);
    if (!visitor) return null;

    const oldValues = { ...visitor };
    visitor.status = VisitorStatus.APPROVED;
    visitor.updatedAt = this.getNow();
    
    store.saveVisitor(visitor);
    this.createHistoryRecord(id, ApprovalAction.APPROVE, operator, operatorRole, oldValues, visitor, comment);
    
    this.grantFloorAccess(id, visitor.floor, '审批通过授予门禁权限');
    return visitor;
  }

  rejectVisitor(id: string, operator: string, operatorRole: string, reason: string): Visitor | null {
    const visitor = store.getVisitor(id);
    if (!visitor) return null;

    const oldValues = { ...visitor };
    visitor.status = VisitorStatus.REJECTED;
    visitor.updatedAt = this.getNow();
    
    store.saveVisitor(visitor);
    this.createHistoryRecord(id, ApprovalAction.REJECT, operator, operatorRole, oldValues, visitor, reason);
    return visitor;
  }

  withdrawVisitor(id: string, operator: string, operatorRole: string, reason?: string): Visitor | null {
    const visitor = store.getVisitor(id);
    if (!visitor) return null;

    const oldValues = { ...visitor };
    visitor.status = VisitorStatus.WITHDRAWN;
    visitor.updatedAt = this.getNow();
    
    store.saveVisitor(visitor);
    this.createHistoryRecord(id, ApprovalAction.WITHDRAW, operator, operatorRole, oldValues, visitor, reason || '撤回申请');
    
    const activeAccesses = store.getActiveAccessControls(id);
    activeAccesses.forEach(ac => {
      store.revokeAccessControl(ac.id, '申请被撤回');
    });
    
    return visitor;
  }

  resubmitVisitor(id: string, operator: string, operatorRole: string, updates?: Partial<Visitor>): Visitor | null {
    const visitor = store.getVisitor(id);
    if (!visitor) return null;

    const oldValues = { ...visitor };
    const newValues: Partial<Visitor> = {
      ...updates,
      status: VisitorStatus.SUBMITTED,
      updatedAt: this.getNow()
    };
    
    Object.assign(visitor, newValues);
    store.saveVisitor(visitor);
    this.createHistoryRecord(id, ApprovalAction.RESUBMIT, operator, operatorRole, oldValues, visitor, '撤回后重新提交');
    return visitor;
  }

  modifyVisitor(id: string, operator: string, operatorRole: string, updates: Partial<Visitor>, comment?: string): Visitor | null {
    const visitor = store.getVisitor(id);
    if (!visitor) return null;

    const oldValues = { ...visitor };
    const newValues: Partial<Visitor> = {
      ...updates,
      updatedAt: this.getNow()
    };
    
    Object.assign(visitor, newValues);
    store.saveVisitor(visitor);
    this.createHistoryRecord(id, ApprovalAction.MODIFY, operator, operatorRole, oldValues, visitor, comment);
    return visitor;
  }

  changeVisitorFloor(id: string, newFloor: number, operator: string, operatorRole: string, reason: string, keepOldAccess: boolean = false): Visitor | null {
    const visitor = store.getVisitor(id);
    if (!visitor) return null;

    const oldValues = { ...visitor };
    const oldFloor = visitor.floor;
    visitor.floor = newFloor;
    visitor.updatedAt = this.getNow();
    
    store.saveVisitor(visitor);
    this.createHistoryRecord(id, ApprovalAction.CHANGE_FLOOR, operator, operatorRole, oldValues, visitor, reason);

    if (!keepOldAccess) {
      const activeAccesses = store.getActiveAccessControls(id);
      activeAccesses.forEach(ac => {
        if (ac.floor === oldFloor) {
          store.revokeAccessControl(ac.id, '楼层变更，原门禁撤销');
        }
      });
    }

    this.grantFloorAccess(id, newFloor, `楼层变更，授予新楼层门禁权限`);
    return visitor;
  }

  private grantFloorAccess(visitorId: string, floor: number, reason: string): AccessControl {
    const accessControl: AccessControl = {
      id: this.generateId(),
      visitorId,
      floor,
      isActive: true,
      grantedAt: this.getNow(),
      reason
    };
    store.saveAccessControl(accessControl);
    return accessControl;
  }

  addComment(id: string, operator: string, operatorRole: string, comment: string): Visitor | null {
    const visitor = store.getVisitor(id);
    if (!visitor) return null;

    const oldValues = { ...visitor };
    visitor.updatedAt = this.getNow();
    
    store.saveVisitor(visitor);
    this.createHistoryRecord(id, ApprovalAction.ADD_COMMENT, operator, operatorRole, oldValues, visitor, comment);
    return visitor;
  }

  getVisitorHistory(id: string): HistoryRecord[] {
    return store.getHistoryForVisitor(id);
  }

  getVisitorAccessControls(id: string): AccessControl[] {
    return store.getAccessControlsForVisitor(id);
  }

  exportVisitorData(id: string): { visitor: Visitor; history: HistoryRecord[]; accessControls: AccessControl[] } | null {
    const visitor = this.getVisitor(id);
    if (!visitor) return null;

    return {
      visitor,
      history: this.getVisitorHistory(id),
      accessControls: this.getVisitorAccessControls(id)
    };
  }
}

export const visitorService = new VisitorService();
