import type {
  Pet,
  PetAlias,
  DataSource,
  Schedule,
  MedicalRecord,
  OperationLog,
  Stats,
  LogAction,
  LogTarget,
  AliasSource,
  SourceType,
  ScheduleStatus,
} from "@/types";
import { buildSeedData, type SeedData } from "@/utils/seedData";
import {
  detectAliasConflicts,
  normalizeScheduleStatuses,
  summarizeConflicts,
} from "@/utils/reconciliation";
import { deepDiff } from "@/utils/diff";

const STORAGE_KEY = "pet_training_reconcile_v1";
const SEED_MARK_KEY = "pet_training_reconcile_v1_seeded";

function loadFromStorage(): SeedData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as SeedData;
  } catch {
    return null;
  }
}

function saveToStorage(data: SeedData) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (e) {
    console.warn("保存本地数据失败", e);
  }
}

function uid(prefix: string) {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

interface ReconcileState {
  pets: Pet[];
  aliases: PetAlias[];
  dataSources: DataSource[];
  schedules: Schedule[];
  medicalRecords: MedicalRecord[];
  operationLogs: OperationLog[];
  currentOperator: string;

  _init: () => void;
  _persist: () => void;
  _recomputeAnomalies: () => void;
  _writeLog: (args: {
    targetType: LogTarget;
    targetId: string;
    action: LogAction;
    before: Record<string, unknown> | null;
    after: Record<string, unknown> | null;
    remark?: string;
  }) => void;

  getStats: () => Stats;
  getAliasConflicts: () => ReturnType<typeof detectAliasConflicts>;
  getConflictSummary: () => ReturnType<typeof summarizeConflicts>;
  getPetById: (id: string) => Pet | undefined;
  getDataSourceById: (id: string) => DataSource | undefined;
  getScheduleById: (id: string) => Schedule | undefined;
  getMedicalById: (id: string) => MedicalRecord | undefined;
  getLogsByTarget: (type: LogTarget, id: string) => OperationLog[];

  importCsvSchedules: (args: {
    fileName: string;
    rows: {
      petName: string;
      courseName: string;
      courseDate: string;
      durationMin: number;
      trainer: string;
      sourceRow: string;
    }[];
  }) => { added: number; skipped: number };

  addMedicalRecord: (args: {
    petName: string;
    visitDate: string;
    diagnosis: string;
    treatment: string;
    veterinarian: string;
    linkedScheduleId?: string | null;
    includeSampleNormal?: boolean;
  }) => { medicalId: string; sampleScheduleId?: string };

  confirmSchedule: (id: string, bindPetId?: string, remark?: string) => void;
  withdrawSchedule: (id: string, remark?: string) => void;

  bindAliasToPet: (args: {
    aliasName: string;
    petId: string | null;
    createPetIfMissing?: { canonicalName: string; species: Pet["species"]; gender: Pet["gender"] };
    source: AliasSource;
    linkedRecordId?: string;
    remark?: string;
  }) => { petId: string; aliasId: string };

  resetAll: () => void;
  setOperator: (name: string) => void;
}

const snapshotSchedule = (s: Schedule): Record<string, unknown> => {
  const { id, sourceId, sourceRow, ...rest } = s;
  return { ...rest } as unknown as Record<string, unknown>;
};
const snapshotMedical = (m: MedicalRecord): Record<string, unknown> => {
  const { id, sourceId, createdAt, ...rest } = m;
  return { ...rest } as unknown as Record<string, unknown>;
};

const initial: ReconcileState = {
  pets: [],
  aliases: [],
  dataSources: [],
  schedules: [],
  medicalRecords: [],
  operationLogs: [],
  currentOperator: "小乔",

  _init() {
    const mark = localStorage.getItem(SEED_MARK_KEY);
    const stored = loadFromStorage();
    if (stored) {
      this.pets = stored.pets;
      this.aliases = stored.aliases;
      this.dataSources = stored.dataSources;
      this.schedules = stored.schedules;
      this.medicalRecords = stored.medicalRecords;
      this.operationLogs = stored.operationLogs;
    } else {
      const seed = buildSeedData();
      this.pets = seed.pets;
      this.aliases = seed.aliases;
      this.dataSources = seed.dataSources;
      this.schedules = seed.schedules;
      this.medicalRecords = seed.medicalRecords;
      this.operationLogs = seed.operationLogs;
      this._persist();
    }
    if (!mark) {
      localStorage.setItem(SEED_MARK_KEY, "1");
    }
    this._recomputeAnomalies();
  },

  _persist() {
    saveToStorage({
      pets: this.pets,
      aliases: this.aliases,
      dataSources: this.dataSources,
      schedules: this.schedules,
      medicalRecords: this.medicalRecords,
      operationLogs: this.operationLogs,
    });
  },

  _recomputeAnomalies() {
    const conflicts = detectAliasConflicts({
      schedules: this.schedules,
      pets: this.pets,
      aliases: this.aliases,
      medicalRecords: this.medicalRecords,
    });
    const normalized = normalizeScheduleStatuses(this.schedules, conflicts);
    const changed = normalized.some((s, i) => s.status !== this.schedules[i].status);
    if (changed) {
      this.schedules = normalized;
      this._persist();
    }
  },

  _writeLog({ targetType, targetId, action, before, after, remark }) {
    if (before && after) {
      const diffs = deepDiff(before, after);
      if (diffs.every((d) => !d.changed)) return;
    }
    const log: OperationLog = {
      id: uid("LOG"),
      targetType,
      targetId,
      action,
      operator: this.currentOperator,
      operatedAt: new Date().toISOString(),
      beforeState: before,
      afterState: after,
      remark,
    };
    this.operationLogs = [log, ...this.operationLogs];
  },

  getStats() {
    const anomalies = this.schedules.filter((s) => s.status === "ANOMALY");
    const normal = this.schedules.filter((s) => s.status !== "ANOMALY");
    return {
      totalSchedules: this.schedules.length,
      totalMinutes: normal.reduce((acc, s) => acc + s.durationMin, 0),
      confirmedCount: this.schedules.filter((s) => s.status === "CONFIRMED").length,
      pendingCount: this.schedules.filter((s) => s.status === "PENDING").length,
      anomalyCount: anomalies.length,
      withdrawnCount: this.schedules.filter((s) => s.status === "WITHDRAWN").length,
      medicalCount: this.medicalRecords.length,
      aliasConflictCount: this.getAliasConflicts().length,
    };
  },

  getAliasConflicts() {
    return detectAliasConflicts({
      schedules: this.schedules,
      pets: this.pets,
      aliases: this.aliases,
      medicalRecords: this.medicalRecords,
    });
  },

  getConflictSummary() {
    return summarizeConflicts(this.getAliasConflicts());
  },

  getPetById(id) {
    return this.pets.find((p) => p.id === id);
  },
  getDataSourceById(id) {
    return this.dataSources.find((s) => s.id === id);
  },
  getScheduleById(id) {
    return this.schedules.find((s) => s.id === id);
  },
  getMedicalById(id) {
    return this.medicalRecords.find((m) => m.id === id);
  },
  getLogsByTarget(type, id) {
    return this.operationLogs.filter((l) => l.targetType === type && l.targetId === id);
  },

  importCsvSchedules({ fileName, rows }) {
    const sourceId = uid("SRC");
    const src: DataSource = {
      id: sourceId,
      type: "CSV",
      fileName,
      importedBy: this.currentOperator,
      importedAt: new Date().toISOString(),
    };
    this.dataSources = [src, ...this.dataSources];
    const existingKey = new Set(
      this.schedules.map((s) => `${s.petName}|${s.courseName}|${s.courseDate}`)
    );
    let added = 0;
    let skipped = 0;
    const newSchedules: Schedule[] = [];
    rows.forEach((r) => {
      const key = `${r.petName}|${r.courseName}|${r.courseDate}`;
      if (existingKey.has(key)) {
        skipped++;
        return;
      }
      existingKey.add(key);
      newSchedules.push({
        id: uid("SCH"),
        petName: r.petName,
        petId: null,
        courseName: r.courseName,
        courseDate: r.courseDate,
        durationMin: r.durationMin,
        trainer: r.trainer,
        status: "PENDING",
        sourceId,
        sourceRow: r.sourceRow,
      });
      added++;
    });
    this.schedules = [...newSchedules, ...this.schedules];
    this._recomputeAnomalies();
    this._writeLog({
      targetType: "SOURCE",
      targetId: sourceId,
      action: "IMPORT_CSV",
      before: null,
      after: { fileName, added, skipped } as Record<string, unknown>,
      remark: `CSV导入完成：新增${added}条，重复跳过${skipped}条`,
    });
    this._persist();
    return { added, skipped };
  },

  addMedicalRecord({
    petName,
    visitDate,
    diagnosis,
    treatment,
    veterinarian,
    linkedScheduleId = null,
    includeSampleNormal,
  }) {
    const sourceId = uid("SRC");
    const src: DataSource = {
      id: sourceId,
      type: "MEDICAL_FORM",
      fileName: `病历手写单-${new Date().toLocaleDateString("zh-CN")}`,
      importedBy: this.currentOperator,
      importedAt: new Date().toISOString(),
      note: includeSampleNormal ? "包含1条正常记录样例" : undefined,
    };
    this.dataSources = [src, ...this.dataSources];

    let sampleScheduleId: string | undefined;
    if (includeSampleNormal) {
      const sid = uid("SCH");
      sampleScheduleId = sid;
      this.schedules.unshift({
        id: sid,
        petName,
        petId: null,
        courseName: "（正常记录-对照样例）训练课签到",
        courseDate: visitDate,
        durationMin: 45,
        trainer: "未安排",
        status: "PENDING",
        sourceId,
        sourceRow: "手写单-正常对照项",
      });
    }

    const medicalId = uid("MED");
    this.medicalRecords.unshift({
      id: medicalId,
      petName,
      visitDate,
      diagnosis,
      treatment,
      veterinarian,
      sourceId,
      linkedScheduleId: sampleScheduleId ?? linkedScheduleId,
      createdAt: new Date().toISOString(),
    });

    this._recomputeAnomalies();
    this._writeLog({
      targetType: "SOURCE",
      targetId: sourceId,
      action: "IMPORT_MEDICAL",
      before: null,
      after: {
        petName,
        visitDate,
        diagnosis,
        includeSampleNormal: !!includeSampleNormal,
      } as Record<string, unknown>,
      remark: includeSampleNormal
        ? "已录入病历手写单，并附带一条正常训练课记录用于对照确认逻辑"
        : "已录入病历手写单",
    });
    this._persist();
    return { medicalId, sampleScheduleId };
  },

  confirmSchedule(id, bindPetId, remark) {
    const idx = this.schedules.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const before = snapshotSchedule(this.schedules[idx]);
    const next: Schedule = { ...this.schedules[idx] };
    if (bindPetId) {
      next.petId = bindPetId;
    }
    next.status = "CONFIRMED";
    next.confirmedAt = new Date().toISOString();
    next.confirmedBy = this.currentOperator;
    next.withdrawnAt = undefined;
    next.anomalyReason = undefined;
    this.schedules[idx] = next;
    this._recomputeAnomalies();
    this._writeLog({
      targetType: "SCHEDULE",
      targetId: id,
      action: "CONFIRM",
      before,
      after: snapshotSchedule(next),
      remark: bindPetId ? `${remark ?? ""} 绑定宠物规范ID=${bindPetId}`.trim() : remark,
    });
    this._persist();
  },

  withdrawSchedule(id, remark) {
    const idx = this.schedules.findIndex((s) => s.id === id);
    if (idx < 0) return;
    const before = snapshotSchedule(this.schedules[idx]);
    const next: Schedule = { ...this.schedules[idx] };
    next.status = "WITHDRAWN";
    next.withdrawnAt = new Date().toISOString();
    this.schedules[idx] = next;
    this._recomputeAnomalies();
    this._writeLog({
      targetType: "SCHEDULE",
      targetId: id,
      action: "WITHDRAW",
      before,
      after: snapshotSchedule(next),
      remark,
    });
    this._persist();
  },

  bindAliasToPet({
    aliasName,
    petId,
    createPetIfMissing,
    source,
    linkedRecordId,
    remark,
  }) {
    let targetPetId = petId;
    if (!targetPetId && createPetIfMissing) {
      const newPet: Pet = {
        id: uid("PET"),
        canonicalName: createPetIfMissing.canonicalName,
        species: createPetIfMissing.species,
        gender: createPetIfMissing.gender,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      this.pets = [newPet, ...this.pets];
      targetPetId = newPet.id;
    }
    let alias = this.aliases.find(
      (a) => a.aliasName.trim() === aliasName.trim()
    );
    const beforeAlias = alias ? { ...alias } : null;
    if (!alias) {
      alias = {
        id: uid("ALS"),
        petId: targetPetId,
        aliasName: aliasName.trim(),
        source,
        linkedRecordId,
        createdAt: new Date().toISOString().slice(0, 10),
      };
      this.aliases = [alias, ...this.aliases];
    } else {
      alias.petId = targetPetId;
      if (!alias.source) alias.source = source;
      if (!alias.linkedRecordId && linkedRecordId) alias.linkedRecordId = linkedRecordId;
    }
    this._recomputeAnomalies();
    this._writeLog({
      targetType: "ALIAS",
      targetId: alias.id,
      action: "BIND_ALIAS",
      before: beforeAlias
        ? ({ petId: beforeAlias.petId, aliasName: beforeAlias.aliasName } as Record<
            string,
            unknown
          >)
        : null,
      after: {
        petId: alias.petId,
        aliasName: alias.aliasName,
        source,
        linkedRecordId,
      } as Record<string, unknown>,
      remark: remark ?? (targetPetId ? `关联到规范宠物 ${targetPetId}` : "解除关联"),
    });
    this._persist();
    return { petId: targetPetId!, aliasId: alias.id };
  },

  resetAll() {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(SEED_MARK_KEY);
    const seed = buildSeedData();
    this.pets = seed.pets;
    this.aliases = seed.aliases;
    this.dataSources = seed.dataSources;
    this.schedules = seed.schedules;
    this.medicalRecords = seed.medicalRecords;
    this.operationLogs = seed.operationLogs;
    this.currentOperator = "小乔";
    this._recomputeAnomalies();
    this._persist();
  },

  setOperator(name) {
    this.currentOperator = name || "志愿者";
  },
};

export { initial as initialReconcileState, STORAGE_KEY, SEED_MARK_KEY, uid };
export type { ReconcileState };
