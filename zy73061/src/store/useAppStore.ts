import { create } from 'zustand';
import type {
  InspectionRecord,
  WarningAlert,
  ThresholdRule,
  FormulaVersion,
  TimelineItem,
  DuplicateGroup,
} from '@/types';
import {
  inspectionRecords,
  warningAlerts,
  thresholdRules,
  formulaVersions,
  timelineItems,
} from '@/data/mockData';
import { detectDuplicates, markDuplicatesInRecords } from '@/utils/detector';

interface AppState {
  records: InspectionRecord[];
  warnings: WarningAlert[];
  rules: ThresholdRule[];
  versions: FormulaVersion[];
  timeline: TimelineItem[];
  duplicates: DuplicateGroup[];
  selectedRecordId: string | null;
  drawerOpen: boolean;
  confirmPanelOpenFor: string | null;
  confirmedDuplicates: Record<string, string>;

  setSelectedRecordId: (id: string | null) => void;
  setDrawerOpen: (open: boolean) => void;
  openConfirmPanel: (equipmentNo: string) => void;
  closeConfirmPanel: () => void;
  confirmDuplicate: (equipmentNo: string, chosenRecordId: string) => void;
  getWarningsByLevel: (level: string) => WarningAlert[];
  getCurrentVersion: () => FormulaVersion | undefined;
  getRecordById: (id: string) => InspectionRecord | undefined;
}

const initialRecords = markDuplicatesInRecords(inspectionRecords);
const initialDuplicates = detectDuplicates(initialRecords, warningAlerts);

export const useAppStore = create<AppState>((set, get) => ({
  records: initialRecords,
  warnings: warningAlerts,
  rules: thresholdRules,
  versions: formulaVersions,
  timeline: timelineItems,
  duplicates: initialDuplicates,
  selectedRecordId: null,
  drawerOpen: false,
  confirmPanelOpenFor: null,
  confirmedDuplicates: {},

  setSelectedRecordId: (id) => set({ selectedRecordId: id, drawerOpen: id !== null }),
  setDrawerOpen: (open) => set({ drawerOpen: open, selectedRecordId: open ? get().selectedRecordId : null }),
  openConfirmPanel: (equipmentNo) => set({ confirmPanelOpenFor: equipmentNo }),
  closeConfirmPanel: () => set({ confirmPanelOpenFor: null }),
  confirmDuplicate: (equipmentNo, chosenRecordId) => {
    const { confirmedDuplicates, records, warnings } = get();
    const newConfirmed = { ...confirmedDuplicates, [equipmentNo]: chosenRecordId };
    const newRecords = records.map((r) =>
      r.equipment_no === equipmentNo
        ? { ...r, status: r.id === chosenRecordId ? ('confirmed' as const) : r.status, is_duplicate: false }
        : r,
    );
    const newWarnings = warnings.map((w) => {
      const rec = newRecords.find((r) => r.id === w.record_id);
      if (rec && rec.equipment_no === equipmentNo && rec.id !== chosenRecordId) {
        return { ...w, change_reason: `人工确认后已采信记录 ${chosenRecordId}，本条预警作废` };
      }
      return w;
    });
    const newDuplicates = detectDuplicates(newRecords, newWarnings);
    set({
      confirmedDuplicates: newConfirmed,
      records: newRecords,
      warnings: newWarnings,
      duplicates: newDuplicates,
      confirmPanelOpenFor: null,
    });
  },

  getWarningsByLevel: (level) => get().warnings.filter((w) => w.level === level),
  getCurrentVersion: () => get().versions.find((v) => v.is_current),
  getRecordById: (id) => get().records.find((r) => r.id === id),
}));
