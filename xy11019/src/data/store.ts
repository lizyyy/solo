import { Child, Guardian, PickupAuthorization, BlacklistEntry } from '../models/types';

export class DataStore {
  private children: Map<string, Child> = new Map();
  private guardians: Map<string, Guardian> = new Map();
  private authorizations: Map<string, PickupAuthorization> = new Map();
  private blacklist: Map<string, BlacklistEntry> = new Map();

  getChildren(): Child[] {
    return Array.from(this.children.values());
  }

  getChildById(id: string): Child | undefined {
    return this.children.get(id);
  }

  addChild(child: Child): void {
    this.children.set(child.id, child);
  }

  updateChild(id: string, child: Partial<Child>): Child | undefined {
    const existing = this.children.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...child, updatedAt: new Date().toISOString() };
    this.children.set(id, updated);
    return updated;
  }

  getGuardians(): Guardian[] {
    return Array.from(this.guardians.values());
  }

  getGuardianById(id: string): Guardian | undefined {
    return this.guardians.get(id);
  }

  getGuardiansByBlacklistStatus(isBlacklisted: boolean): Guardian[] {
    return Array.from(this.guardians.values()).filter(g => g.isBlacklisted === isBlacklisted);
  }

  addGuardian(guardian: Guardian): void {
    this.guardians.set(guardian.id, guardian);
  }

  updateGuardian(id: string, guardian: Partial<Guardian>): Guardian | undefined {
    const existing = this.guardians.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...guardian, updatedAt: new Date().toISOString() };
    this.guardians.set(id, updated);
    return updated;
  }

  getAuthorizations(): PickupAuthorization[] {
    return Array.from(this.authorizations.values());
  }

  getAuthorizationById(id: string): PickupAuthorization | undefined {
    return this.authorizations.get(id);
  }

  getAuthorizationsByChildId(childId: string): PickupAuthorization[] {
    return Array.from(this.authorizations.values()).filter(a => a.childId === childId);
  }

  getAuthorizationsByGuardianId(guardianId: string): PickupAuthorization[] {
    return Array.from(this.authorizations.values()).filter(a => a.guardianId === guardianId);
  }

  addAuthorization(authorization: PickupAuthorization): void {
    this.authorizations.set(authorization.id, authorization);
  }

  updateAuthorization(id: string, authorization: Partial<PickupAuthorization>): PickupAuthorization | undefined {
    const existing = this.authorizations.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...authorization, updatedAt: new Date().toISOString() };
    this.authorizations.set(id, updated);
    return updated;
  }

  deleteAuthorization(id: string): boolean {
    return this.authorizations.delete(id);
  }

  getBlacklist(): BlacklistEntry[] {
    return Array.from(this.blacklist.values());
  }

  getBlacklistByGuardianId(guardianId: string): BlacklistEntry | undefined {
    return Array.from(this.blacklist.values()).find(b => b.guardianId === guardianId);
  }

  addBlacklistEntry(entry: BlacklistEntry): void {
    this.blacklist.set(entry.id, entry);
  }

  removeBlacklistEntry(id: string): boolean {
    return this.blacklist.delete(id);
  }

  clearAll(): void {
    this.children.clear();
    this.guardians.clear();
    this.authorizations.clear();
    this.blacklist.clear();
  }
}

export const dataStore = new DataStore();
