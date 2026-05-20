import { Mentor, Application, TransferRecord } from '../types';
import { v4 as uuidv4 } from 'uuid';

export class DataStore {
  private mentors: Map<string, Mentor> = new Map();
  private applications: Map<string, Application> = new Map();
  private transfers: Map<string, TransferRecord> = new Map();
  private processedBatches: Set<string> = new Set();
  private studentApplications: Map<string, Set<string>> = new Map();

  addMentor(mentor: Mentor): void {
    this.mentors.set(mentor.id, mentor);
  }

  getMentor(id: string): Mentor | undefined {
    return this.mentors.get(id);
  }

  getAllMentors(): Mentor[] {
    return Array.from(this.mentors.values());
  }

  updateMentorQuota(mentorId: string, usedQuota: number): void {
    const mentor = this.mentors.get(mentorId);
    if (mentor) {
      mentor.usedQuota = usedQuota;
    }
  }

  addApplication(app: Application): void {
    this.applications.set(app.id, app);
    const studentApps = this.studentApplications.get(app.studentId) || new Set();
    studentApps.add(app.id);
    this.studentApplications.set(app.studentId, studentApps);
  }

  getApplication(id: string): Application | undefined {
    return this.applications.get(id);
  }

  getApplicationsByStudent(studentId: string): Application[] {
    const appIds = this.studentApplications.get(studentId) || new Set();
    return Array.from(appIds).map(id => this.applications.get(id)!).filter(Boolean);
  }

  getAllApplications(): Application[] {
    return Array.from(this.applications.values());
  }

  addTransfer(transfer: TransferRecord): void {
    this.transfers.set(transfer.id, transfer);
  }

  getTransfer(id: string): TransferRecord | undefined {
    return this.transfers.get(id);
  }

  getAllTransfers(): TransferRecord[] {
    return Array.from(this.transfers.values());
  }

  markBatchProcessed(batchId: string): void {
    this.processedBatches.add(batchId);
  }

  isBatchProcessed(batchId: string): boolean {
    return this.processedBatches.has(batchId);
  }

  reset(): void {
    this.mentors.clear();
    this.applications.clear();
    this.transfers.clear();
    this.processedBatches.clear();
    this.studentApplications.clear();
  }

  generateId(): string {
    return uuidv4();
  }
}

export const dataStore = new DataStore();
