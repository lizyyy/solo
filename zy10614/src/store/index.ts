import { v4 as uuidv4 } from 'uuid';
import {
  Candidate,
  CandidateStatus,
  ImportRecord,
  MergeHistory,
  SourceChannel
} from '../types';

class DataStore {
  private candidates: Map<string, Candidate> = new Map();
  private importRecords: Map<string, ImportRecord> = new Map();
  private mergeHistories: Map<string, MergeHistory> = new Map();

  addCandidate(candidate: Omit<Candidate, 'id' | 'createdAt' | 'updatedAt'>): Candidate {
    const now = new Date();
    const newCandidate: Candidate = {
      ...candidate,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    this.candidates.set(newCandidate.id, newCandidate);
    return newCandidate;
  }

  getCandidate(id: string): Candidate | undefined {
    return this.candidates.get(id);
  }

  updateCandidate(id: string, updates: Partial<Candidate>): Candidate | undefined {
    const candidate = this.candidates.get(id);
    if (!candidate) return undefined;
    
    const updated: Candidate = {
      ...candidate,
      ...updates,
      updatedAt: new Date()
    };
    this.candidates.set(id, updated);
    return updated;
  }

  deleteCandidate(id: string): boolean {
    return this.candidates.delete(id);
  }

  findByPhoneOrEmail(phone: string, email: string): Candidate[] {
    const results: Candidate[] = [];
    for (const candidate of this.candidates.values()) {
      if (candidate.phone === phone || candidate.email === email) {
        results.push(candidate);
      }
    }
    return results;
  }

  getAllCandidates(): Candidate[] {
    return Array.from(this.candidates.values());
  }

  addImportRecord(record: Omit<ImportRecord, 'id' | 'createdAt'>): ImportRecord {
    const newRecord: ImportRecord = {
      ...record,
      id: uuidv4(),
      createdAt: new Date()
    };
    this.importRecords.set(newRecord.id, newRecord);
    return newRecord;
  }

  getImportRecord(id: string): ImportRecord | undefined {
    return this.importRecords.get(id);
  }

  updateImportRecord(id: string, updates: Partial<ImportRecord>): ImportRecord | undefined {
    const record = this.importRecords.get(id);
    if (!record) return undefined;
    
    const updated: ImportRecord = {
      ...record,
      ...updates
    };
    this.importRecords.set(id, updated);
    return updated;
  }

  getAllImportRecords(): ImportRecord[] {
    return Array.from(this.importRecords.values());
  }

  addMergeHistory(history: Omit<MergeHistory, 'id' | 'createdAt'>): MergeHistory {
    const newHistory: MergeHistory = {
      ...history,
      id: uuidv4(),
      createdAt: new Date()
    };
    this.mergeHistories.set(newHistory.id, newHistory);
    return newHistory;
  }

  getMergeHistoriesByCandidate(candidateId: string): MergeHistory[] {
    const results: MergeHistory[] = [];
    for (const history of this.mergeHistories.values()) {
      if (history.candidateId === candidateId || history.targetCandidateId === candidateId) {
        results.push(history);
      }
    }
    return results.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getAllMergeHistories(): MergeHistory[] {
    return Array.from(this.mergeHistories.values())
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  clearAll(): void {
    this.candidates.clear();
    this.importRecords.clear();
    this.mergeHistories.clear();
  }
}

export const store = new DataStore();
