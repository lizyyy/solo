import { Claim, AuditLog } from './types';

class DataStore {
  private claims: Map<string, Claim> = new Map();
  private auditLogs: Map<string, AuditLog[]> = new Map();
  private duplicateIndex: Map<string, string> = new Map();

  generateDuplicateKey(claim: { baggage: { tagNumber: string; arrivalDate: Date }; passengerName: string }): string {
    const dateStr = new Date(claim.baggage.arrivalDate).toISOString().split('T')[0];
    return `${claim.baggage.tagNumber}-${dateStr}-${claim.passengerName}`;
  }

  addClaim(claim: Claim): void {
    this.claims.set(claim.id, claim);
    const key = this.generateDuplicateKey(claim);
    this.duplicateIndex.set(key, claim.id);
    this.auditLogs.set(claim.id, []);
  }

  getClaim(id: string): Claim | undefined {
    return this.claims.get(id);
  }

  findDuplicate(claimInput: { baggage: { tagNumber: string; arrivalDate: Date }; passengerName: string }): Claim | undefined {
    const key = this.generateDuplicateKey(claimInput);
    const claimId = this.duplicateIndex.get(key);
    return claimId ? this.claims.get(claimId) : undefined;
  }

  getAllClaims(): Claim[] {
    return Array.from(this.claims.values());
  }

  updateClaim(id: string, updates: Partial<Claim>): Claim | undefined {
    const claim = this.claims.get(id);
    if (!claim) return undefined;
    
    const updated = { ...claim, ...updates, updateTime: new Date() };
    this.claims.set(id, updated);
    return updated;
  }

  addAuditLog(log: AuditLog): void {
    const logs = this.auditLogs.get(log.claimId) || [];
    logs.push(log);
    this.auditLogs.set(log.claimId, logs);
  }

  getAuditLogs(claimId: string): AuditLog[] {
    return this.auditLogs.get(claimId) || [];
  }
}

export const store = new DataStore();
