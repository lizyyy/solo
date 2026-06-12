import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  ReconciliationState,
  GroupSignupRecord,
  ContractRecord,
  ReconciliationResult,
  OperationLog,
  ImportBatch,
  RecordStatus,
  DataSource
} from '../types';

const DEFAULT_DATA_FILE = path.join(process.cwd(), 'data', 'reconciliation-state.json');

export class ReconciliationStore {
  private state: ReconciliationState;
  private dataFile: string;

  constructor(dataFile?: string) {
    this.dataFile = dataFile || DEFAULT_DATA_FILE;
    this.state = this.loadState();
  }

  private loadState(): ReconciliationState {
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (fs.existsSync(this.dataFile)) {
      try {
        const content = fs.readFileSync(this.dataFile, 'utf-8');
        return JSON.parse(content);
      } catch (e) {
        console.warn('状态文件损坏，使用空状态初始化');
      }
    }

    return {
      groupRecords: [],
      contractRecords: [],
      results: [],
      logs: [],
      batches: [],
      lastUpdated: new Date().toISOString()
    };
  }

  private saveState(): void {
    this.state.lastUpdated = new Date().toISOString();
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.dataFile, JSON.stringify(this.state, null, 2), 'utf-8');
  }

  private logOperation(
    operationType: string,
    entityType: string,
    entityId: string | undefined,
    operator: string,
    oldState?: any,
    newState?: any,
    batchId?: string,
    notes?: string
  ): void {
    const deepClone = (obj: any): any => {
      if (obj === undefined) return undefined;
      try {
        return JSON.parse(JSON.stringify(obj));
      } catch (e) {
        return String(obj);
      }
    };

    const log: OperationLog = {
      id: uuidv4(),
      operationType,
      entityType,
      entityId,
      oldState: deepClone(oldState),
      newState: deepClone(newState),
      operator,
      timestamp: new Date().toISOString(),
      batchId,
      notes
    };
    this.state.logs.push(log);
  }

  getState(): Readonly<ReconciliationState> {
    return this.state;
  }

  addGroupRecords(
    records: Omit<GroupSignupRecord, 'id' | 'importedAt' | 'status' | 'manualEdits'>[],
    batchId: string,
    operator: string
  ): GroupSignupRecord[] {
    const newRecords: GroupSignupRecord[] = records.map((r) => ({
      ...r,
      id: uuidv4(),
      importedAt: new Date().toISOString(),
      status: RecordStatus.IMPORTED,
      manualEdits: []
    }));

    this.state.groupRecords.push(...newRecords);
    const batch = this.state.batches.find((b) => b.id === batchId);
    if (batch) batch.recordCount = newRecords.length;
    this.logOperation('BULK_IMPORT', 'GroupSignupRecord', undefined, operator, undefined, { count: newRecords.length }, batchId);
    this.saveState();
    return newRecords;
  }

  addContractRecords(
    records: Omit<ContractRecord, 'id' | 'importedAt' | 'status' | 'manualEdits'>[],
    batchId: string,
    operator: string
  ): ContractRecord[] {
    const newRecords: ContractRecord[] = records.map((r) => ({
      ...r,
      id: uuidv4(),
      importedAt: new Date().toISOString(),
      status: RecordStatus.IMPORTED,
      manualEdits: []
    }));

    this.state.contractRecords.push(...newRecords);
    const cbatch = this.state.batches.find((b) => b.id === batchId);
    if (cbatch) cbatch.recordCount = newRecords.length;
    this.logOperation('BULK_IMPORT', 'ContractRecord', undefined, operator, undefined, { count: newRecords.length }, batchId);
    this.saveState();
    return newRecords;
  }

  addBatch(batch: Omit<ImportBatch, 'id' | 'importedAt'>): ImportBatch {
    const newBatch: ImportBatch = {
      ...batch,
      id: uuidv4(),
      importedAt: new Date().toISOString()
    };
    this.state.batches.push(newBatch);
    this.logOperation('CREATE_BATCH', 'ImportBatch', newBatch.id, batch.operator, undefined, newBatch);
    this.saveState();
    return newBatch;
  }

  addResult(result: Omit<ReconciliationResult, 'id' | 'createdAt' | 'updatedAt'>, operator: string): ReconciliationResult {
    const now = new Date().toISOString();
    const newResult: ReconciliationResult = {
      ...result,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    this.state.results.push(newResult);
    this.logOperation('CREATE_RESULT', 'ReconciliationResult', newResult.id, operator, undefined, newResult);
    this.saveState();
    return newResult;
  }

  updateResult(resultId: string, updates: Partial<ReconciliationResult>, operator: string, notes?: string): ReconciliationResult | undefined {
    const idx = this.state.results.findIndex((r) => r.id === resultId);
    if (idx === -1) return undefined;

    const oldState = { ...this.state.results[idx] };
    this.state.results[idx] = {
      ...this.state.results[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.logOperation('UPDATE_RESULT', 'ReconciliationResult', resultId, operator, oldState, this.state.results[idx], undefined, notes);
    this.saveState();
    return this.state.results[idx];
  }

  updateGroupRecord(recordId: string, updates: Partial<GroupSignupRecord>, operator: string, editReason?: string): GroupSignupRecord | undefined {
    const idx = this.state.groupRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) return undefined;

    const oldState = { ...this.state.groupRecords[idx] };
    const now = new Date().toISOString();

    const manualEdits = Object.entries(updates)
      .filter(([key]) => key !== 'status' && key !== 'manualEdits')
      .map(([fieldName, newValue]) => ({
        id: uuidv4(),
        fieldName,
        oldValue: String((oldState as any)[fieldName] || ''),
        newValue: String(newValue || ''),
        editedBy: operator,
        editedAt: now,
        reason: editReason
      }));

    this.state.groupRecords[idx] = {
      ...this.state.groupRecords[idx],
      ...updates,
      manualEdits: [...this.state.groupRecords[idx].manualEdits, ...manualEdits]
    };

    this.logOperation('UPDATE_GROUP_RECORD', 'GroupSignupRecord', recordId, operator, oldState, this.state.groupRecords[idx]);
    this.saveState();
    return this.state.groupRecords[idx];
  }

  updateContractRecord(recordId: string, updates: Partial<ContractRecord>, operator: string, editReason?: string): ContractRecord | undefined {
    const idx = this.state.contractRecords.findIndex((r) => r.id === recordId);
    if (idx === -1) return undefined;

    const oldState = { ...this.state.contractRecords[idx] };
    const now = new Date().toISOString();

    const manualEdits = Object.entries(updates)
      .filter(([key]) => key !== 'status' && key !== 'manualEdits')
      .map(([fieldName, newValue]) => ({
        id: uuidv4(),
        fieldName,
        oldValue: String((oldState as any)[fieldName] || ''),
        newValue: String(newValue || ''),
        editedBy: operator,
        editedAt: now,
        reason: editReason
      }));

    this.state.contractRecords[idx] = {
      ...this.state.contractRecords[idx],
      ...updates,
      manualEdits: [...this.state.contractRecords[idx].manualEdits, ...manualEdits]
    };

    this.logOperation('UPDATE_CONTRACT_RECORD', 'ContractRecord', recordId, operator, oldState, this.state.contractRecords[idx]);
    this.saveState();
    return this.state.contractRecords[idx];
  }

  findGroupRecordByRowAndBatch(rowNumber: number, batchId: string): GroupSignupRecord | undefined {
    return this.state.groupRecords.find(
      (r) => r.originalRowNumber === rowNumber && r.importBatchId === batchId
    );
  }

  getResultsWithDetails(options: { includeSuperseded?: boolean } = {}): Array<{
    result: ReconciliationResult;
    groupRecord?: GroupSignupRecord;
    contractRecord?: ContractRecord;
  }> {
    const { includeSuperseded = false } = options;
    const activeResults = includeSuperseded
      ? this.state.results
      : this.state.results.filter((r) => r.status !== RecordStatus.SUPERSEDED);

    return activeResults.map((result) => ({
      result,
      groupRecord: this.state.groupRecords.find((g) => g.id === result.groupRecordId),
      contractRecord: this.state.contractRecords.find((c) => c.id === result.contractRecordId)
    }));
  }

  getLogsForEntity(entityId: string): OperationLog[] {
    return this.state.logs.filter((l) => l.entityId === entityId).sort((a, b) => a.timestamp.localeCompare(b.timestamp));
  }

  exportState(): ReconciliationState {
    return JSON.parse(JSON.stringify(this.state));
  }

  resetState(operator: string): void {
    const oldState = { ...this.state };
    this.state = {
      groupRecords: [],
      contractRecords: [],
      results: [],
      logs: [],
      batches: [],
      lastUpdated: new Date().toISOString()
    };
    this.logOperation('RESET_STATE', 'ReconciliationState', undefined, operator, oldState, this.state);
    this.saveState();
  }

  rollbackBatch(batchId: string, operator: string, reason?: string): {
    affectedGroupRecords: number;
    affectedContractRecords: number;
    affectedResults: number;
  } {
    const batch = this.state.batches.find((b) => b.id === batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }

    let affectedGroupRecords = 0;
    let affectedContractRecords = 0;
    let affectedResults = 0;

    const groupRecordIds = new Set<string>();
    const contractRecordIds = new Set<string>();

    for (let i = 0; i < this.state.groupRecords.length; i++) {
      if (this.state.groupRecords[i].importBatchId === batchId && this.state.groupRecords[i].status !== RecordStatus.SUPERSEDED) {
        const oldState = { ...this.state.groupRecords[i] };
        this.state.groupRecords[i] = {
          ...this.state.groupRecords[i],
          status: RecordStatus.SUPERSEDED
        };
        groupRecordIds.add(this.state.groupRecords[i].id);
        this.logOperation(
          'ROLLBACK_BATCH',
          'GroupSignupRecord',
          this.state.groupRecords[i].id,
          operator,
          oldState,
          this.state.groupRecords[i],
          batchId,
          reason
        );
        affectedGroupRecords++;
      }
    }

    for (let i = 0; i < this.state.contractRecords.length; i++) {
      if (this.state.contractRecords[i].importBatchId === batchId && this.state.contractRecords[i].status !== RecordStatus.SUPERSEDED) {
        const oldState = { ...this.state.contractRecords[i] };
        this.state.contractRecords[i] = {
          ...this.state.contractRecords[i],
          status: RecordStatus.SUPERSEDED
        };
        contractRecordIds.add(this.state.contractRecords[i].id);
        this.logOperation(
          'ROLLBACK_BATCH',
          'ContractRecord',
          this.state.contractRecords[i].id,
          operator,
          oldState,
          this.state.contractRecords[i],
          batchId,
          reason
        );
        affectedContractRecords++;
      }
    }

    for (let i = 0; i < this.state.results.length; i++) {
      const r = this.state.results[i];
      const affectsThis =
        (r.groupRecordId && groupRecordIds.has(r.groupRecordId)) ||
        (r.contractRecordId && contractRecordIds.has(r.contractRecordId));

      if (affectsThis && r.status !== RecordStatus.SUPERSEDED) {
        const oldState = { ...r };
        this.state.results[i] = {
          ...r,
          status: RecordStatus.SUPERSEDED,
          updatedAt: new Date().toISOString()
        };
        this.logOperation(
          'ROLLBACK_BATCH',
          'ReconciliationResult',
          r.id,
          operator,
          oldState,
          this.state.results[i],
          batchId,
          reason
        );
        affectedResults++;
      }
    }

    const oldBatch = { ...batch };
    const batchIdx = this.state.batches.findIndex((b) => b.id === batchId);
    if (batchIdx !== -1) {
      (this.state.batches[batchIdx] as any).status = 'superseded';
    }
    this.logOperation(
      'ROLLBACK_BATCH',
      'ImportBatch',
      batchId,
      operator,
      oldBatch,
      { ...batch, status: 'superseded' },
      batchId,
      reason
    );

    this.saveState();
    return { affectedGroupRecords, affectedContractRecords, affectedResults };
  }
}

export const defaultStore = new ReconciliationStore();
