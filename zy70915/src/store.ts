import { Claim, AuditLog, CompensationReport } from "./types";

class DataStore {
  private claims: Map<string, Claim> = new Map();
  private auditLogs: Map<string, AuditLog[]> = new Map();
  private reports: Map<string, CompensationReport> = new Map();
  private duplicateIndex: Map<string, string> = new Map();

  generateDuplicateKey(claim: { baggage: { tagNumber: string; arrivalDate: Date }; passengerName: string }): string {
    const dateStr = new Date(claim.baggage.arrivalDate).toISOString().split("T")[0];
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

  addReport(report: CompensationReport): void {
    this.reports.set(report.id, report);
  }

  getReport(id: string): CompensationReport | undefined {
    return this.reports.get(id);
  }

  getReportByClaimId(claimId: string): CompensationReport | undefined {
    return Array.from(this.reports.values()).find(r => r.claimId === claimId);
  }

  getAllReports(): CompensationReport[] {
    return Array.from(this.reports.values());
  }

  updateReport(id: string, updates: Partial<CompensationReport>): CompensationReport | undefined {
    const report = this.reports.get(id);
    if (!report) return undefined;
    const updated = { ...report, ...updates };
    this.reports.set(id, updated);
    return updated;
  }
}

export const store = new DataStore();
