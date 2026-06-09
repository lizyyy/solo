import { create } from 'zustand';
import type { WorkOrder, Evidence, TempMaterial, PlaybackVersion } from '@/types';
import { mockWorkOrders } from '@/data/mockData';

interface Statistics {
  totalAbnormal: number;
  delayedArrival: number;
  replacementBlocked: number;
  pendingEvidences: number;
}

interface AbnormalEvent {
  id: string;
  workOrderId: string;
  sparePartId?: string;
  type: 'delayed_arrival' | 'replacement_blocked';
  startTime: Date;
  endTime: Date;
  description: string;
  workOrderRange: { start: Date; end: Date };
}

interface PlaybackState {
  workOrders: WorkOrder[];
  selectedOrderId: string;
  highlightAbnormalId: string | null;
  scrollTarget: string | null;
  statistics: Statistics;
  abnormalTimeline: AbnormalEvent[];

  selectOrder: (id: string) => void;
  highlightAbnormal: (abnormalId: string | null) => void;
  setScrollTarget: (target: string | null) => void;
  updateTempMaterialRemark: (orderId: string, materialId: string, remark: string) => void;
  updateEvidenceStatus: (orderId: string, evidenceId: string, status: 'confirmed' | 'pending', remark?: string) => void;
  addPlaybackVersion: (orderId: string, changes: string[], operator: string) => void;
}

const STORAGE_KEY = 'pump_playback_state_v1';

function loadFromStorage(): WorkOrder[] | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      return JSON.parse(raw);
    }
  } catch {
    return null;
  }
  return null;
}

function saveToStorage(orders: WorkOrder[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
  } catch {
    /* ignore */
  }
}

function calcStatistics(orders: WorkOrder[]): Statistics {
  let delayedArrival = 0;
  let replacementBlocked = 0;
  let pendingEvidences = 0;
  orders.forEach((o) => {
    o.spareParts.forEach((sp) => {
      if (sp.status === 'delayed') delayedArrival++;
      if (sp.status === 'replaced_blocked') replacementBlocked++;
    });
    o.evidences.forEach((e) => {
      if (e.status === 'pending') pendingEvidences++;
    });
  });
  return {
    totalAbnormal: delayedArrival + replacementBlocked,
    delayedArrival,
    replacementBlocked,
    pendingEvidences,
  };
}

function calcAbnormalTimeline(orders: WorkOrder[]): AbnormalEvent[] {
  const events: AbnormalEvent[] = [];
  orders.forEach((o) => {
    const woStart = new Date(o.plannedStartTime.replace(' ', 'T'));
    const woEnd = new Date(o.plannedEndTime.replace(' ', 'T'));
    o.spareParts.forEach((sp) => {
      if (sp.status === 'delayed') {
        const start = new Date(sp.requiredByTime.replace(' ', 'T'));
        const end = new Date(sp.actualArrivalTime.replace(' ', 'T'));
        events.push({
          id: `ab-${o.id}-${sp.id}`,
          workOrderId: o.id,
          sparePartId: sp.id,
          type: 'delayed_arrival',
          startTime: start,
          endTime: end,
          description: `${sp.name}（${sp.modelNo}）到货延误 ${Math.round((end.getTime() - start.getTime()) / 60000)} 分钟`,
          workOrderRange: { start: woStart, end: woEnd },
        });
      } else if (sp.status === 'replaced_blocked' && sp.replacement) {
        const start = new Date(sp.replacement.applyTime.replace(' ', 'T'));
        const end = new Date(sp.actualArrivalTime.replace(' ', 'T'));
        events.push({
          id: `ab-${o.id}-${sp.id}`,
          workOrderId: o.id,
          sparePartId: sp.id,
          type: 'replacement_blocked',
          startTime: start,
          endTime: end,
          description: `${sp.name} 型号替换被拦截，正确型号到货耗时 ${Math.round((end.getTime() - start.getTime()) / 3600000)} 小时`,
          workOrderRange: { start: woStart, end: woEnd },
        });
      }
    });
  });
  return events;
}

const initialOrders = loadFromStorage() ?? mockWorkOrders;

export const usePlaybackStore = create<PlaybackState>((set, get) => ({
  workOrders: initialOrders,
  selectedOrderId: initialOrders[0]?.id ?? '',
  highlightAbnormalId: null,
  scrollTarget: null,
  statistics: calcStatistics(initialOrders),
  abnormalTimeline: calcAbnormalTimeline(initialOrders),

  selectOrder: (id) => set({ selectedOrderId: id, highlightAbnormalId: null }),

  highlightAbnormal: (abnormalId) => set({ highlightAbnormalId: abnormalId }),

  setScrollTarget: (target) => set({ scrollTarget: target }),

  updateTempMaterialRemark: (orderId, materialId, remark) => {
    const updated = get().workOrders.map((o) => {
      if (o.id !== orderId) return o;
      const newMats = o.tempMaterials.map((m) => {
        if (m.id !== materialId) return m;
        return {
          ...m,
          remark,
          remarkVersion: m.remarkVersion + 1,
          remarkUpdatedAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        };
      });
      return { ...o, tempMaterials: newMats };
    });
    saveToStorage(updated);
    set({ workOrders: updated, statistics: calcStatistics(updated), abnormalTimeline: calcAbnormalTimeline(updated) });
  },

  updateEvidenceStatus: (orderId, evidenceId, status, remark) => {
    const updated = get().workOrders.map((o) => {
      if (o.id !== orderId) return o;
      const newEvs = o.evidences.map((e) => {
        if (e.id !== evidenceId) return e;
        return {
          ...e,
          status,
          remark: remark ?? e.remark,
          uploadTime: status === 'confirmed' && !e.uploadTime ? new Date().toISOString().replace('T', ' ').slice(0, 16) : e.uploadTime,
          uploader: status === 'confirmed' && !e.uploader ? '当前用户' : e.uploader,
        } as Evidence;
      });
      return { ...o, evidences: newEvs };
    });
    saveToStorage(updated);
    set({ workOrders: updated, statistics: calcStatistics(updated), abnormalTimeline: calcAbnormalTimeline(updated) });
  },

  addPlaybackVersion: (orderId, changes, operator) => {
    const updated = get().workOrders.map((o) => {
      if (o.id !== orderId) return o;
      const lastVer = o.versions[o.versions.length - 1];
      const baseNum = lastVer ? parseFloat(lastVer.version.replace('v', '')) : 0.9;
      const newNum = (baseNum + 0.1).toFixed(1);
      const newVersion: PlaybackVersion = {
        version: `v${newNum}`,
        runAt: new Date().toISOString().replace('T', ' ').slice(0, 16),
        changes,
        operator,
        snapshot: JSON.parse(JSON.stringify(o)),
      };
      return { ...o, versions: [...o.versions, newVersion] };
    });
    saveToStorage(updated);
    set({ workOrders: updated, statistics: calcStatistics(updated), abnormalTimeline: calcAbnormalTimeline(updated) });
  },
}));
