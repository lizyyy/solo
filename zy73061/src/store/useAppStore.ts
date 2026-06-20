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
  thresholdRules,
  formulaVersions,
  timelineItems,
} from '@/data/mockData';
import { detectDuplicates, markDuplicatesInRecords } from '@/utils/detector';
import { buildWarnings } from '@/utils/calculator';

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
  getCurrentVersion: () => FormulaVersion | undefined;
  getRecordById: (id: string) => InspectionRecord | undefined;
}

const initialRecords = markDuplicatesInRecords(inspectionRecords);
const initialWarnings = buildWarnings(initialRecords, thresholdRules);
const initialDuplicates = detectDuplicates(initialRecords, initialWarnings);

function nowStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export const useAppStore = create<AppState>((set, get) => ({
  records: initialRecords,
  warnings: initialWarnings,
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
    const { confirmedDuplicates, records, warnings, timeline, rules } = get();
    const newConfirmed = { ...confirmedDuplicates, [equipmentNo]: chosenRecordId };

    const newRecords = records.map((r) => {
      if (r.equipment_no !== equipmentNo) return r;
      if (r.id === chosenRecordId) {
        return { ...r, status: 'confirmed' as const, is_duplicate: false };
      }
      return { ...r, status: 'normal' as const, is_duplicate: false };
    });

    const chosenRecord = newRecords.find((r) => r.id === chosenRecordId);
    const voidedRecord = records.find(
      (r) => r.equipment_no === equipmentNo && r.id !== chosenRecordId,
    );

    const newWarnings = warnings.map((w) => {
      const rec = newRecords.find((r) => r.id === w.record_id);
      if (!rec || rec.equipment_no !== equipmentNo) return w;
      if (w.record_id === chosenRecordId) {
        return {
          ...w,
          status: 'active' as const,
          voided_reason: undefined,
          change_reason: `人工确认采信本条（${chosenRecord?.inspector || ''}），数值生效`,
        };
      }
      return {
        ...w,
        status: 'voided' as const,
        voided_reason: `设备${equipmentNo}重复确认：采信 ${chosenRecordId}，本条对应预警作废并移出统计`,
      };
    });

    const rule = chosenRecord ? rules.find((r) => r.metric === chosenRecord.metric_type) : undefined;
    const appendItems: TimelineItem[] = [];
    if (chosenRecord && rule) {
      appendItems.push({
        id: `tl-confirm-${equipmentNo}-${Date.now()}`,
        record_id: chosenRecord.id,
        date: nowStr(),
        equipment_no: equipmentNo,
        pipeline_name: chosenRecord.pipeline_name,
        value: chosenRecord.measured_value,
        unit: chosenRecord.measure_unit,
        level: newWarnings.find((w) => w.record_id === chosenRecord.id)?.level ?? 'green',
        formula_version: rule.formula_version,
        is_current_version: true,
        change_reason: `人工确认采信本条（${chosenRecord.inspector}），${equipmentNo} 设备预警数值生效`,
        event_type: 'confirm',
      });
    }
    if (voidedRecord) {
      appendItems.push({
        id: `tl-void-${equipmentNo}-${Date.now()}`,
        record_id: voidedRecord.id,
        date: nowStr(),
        equipment_no: equipmentNo,
        pipeline_name: voidedRecord.pipeline_name,
        value: voidedRecord.measured_value,
        unit: voidedRecord.measure_unit,
        level: newWarnings.find((w) => w.record_id === voidedRecord.id)?.level ?? 'green',
        formula_version: 'v2.3',
        is_current_version: true,
        change_reason: `重复确认后未采信本条，对应预警作废并从汇总/明细统计中剔除`,
        event_type: 'void',
      });
    }

    const newDuplicates = detectDuplicates(newRecords, newWarnings);
    set({
      confirmedDuplicates: newConfirmed,
      records: newRecords,
      warnings: newWarnings,
      timeline: [...timeline, ...appendItems],
      duplicates: newDuplicates,
      confirmPanelOpenFor: null,
    });
  },

  getCurrentVersion: () => get().versions.find((v) => v.is_current),
  getRecordById: (id) => get().records.find((r) => r.id === id),
}));
