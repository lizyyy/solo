import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  AppState,
  JunctionPhoto,
  BusCardRecord,
  CommunityNameMap,
  ConflictRecord,
  SummaryVersion,
  OperationLog,
  SelfCheckReport,
  WorkflowStep
} from '@/types';
import { generateId, formatDateTime, generateBatchId } from '@/utils/common';
import { runFullSelfCheck } from '@/utils/selfCheck';
import { detectAllConflicts, detectCommunityNameConflicts } from '@/utils/conflictDetector';
import { autoDetectNameMaps, applyNameMapping } from '@/utils/nameMapper';
import { generateAllMockData } from '@/utils/mockData';

interface AppActions {
  setCurrentStep: (step: WorkflowStep) => void;
  setCurrentBatch: (batch: string) => void;
  addPhotos: (photos: JunctionPhoto[]) => void;
  updatePhoto: (id: string, updates: Partial<JunctionPhoto>) => void;
  deletePhoto: (id: string) => void;
  addBusRecords: (records: BusCardRecord[]) => void;
  updateBusRecord: (id: string, updates: Partial<BusCardRecord>) => void;
  deleteBusRecord: (id: string) => void;
  resolveConflict: (id: string, status: 'confirmed' | 'rejected', note?: string) => void;
  addNameMap: (nameMap: Omit<CommunityNameMap, 'id'>) => void;
  reviewNameMap: (id: string, status: 'confirmed' | 'rejected', reviewer?: string) => void;
  generateSummary: () => SummaryVersion;
  runSelfCheck: () => SelfCheckReport;
  runConflictDetection: () => void;
  runNameDetection: () => void;
  addLog: (log: Omit<OperationLog, 'id' | 'timestamp'>) => void;
  exportData: () => string;
  importData: (json: string) => void;
  loadMockData: () => void;
  clearAllData: () => void;
  getCanonicalCommunityNames: () => string[];
}

