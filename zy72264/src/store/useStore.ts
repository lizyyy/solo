import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  SafetyRadiusRow,
  ChangeRecord,
  ImportBatch,
  CoordinateOriginDoc,
  RowStatus,
} from '../types';
import { generateRowKey, checkDuplicate, detectLengthMismatch } from '../utils/boundaryRules';

interface StoreState {
  rows: SafetyRadiusRow[];
  changeRecords: ChangeRecord[];
  importBatches: ImportBatch[];
  coordinateDocs: CoordinateOriginDoc[];
  currentUser: { id: string; name: string; role: 'engineer' | 'client' };
}

interface StoreActions {
  importRows: (
    batchId: string,
    fileName: string,
    newRows: Omit<
      SafetyRadiusRow,
      'id' | 'status' | 'importedBatchId' | 'createdAt' | 'updatedAt'
    >[]
  ) => { added: number; duplicated: number; abnormal: number };
  updateRow: (
    rowId: string,
    fieldName: string,
    newValue: string,
    changedBy: string
  ) => void;
  rollbackChange: (changeRecordId: string, changedBy: string) => void;
  updateRowStatus: (rowId: string, newStatus: RowStatus) => void;
  archiveRow: (rowId: string) => void;
  unarchiveRow: (rowId: string) => void;
}

export const useStore = create<StoreState & StoreActions>()(
  persist(
    (set, get) => ({
      rows: [],
      changeRecords: [],
      importBatches: [],
      coordinateDocs: [
        {
          id: 'coord-doc-1',
          title: '坐标原点说明',
          content:
            '1. 坐标原点位于隧道入口中线与路面交点\n2. X轴沿隧道中线方向，向洞内为正\n3. Y轴垂直于中线，向右为正\n4. 高程基准采用1985国家高程基准\n5. 安全半径计算以坐标原点为参考起点，沿X轴累加里程\n6. 补录路线时必须重新计算从坐标原点到该路线起点的里程长度',
          updatedAt: new Date().toISOString(),
        },
      ],
      currentUser: { id: 'xg001', name: '许工', role: 'engineer' },

      importRows: (batchId, fileName, newRows) => {
        const state = get();
        let added = 0;
        let duplicated = 0;
        let abnormal = 0;
        const rowsToAdd: SafetyRadiusRow[] = [];

        for (const row of newRows) {
          const tempRow: SafetyRadiusRow = {
            ...row,
            id: '',
            status: 'pending',
            importedBatchId: batchId,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          };

          if (checkDuplicate(tempRow, state.rows)) {
            duplicated++;
            continue;
          }

          const { isAbnormal } = detectLengthMismatch(tempRow);
          if (isAbnormal) {
            tempRow.status = 'review';
            abnormal++;
          }

          tempRow.id = `${batchId}-${generateRowKey(row)}`;
          rowsToAdd.push(tempRow);
          added++;
        }

        const batch: ImportBatch = {
          id: batchId,
          fileName,
          totalRows: newRows.length,
          duplicatedRows: duplicated,
          abnormalRows: abnormal,
          importedAt: new Date().toISOString(),
          importedBy: state.currentUser.name,
        };

        set({
          rows: [...state.rows, ...rowsToAdd],
          importBatches: [...state.importBatches, batch],
        });

        return { added, duplicated, abnormal };
      },

      updateRow: (rowId, fieldName, newValue, changedBy) => {
        const state = get();
        const row = state.rows.find((r) => r.id === rowId);
        if (!row) return;
        if (row.status === 'archived') return;

        const oldValue = String(row[fieldName as keyof SafetyRadiusRow] ?? '');
        const changeRecord: ChangeRecord = {
          id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          rowId,
          fieldName,
          oldValue,
          newValue,
          changedBy,
          changedAt: new Date().toISOString(),
          changeType: 'edit',
        };

        const newStatus: RowStatus = row.status === 'pending' ? 'modified' : row.status;

        set({
          rows: state.rows.map((r) =>
            r.id === rowId
              ? { ...r, [fieldName]: newValue, status: newStatus, updatedAt: new Date().toISOString() }
              : r
          ),
          changeRecords: [...state.changeRecords, changeRecord],
        });
      },

      rollbackChange: (changeRecordId, changedBy) => {
        const state = get();
        const record = state.changeRecords.find((r) => r.id === changeRecordId);
        if (!record) return;

        const row = state.rows.find((r) => r.id === record.rowId);
        if (!row) return;

        const rollbackRecord: ChangeRecord = {
          id: `cr-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
          rowId: record.rowId,
          fieldName: record.fieldName,
          oldValue: record.newValue,
          newValue: record.oldValue,
          changedBy,
          changedAt: new Date().toISOString(),
          changeType: 'rollback',
        };

        set({
          rows: state.rows.map((r) =>
            r.id === record.rowId
              ? { ...r, [record.fieldName]: record.oldValue, updatedAt: new Date().toISOString() }
              : r
          ),
          changeRecords: [...state.changeRecords, rollbackRecord],
        });
      },

      updateRowStatus: (rowId, newStatus) => {
        const state = get();
        set({
          rows: state.rows.map((r) =>
            r.id === rowId
              ? { ...r, status: newStatus, updatedAt: new Date().toISOString() }
              : r
          ),
        });
      },

      archiveRow: (rowId) => {
        const state = get();
        set({
          rows: state.rows.map((r) =>
            r.id === rowId
              ? { ...r, status: 'archived', updatedAt: new Date().toISOString() }
              : r
          ),
        });
      },

      unarchiveRow: (rowId) => {
        const state = get();
        set({
          rows: state.rows.map((r) =>
            r.id === rowId
              ? { ...r, status: 'modified', updatedAt: new Date().toISOString() }
              : r
          ),
        });
      },
    }),
    {
      name: 'tunnel-inspection-store',
    }
  )
);
