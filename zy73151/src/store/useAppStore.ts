import { create } from 'zustand';
import type { Material, Anomaly, Station, FilterState, LabRecord, EvidenceItem, MaterialSource } from '@/types';
import { stations as mockStations } from '@/data/stations';
import { materials as mockMaterials } from '@/data/materials';
import { detectAllAnomalies } from '@/utils/anomalyDetector';
import { parseCSV, ParseResult } from '@/utils/csvParser';

const generateId = () => Math.random().toString(36).substring(2, 11);

interface UploadResult {
  material: Material;
  parseResult: ParseResult;
  newAnomalies: number;
}

interface AppState {
  materials: Material[];
  stations: Station[];
  anomalies: Anomaly[];
  selectedStationId: string | null;
  selectedAnomalyId: string | null;
  filter: FilterState;
  sidebarCollapsed: boolean;
  lastUpload: UploadResult | null;

  addMaterial: (material: Material) => void;
  updateMaterial: (id: string, data: Partial<Material>) => void;
  detectAnomalies: () => void;
  setAnomalyStatus: (id: string, status: 'confirmed' | 'pending') => void;
  selectStation: (id: string | null) => void;
  selectAnomaly: (id: string | null) => void;
  setFilter: (filter: Partial<FilterState>) => void;
  toggleSidebar: () => void;
  getFilteredAnomalies: () => Anomaly[];
  getStationAnomalies: (stationId: string) => Anomaly[];

  uploadCSV: (file: File, source: MaterialSource, customName?: string) => Promise<UploadResult>;
  addVerbalNote: (content: string, affectedStationIds?: string[], changesJudgment?: boolean) => UploadResult;
  addEvidenceToAnomaly: (anomalyId: string, evidence: Omit<EvidenceItem, 'id'>) => void;
  markAllStatusByType: (type: string, status: 'confirmed' | 'pending') => void;
  resetToMockData: () => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  materials: mockMaterials,
  stations: mockStations,
  anomalies: detectAllAnomalies(mockMaterials),
  selectedStationId: null,
  selectedAnomalyId: null,
  filter: {
    type: 'all',
    status: 'all',
    severity: 'all',
    stationId: 'all',
  },
  sidebarCollapsed: false,
  lastUpload: null,

  addMaterial: (material) => {
    set((state) => {
      const updatedMats = state.materials.map(m => ({
        ...m,
        isLatest: false,
      }));
      const newMaterials = [...updatedMats, material];
      const newAnomalies = detectAllAnomalies(newMaterials);
      return {
        materials: newMaterials,
        anomalies: newAnomalies,
      };
    });
  },

  updateMaterial: (id, data) => {
    set((state) => {
      const newMaterials = state.materials.map(m =>
        m.id === id ? { ...m, ...data } : m
      );
      const newAnomalies = detectAllAnomalies(newMaterials);
      return { materials: newMaterials, anomalies: newAnomalies };
    });
  },

  detectAnomalies: () => {
    set((state) => ({
      anomalies: detectAllAnomalies(state.materials),
    }));
  },

  setAnomalyStatus: (id, status) => {
    set((state) => ({
      anomalies: state.anomalies.map(a =>
        a.id === id ? { ...a, status } : a
      ),
    }));
  },

  selectStation: (id) => {
    set({ selectedStationId: id });
  },

  selectAnomaly: (id) => {
    set({ selectedAnomalyId: id });
  },

  setFilter: (filter) => {
    set((state) => ({
      filter: { ...state.filter, ...filter },
    }));
  },

  toggleSidebar: () => {
    set((state) => ({ sidebarCollapsed: !state.sidebarCollapsed }));
  },

  getFilteredAnomalies: () => {
    const { anomalies, filter } = get();
    return anomalies.filter(a => {
      if (filter.type !== 'all' && a.type !== filter.type) return false;
      if (filter.status !== 'all' && a.status !== filter.status) return false;
      if (filter.severity !== 'all' && a.severity !== filter.severity) return false;
      if (filter.stationId !== 'all' && a.stationId !== filter.stationId) return false;
      return true;
    });
  },

  getStationAnomalies: (stationId) => {
    const { anomalies } = get();
    return anomalies.filter(a => a.stationId === stationId);
  },

