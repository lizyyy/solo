import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  PetEvent,
  PetProfile,
  DerivedPet,
  TrainingJudge,
  ExportDiff,
  ExportSummary,
} from '@/types';
import { EMPTY_PROFILE, DEMO_OPERATOR, generateDemoEvents } from '@/data/demoEvents';
import {
  derivePets,
  computeDiffsBetween,
  profileToRowValue,
  EXPORT_FIELDS,
  formatDate,
} from '@/utils/tracking';

interface LastExportState {
  snapshot: DerivedPet[];
  exportedAt: number;
  eventIds: string[];
}

interface PetStore {
  events: PetEvent[];
  pets: DerivedPet[];
  lastExport: LastExportState | null;
  initializedWithDemo: boolean;

  initIfEmpty: () => void;
  resetToDemo: () => void;
  clearAll: () => void;

  importPet: (profile: PetProfile, source: string, photoUrls: string[], note?: string) => string;
  confirmPet: (petId: string, note?: string) => void;
  revokePet: (petId: string, reason: string) => void;
  addNote: (petId: string, note: string, trainingUpdates?: Partial<PetProfile>) => ExportDiff[];
  rejudgePet: (
    petId: string,
    oldJudge: TrainingJudge,
    newJudge: TrainingJudge,
    reason: string,
    additionalUpdates?: Partial<PetProfile>,
  ) => void;

  computeExportDiffSinceLast: () => ExportDiff[];
  buildExportSummary: () => ExportSummary;
  markExported: () => void;
  exportCSVBlob: () => Blob;
  exportJSONBlob: () => Blob;

