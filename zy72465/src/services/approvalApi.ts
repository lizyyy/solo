import type {
  ApprovalRecord,
  ExportLog,
  HistoryEntry,
} from '@/types';
import {
  EXPORT_FIELD_MAPPINGS,
  formatValueByCode,
  getDisplayCommunityName,
} from '@/types';
import { restoreFromLocalStorage } from '@/utils/persistStore';
import { useAppStore } from '@/store/useAppStore';

type ApiResponse<T> = {
  code: number;
  message: string;
  data: T;
  timestamp: number;
  source: 'persistence';
};

const delay = async (ms = 80 + Math.random() * 120) =>
  new Promise<void>((r) => setTimeout(r, ms));

const readPersistentData = () => {
  const liveState = useAppStore.getState();
  const liveRecords = liveState?.records?.length > 0
    ? liveState.records
    : undefined;
  if (liveRecords && liveRecords.length > 0) {
    return {
      records: liveRecords as ApprovalRecord[],
      history: liveState.history as Record<string, HistoryEntry[]>,
      exportLogs: liveState.exportLogs as ExportLog[],
    };
  }
  const restored = restoreFromLocalStorage();
  if (!restored) {
    return {
      records: [] as ApprovalRecord[],
      history: {} as Record<string, HistoryEntry[]>,
      exportLogs: [] as ExportLog[],
    };
  }
  return {
    records: (restored.records || []) as ApprovalRecord[],
    history: (restored.history || {}) as Record<string, HistoryEntry[]>,
    exportLogs: (restored.exportLogs || []) as ExportLog[],
  };
};

const ok = <T,>(data: T, message = 'ok'): ApiResponse<T> => ({
  code: 0,
  message,
  data,
  timestamp: Date.now(),
  source: 'persistence',
});

const err = <T,>(code: number, message: string, data: T): ApiResponse<T> => ({
  code,
  message,
  data,
  timestamp: Date.now(),
  source: 'persistence',
});

export type ApiRecordDetail = {
  record: ApprovalRecord;
  history: HistoryEntry[];
  displayCommunityName: string;
};

export type ApiExportedRow = {
  fieldCode: string;
  fieldLabel: string;
  value: string | number;
};

export type ApiExportDetail = {
  log: ExportLog;
  rows: Array<{
    recordId: string;
    originalLineNumber: number;
    displayName: string;
    fields: ApiExportedRow[];
  }>;
  summary: {
    totalRecords: number;
    totalFields: number;
    exportedAt: Date | string;
    exportedBy: string;
  };
};

export const approvalApi = {
  async listRecords(params?: { keyword?: string; status?: string }): Promise<
    ApiResponse<{
      total: number;
      items: Array<ApprovalRecord & { displayCommunityName: string }>;
    }>
  > {
    await delay();
    const { records } = readPersistentData();
    let items = records.map((r) => ({
      ...r,
      displayCommunityName: getDisplayCommunityName(r),
    }));
    if (params?.keyword) {
      const kw = params.keyword.trim();
      if (kw) {
        items = items.filter(
          (r) =>
            r.displayCommunityName.includes(kw) ||
            r.communityOldName?.includes(kw) ||
            r.communityNewName?.includes(kw),
        );
      }
    }
    if (params?.status) {
      items = items.filter((r) => r.status === params.status);
    }
    return ok({ total: items.length, items });
  },

  async getRecord(id: string): Promise<ApiResponse<ApiRecordDetail | null>> {
    await delay();
    const { records, history } = readPersistentData();
    const record = records.find((r) => r.id === id);
    if (!record) {
      return err(404, `记录 ${id} 不存在`, null);
    }
    return ok({
      record,
      history: history[id] || [],
      displayCommunityName: getDisplayCommunityName(record),
    });
  },

  async listExportLogs(): Promise<ApiResponse<ExportLog[]>> {
    await delay();
    const { exportLogs } = readPersistentData();
    return ok(exportLogs, `共 ${exportLogs.length} 条导出日志`);
  },

  async getExportLogDetail(logId: string): Promise<ApiResponse<ApiExportDetail | null>> {
    await delay();
    const { exportLogs } = readPersistentData();
    const log = exportLogs.find((e) => e.id === logId);
    if (!log) {
      return err(404, `导出日志 ${logId} 不存在`, null);
    }
    const rows = log.dataSnapshot.map((snap) => {
      const fields: ApiExportedRow[] = EXPORT_FIELD_MAPPINGS.map((m) => ({
        fieldCode: m.code,
        fieldLabel: m.label,
        value: formatValueByCode(snap, m.code),
      }));
      return {
        recordId: snap.id,
        originalLineNumber: snap.originalLineNumber,
        displayName: getDisplayCommunityName(snap),
        fields,
      };
    });
    return ok({
      log,
      rows,
      summary: {
        totalRecords: rows.length,
        totalFields: EXPORT_FIELD_MAPPINGS.length,
        exportedAt: log.exportedAt,
        exportedBy: log.exportedBy,
      },
    });
  },

  async consistencyCheck(params?: { exportLogId?: string }): Promise<
    ApiResponse<{
      storeCount: number;
      exportLogCount: number;
      latestExportHashMatch: boolean;
      latestExportId?: string;
      fieldCount: number;
      details: Array<{
        recordId: string;
        originalLineNumber: number;
        displayName: string;
        status: string;
        matches: boolean;
        mismatchedFields: string[];
      }>;
    }>
  > {
    await delay();
    const { records, exportLogs } = readPersistentData();
    const compareSource =
      params?.exportLogId ?
        exportLogs.find((e) => e.id === params.exportLogId)?.dataSnapshot
      : exportLogs[0]?.dataSnapshot;
    const latestExportId =
      params?.exportLogId || exportLogs[0]?.id;

    const details = records.map((r) => {
      const snap = compareSource?.find((s) => s.id === r.id);
      const mismatchedFields: string[] = [];
      if (snap) {
        EXPORT_FIELD_MAPPINGS.forEach((m) => {
          const vStore = String(formatValueByCode(r, m.code));
          const vExport = String(formatValueByCode(snap, m.code));
          if (vStore !== vExport) {
            mismatchedFields.push(m.label);
          }
        });
      }
      return {
        recordId: r.id,
        originalLineNumber: r.originalLineNumber,
        displayName: getDisplayCommunityName(r),
        status: r.status,
        matches: !snap ? false : mismatchedFields.length === 0,
        mismatchedFields,
      };
    });

    const latestExportHashMatch =
      !!compareSource &&
      details.every((d) => d.matches || d.mismatchedFields.length === 0);

    return ok({
      storeCount: records.length,
      exportLogCount: exportLogs.length,
      latestExportHashMatch,
      latestExportId,
      fieldCount: EXPORT_FIELD_MAPPINGS.length,
      details,
    });
  },
};