  uploadCSV: async (file, source, customName) => {
    const text = await file.text();
    const materialId = `mat-${generateId()}`;
    const parseResult = parseCSV(text, materialId);

    const version = get().materials.filter(m => m.source === source).length + 1;
    const now = new Date();
    const nowStr = now.toISOString().replace('T', ' ').slice(0, 19);

    const sourceNames: Record<MaterialSource, string> = {
      lab_result: '实验室结果表',
      late_attachment: '晚到附件',
      verbal_note: '口头说明',
    };

    const description = parseResult.warnings.length > 0
      ? `导入：${parseResult.records.length}条记录。警告：${parseResult.warnings.join('；')}`
      : `成功导入 ${parseResult.records.length} 条记录`;

    const material: Material = {
      id: materialId,
      name: customName || `${sourceNames[source]}_${now.toISOString().slice(0, 10)}_v${version}`,
      source,
      version,
      uploadTime: nowStr,
      content: text.slice(0, 500),
      parsedData: parseResult.records,
      isLatest: true,
      description,
    };

    const existingIds = new Set(get().stations.map(s => s.id));
    const newStations: Station[] = parseResult.stationsFound
      .filter(s => !existingIds.has(s.id))
      .map((s, idx) => ({
        ...s,
        x: 100 + Math.random() * 260,
        y: 60 + Math.random() * 280,
        area: '新增监测点',
      }));

    const currentAnomalyCount = get().anomalies.length;

    set((state) => {
      const updatedMats = state.materials.map(m => ({
        ...m,
        isLatest: false,
      }));
      return {
        materials: [...updatedMats, material],
        stations: [...state.stations, ...newStations],
        lastUpload: {
          material,
          parseResult,
          newAnomalies: 0,
        },
      };
    });

    set((state) => ({
      anomalies: detectAllAnomalies(state.materials),
    }));

    const finalAnomalyCount = get().anomalies.length;
    const result: UploadResult = {
      material,
      parseResult,
      newAnomalies: finalAnomalyCount - currentAnomalyCount,
    };

    set({ lastUpload: result });
    return result;
  },

  addVerbalNote: (content, affectedStationIds, changesJudgment) => {
    const materialId = `mat-verbal-${generateId()}`;
    const version = get().materials.filter(m => m.source === 'verbal_note').length + 1;
    const now = new Date();
    const nowStr = now.toISOString().replace('T', ' ').slice(0, 19);

    const parsedStations = affectedStationIds && affectedStationIds.length > 0
      ? affectedStationIds
      : content.match(/S\d{3}|东港|南湾|西礁|北滩|中央|东南|西北/g)
        ?.map(name => {
          const map: Record<string, string> = {
            '东港': 'S001', '南湾': 'S003', '西礁': 'S004',
            '北滩': 'S005', '中央': 'S006', '东南': 'S007', '西北': 'S008',
          };
          if (name.startsWith('S')) return name;
          return map[name] || 'S001';
        }) || [];

    const uniqueStations = [...new Set(parsedStations)].slice(0, 5);

    const allStations = get().stations;
    const stationNameForNote = uniqueStations.length > 0
      ? allStations.find(s => s.id === uniqueStations[0])?.name || '多个点位'
      : '综合说明';

    const parsedData: LabRecord[] = [];

    const description = changesJudgment
      ? '本说明改变了原判断口径，请结合证据链重新评估结论'
      : '补充说明材料';

    const material: Material = {
      id: materialId,
      name: `口头说明_${stationNameForNote}_v${version}`,
      source: 'verbal_note',
      version,
      uploadTime: nowStr,
      content,
      parsedData,
      isLatest: true,
      description,
    };

    const existingIds = new Set(get().materials.map(m => m.id));
    const affectedMatIds = [...existingIds].slice(-2);

    const currentAnomalyCount = get().anomalies.length;

    set((state) => {
      const updatedMats = state.materials.map(m => ({
        ...m,
        isLatest: false,
      }));

      const updatedAnomalies = changesJudgment && uniqueStations.length > 0
        ? state.anomalies.map(a => {
          if (!uniqueStations.includes(a.stationId)) return a;

          const newEvidence: EvidenceItem = {
            id: generateId(),
            materialId,
            materialName: material.name,
            version,
            timestamp: nowStr,
            content,
            isVerbal: true,
            changeType: 'modify',
            fieldName: 'judgment',
            previousValue: '原判断',
            currentValue: '口头说明后修正',
          };

          return {
            ...a,
            evidenceChain: [...a.evidenceChain, newEvidence],
            conclusionChange: `${a.conclusionChange}（注：口头说明已改变口径：${content.slice(0, 50)}${content.length > 50 ? '...' : ''}）`,
            materialIds: [...new Set([...a.materialIds, materialId])],
            materialNames: [...new Set([...a.materialNames, material.name])],
          };
        })
        : state.anomalies;

      return {
        materials: [...updatedMats, material],
        anomalies: updatedAnomalies,
      };
    });

    const finalAnomalyCount = get().anomalies.length;
    const result: UploadResult = {
      material,
      parseResult: {
        records: parsedData,
        headers: [],
        warnings: changesJudgment ? ['本口头说明标记为改变判断口径'] : [],
        stationsFound: [],
      },
      newAnomalies: finalAnomalyCount - currentAnomalyCount,
    };

    set({ lastUpload: result });
    return result;
  },

  addEvidenceToAnomaly: (anomalyId, evidence) => {
    set((state) => ({
      anomalies: state.anomalies.map(a => {
        if (a.id !== anomalyId) return a;
        return {
          ...a,
          evidenceChain: [...a.evidenceChain, { ...evidence, id: generateId() }],
        };
      }),
    }));
  },

  markAllStatusByType: (type, status) => {
    set((state) => ({
      anomalies: state.anomalies.map(a =>
        type === 'all' || a.type === type ? { ...a, status } : a
      ),
    }));
  },

  resetToMockData: () => {
    set({
      materials: mockMaterials,
      stations: mockStations,
      anomalies: detectAllAnomalies(mockMaterials),
      lastUpload: null,
    });
  },
}));
