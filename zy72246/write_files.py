import os

base = os.path.dirname(os.path.abspath(__file__))

files = {}

files['src/types/index.ts'] = r"""export enum ProcessingStatus {
  PENDING = 'PENDING',
  REVERSAL_PENDING_REVIEW = 'REVERSAL_PENDING_REVIEW',
  NORMAL = 'NORMAL',
  REJECTED = 'REJECTED',
  SUPPLEMENT_COMPLETED = 'SUPPLEMENT_COMPLETED',
  BALANCE_UPDATED = 'BALANCE_UPDATED',
  PENDING_APPROVAL = 'PENDING_APPROVAL',
  COMPLETED = 'COMPLETED',
}

export enum ProcessStep {
  STEP_1_IMPORT = 'STEP_1_IMPORT',
  STEP_2_SUPPLEMENT = 'STEP_2_SUPPLEMENT',
  STEP_3_BALANCE = 'STEP_3_BALANCE',
  STEP_4_SUMMARY = 'STEP_4_SUMMARY',
}

export enum DuplicateAction {
  CONFIRM_UPDATE = 'CONFIRM_UPDATE',
  SKIP = 'SKIP',
  MERGE = 'MERGE',
}

export interface TaxNote {
  id: string;
  originalLineNumber: string;
  tradeDate: string;
  stockCode: string;
  stockName: string;
  serialNumber: string;
  originalAmount: number;
  currentAmount: number;
  originalRemark: string;
  currentRemark: string;
  counterTailNumber: string;
  summary: string;
  processingStatus: ProcessingStatus;
  currentStep: ProcessStep;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  holidayRemark?: string;
}

export interface TaxNoteVersion {
  id: string;
  taxNoteId: string;
  versionNumber: number;
  fieldName: string;
  oldValue: string;
  newValue: string;
  changedBy: string;
  changedAt: string;
  changeReason: string;
}

export interface StatusHistory {
  id: string;
  taxNoteId: string;
  fromStatus: ProcessingStatus | null;
  toStatus: ProcessingStatus;
  operatedBy: string;
  operatedAt: string;
  remark: string;
}

export interface ReviewRecord {
  id: string;
  taxNoteId: string;
  reviewResult: 'APPROVED' | 'REJECTED';
  reviewOpinion: string;
  reviewedBy: string;
  reviewedAt: string;
  isReversed: boolean;
  reversedBy?: string;
  reversedAt?: string;
}

export interface BalanceChangeRecord {
  id: string;
  taxNoteId: string;
  previousBalance: number;
  changeAmount: number;
  newBalance: number;
  changeType: 'TAX' | 'ADJUSTMENT' | 'REVERSAL' | 'HOLIDAY';
  changeDate: string;
  remark: string;
  generatedBy: string;
  generatedAt: string;
  version: number;
}

export interface DuplicateResolution {
  rowIndex: number;
  recordId: string;
  action: DuplicateAction;
  mergeRemark?: string;
}

export interface BoundaryRule {
  id: string;
  name: string;
  description: string;
  condition: string;
  action: string;
  rollbackMethod: string;
  codeReference: string;
  status: 'ACTIVE' | 'DEPRECATED';
}

export interface ImportResult {
  totalRecords: number;
  newRecords: number;
  updatedRecords: number;
  skippedRecords: number;
  errorRecords: number;
  reversalPendingRecords: number;
  duplicateRecords: number;
  details: ImportDetail[];
}

export interface ImportDetail {
  lineNumber: string;
  action: 'NEW' | 'UPDATE' | 'SKIP' | 'ERROR' | 'DUPLICATE';
  reason: string;
  recordId?: string;
  existingRecord?: TaxNote;
  newRowData?: ImportRowData;
}

export interface ImportRowData {
  lineNumber: string;
  tradeDate: string;
  stockCode: string;
  stockName: string;
  serialNumber: string;
  amount: number;
  remark: string;
  counterTailNumber: string;
}

export interface AppState {
  taxNotes: TaxNote[];
  versions: TaxNoteVersion[];
  statusHistories: StatusHistory[];
  reviewRecords: ReviewRecord[];
  balanceChanges: BalanceChangeRecord[];
  currentUser: string;
  filter: {
    status?: ProcessingStatus;
    step?: ProcessStep;
    keyword?: string;
  };
}

export type ActionType =
  | { type: 'IMPORT_DATA'; payload: { taxNotes: TaxNote[]; versions: TaxNoteVersion[]; statusHistories: StatusHistory[] } }
  | { type: 'UPDATE_TAX_NOTE'; payload: { id: string; updates: Partial<TaxNote>; reason: string } }
  | { type: 'CHANGE_STATUS'; payload: { id: string; toStatus: ProcessingStatus; remark: string } }
  | { type: 'REVIEW_RECORD'; payload: { id: string; result: 'APPROVED' | 'REJECTED'; opinion: string } }
  | { type: 'ROLLBACK_STATUS'; payload: { id: string; reason: string } }
  | { type: 'GENERATE_BALANCE_CHANGE'; payload: { balanceChange: BalanceChangeRecord; taxNoteUpdates?: { id: string; updates: Partial<TaxNote>; reason: string } } }
  | { type: 'SET_FILTER'; payload: Partial<AppState['filter']> }
  | { type: 'LOAD_STATE'; payload: Partial<AppState> };
"""