  getEventsOfPet: (petId: string) => PetEvent[];
  getPetById: (petId: string) => DerivedPet | undefined;
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function deepClone(p: PetProfile): PetProfile {
  return {
    ...p,
    aliases: [...p.aliases],
    photoUrls: [...p.photoUrls],
  };
}

function getLatestProfile(events: PetEvent[], petId: string): PetProfile {
  const petEvents = events
    .filter((e) => e.petId === petId)
    .sort((a, b) => a.timestamp - b.timestamp);
  if (!petEvents.length) return { ...EMPTY_PROFILE };
  return deepClone(petEvents[petEvents.length - 1].snapshotAfter);
}

function persistPets(events: PetEvent[]): DerivedPet[] {
  return derivePets(events);
}

export const usePetStore = create<PetStore>()(
  persist(
    (set, get) => ({
      events: [],
      pets: [],
      lastExport: null,
      initializedWithDemo: false,

      initIfEmpty: () => {
        const s = get();
        if (s.events.length === 0 && !s.initializedWithDemo) {
          const demo = generateDemoEvents();
          set({
            events: demo,
            pets: persistPets(demo),
            initializedWithDemo: true,
          });
        }
      },

      resetToDemo: () => {
        const demo = generateDemoEvents();
        set({
          events: demo,
          pets: persistPets(demo),
          lastExport: null,
          initializedWithDemo: true,
        });
      },

      clearAll: () => {
        set({ events: [], pets: [], lastExport: null, initializedWithDemo: false });
      },

      importPet: (profile, source, photoUrls, note) => {
        const petId = uid('pet');
        const before = { ...EMPTY_PROFILE };
        const after: PetProfile = {
          ...deepClone(profile),
          photoUrls,
        };
        const event: PetEvent = {
          id: uid('evt'),
          petId,
          type: 'import',
          timestamp: Date.now(),
          operator: DEMO_OPERATOR,
          source: source as any,
          note: note || '导入新的疫苗本照片记录',
          snapshotBefore: before,
          snapshotAfter: after,
        };
        const next = [...get().events, event];
        set({ events: next, pets: persistPets(next) });
        return petId;
      },

      confirmPet: (petId, note) => {
        const state = get();
        const before = getLatestProfile(state.events, petId);
        if (before.confirmed) return;
        const after = { ...before, confirmed: true };
        const event: PetEvent = {
          id: uid('evt'),
          petId,
          type: 'confirm',
          timestamp: Date.now(),
          operator: DEMO_OPERATOR,
          source: 'manual',
          note: note || '确认信息正确，归档',
          snapshotBefore: before,
          snapshotAfter: after,
        };
        const next = [...state.events, event];
        set({ events: next, pets: persistPets(next) });
      },

      revokePet: (petId, reason) => {
        const state = get();
        const before = getLatestProfile(state.events, petId);
        const after = { ...before, revoked: true, confirmed: false };
        const event: PetEvent = {
          id: uid('evt'),
          petId,
          type: 'revoke',
          timestamp: Date.now(),
          operator: DEMO_OPERATOR,
          source: 'manual',
          note: reason || '撤回该记录',
          snapshotBefore: before,
          snapshotAfter: after,
        };
        const next = [...state.events, event];
        set({ events: next, pets: persistPets(next) });
      },

      addNote: (petId, note, trainingUpdates) => {
        const state = get();
        const before = getLatestProfile(state.events, petId);
        const after: PetProfile = {
          ...before,
          ...(trainingUpdates || {}),
          aliases: trainingUpdates?.aliases ? [...trainingUpdates.aliases] : before.aliases,
          photoUrls: trainingUpdates?.photoUrls ? [...trainingUpdates.photoUrls] : before.photoUrls,
          latestNote: (before.latestNote ? before.latestNote + '；' : '') + note,
        };
        const event: PetEvent = {
          id: uid('evt'),
          petId,
          type: 'addendum',
          timestamp: Date.now(),
          operator: DEMO_OPERATOR,
          source: 'owner_supplement',
          note,
          snapshotBefore: before,
          snapshotAfter: after,
        };
        const nextEvents = [...state.events, event];
        const nextPets = persistPets(nextEvents);

        const beforePetsSnapshot = state.pets;
        set({ events: nextEvents, pets: nextPets });
        return computeDiffsBetween(beforePetsSnapshot, nextPets, [event]);
      },

      rejudgePet: (petId, oldJudge, newJudge, reason, additionalUpdates) => {
        const state = get();
        const before = getLatestProfile(state.events, petId);
        const after: PetProfile = {
          ...before,
          ...(additionalUpdates || {}),
          aliases: additionalUpdates?.aliases ? [...additionalUpdates.aliases] : before.aliases,
          photoUrls: additionalUpdates?.photoUrls ? [...additionalUpdates.photoUrls] : before.photoUrls,
          trainingJudge: newJudge,
        };
        const event: PetEvent = {
          id: uid('evt'),
          petId,
          type: 'rejudge',
          timestamp: Date.now(),
          operator: DEMO_OPERATOR,
          source: 'manual',
          note: `人工改判：${oldJudge} → ${newJudge}`,
          snapshotBefore: before,
          snapshotAfter: after,
          rejudgeReason: reason,
          oldJudge,
          newJudge,
        } as any;
        const next = [...state.events, event];
        set({ events: next, pets: persistPets(next) });
      },

      computeExportDiffSinceLast: () => {
        const state = get();
        if (!state.lastExport) {
          return computeDiffsBetween([], state.pets, state.events);
        }
        const newEventIds = state.lastExport.eventIds;
        const newEvents = state.events.filter((e) => !newEventIds.includes(e.id));
        return computeDiffsBetween(state.lastExport.snapshot, state.pets, newEvents);
      },

      buildExportSummary: () => {
        const state = get();
        return {
          totalRows: state.pets.length,
          anomalyRows: state.pets.filter((p) => p.anomalies.length > 0).length,
          diffs: state.computeExportDiffSinceLast(),
          generatedAt: Date.now(),
        };
      },

      markExported: () => {
        const state = get();
        set({
          lastExport: {
            snapshot: state.pets.map((p) => ({ ...p, aliases: [...p.aliases], photoUrls: [...p.photoUrls], anomalies: p.anomalies.map((a) => ({ ...a })) })),
            exportedAt: Date.now(),
            eventIds: state.events.map((e) => e.id),
          },
        });
      },

      exportCSVBlob: () => {
        const state = get();
        const header = EXPORT_FIELDS.map((f) => f.label);
        const rows = state.pets.map((pet) =>
          EXPORT_FIELDS.map((f) => {
            const v = profileToRowValue(pet, f.key);
            const s = v.replace(/"/g, '""');
            return /[",\n]/.test(s) ? `"${s}"` : s;
          }),
        );
        const csv = [header, ...rows].map((r) => r.join(',')).join('\n');
        const summary = state.buildExportSummary();
        let notes = '\n\n';
        notes += '# ====== 导出变更说明 ======\n';
        notes += `# 生成时间：${formatDate(summary.generatedAt)}\n`;
        notes += `# 总行数：${summary.totalRows}，异常行数：${summary.anomalyRows}\n`;
        if (summary.diffs.length) {
          notes += `# 与上次导出相比共 ${summary.diffs.length} 处变更：\n`;
          summary.diffs.forEach((d, i) => {
            const row = d.rowIndex > 0 ? `第${d.rowIndex}行` : '删除行';
            notes += `#   ${i + 1}. ${row}·${d.field}：${d.oldValue} → ${d.newValue}（${d.reason || d.eventType}）\n`;
          });
        } else {
          notes += '# 无差异（本次为首次导出或内容未变化）\n';
        }
        return new Blob(['\uFEFF' + csv + notes], { type: 'text/csv;charset=utf-8' });
      },

      exportJSONBlob: () => {
        const state = get();
        const summary = state.buildExportSummary();
        const payload = {
          exportedAt: formatDate(summary.generatedAt),
          summary: {
            totalRows: summary.totalRows,
            anomalyRows: summary.anomalyRows,
            diffCount: summary.diffs.length,
          },
          changesSinceLast: summary.diffs,
          pets: state.pets.map((p) => ({
            petId: p.petId,
            name: p.name,
            aliases: p.aliases,
            species: p.species,
            breed: p.breed,
            vaccineStatus: p.vaccineStatus,
            trainingProgress: p.trainingProgress,
            trainingJudge: p.trainingJudge,
            latestNote: p.latestNote,
            photoUrls: p.photoUrls,
            confirmed: p.confirmed,
            revoked: p.revoked,
            anomalies: p.anomalies,
            lastModifiedAt: formatDate(p.lastModifiedAt),
            eventCount: p.eventCount,
          })),
          eventLog: state.events,
        };
        return new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      },

      getEventsOfPet: (petId) =>
        get()
          .events.filter((e) => e.petId === petId)
          .sort((a, b) => b.timestamp - a.timestamp),

      getPetById: (petId) => get().pets.find((p) => p.petId === petId),
    }),
    {
      name: 'pet-training-tracking-v1',
      partialize: (state) => ({
        events: state.events,
        lastExport: state.lastExport,
        initializedWithDemo: state.initializedWithDemo,
      }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          try {
            state.pets = persistPets(state.events);
          } catch {
            /* noop */
          }
        }
      },
    },
  ),
);
