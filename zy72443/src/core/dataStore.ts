import { TicketExport, AudioFileRemark, LessonVerification, AnomalyRecord } from '../models';

class DataStore {
  private tickets: Map<string, TicketExport> = new Map();
  private audioRemarks: Map<string, AudioFileRemark> = new Map();
  private verifications: Map<string, LessonVerification> = new Map();
  private anomalies: Map<string, AnomalyRecord> = new Map();

  addTicket(ticket: TicketExport): void {
    this.tickets.set(ticket.ticketId, ticket);
  }

  getTicket(ticketId: string): TicketExport | undefined {
    return this.tickets.get(ticketId);
  }

  getAllTickets(): TicketExport[] {
    return Array.from(this.tickets.values());
  }

  addAudioRemark(remark: AudioFileRemark): void {
    this.audioRemarks.set(remark.audioFileId, remark);
  }

  getAudioRemark(audioFileId: string): AudioFileRemark | undefined {
    return this.audioRemarks.get(audioFileId);
  }

  getAudioRemarkByTicket(ticketId: string): AudioFileRemark | undefined {
    return Array.from(this.audioRemarks.values()).find(r => r.ticketId === ticketId);
  }

  getAllAudioRemarks(): AudioFileRemark[] {
    return Array.from(this.audioRemarks.values());
  }

  addVerification(verification: LessonVerification): void {
    this.verifications.set(verification.verificationNo, verification);
  }

  getVerification(verificationNo: string): LessonVerification | undefined {
    return this.verifications.get(verificationNo);
  }

  getVerificationByTicket(ticketId: string): LessonVerification | undefined {
    return Array.from(this.verifications.values()).find(v => v.ticketId === ticketId);
  }

  getAllVerifications(): LessonVerification[] {
    return Array.from(this.verifications.values());
  }

  updateVerification(verificationNo: string, updates: Partial<LessonVerification>): LessonVerification | undefined {
    const existing = this.verifications.get(verificationNo);
    if (existing) {
      const updated = { ...existing, ...updates, updatedAt: new Date().toISOString() };
      this.verifications.set(verificationNo, updated);
      return updated;
    }
    return undefined;
  }

  addAnomaly(anomaly: AnomalyRecord): void {
    this.anomalies.set(anomaly.id, anomaly);
  }

  getAnomaly(id: string): AnomalyRecord | undefined {
    return this.anomalies.get(id);
  }

  getAnomaliesByTicket(ticketId: string): AnomalyRecord[] {
    return Array.from(this.anomalies.values()).filter(a => a.ticketId === ticketId);
  }

  getUnresolvedAnomalies(): AnomalyRecord[] {
    return Array.from(this.anomalies.values()).filter(a => !a.resolved);
  }

  getAllAnomalies(): AnomalyRecord[] {
    return Array.from(this.anomalies.values());
  }

  resolveAnomaly(id: string, resolvedBy: string, notes: string): AnomalyRecord | undefined {
    const anomaly = this.anomalies.get(id);
    if (anomaly) {
      const updated = {
        ...anomaly,
        resolved: true,
        resolvedAt: new Date().toISOString(),
        resolvedBy,
        resolutionNotes: notes
      };
      this.anomalies.set(id, updated);
      return updated;
    }
    return undefined;
  }

  clear(): void {
    this.tickets.clear();
    this.audioRemarks.clear();
    this.verifications.clear();
    this.anomalies.clear();
  }
}

export const dataStore = new DataStore();