files['src/utils/stateMachine.ts'] = """import { ProcessingStatus, ProcessStep } from '@/types';

export const STATUS_TRANSITIONS: Record<ProcessingStatus, ProcessingStatus[]> = {
  [ProcessingStatus.PENDING]: [
    ProcessingStatus.SUPPLEMENT_COMPLETED,
    ProcessingStatus.REJECTED,
  ],
  [ProcessingStatus.REVERSAL_PENDING_REVIEW]: [
    ProcessingStatus.NORMAL,
    ProcessingStatus.REJECTED,
  ],
  [ProcessingStatus.NORMAL]: [
    ProcessingStatus.SUPPLEMENT_COMPLETED,
    ProcessingStatus.REJECTED,
  ],
  [ProcessingStatus.REJECTED]: [
    ProcessingStatus.PENDING,
    ProcessingStatus.NORMAL,
  ],
  [ProcessingStatus.SUPPLEMENT_COMPLETED]: [
    ProcessingStatus.BALANCE_UPDATED,
    ProcessingStatus.PENDING_APPROVAL,
    ProcessingStatus.REJECTED,
    ProcessingStatus.PENDING,
  ],
  [ProcessingStatus.BALANCE_UPDATED]: [
    ProcessingStatus.PENDING_APPROVAL,
    ProcessingStatus.REJECTED,
    ProcessingStatus.SUPPLEMENT_COMPLETED,
  ],
  [ProcessingStatus.PENDING_APPROVAL]: [
    ProcessingStatus.COMPLETED,
    ProcessingStatus.REJECTED,
    ProcessingStatus.BALANCE_UPDATED,
    ProcessingStatus.SUPPLEMENT_COMPLETED,
  ],
  [ProcessingStatus.COMPLETED]: [
    ProcessingStatus.PENDING_APPROVAL,
    ProcessingStatus.BALANCE_UPDATED,
  ],
};

export const STEP_TRANSITIONS: Record<ProcessStep, ProcessStep[]> = {
  [ProcessStep.STEP_1_IMPORT]: [
    ProcessStep.STEP_2_SUPPLEMENT,
  ],
  [ProcessStep.STEP_2_SUPPLEMENT]: [
    ProcessStep.STEP_3_BALANCE,
    ProcessStep.STEP_1_IMPORT,
  ],
  [ProcessStep.STEP_3_BALANCE]: [
    ProcessStep.STEP_4_SUMMARY,
    ProcessStep.STEP_2_SUPPLEMENT,
  ],
  [ProcessStep.STEP_4_SUMMARY]: [
    ProcessStep.STEP_3_BALANCE,
    ProcessStep.STEP_2_SUPPLEMENT,
  ],
};

export function canTransitionStatus(
  fromStatus: ProcessingStatus,
  toStatus: ProcessingStatus
): boolean {
  const allowedTransitions = STATUS_TRANSITIONS[fromStatus];
  if (!allowedTransitions) return false;
  return allowedTransitions.includes(toStatus);
}

export function canTransitionStep(
  fromStep: ProcessStep,
  toStep: ProcessStep
): boolean {
  const allowedTransitions = STEP_TRANSITIONS[fromStep];
  if (!allowedTransitions) return false;
  return allowedTransitions.includes(toStep);
}

export function getNextAllowedStatuses(currentStatus: ProcessingStatus): ProcessingStatus[] {
  return STATUS_TRANSITIONS[currentStatus] || [];
}

export function getNextAllowedSteps(currentStep: ProcessStep): ProcessStep[] {
  return STEP_TRANSITIONS[currentStep] || [];
}

export function getStatusDisplayName(status: ProcessingStatus): string {
  const displayNames: Record<ProcessingStatus, string> = {
    [ProcessingStatus.PENDING]: '\u5f85\u5904\u7406',
    [ProcessingStatus.REVERSAL_PENDING_REVIEW]: '\u5df2\u51b2\u6b63\u5f85\u590d\u6838',
    [ProcessingStatus.NORMAL]: '\u6b63\u5e38',
    [ProcessingStatus.REJECTED]: '\u5df2\u9a73\u56de',
    [ProcessingStatus.SUPPLEMENT_COMPLETED]: '\u8865\u770b\u5b8c\u6210',
    [ProcessingStatus.BALANCE_UPDATED]: '\u4f59\u989d\u5df2\u66f4\u65b0',
    [ProcessingStatus.PENDING_APPROVAL]: '\u5f85\u8d1f\u8d23\u4eba\u5ba1\u9605',
    [ProcessingStatus.COMPLETED]: '\u5df2\u5b8c\u6210',
  };
  return displayNames[status] || status;
}

export function getStepDisplayName(step: ProcessStep): string {
  const displayNames: Record<ProcessStep, string> = {
    [ProcessStep.STEP_1_IMPORT]: '\u7b2c\u4e00\u6b65\uff1a\u5bfc\u5165',
    [ProcessStep.STEP_2_SUPPLEMENT]: '\u7b2c\u4e8c\u6b65\uff1a\u8865\u770b\u6d41\u6c34',
    [ProcessStep.STEP_3_BALANCE]: '\u7b2c\u4e09\u6b65\uff1a\u4f59\u989d\u66f4\u65b0',
    [ProcessStep.STEP_4_SUMMARY]: '\u7b2c\u56db\u6b65\uff1a\u6458\u8981\u66f4\u65b0',
  };
  return displayNames[step] || step;
}

export function getStatusColor(status: ProcessingStatus): string {
  const colors: Record<ProcessingStatus, string> = {
    [ProcessingStatus.PENDING]: 'bg-gray-100 text-gray-800 border-gray-300',
    [ProcessingStatus.REVERSAL_PENDING_REVIEW]: 'bg-orange-100 text-orange-800 border-orange-400',
    [ProcessingStatus.NORMAL]: 'bg-green-100 text-green-800 border-green-300',
    [ProcessingStatus.REJECTED]: 'bg-red-100 text-red-800 border-red-300',
    [ProcessingStatus.SUPPLEMENT_COMPLETED]: 'bg-blue-100 text-blue-800 border-blue-300',
    [ProcessingStatus.BALANCE_UPDATED]: 'bg-indigo-100 text-indigo-800 border-indigo-300',
    [ProcessingStatus.PENDING_APPROVAL]: 'bg-purple-100 text-purple-800 border-purple-300',
    [ProcessingStatus.COMPLETED]: 'bg-emerald-100 text-emerald-800 border-emerald-300',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusTextColor(status: ProcessingStatus): string {
  const colors: Record<ProcessingStatus, string> = {
    [ProcessingStatus.PENDING]: 'text-gray-600',
    [ProcessingStatus.REVERSAL_PENDING_REVIEW]: 'text-orange-600',
    [ProcessingStatus.NORMAL]: 'text-green-600',
    [ProcessingStatus.REJECTED]: 'text-red-600',
    [ProcessingStatus.SUPPLEMENT_COMPLETED]: 'text-blue-600',
    [ProcessingStatus.BALANCE_UPDATED]: 'text-indigo-600',
    [ProcessingStatus.PENDING_APPROVAL]: 'text-purple-600',
    [ProcessingStatus.COMPLETED]: 'text-emerald-600',
  };
  return colors[status] || 'text-gray-600';
}
"""

