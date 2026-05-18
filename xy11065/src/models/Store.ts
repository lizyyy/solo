import { Visitor, HistoryRecord, AccessControl } from '../types';

export class DataStore {
  private visitors: Map<string, Visitor> = new Map();
  private history: Map<string, HistoryRecord> = new Map();
  private accessControls: Map<string, AccessControl> = new Map();
  private visitorHistoryIndex: Map<string, string[]> = new Map();

  saveVisitor(visitor: Visitor): void {
    this.visitors.set(visitor.id, visitor);
  }

  getVisitor(id: string): Visitor | undefined {
    return this.visitors.get(id);
  }

  getAllVisitors(): Visitor[] {
    return Array.from(this.visitors.values()).sort((a, b) => 
      new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  deleteVisitor(id: string): boolean {
    return this.visitors.delete(id);
  }

  saveHistory(record: HistoryRecord): void {
    this.history.set(record.id, record);
    const historyList = this.visitorHistoryIndex.get(record.visitorId) || [];
    historyList.push(record.id);
    this.visitorHistoryIndex.set(record.visitorId, historyList);
  }

  getHistoryForVisitor(visitorId: string): HistoryRecord[] {
    const historyIds = this.visitorHistoryIndex.get(visitorId) || [];
    return historyIds
      .map(id => this.history.get(id))
      .filter((r): r is HistoryRecord => r !== undefined)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  saveAccessControl(accessControl: AccessControl): void {
    this.accessControls.set(accessControl.id, accessControl);
  }

  getAccessControlsForVisitor(visitorId: string): AccessControl[] {
    return Array.from(this.accessControls.values())
      .filter(ac => ac.visitorId === visitorId)
      .sort((a, b) => new Date(b.grantedAt).getTime() - new Date(a.grantedAt).getTime());
  }

  getActiveAccessControls(visitorId: string): AccessControl[] {
    return this.getAccessControlsForVisitor(visitorId).filter(ac => ac.isActive);
  }

  revokeAccessControl(id: string, reason: string): boolean {
    const ac = this.accessControls.get(id);
    if (!ac) return false;
    ac.isActive = false;
    ac.revokedAt = new Date().toISOString();
    ac.reason = reason;
    return true;
  }

  clear(): void {
    this.visitors.clear();
    this.history.clear();
    this.accessControls.clear();
    this.visitorHistoryIndex.clear();
  }
}

export const store = new DataStore();
