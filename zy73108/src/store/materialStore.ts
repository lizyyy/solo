import { create } from "zustand";
import type {
  ChangeLog,
  FilterOptions,
  ImportItem,
  ImportPreviewItem,
  ImportResult,
  LogAction,
  MaterialRecord,
  RecordStatus,
} from "@/types";
import { computeRecordKey, generateBatchNo, uid } from "@/utils/id";
import {
  checkDuplicate,
  checkSupplement,
  protectRemark,
  validateImportItem,
} from "@/utils/validators";

const STORAGE_KEY = "rzts_material_store_v1";

interface PersistSnapshot {
  records: MaterialRecord[];
  logs: ChangeLog[];
}

interface MaterialState {
  records: MaterialRecord[];
  logs: ChangeLog[];
  hydrated: boolean;

  hydrate: () => void;
  persist: () => void;
  reset: () => void;

  previewImport: (items: ImportItem[]) => ImportPreviewItem[];
  importRecords: (items: ImportItem[], operator: string) => ImportResult;

  confirmRecord: (id: string, operator: string) => void;
  revokeRecord: (id: string, operator: string) => void;
  updateRemark: (id: string, remark: string, operator: string) => void;
  markLateChange: (id: string, isLate: boolean, operator: string) => void;
  setRecordStatus: (id: string, status: RecordStatus, operator: string) => void;

  batchConfirm: (ids: string[], operator: string) => number;
  batchRevoke: (ids: string[], operator: string) => number;
  batchMarkLate: (ids: string[], operator: string) => number;

  getRecordById: (id: string) => MaterialRecord | undefined;
  getVersionChain: (materialNo: string) => MaterialRecord[];

  filterRecords: (filter: FilterOptions) => MaterialRecord[];
  filterLogs: (filter: FilterOptions) => ChangeLog[];
  listBatchNos: () => string[];
  listOperators: () => string[];
}

const addLog = (
  logs: ChangeLog[],
  rec: MaterialRecord,
  action: LogAction,
  operator: string,
  detail: string
): ChangeLog[] => {
  return [
    ...logs,
    {
      id: uid("L"),
      recordId: rec.id,
      batchNo: rec.batchNo,
      action,
      operator,
      detail,
      timestamp: new Date().toISOString(),
      materialNo: rec.materialNo,
      title: rec.title,
    },
  ];
};

const addLogForImport = (
  logs: ChangeLog[],
  rec: MaterialRecord,
  operator: string,
  isSupplement: boolean
): ChangeLog[] => {
  const action: LogAction = isSupplement ? "supplement" : "import";
  const detail = isSupplement
    ? `后补材料新版本 v${rec.version}（不覆盖 v${rec.version - 1} 的判断）`
    : `新建记录，初始状态：待确认`;
  return addLog(logs, rec, action, operator, detail);
};

