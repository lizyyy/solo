import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { DefectStatus, DefectType } from '../types';
import type { Building, Defect, FilterOptions, Photo, ReinspectionRecord } from '../types';
import { sampleBuildings, sampleDefects } from '../data/sampleData';

const STORAGE_KEY = 'glass-curtain-wall-inspector-data';
const REINSPECTION_KEY = 'glass-curtain-wall-reinspection';

export const useInspectorStore = defineStore('inspector', () => {
  const buildings = ref<Building[]>([]);
  const defects = ref<Defect[]>([]);
  const reinspectionRecords = ref<ReinspectionRecord[]>([]);
  const selectedBuildingId = ref<string | null>(null);
  const selectedDefect = ref<Defect | null>(null);
  const filterOptions = ref<FilterOptions>({});
  const isInitialized = ref(false);

  const generateId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`;

  const initializeStore = () => {
    if (isInitialized.value) return;
    
    const storedBuildings = localStorage.getItem(`${STORAGE_KEY}-buildings`);
    const storedDefects = localStorage.getItem(`${STORAGE_KEY}-defects`);
    const storedReinspection = localStorage.getItem(REINSPECTION_KEY);
    
    if (storedBuildings && storedDefects) {
      buildings.value = JSON.parse(storedBuildings);
      defects.value = JSON.parse(storedDefects);
    } else {
      buildings.value = JSON.parse(JSON.stringify(sampleBuildings));
      defects.value = JSON.parse(JSON.stringify(sampleDefects));
      persistData();
    }
    
    if (storedReinspection) {
      reinspectionRecords.value = JSON.parse(storedReinspection);
    }
    
    isInitialized.value = true;
  };

  const persistData = () => {
    localStorage.setItem(`${STORAGE_KEY}-buildings`, JSON.stringify(buildings.value));
    localStorage.setItem(`${STORAGE_KEY}-defects`, JSON.stringify(defects.value));
    localStorage.setItem(REINSPECTION_KEY, JSON.stringify(reinspectionRecords.value));
  };

  const resetToSampleData = () => {
    buildings.value = JSON.parse(JSON.stringify(sampleBuildings));
    defects.value = JSON.parse(JSON.stringify(sampleDefects));
    reinspectionRecords.value = [];
    selectedBuildingId.value = null;
    selectedDefect.value = null;
    filterOptions.value = {};
    persistData();
    console.log('[系统] 数据已重置为样例数据');
  };

  const selectedBuilding = computed(() => {
    return buildings.value.find(b => b.id === selectedBuildingId.value) || null;
  });

  const buildingDefects = computed(() => {
    if (!selectedBuildingId.value) return [];
    return defects.value.filter(d => d.buildingId === selectedBuildingId.value);
  });

  const filteredDefects = computed(() => {
    let result = [...defects.value];
    
    if (filterOptions.value.buildingId) {
      result = result.filter(d => d.buildingId === filterOptions.value.buildingId);
    }
    
    if (filterOptions.value.status) {
      result = result.filter(d => d.status === filterOptions.value.status);
    }
    
    if (filterOptions.value.type) {
      result = result.filter(d => d.type === filterOptions.value.type);
    }
    
    return result.sort((a, b) => b.updatedAt - a.updatedAt);
  });

  const defectStats = computed(() => {
    const total = defects.value.length;
    const pending = defects.value.filter(d => d.status === DefectStatus.PENDING).length;
    const inProgress = defects.value.filter(d => d.status === DefectStatus.IN_PROGRESS).length;
    const reinspected = defects.value.filter(d => d.status === DefectStatus.REINSPECTED).length;
    const closed = defects.value.filter(d => d.status === DefectStatus.CLOSED).length;
    const cracks = defects.value.filter(d => d.type === DefectType.CRACK).length;
    const looseness = defects.value.filter(d => d.type === DefectType.LOOSENESS).length;
    
    return { total, pending, inProgress, reinspected, closed, cracks, looseness };
  });

  const getDefectsAtPosition = (floor: number, column: number) => {
    if (!selectedBuildingId.value) return [];
    return defects.value.filter(d => 
      d.buildingId === selectedBuildingId.value &&
      d.floor === floor &&
      d.column === column
    );
  };

  const hasDefectAt = (floor: number, column: number) => {
    return getDefectsAtPosition(floor, column).length > 0;
  };

  const getPrimaryDefectType = (floor: number, column: number): DefectType | null => {
    const defectsAtPos = getDefectsAtPosition(floor, column);
    if (defectsAtPos.length === 0) return null;
    const active = defectsAtPos.filter(d => d.status !== DefectStatus.CLOSED);
    if (active.length > 0) return active[0].type;
    return defectsAtPos[0].type;
  };

  const selectBuilding = (buildingId: string | null) => {
    selectedBuildingId.value = buildingId;
    selectedDefect.value = null;
    console.log(`[选择] 建筑: ${buildingId || '全部'}`);
  };

  const selectDefect = (defect: Defect | null) => {
    selectedDefect.value = defect;
    if (defect) {
      console.log(`[选择] 缺陷: ${defect.id} (${defect.type})`);
    }
  };

  const setFilter = (options: FilterOptions) => {
    filterOptions.value = { ...filterOptions.value, ...options };
  };

  const clearFilter = () => {
    filterOptions.value = {};
  };

  const createDefect = (data: {
    buildingId: string;
    floor: number;
    column: number;
    type: DefectType;
    description: string;
    inspectionNote?: string;
    photos?: Photo[];
  }): Defect | null => {
    const building = buildings.value.find(b => b.id === data.buildingId);
    if (!building) {
      console.error('[错误] 创建缺陷失败：建筑不存在');
      return null;
    }
    
    if (data.floor < 1 || data.floor > building.floors) {
      console.error(`[错误] 创建缺陷失败：楼层 ${data.floor} 超出范围 (1-${building.floors})`);
      return null;
    }
    
    if (data.column < 1 || data.column > building.columns) {
      console.error(`[错误] 创建缺陷失败：列 ${data.column} 超出范围 (1-${building.columns})`);
      return null;
    }
    
    if (!data.description || data.description.trim().length === 0) {
      console.error('[错误] 创建缺陷失败：描述不能为空');
      return null;
    }
    
    const now = Date.now();
    const defect: Defect = {
      id: generateId('defect'),
      buildingId: data.buildingId,
      floor: data.floor,
      column: data.column,
      type: data.type,
      status: DefectStatus.PENDING,
      description: data.description,
      photos: data.photos || [],
      createdAt: now,
      updatedAt: now,
      inspectionNote: data.inspectionNote
    };
    
    defects.value.push(defect);
    persistData();
    console.log(`[创建] 缺陷: ${defect.id} @ ${data.floor}F-${data.column}列`);
    return defect;
  };

  const updateDefect = (defectId: string, updates: Partial<Defect>) => {
    const index = defects.value.findIndex(d => d.id === defectId);
    if (index === -1) {
      console.error(`[错误] 更新失败：缺陷 ${defectId} 不存在`);
      return false;
    }
    
    defects.value[index] = {
      ...defects.value[index],
      ...updates,
      updatedAt: Date.now()
    };
    
    if (selectedDefect.value?.id === defectId) {
      selectedDefect.value = defects.value[index];
    }
    
    persistData();
    console.log(`[更新] 缺陷: ${defectId}`);
    return true;
  };

  const transitionStatus = (defectId: string, newStatus: DefectStatus, note: string) => {
    const defect = defects.value.find(d => d.id === defectId);
    if (!defect) {
      console.error(`[错误] 状态流转失败：缺陷 ${defectId} 不存在`);
      return false;
    }
    
    const validTransitions: Record<DefectStatus, DefectStatus[]> = {
      [DefectStatus.PENDING]: [DefectStatus.IN_PROGRESS, DefectStatus.CLOSED],
      [DefectStatus.IN_PROGRESS]: [DefectStatus.REINSPECTED, DefectStatus.CLOSED],
      [DefectStatus.REINSPECTED]: [DefectStatus.IN_PROGRESS, DefectStatus.CLOSED],
      [DefectStatus.CLOSED]: [DefectStatus.IN_PROGRESS]
    };
    
    if (!validTransitions[defect.status].includes(newStatus)) {
      console.error(`[错误] 非法状态流转: ${defect.status} -> ${newStatus}`);
      return false;
    }
    
    const previousStatus = defect.status;
    const record: ReinspectionRecord = {
      id: generateId('record'),
      defectId,
      previousStatus,
      newStatus,
      note: note || '无备注',
      operator: '巡检员',
      timestamp: Date.now()
    };
    
    reinspectionRecords.value.push(record);
    
    const updateData: Partial<Defect> = {
      status: newStatus,
      updatedAt: Date.now()
    };
    
    if (newStatus === DefectStatus.REINSPECTED || newStatus === DefectStatus.CLOSED) {
      updateData.reinspectionNote = note;
    }
    
    const result = updateDefect(defectId, updateData);
    persistData();
    console.log(`[流转] 状态: ${previousStatus} -> ${newStatus} (缺陷: ${defectId})`);
    return result;
  };

  const getDefectHistory = (defectId: string) => {
    return reinspectionRecords.value
      .filter(r => r.defectId === defectId)
      .sort((a, b) => b.timestamp - a.timestamp);
  };

  const addPhoto = (defectId: string, photo: Photo) => {
    const defect = defects.value.find(d => d.id === defectId);
    if (!defect) return false;
    
    defect.photos.push(photo);
    defect.updatedAt = Date.now();
    persistData();
    console.log(`[添加] 照片: ${photo.name} -> 缺陷 ${defectId}`);
    return true;
  };

  const removePhoto = (defectId: string, photoId: string) => {
    const defect = defects.value.find(d => d.id === defectId);
    if (!defect) return false;
    
    const index = defect.photos.findIndex(p => p.id === photoId);
    if (index === -1) return false;
    
    defect.photos.splice(index, 1);
    defect.updatedAt = Date.now();
    persistData();
    console.log(`[删除] 照片: ${photoId} <- 缺陷 ${defectId}`);
    return true;
  };

  const deleteDefect = (defectId: string) => {
    const index = defects.value.findIndex(d => d.id === defectId);
    if (index === -1) return false;
    
    defects.value.splice(index, 1);
    if (selectedDefect.value?.id === defectId) {
      selectedDefect.value = null;
    }
    persistData();
    console.log(`[删除] 缺陷: ${defectId}`);
    return true;
  };

  const exportToJSON = (buildingId?: string) => {
    let dataToExport = defects.value;
    if (buildingId) {
      dataToExport = defects.value.filter(d => d.buildingId === buildingId);
    }
    
    const exportData = {
      exportTime: new Date().toISOString(),
      version: '1.0.0',
      buildings: buildingId 
        ? buildings.value.filter(b => b.id === buildingId)
        : buildings.value,
      defects: dataToExport,
      stats: buildingId ? {
        total: dataToExport.length,
        pending: dataToExport.filter(d => d.status === DefectStatus.PENDING).length,
        inProgress: dataToExport.filter(d => d.status === DefectStatus.IN_PROGRESS).length,
        reinspected: dataToExport.filter(d => d.status === DefectStatus.REINSPECTED).length,
        closed: dataToExport.filter(d => d.status === DefectStatus.CLOSED).length
      } : defectStats.value
    };
    
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspection-report-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`[导出] JSON报告: ${dataToExport.length} 条缺陷记录`);
    return exportData;
  };

  const exportToCSV = (buildingId?: string) => {
    let dataToExport = defects.value;
    if (buildingId) {
      dataToExport = defects.value.filter(d => d.buildingId === buildingId);
    }
    
    const buildingMap = new Map(buildings.value.map(b => [b.id, b.name]));
    
    const headers = ['缺陷ID', '建筑', '楼层', '列', '类型', '状态', '描述', '照片数', '创建时间', '更新时间'];
    
    const typeLabels: Record<DefectType, string> = {
      [DefectType.CRACK]: '裂纹',
      [DefectType.LOOSENESS]: '松动'
    };
    
    const statusLabels: Record<DefectStatus, string> = {
      [DefectStatus.PENDING]: '待处理',
      [DefectStatus.IN_PROGRESS]: '处理中',
      [DefectStatus.REINSPECTED]: '已复检',
      [DefectStatus.CLOSED]: '已关闭'
    };
    
    const formatDate = (ts: number) => new Date(ts).toLocaleString('zh-CN');
    
    const rows = dataToExport.map(d => [
      d.id,
      buildingMap.get(d.buildingId) || d.buildingId,
      d.floor,
      d.column,
      typeLabels[d.type],
      statusLabels[d.status],
      `"${d.description.replace(/"/g, '""')}"`,
      d.photos.length,
      formatDate(d.createdAt),
      formatDate(d.updatedAt)
    ]);
    
    const csv = '\uFEFF' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspection-report-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    console.log(`[导出] CSV报告: ${rows.length} 行数据`);
    return { headers, rows, count: rows.length };
  };

  return {
    isInitialized,
    buildings,
    defects,
    reinspectionRecords,
    selectedBuildingId,
    selectedDefect,
    filterOptions,
    selectedBuilding,
    buildingDefects,
    filteredDefects,
    defectStats,
    initializeStore,
    resetToSampleData,
    selectBuilding,
    selectDefect,
    setFilter,
    clearFilter,
    getDefectsAtPosition,
    hasDefectAt,
    getPrimaryDefectType,
    createDefect,
    updateDefect,
    transitionStatus,
    getDefectHistory,
    addPhoto,
    removePhoto,
    deleteDefect,
    exportToJSON,
    exportToCSV,
    generateId
  };
});