files['src/utils/deduplication.ts'] = """import { TaxNote, ImportRowData, ImportResult, ImportDetail, ProcessingStatus, ProcessStep, DuplicateAction, DuplicateResolution } from '@/types';
import { generateBusinessKey, determineInitialStatus, detectFieldChanges, checkReversalRule } from './boundaryRules';
import { createVersionRecord, createStatusHistoryRecord, generateUUID } from './versionControl';

export function checkDuplicate(existingRecords: TaxNote[], rowData: ImportRowData): TaxNote | null {
  const businessKey = generateBusinessKey(rowData.tradeDate, rowData.stockCode, rowData.serialNumber);
  return existingRecords.find(record => record.id === businessKey) || null;
}

export function analyzeDuplicates(
  existingRecords: TaxNote[],
  importRows: ImportRowData[]
): {
  newRecords: ImportRowData[];
  potentialDuplicates: { row: ImportRowData; existing: TaxNote; rowIndex: number }[];
  errors: string[];
} {
  const newRecords: ImportRowData[] = [];
  const potentialDuplicates: { row: ImportRowData; existing: TaxNote; rowIndex: number }[] = [];
  const errors: string[] = [];

  importRows.forEach((row, index) => {
    try {
      const existing = checkDuplicate(existingRecords, row);
      if (existing) {
        potentialDuplicates.push({ row, existing, rowIndex: index });
      } else {
        newRecords.push(row);
      }
    } catch (error) {
      errors.push(`\u7b2c${row.lineNumber}\u884c: ${error instanceof Error ? error.message : '\u5206\u6790\u9519\u8bef'}`);
    }
  });

  return { newRecords, potentialDuplicates, errors };
}

export interface ProcessImportResult {
  taxNotes: TaxNote[];
  versions: ReturnType<typeof createVersionRecord>[];
  statusHistories: ReturnType<typeof createStatusHistoryRecord>[];
  importResult: ImportResult;
}

export function processImportData(
  existingRecords: TaxNote[],
  importRows: ImportRowData[],
  currentUser: string,
  duplicateResolutions?: DuplicateResolution[]
): ProcessImportResult {
  const result: ProcessImportResult = {
    taxNotes: [],
    versions: [],
    statusHistories: [],
    importResult: {
      totalRecords: importRows.length,
      newRecords: 0,
      updatedRecords: 0,
      skippedRecords: 0,
      errorRecords: 0,
      reversalPendingRecords: 0,
      duplicateRecords: 0,
      details: [],
    },
  };

  const resolutionMap = new Map<string, DuplicateResolution>();
  if (duplicateResolutions) {
    duplicateResolutions.forEach(res => {
      resolutionMap.set(`${res.rowIndex}_${res.recordId}`, res);
    });
  }

  for (let rowIndex = 0; rowIndex < importRows.length; rowIndex++) {
    const row = importRows[rowIndex];
    try {
      const existingRecord = checkDuplicate(existingRecords, row);
      const isReversalPending = checkReversalRule(row.amount, row.remark);

      if (!existingRecord) {
        const newRecord = createNewTaxNote(row, currentUser);
        result.taxNotes.push(newRecord);
        result.importResult.newRecords++;

        const statusHistory = createStatusHistoryRecord(
          newRecord.id,
          null,
          newRecord.processingStatus,
          currentUser,
          '\u521d\u59cb\u5bfc\u5165'
        );
        result.statusHistories.push(statusHistory);

        result.importResult.details.push({
          lineNumber: row.lineNumber,
          action: 'NEW',
          reason: '\u65b0\u8bb0\u5f55\u5bfc\u5165',
          recordId: newRecord.id,
        });

        if (isReversalPending) {
          result.importResult.reversalPendingRecords++;
        }
      } else {
        const resolutionKey = `${rowIndex}_${existingRecord.id}`;
        const resolution = resolutionMap.get(resolutionKey);

        if (!resolution) {
          result.importResult.duplicateRecords++;
          result.importResult.details.push({
            lineNumber: row.lineNumber,
            action: 'DUPLICATE',
            reason: '\u68c0\u6d4b\u5230\u91cd\u590d\u8bb0\u5f55\uff0c\u7b49\u5f85\u7528\u6237\u5904\u7406',
            recordId: existingRecord.id,
            existingRecord,
            newRowData: row,
          });
          continue;
        }

        switch (resolution.action) {
          case DuplicateAction.SKIP:
            result.importResult.skippedRecords++;
            result.importResult.details.push({
              lineNumber: row.lineNumber,
              action: 'SKIP',
              reason: '\u7528\u6237\u9009\u62e9\u8df3\u8fc7\u91cd\u590d\u8bb0\u5f55',
              recordId: existingRecord.id,
            });
            break;

          case DuplicateAction.CONFIRM_UPDATE: {
            const updates: Partial<TaxNote> = {
              currentRemark: row.remark,
              currentAmount: row.amount,
              counterTailNumber: row.counterTailNumber,
            };

            const changes = detectFieldChanges(existingRecord, updates);

            if (changes.length === 0) {
              result.importResult.skippedRecords++;
              result.importResult.details.push({
                lineNumber: row.lineNumber,
                action: 'SKIP',
                reason: '\u65e0\u5b57\u6bb5\u53d8\u66f4\uff0c\u8df3\u8fc7',
                recordId: existingRecord.id,
              });
            } else {
              const updatedRecord: TaxNote = {
                ...existingRecord,
                ...updates,
                version: existingRecord.version + 1,
                updatedBy: currentUser,
                updatedAt: new Date().toISOString(),
              };

              if (isReversalPending && updatedRecord.processingStatus !== ProcessingStatus.REVERSAL_PENDING_REVIEW) {
                updatedRecord.processingStatus = ProcessingStatus.REVERSAL_PENDING_REVIEW;
                const statusHistory = createStatusHistoryRecord(
                  updatedRecord.id,
                  existingRecord.processingStatus,
                  updatedRecord.processingStatus,
                  currentUser,
                  '\u91cd\u65b0\u5bfc\u5165\u68c0\u6d4b\u5230\u51b2\u6b63\u6807\u8bb0'
                );
                result.statusHistories.push(statusHistory);
                result.importResult.reversalPendingRecords++;
              }

              result.taxNotes.push(updatedRecord);
              result.importResult.updatedRecords++;

              for (const change of changes) {
                const version = createVersionRecord(
                  updatedRecord.id,
                  updatedRecord.version,
                  change.field,
                  change.oldValue,
                  change.newValue,
                  currentUser,
                  '\u91cd\u65b0\u5bfc\u5165\u66f4\u65b0'
                );
                result.versions.push(version);
              }

              result.importResult.details.push({
                lineNumber: row.lineNumber,
                action: 'UPDATE',
                reason: `\u7528\u6237\u786e\u8ba4\u66f4\u65b0\uff0c\u68c0\u6d4b\u5230${changes.length}\u4e2a\u5b57\u6bb5\u53d8\u66f4`,
                recordId: existingRecord.id,
              });
            }
            break;
          }

          case DuplicateAction.MERGE: {
            const mergedRemark = resolution.mergeRemark
              ? `${existingRecord.currentRemark} | ${resolution.mergeRemark} | ${row.remark}`
              : `${existingRecord.currentRemark} | ${row.remark}`;

            const updates: Partial<TaxNote> = {
              currentRemark: mergedRemark,
              currentAmount: row.amount !== 0 ? row.amount : existingRecord.currentAmount,
              counterTailNumber: row.counterTailNumber || existingRecord.counterTailNumber,
            };

            const changes = detectFieldChanges(existingRecord, updates);

            if (changes.length === 0) {
              result.importResult.skippedRecords++;
              result.importResult.details.push({
                lineNumber: row.lineNumber,
                action: 'SKIP',
                reason: '\u5408\u5e76\u540e\u65e0\u5b57\u6bb5\u53d8\u66f4\uff0c\u8df3\u8fc7',
                recordId: existingRecord.id,
              });
            } else {
              const updatedRecord: TaxNote = {
                ...existingRecord,
                ...updates,
                version: existingRecord.version + 1,
                updatedBy: currentUser,
                updatedAt: new Date().toISOString(),
              };

              result.taxNotes.push(updatedRecord);
              result.importResult.updatedRecords++;

              for (const change of changes) {
                const version = createVersionRecord(
                  updatedRecord.id,
                  updatedRecord.version,
                  change.field,
                  change.oldValue,
                  change.newValue,
                  currentUser,
                  `\u5408\u5e76\u5907\u6ce8${resolution.mergeRemark ? ': ' + resolution.mergeRemark : ''}`
                );
                result.versions.push(version);
              }

              result.importResult.details.push({
                lineNumber: row.lineNumber,
                action: 'UPDATE',
                reason: `\u7528\u6237\u9009\u62e9\u5408\u5e76\u5907\u6ce8\uff0c\u68c0\u6d4b\u5230${changes.length}\u4e2a\u5b57\u6bb5\u53d8\u66f4`,
                recordId: existingRecord.id,
              });
            }
            break;
          }
        }
      }
    } catch (error) {
      result.importResult.errorRecords++;
      result.importResult.details.push({
        lineNumber: row.lineNumber,
        action: 'ERROR',
        reason: error instanceof Error ? error.message : '\u672a\u77e5\u9519\u8bef',
      });
    }
  }

  return result;
}

function createNewTaxNote(rowData: ImportRowData, currentUser: string): TaxNote {
  const businessKey = generateBusinessKey(rowData.tradeDate, rowData.stockCode, rowData.serialNumber);
  const now = new Date().toISOString();
  const initialStatus = determineInitialStatus(rowData);

  return {
    id: businessKey,
    originalLineNumber: rowData.lineNumber,
    tradeDate: rowData.tradeDate,
    stockCode: rowData.stockCode,
    stockName: rowData.stockName,
    serialNumber: rowData.serialNumber,
    originalAmount: rowData.amount,
    currentAmount: rowData.amount,
    originalRemark: rowData.remark,
    currentRemark: rowData.remark,
    counterTailNumber: rowData.counterTailNumber,
    summary: '',
    processingStatus: initialStatus,
    currentStep: ProcessStep.STEP_1_IMPORT,
    version: 1,
    createdBy: currentUser,
    createdAt: now,
    updatedBy: currentUser,
    updatedAt: now,
  };
}

export { generateUUID };
"""

for filepath, content in files.items():
    full_path = os.path.join(base, filepath)
    os.makedirs(os.path.dirname(full_path), exist_ok=True)
    with open(full_path, 'w', encoding='utf-8') as f:
        f.write(content.lstrip('\n'))
    print(f'Written: {filepath}')