export const useMaterialStore = create<MaterialState>((set, get) => ({
  records: [],
  logs: [],
  hydrated: false,

  hydrate: () => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const snap: PersistSnapshot = JSON.parse(raw);
        set({ records: snap.records || [], logs: snap.logs || [], hydrated: true });
      } else {
        set({ hydrated: true });
      }
    } catch (e) {
      console.warn("hydrate failed", e);
      set({ hydrated: true });
    }
  },

  persist: () => {
    const { records, logs } = get();
    const snap: PersistSnapshot = { records, logs };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
  },

  reset: () => {
    set({ records: [], logs: [] });
    localStorage.removeItem(STORAGE_KEY);
  },

  previewImport: (items) => {
    const { records } = get();
    const incomingKeys = new Set<string>();
    return items
      .map((item) => {
        const validation = validateImportItem(item);
        const dup = checkDuplicate(item, records, incomingKeys);
        const key = computeRecordKey(item.materialNo, item.title);
        let _isDuplicate = false;
        let _duplicateReason: string | undefined;
        if (!validation.valid) {
          _isDuplicate = true;
          _duplicateReason = validation.errors.join("；");
        } else if (dup.isDuplicate) {
          _isDuplicate = true;
          _duplicateReason = dup.reason;
        }
        if (!_isDuplicate) incomingKeys.add(key);
        const sup = checkSupplement(item, records);
        return {
          ...item,
          _key: key,
          _isDuplicate,
          _duplicateReason,
          _isSupplement: sup.isSupplement && !_isDuplicate,
          _previousVersion: sup.previousVersion,
          _previousId: sup.previousId,
        } as ImportPreviewItem;
      });
  },

  importRecords: (items, operator) => {
    const state = get();
    const batchNo = generateBatchNo();
    const now = new Date().toISOString();
    const incomingKeys = new Set<string>();
    const imported: MaterialRecord[] = [];
    const skipped: { item: ImportItem; reason: string }[] = [];
    const supplemented: {
      newId: string;
      parentId: string;
      materialNo: string;
    }[] = [];
    let newRecords = [...state.records];
    let newLogs = [...state.logs];

    items.forEach((item) => {
      const validation = validateImportItem(item);
      if (!validation.valid) {
        skipped.push({ item, reason: validation.errors.join("；") });
        return;
      }
      const dup = checkDuplicate(item, newRecords, incomingKeys);
      if (dup.isDuplicate) {
        skipped.push({ item, reason: dup.reason || "重复记录" });
        return;
      }
      const key = computeRecordKey(item.materialNo, item.title);
      incomingKeys.add(key);
      const sup = checkSupplement(item, newRecords);
      const version = (sup.previousVersion || 0) + 1;
      const record: MaterialRecord = {
        id: uid("R"),
        batchNo,
        materialNo: item.materialNo.trim(),
        title: item.title.trim(),
        content: item.content || "",
        status: "pending",
        remark: (item.remark || "").trim(),
        isLateChange: !!item.isLateChange,
        version,
        parentId: sup.previousId,
        operator,
        createdAt: now,
        updatedAt: now,
      };
      newRecords = [...newRecords, record];
      imported.push(record);
      newLogs = addLogForImport(newLogs, record, operator, sup.isSupplement);
      if (sup.isSupplement && sup.previousId) {
        supplemented.push({
          newId: record.id,
          parentId: sup.previousId,
          materialNo: record.materialNo,
        });
      }
    });

    set({ records: newRecords, logs: newLogs });
    get().persist();
    return { batchNo, imported, skipped, supplemented };
  },

  confirmRecord: (id, operator) => {
    get().setRecordStatus(id, "confirmed", operator);
  },

  revokeRecord: (id, operator) => {
    get().setRecordStatus(id, "revoked", operator);
  },

  setRecordStatus: (id, status, operator) => {
    const { records, logs } = get();
    const idx = records.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const old = records[idx];
    const updated: MaterialRecord = {
      ...old,
      status,
      updatedAt: new Date().toISOString(),
    };
    const newRecords = [...records];
    newRecords[idx] = updated;
    const detailMap: Record<RecordStatus, string> = {
      pending: "重置状态为待确认",
      confirmed: "已确认，进入正常结果",
      revoked: "已撤回，从正常结果移除",
    };
    const actionMap: Record<RecordStatus, LogAction> = {
      pending: "update",
      confirmed: "confirm",
      revoked: "revoke",
    };
    const newLogs = addLog(
      logs,
      updated,
      actionMap[status],
      operator,
      detailMap[status]
    );
    set({ records: newRecords, logs: newLogs });
    get().persist();
  },

  updateRemark: (id, remark, operator) => {
    const { records, logs } = get();
    const idx = records.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const old = records[idx];
    const finalRemark = protectRemark(old.remark, remark);
    if (finalRemark === old.remark) return;
    const updated: MaterialRecord = {
      ...old,
      remark: finalRemark,
      updatedAt: new Date().toISOString(),
    };
    const newRecords = [...records];
    newRecords[idx] = updated;
    const newLogs = addLog(
      logs,
      updated,
      "remark",
      operator,
      `人工备注已更新（已保护原备注不被空值覆盖）`
    );
    set({ records: newRecords, logs: newLogs });
    get().persist();
  },

  markLateChange: (id, isLate, operator) => {
    const { records, logs } = get();
    const idx = records.findIndex((r) => r.id === id);
    if (idx < 0) return;
    const old = records[idx];
    if (old.isLateChange === isLate) return;
    const updated: MaterialRecord = {
      ...old,
      isLateChange: isLate,
      updatedAt: new Date().toISOString(),
    };
    const newRecords = [...records];
    newRecords[idx] = updated;
    const newLogs = addLog(
      logs,
      updated,
      isLate ? "mark_late" : "unmark_late",
      operator,
      isLate
        ? "已标记为晚到变更单，单独拎出、与正常结果隔离"
        : "已取消晚到标记，恢复进入正常筛选"
    );
    set({ records: newRecords, logs: newLogs });
    get().persist();
  },

  batchConfirm: (ids, operator) => {
    let count = 0;
    ids.forEach((id) => {
      const r = get().records.find((x) => x.id === id);
      if (r && r.status !== "confirmed") {
        get().confirmRecord(id, operator);
        count++;
      }
    });
    return count;
  },

  batchRevoke: (ids, operator) => {
    let count = 0;
    ids.forEach((id) => {
      const r = get().records.find((x) => x.id === id);
      if (r && r.status !== "revoked") {
        get().revokeRecord(id, operator);
        count++;
      }
    });
    return count;
  },

  batchMarkLate: (ids, operator) => {
    let count = 0;
    ids.forEach((id) => {
      const r = get().records.find((x) => x.id === id);
      if (r && !r.isLateChange) {
        get().markLateChange(id, true, operator);
        count++;
      }
    });
    return count;
  },

  getRecordById: (id) => get().records.find((r) => r.id === id),

  getVersionChain: (materialNo) => {
    return get()
      .records.filter((r) => r.materialNo === materialNo)
      .sort((a, b) => a.version - b.version);
  },

  filterRecords: (filter) => {
    const { records } = get();
    return records.filter((r) => {
      if (filter.status && filter.status !== "all" && r.status !== filter.status) {
        return false;
      }
      if (
        filter.isLateChange !== undefined &&
        filter.isLateChange !== "all" &&
        r.isLateChange !== filter.isLateChange
      ) {
        return false;
      }
      if (filter.batchNo && filter.batchNo.trim()) {
        if (!r.batchNo.includes(filter.batchNo.trim())) return false;
      }
      if (filter.materialNo && filter.materialNo.trim()) {
        if (!r.materialNo.includes(filter.materialNo.trim())) return false;
      }
      if (filter.operator && filter.operator.trim()) {
        if (!r.operator.includes(filter.operator.trim())) return false;
      }
      if (filter.keyword && filter.keyword.trim()) {
        const kw = filter.keyword.trim().toLowerCase();
        const hay = `${r.title} ${r.content} ${r.remark} ${r.materialNo}`.toLowerCase();
        if (!hay.includes(kw)) return false;
      }
      if (filter.dateFrom) {
        if (r.createdAt < filter.dateFrom + "T00:00:00") return false;
      }
      if (filter.dateTo) {
        if (r.createdAt > filter.dateTo + "T23:59:59") return false;
      }
      return true;
    });
  },

  filterLogs: (filter) => {
    const { logs } = get();
    return logs
      .filter((log) => {
        if (filter.action && filter.action !== "all" && log.action !== filter.action) {
          return false;
        }
        if (filter.batchNo && filter.batchNo.trim()) {
          if (!log.batchNo.includes(filter.batchNo.trim())) return false;
        }
        if (filter.operator && filter.operator.trim()) {
          if (!log.operator.includes(filter.operator.trim())) return false;
        }
        if (filter.materialNo && filter.materialNo.trim()) {
          const mno = log.materialNo || "";
          if (!mno.includes(filter.materialNo.trim())) return false;
        }
        if (filter.keyword && filter.keyword.trim()) {
          const kw = filter.keyword.trim().toLowerCase();
          const hay = `${log.detail} ${log.operator} ${log.batchNo} ${log.materialNo} ${log.title}`.toLowerCase();
          if (!hay.includes(kw)) return false;
        }
        if (filter.dateFrom) {
          if (log.timestamp < filter.dateFrom + "T00:00:00") return false;
        }
        if (filter.dateTo) {
          if (log.timestamp > filter.dateTo + "T23:59:59") return false;
        }
        return true;
      })
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  },

  listBatchNos: () => {
    const s = new Set(get().records.map((r) => r.batchNo));
    return Array.from(s).sort((a, b) => b.localeCompare(a));
  },

  listOperators: () => {
    const s = new Set([
      ...get().records.map((r) => r.operator),
      ...get().logs.map((l) => l.operator),
    ]);
    return Array.from(s).sort();
  },
}));