const initialState: AppState = {
  photos: [],
  busRecords: [],
  nameMaps: [],
  conflicts: [],
  summaries: [],
  logs: [],
  selfCheckReports: [],
  currentStep: 1,
  currentBatch: generateBatchId(),
  currentUser: '交通协管-老马'
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      setCurrentStep: (step) => set({ currentStep: step }),

      setCurrentBatch: (batch) => set({ currentBatch: batch }),

      addPhotos: (photos) => {
        const state = get();
        const newPhotos = photos.map(p => ({
          ...p,
          id: p.id || generateId(),
          uploadTime: p.uploadTime || formatDateTime(),
          importBatch: p.importBatch || state.currentBatch
        }));
        set({ photos: [...state.photos, ...newPhotos] });
        
        newPhotos.forEach(photo => {
          get().addLog({
            operator: state.currentUser,
            action: '导入照片',
            targetType: 'JunctionPhoto',
            targetId: photo.id,
            detail: `导入照片：${photo.fileName}（${photo.communityName}）`
          });
        });
        
        get().runConflictDetection();
        get().runNameDetection();
      },

      updatePhoto: (id, updates) => {
        const state = get();
        const photo = state.photos.find(p => p.id === id);
        set({
          photos: state.photos.map(p =>
            p.id === id ? { ...p, ...updates } : p
          )
        });
        get().addLog({
          operator: state.currentUser,
          action: '更新照片',
          targetType: 'JunctionPhoto',
          targetId: id,
          detail: `更新照片信息：${photo?.fileName || id}`,
          before: photo,
          after: { ...photo, ...updates }
        });
      },

      deletePhoto: (id) => {
        const state = get();
        const photo = state.photos.find(p => p.id === id);
        set({
          photos: state.photos.filter(p => p.id !== id)
        });
        get().addLog({
          operator: state.currentUser,
          action: '删除照片',
          targetType: 'JunctionPhoto',
          targetId: id,
          detail: `删除照片：${photo?.fileName || id}`
        });
      },

      addBusRecords: (records) => {
        const state = get();
        const newRecords = records.map(r => ({
          ...r,
          id: r.id || generateId(),
          importBatch: r.importBatch || state.currentBatch,
          isSupplementary: r.isSupplementary || false
        }));
        set({ busRecords: [...state.busRecords, ...newRecords] });
        
        newRecords.forEach(record => {
          get().addLog({
            operator: state.currentUser,
            action: record.isSupplementary ? '补录公交数据' : '导入公交数据',
            targetType: 'BusCardRecord',
            targetId: record.id,
            detail: `${record.isSupplementary ? '补录' : '导入'}公交数据：${record.communityName} ${record.timeSlot}（${record.cardCount}次）`
          });
        });
        
        get().runConflictDetection();
        get().runNameDetection();
      },

      updateBusRecord: (id, updates) => {
        const state = get();
        const record = state.busRecords.find(r => r.id === id);
        set({
          busRecords: state.busRecords.map(r =>
            r.id === id ? { ...r, ...updates } : r
          )
        });
        get().addLog({
          operator: state.currentUser,
          action: '更新公交数据',
          targetType: 'BusCardRecord',
          targetId: id,
          detail: `更新公交数据：${record?.communityName || id}`,
          before: record,
          after: { ...record, ...updates }
        });
      },

      deleteBusRecord: (id) => {
        const state = get();
        const record = state.busRecords.find(r => r.id === id);
        set({
          busRecords: state.busRecords.filter(r => r.id !== id)
        });
        get().addLog({
          operator: state.currentUser,
          action: '删除公交数据',
          targetType: 'BusCardRecord',
          targetId: id,
          detail: `删除公交数据：${record?.communityName || id}`
        });
      },

      resolveConflict: (id, status, note) => {
        const state = get();
        const conflict = state.conflicts.find(c => c.id === id);
        set({
          conflicts: state.conflicts.map(c =>
            c.id === id
              ? {
                  ...c,
                  status,
                  handledBy: state.currentUser,
                  handledAt: formatDateTime(),
                  handlerNote: note
                }
              : c
          )
        });
        get().addLog({
          operator: state.currentUser,
          action: status === 'confirmed' ? '确认冲突' : '驳回冲突',
          targetType: 'ConflictRecord',
          targetId: id,
          detail: `${status === 'confirmed' ? '确认' : '驳回'}冲突：${conflict?.description?.substring(0, 50) || id}${note ? `（备注：${note}）` : ''}`
        });
      },

      addNameMap: (nameMap) => {
        const state = get();
        const newMap: CommunityNameMap = {
          ...nameMap,
          id: generateId()
        };
        set({ nameMaps: [...state.nameMaps, newMap] });
        get().addLog({
          operator: state.currentUser,
          action: '添加名称映射',
          targetType: 'CommunityNameMap',
          targetId: newMap.id,
          detail: `添加名称映射：${nameMap.oldName} → ${nameMap.newName}`
        });
      },

      reviewNameMap: (id, status, reviewer) => {
        const state = get();
        const nameMap = state.nameMaps.find(m => m.id === id);
        set({
          nameMaps: state.nameMaps.map(m =>
            m.id === id
              ? {
                  ...m,
                  status,
                  reviewedBy: reviewer || state.currentUser,
                  reviewedAt: formatDateTime()
                }
              : m
          )
        });
        get().addLog({
          operator: reviewer || state.currentUser,
          action: status === 'confirmed' ? '确认名称映射' : '驳回名称映射',
          targetType: 'CommunityNameMap',
          targetId: id,
          detail: `${status === 'confirmed' ? '确认' : '驳回'}名称映射：${nameMap?.oldName} → ${nameMap?.newName}`
        });
      },

      generateSummary: () => {
        const state = get();
        const canonicalCommunities = state.getCanonicalCommunityNames();
        const resolvedConflicts = state.conflicts.filter(c => c.status !== 'pending');
        const confirmedNameMaps = state.nameMaps.filter(m => m.status === 'confirmed');
        
        const totalPhotos = state.photos.length;
        const totalBusRecords = state.busRecords.length;
        const totalCardCount = state.busRecords.reduce((sum, r) => sum + r.cardCount, 0);
        
        const communitiesWithPhotos = new Set(state.photos.map(p => applyNameMapping(p.communityName, state.nameMaps)));
        const communitiesWithBus = new Set(state.busRecords.map(r => applyNameMapping(r.communityName, state.nameMaps)));
        const communitiesWithBoth = [...communitiesWithPhotos].filter(c => communitiesWithBus.has(c));
        
        const pendingConflicts = state.conflicts.filter(c => c.status === 'pending');
        const pendingNameMaps = state.nameMaps.filter(m => m.status === 'pending');
        
        const content = `
社区托育步行可达性核查摘要
生成时间：${formatDateTime()}
操作人：${state.currentUser}

一、总体统计
- 覆盖小区数量：${canonicalCommunities.length} 个
- 路口照片数量：${totalPhotos} 张
- 公交刷卡记录：${totalBusRecords} 条
- 公交刷卡总量：${totalCardCount} 次
- 双源数据完整小区：${communitiesWithBoth.length} 个

二、数据质量
- 待处理冲突：${pendingConflicts.length} 条
- 已处理冲突：${resolvedConflicts.length} 条
- 待复核名称映射：${pendingNameMaps.length} 条
- 已确认名称映射：${confirmedNameMaps.length} 条

三、小区明细（部分）
${canonicalCommunities.slice(0, 5).map(name => {
  const photos = state.photos.filter(p => applyNameMapping(p.communityName, state.nameMaps) === name);
  const records = state.busRecords.filter(r => applyNameMapping(r.communityName, state.nameMaps) === name);
  const cardCount = records.reduce((sum, r) => sum + r.cardCount, 0);
  const hasSafe = photos.some(p => p.hasCrosswalk || p.hasTrafficLight);
  return `- ${name}：照片${photos.length}张，公交${records.length}条（${cardCount}次），${hasSafe ? '有安全设施' : '缺少安全设施'}`;
}).join('\n')}

四、备注
${pendingConflicts.length > 0 ? `⚠️ 有 ${pendingConflicts.length} 条冲突待处理，请前往「冲突检测」页面确认` : '✅ 所有冲突已处理'}
${pendingNameMaps.length > 0 ? `⚠️ 有 ${pendingNameMaps.length} 条名称映射待市政巡检员复核` : '✅ 所有名称映射已处理'}
        `.trim();
        
        const newVersion = state.summaries.length + 1;
        const summary: SummaryVersion = {
          id: generateId(),
          version: newVersion,
          generatedAt: formatDateTime(),
          generatedBy: state.currentUser,
          content,
          stats: {
            totalCommunities: canonicalCommunities.length,
            totalPhotos,
            totalBusRecords,
            conflictsResolved: resolvedConflicts.length,
            nameMapsConfirmed: confirmedNameMaps.length
          },
          isExported: false
        };
        
        set({ summaries: [...state.summaries, summary] });
        get().addLog({
          operator: state.currentUser,
          action: '生成摘要',
          targetType: 'SummaryVersion',
          targetId: summary.id,
          detail: `生成第 ${newVersion} 版街道摘要`
        });
        
        return summary;
      },

      runSelfCheck: () => {
        const state = get();
        const lastSummary = state.summaries[state.summaries.length - 1];
        const report = runFullSelfCheck(
          state.photos,
          state.busRecords,
          state.nameMaps,
          lastSummary
        );
        set({ selfCheckReports: [...state.selfCheckReports, report] });
        get().addLog({
          operator: state.currentUser,
          action: '运行自检',
          targetType: 'SelfCheckReport',
          targetId: report.id,
          detail: `运行四项自检，整体结果：${report.overallPassed ? '通过' : '发现问题'}`
        });
        return report;
      },

      runConflictDetection: () => {
        const state = get();
        const newConflicts = detectAllConflicts(
          state.photos,
          state.busRecords,
          state.nameMaps
        );
        
        const existingIds = new Set(state.conflicts.map(c => c.id));
        const nameConflicts = detectCommunityNameConflicts(state.photos, state.busRecords);
        
        const allNewConflicts = [...newConflicts, ...nameConflicts].filter(
          c => !existingIds.has(c.id)
        );
        
        if (allNewConflicts.length > 0) {
          set({ conflicts: [...state.conflicts, ...allNewConflicts] });
          get().addLog({
            operator: '系统',
            action: '检测冲突',
            targetType: 'ConflictRecord',
            targetId: 'auto',
            detail: `自动检测到 ${allNewConflicts.length} 条新冲突`
          });
        }
      },

      runNameDetection: () => {
        const state = get();
        const newMaps = autoDetectNameMaps(
          state.photos,
          state.busRecords,
          state.nameMaps
        );
        
        if (newMaps.length > 0) {
          set({ nameMaps: [...state.nameMaps, ...newMaps] });
          get().addLog({
            operator: '系统',
            action: '检测名称',
            targetType: 'CommunityNameMap',
            targetId: 'auto',
            detail: `自动检测到 ${newMaps.length} 条疑似新旧名称对应关系，已加入复核池`
          });
        }
      },

      addLog: (log) => {
        const state = get();
        const newLog: OperationLog = {
          ...log,
          id: generateId(),
          timestamp: formatDateTime()
        };
        set({ logs: [newLog, ...state.logs].slice(0, 500) });
      },

      exportData: () => {
        const state = get();
        const exportData = {
          photos: state.photos,
          busRecords: state.busRecords,
          nameMaps: state.nameMaps,
          conflicts: state.conflicts,
          summaries: state.summaries,
          logs: state.logs,
          exportTime: formatDateTime(),
          exportedBy: state.currentUser
        };
        get().addLog({
          operator: state.currentUser,
          action: '导出数据',
          targetType: 'System',
          targetId: 'export',
          detail: '导出全部数据为 JSON'
        });
        return JSON.stringify(exportData, null, 2);
      },

      importData: (json) => {
        try {
          const data = JSON.parse(json);
          set({
            photos: data.photos || [],
            busRecords: data.busRecords || [],
            nameMaps: data.nameMaps || [],
            conflicts: data.conflicts || [],
            summaries: data.summaries || [],
            logs: data.logs || []
          });
          get().addLog({
            operator: get().currentUser,
            action: '导入数据',
            targetType: 'System',
            targetId: 'import',
            detail: `从 JSON 文件导入数据：${data.photos?.length || 0} 张照片，${data.busRecords?.length || 0} 条公交记录`
          });
        } catch (e) {
          console.error('Import failed:', e);
          throw new Error('数据导入失败，请检查文件格式');
        }
      },

      loadMockData: () => {
        const mock = generateAllMockData();
        set({
          photos: mock.photos,
          busRecords: mock.busRecords,
          nameMaps: mock.nameMaps,
          logs: mock.logs
        });
        get().runConflictDetection();
        get().addLog({
          operator: get().currentUser,
          action: '加载演示数据',
          targetType: 'System',
          targetId: 'mock',
          detail: '加载演示数据用于功能展示'
        });
      },

      clearAllData: () => {
        set({
          ...initialState,
          currentBatch: generateBatchId(),
          logs: [{
            id: generateId(),
            timestamp: formatDateTime(),
            operator: get().currentUser,
            action: '清空数据',
            targetType: 'System',
            targetId: 'clear',
            detail: '清空所有业务数据'
          }]
        });
      },

      getCanonicalCommunityNames: () => {
        const state = get();
        const allNames = [
          ...state.photos.map(p => p.communityName),
          ...state.busRecords.map(r => r.communityName)
        ].filter(Boolean);
        
        const canonical = allNames.map(name => applyNameMapping(name, state.nameMaps));
        return Array.from(new Set(canonical));
      }
    }),
    {
      name: 'community-childcare-walkability',
      version: 1
    }
  )
);
