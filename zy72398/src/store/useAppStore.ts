import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AppState, WorkPhoto, InspectionNote, Conflict, HandoverReport, SelfCheckResult, BatchType, ConflictStatus, ReportItem, HistoryEntry, DiffusionCalcResult, PendingHistoryEntry } from '@/types';
import { generateId, detectConflicts, detectTemperatureMixing, computeDiffusionForPhoto, computeRecalcDiffs, deduplicatePhotosByDeviceTime, verifyExportConsistency } from '@/utils';

interface AppActions {
  addWorkPhoto: (photo: Omit<WorkPhoto, 'id' | 'createdAt'>) => void;
  addInspectionNote: (note: Omit<InspectionNote, 'id' | 'createdAt'>) => void;
  updateConflictStatus: (conflictId: string, status: ConflictStatus, resolverName: string, remark?: string) => void;
  generateReport: () => HandoverReport;
  setCurrentStep: (step: number) => void;
  setCurrentBatchType: (type: BatchType) => void;
  runSelfCheck: (type: 'duplicate_import' | 'temperature_mixed' | 'recalculation' | 'export_consistency') => SelfCheckResult;
  runAllSelfChecks: () => SelfCheckResult[];
  getWorkPhotosByBatch: (batchType: BatchType) => WorkPhoto[];
  getConflictsForPhoto: (photoId: string) => Conflict[];
  getNotesForPhoto: (photoId: string) => InspectionNote[];
  getHistoryForReport: (reportId: string) => HistoryEntry[];
  clearBatchData: (batchType: BatchType) => void;
  resetAll: () => void;
  addMockData: () => void;
}

const initialState: AppState = {
  workPhotos: [],
  inspectionNotes: [],
  conflicts: [],
  reports: [],
  selfCheckResults: [],
  historyEntries: [],
  pendingHistoryEntries: [],
  currentStep: 1,
  currentBatchType: 'normal'
};

export const useAppStore = create<AppState & AppActions>()(
  persist(
    (set, get) => ({
      ...initialState,

      addWorkPhoto: (photo) => {
        const newPhoto: WorkPhoto = {
          ...photo,
          id: generateId(),
          createdAt: new Date().toISOString()
        };
        set((state) => ({
          workPhotos: [...state.workPhotos, newPhoto]
        }));
      },

      addInspectionNote: (note) => {
        const newNote: InspectionNote = {
          ...note,
          id: generateId(),
          createdAt: new Date().toISOString()
        };
        
        set((state) => {
          const photo = state.workPhotos.find(p => p.id === note.workPhotoId);
          const newConflicts: Conflict[] = [];
          
          if (photo) {
            const detected = detectConflicts(photo, newNote);
            newConflicts.push(...detected);
          }
          
          const latestReport = [...state.reports]
            .filter(r => r.batchType === state.currentBatchType)
            .pop();
          
          const historyEntry: PendingHistoryEntry | HistoryEntry = {
            id: generateId(),
            field: `note_${newNote.id}_content`,
            oldValue: '',
            newValue: note.content,
            modifier: note.inspectorName,
            reason: '补录巡检备注',
            modifiedAt: new Date().toISOString(),
            batchType: state.currentBatchType
          };
          
          const statusEntry: PendingHistoryEntry | HistoryEntry = {
            id: generateId(),
            field: 'reviewStatus',
            oldValue: 'pending',
            newValue: 'flagged',
            modifier: note.inspectorName,
            reason: `补录备注：${note.content.slice(0, 40)}`,
            modifiedAt: new Date().toISOString(),
            batchType: state.currentBatchType
          };
          
          if (latestReport) {
            const he1 = { ...historyEntry, reportId: latestReport.id } as HistoryEntry;
            const he2 = { ...statusEntry, reportId: latestReport.id } as HistoryEntry;
            return {
              inspectionNotes: [...state.inspectionNotes, newNote],
              conflicts: [...state.conflicts, ...newConflicts],
              historyEntries: [...state.historyEntries, he1, he2]
            };
          } else {
            return {
              inspectionNotes: [...state.inspectionNotes, newNote],
              conflicts: [...state.conflicts, ...newConflicts],
              pendingHistoryEntries: [...state.pendingHistoryEntries, historyEntry, statusEntry]
            };
          }
        });
      },

      updateConflictStatus: (conflictId, status, resolverName, remark) => {
        set((state) => {
          const conflict = state.conflicts.find(c => c.id === conflictId);
          if (!conflict) return state;
          
          const latestReport = [...state.reports]
            .filter(r => r.batchType === state.currentBatchType)
            .pop();
          
          const actionText = status === 'confirmed' ? '确认' : '驳回';
          const conflictEntry: PendingHistoryEntry | HistoryEntry = {
            id: generateId(),
            field: `conflict_${conflictId}_status`,
            oldValue: conflict.status,
            newValue: status,
            modifier: resolverName,
            reason: remark || `${actionText}冲突：${conflict.photoValue} vs ${conflict.noteValue}`,
            modifiedAt: new Date().toISOString(),
            batchType: state.currentBatchType
          };
          
          const statusEntry: PendingHistoryEntry | HistoryEntry = {
            id: generateId(),
            field: 'reviewStatus',
            oldValue: 'flagged',
            newValue: 'reviewed',
            modifier: resolverName,
            reason: `冲突${actionText}：${remark || '无备注'}`,
            modifiedAt: new Date().toISOString(),
            batchType: state.currentBatchType
          };
          
          const updatedConflicts = state.conflicts.map(c =>
            c.id === conflictId
              ? { ...c, status, resolverName, resolutionRemark: remark, resolvedAt: new Date().toISOString() }
              : c
          );
          
          if (latestReport) {
            const he1 = { ...conflictEntry, reportId: latestReport.id } as HistoryEntry;
            const he2 = { ...statusEntry, reportId: latestReport.id } as HistoryEntry;
            return {
              conflicts: updatedConflicts,
              historyEntries: [...state.historyEntries, he1, he2]
            };
          } else {
            return {
              conflicts: updatedConflicts,
              pendingHistoryEntries: [...state.pendingHistoryEntries, conflictEntry, statusEntry]
            };
          }
        });
      },

      generateReport: () => {
        const state = get();
        const batchPhotos = state.getWorkPhotosByBatch(state.currentBatchType);
        
        const reportTime = new Date().toISOString();
        
        const dedupedPhotos = deduplicatePhotosByDeviceTime(batchPhotos);
        
        const diffusionResults: DiffusionCalcResult[] = dedupedPhotos.map(p => 
          computeDiffusionForPhoto(p, reportTime)
        );
        
        const items: ReportItem[] = dedupedPhotos.map(photo => {
          const photoConflicts = state.getConflictsForPhoto(photo.id);
          const notes = state.getNotesForPhoto(photo.id);
          const { mixed } = detectTemperatureMixing([photo], notes);
          const diffusion = diffusionResults.find(d => d.workPhotoId === photo.id);
          const hasSupplementaryNote = notes.some(n => 
            state.workPhotos.find(p => p.id === n.workPhotoId)?.batchType === 'supplementary'
          );
          
          let reviewStatus: 'pending' | 'reviewed' | 'flagged' = 'pending';
          if (mixed) {
            reviewStatus = 'flagged';
          } else if (photoConflicts.length > 0 && photoConflicts.every(c => c.status !== 'pending')) {
            reviewStatus = 'reviewed';
          } else if (photoConflicts.length > 0) {
            reviewStatus = 'flagged';
          } else if (notes.length > 0) {
            reviewStatus = 'reviewed';
          }
          
          return {
            workPhotoId: photo.id,
            deviceNo: photo.deviceNo,
            dissolvedOxygen: photo.dissolvedOxygen,
            temperature: photo.temperature,
            temperatureUnit: photo.temperatureUnit,
            recordTime: photo.recordTime,
            hasConflict: photoConflicts.length > 0,
            conflictResolved: photoConflicts.length > 0 && photoConflicts.every(c => c.status !== 'pending'),
            temperatureMixed: mixed,
            diffusionRate: diffusion?.diffusionRate,
            reviewStatus,
            supplementaryUpdated: hasSupplementaryNote,
            inspectionNotes: notes.map(n => ({
              id: n.id,
              inspectorName: n.inspectorName,
              content: n.content,
              temperature: n.temperature,
              temperatureUnit: n.temperatureUnit,
              inspectionTime: n.inspectionTime
            })),
            conflicts: photoConflicts.map(c => ({
              id: c.id,
              conflictType: c.conflictType,
              photoValue: c.photoValue,
              noteValue: c.noteValue,
              status: c.status,
              resolverName: c.resolverName,
              resolutionRemark: c.resolutionRemark,
              resolvedAt: c.resolvedAt
            }))
          };
        });
        
        const allConflicts = state.conflicts.filter(c => 
          dedupedPhotos.some(p => p.id === c.workPhotoId)
        );
        
        const dedupedNoteIds = new Set(dedupedPhotos.map(p => p.id));
        const reportNotes = state.inspectionNotes.filter(n => 
          dedupedNoteIds.has(n.workPhotoId)
        );
        
        const { mixed } = detectTemperatureMixing(dedupedPhotos, state.inspectionNotes);
        
        const report: HandoverReport = {
          id: generateId(),
          batchType: state.currentBatchType,
          reportTime,
          status: 'draft',
          items,
          temperatureMixed: mixed,
          conflictCount: allConflicts.length,
          resolvedCount: allConflicts.filter(c => c.status !== 'pending').length,
          deduplicatedItemCount: dedupedPhotos.length,
          diffusionResults,
          inspectionNotes: reportNotes,
          conflicts: allConflicts,
          createdAt: new Date().toISOString()
        };
        
        const previousReports = state.reports.filter(r => r.batchType === state.currentBatchType);
        const isFirstGeneration = previousReports.length === 0;
        const newHistoryEntries: HistoryEntry[] = [];
        
        if (isFirstGeneration) {
          const pendingForBatch = state.pendingHistoryEntries.filter(p => p.batchType === state.currentBatchType);
          pendingForBatch.forEach(p => {
            newHistoryEntries.push({
              id: generateId(),
              reportId: report.id,
              field: p.field,
              oldValue: p.oldValue,
              newValue: p.newValue,
              modifier: p.modifier,
              reason: p.reason,
              modifiedAt: p.modifiedAt
            });
          });
          
          reportNotes.forEach(note => {
            const existingField = `note_${note.id}_content`;
            if (!pendingForBatch.some(p => p.field === existingField)) {
              newHistoryEntries.push({
                id: generateId(),
                reportId: report.id,
                field: existingField,
                oldValue: '',
                newValue: note.content,
                modifier: note.inspectorName,
                reason: '首次报告生成时同步补录备注',
                modifiedAt: new Date().toISOString()
              });
            }
          });
          
          allConflicts.filter(c => c.status !== 'pending').forEach(conflict => {
            const existingField = `conflict_${conflict.id}_status`;
            if (!pendingForBatch.some(p => p.field === existingField)) {
              newHistoryEntries.push({
                id: generateId(),
                reportId: report.id,
                field: existingField,
                oldValue: 'pending',
                newValue: conflict.status,
                modifier: conflict.resolverName || '未知处理人',
                reason: conflict.resolutionRemark || `${conflict.status === 'confirmed' ? '确认' : '驳回'}冲突`,
                modifiedAt: conflict.resolvedAt || new Date().toISOString()
              });
            }
          });
          
          if (mixed) {
            newHistoryEntries.push({
              id: generateId(),
              reportId: report.id,
              field: 'temperatureMixed',
              oldValue: 'false',
              newValue: 'true',
              modifier: '系统检测',
              reason: '检测到摄氏度/开尔文混用，待训练教练复核',
              modifiedAt: new Date().toISOString()
            });
          }
          
          items.forEach(item => {
            newHistoryEntries.push({
              id: generateId(),
              reportId: report.id,
              field: `item_${item.deviceNo}_reviewStatus`,
              oldValue: 'pending',
              newValue: item.reviewStatus,
              modifier: '系统',
              reason: `报告生成时自动判定：${item.reviewStatus === 'reviewed' ? '已复核' : item.reviewStatus === 'flagged' ? '需复核' : '待处理'}`,
              modifiedAt: new Date().toISOString()
            });
          });
        } else {
          const prevReport = previousReports[previousReports.length - 1];
          if (prevReport.items.length !== items.length) {
            newHistoryEntries.push({
              id: generateId(),
              reportId: report.id,
              field: '记录条数(去重后)',
              oldValue: String(prevReport.deduplicatedItemCount),
              newValue: String(report.deduplicatedItemCount),
              modifier: '系统',
              reason: '重新生成报告',
              modifiedAt: new Date().toISOString()
            });
          }
          if (prevReport.conflictCount !== report.conflictCount) {
            newHistoryEntries.push({
              id: generateId(),
              reportId: report.id,
              field: '冲突数',
              oldValue: String(prevReport.conflictCount),
              newValue: String(report.conflictCount),
              modifier: '系统',
              reason: '重新生成报告',
              modifiedAt: new Date().toISOString()
            });
          }
        }
        
        const remainingPending = state.pendingHistoryEntries.filter(p => p.batchType !== state.currentBatchType);
        
        set((state) => ({
          reports: [...state.reports, report],
          historyEntries: [...state.historyEntries, ...newHistoryEntries],
          pendingHistoryEntries: remainingPending
        }));
        
        return report;
      },

      setCurrentStep: (step) => set({ currentStep: step }),
      
      setCurrentBatchType: (type) => set({ currentBatchType: type }),

      runSelfCheck: (type) => {
        const state = get();
        let result: SelfCheckResult;
        
        switch (type) {
          case 'duplicate_import': {
            const seen = new Map<string, WorkPhoto[]>();
            state.workPhotos.forEach(p => {
              const key = `${p.batchType}-${p.deviceNo}-${new Date(p.recordTime).getTime()}`;
              if (!seen.has(key)) seen.set(key, []);
              seen.get(key)!.push(p);
            });
            const duplicates = Array.from(seen.entries()).filter(([, arr]) => arr.length > 1);
            result = {
              id: generateId(),
              checkType: 'duplicate_import',
              passed: duplicates.length === 0,
              details: duplicates.length === 0 
                ? '未检测到重复导入记录' 
                : `检测到 ${duplicates.length} 组重复导入：${duplicates.map(([k, arr]) => `${k}(${arr.length}条)`).join('; ')}`,
              checkedAt: new Date().toISOString(),
              data: { duplicates: duplicates.map(([key, arr]) => ({
                key,
                count: arr.length,
                batchTypes: arr.map(a => a.batchType),
                ids: arr.map(a => a.id)
              })) }
            };
            break;
          }
          case 'temperature_mixed': {
            const { mixed, details } = detectTemperatureMixing(state.workPhotos, state.inspectionNotes);
            result = {
              id: generateId(),
              checkType: 'temperature_mixed',
              passed: !mixed,
              details: mixed ? details.join('; ') : '温度单位使用一致',
              checkedAt: new Date().toISOString(),
              data: { mixedDetails: details }
            };
            break;
          }
          case 'recalculation': {
            const normalPhotos = state.workPhotos.filter(p => p.batchType === 'normal');
            const supplementaryPhotos = state.workPhotos.filter(p => p.batchType === 'supplementary');
            
            if (normalPhotos.length === 0 && supplementaryPhotos.length === 0) {
              result = {
                id: generateId(),
                checkType: 'recalculation',
                passed: false,
                details: '暂无数据可验证',
                checkedAt: new Date().toISOString()
              };
              break;
            }
            
            const latestReport = [...state.reports]
              .filter(r => r.batchType === state.currentBatchType)
              .pop();
            const refTime = latestReport?.reportTime;
            
            const normalCalcs = normalPhotos.map(p => computeDiffusionForPhoto(p, refTime));
            const supplementaryCalcs = supplementaryPhotos.map(p => computeDiffusionForPhoto(p, refTime));
            
            const recalcDiffs = computeRecalcDiffs(normalPhotos, supplementaryPhotos, refTime);
            
            let reportDiffMatch = true;
            const reportDiffDetails: string[] = [];
            
            if (latestReport && latestReport.diffusionResults.length > 0) {
              const allCurrentPhotos = deduplicatePhotosByDeviceTime(
                state.getWorkPhotosByBatch(state.currentBatchType)
              );
              allCurrentPhotos.forEach(photo => {
                const freshCalc = computeDiffusionForPhoto(photo, latestReport.reportTime);
                const reportCalc = latestReport.diffusionResults.find(d => d.workPhotoId === photo.id);
                if (reportCalc) {
                  const diff = Math.abs(freshCalc.diffusionRate - reportCalc.diffusionRate);
                  if (diff > 0.001) {
                    reportDiffMatch = false;
                    reportDiffDetails.push(
                      `${photo.deviceNo}: 报告扩散率=${reportCalc.diffusionRate.toFixed(4)}, 重算扩散率=${freshCalc.diffusionRate.toFixed(4)}, 差异=${diff.toFixed(4)}`
                    );
                  }
                }
              });
            }
            
            const significantDiffs = recalcDiffs.filter(d => d.diffPercent > 10);
            const passed = significantDiffs.length === 0 && reportDiffMatch;
            
            const detailParts: string[] = [];
            detailParts.push(`正常材料 ${normalPhotos.length} 条，补录材料 ${supplementaryPhotos.length} 条`);
            
            if (recalcDiffs.length > 0) {
              detailParts.push(`同一设备补录前后扩散率差异 ${recalcDiffs.length} 组`);
              recalcDiffs.forEach(d => {
                detailParts.push(
                  `${d.deviceNo}: 正常=${d.normalDiffusionRate.toFixed(4)}, 补录=${d.supplementaryDiffusionRate.toFixed(4)}, 偏差=${d.diffPercent.toFixed(1)}%`
                );
              });
            }
            
            if (!reportDiffMatch) {
              detailParts.push(`⚠️ 报告中扩散率与当前重算不一致：${reportDiffDetails.join('; ')}`);
            }
            
            if (significantDiffs.length > 0) {
              detailParts.push(`⚠️ ${significantDiffs.length} 组差异超过10%阈值`);
            }
            
            result = {
              id: generateId(),
              checkType: 'recalculation',
              passed,
              details: detailParts.join('；'),
              checkedAt: new Date().toISOString(),
              data: {
                normalCalcs,
                supplementaryCalcs,
                recalcDiffs,
                reportDiffMatch,
                reportDiffDetails
              }
            };
            break;
          }
          case 'export_consistency': {
            if (state.workPhotos.length === 0) {
              result = {
                id: generateId(),
                checkType: 'export_consistency',
                passed: false,
                details: '暂无数据可导出',
                checkedAt: new Date().toISOString()
              };
              break;
            }
            
            const latestReport = [...state.reports]
              .filter(r => r.batchType === state.currentBatchType)
              .pop();
            
            if (!latestReport) {
              result = {
                id: generateId(),
                checkType: 'export_consistency',
                passed: false,
                details: '请先生成交接报告后再进行导出一致性校验',
                checkedAt: new Date().toISOString()
              };
              break;
            }
            
            const batchPhotos = state.getWorkPhotosByBatch(state.currentBatchType);
            const batchNotes = state.inspectionNotes.filter(n => 
              batchPhotos.some(p => p.id === n.workPhotoId)
            );
            const batchConflicts = state.conflicts.filter(c => 
              batchPhotos.some(p => p.id === c.workPhotoId)
            );
            
            const exportPayload = {
              report: latestReport,
              workPhotos: batchPhotos,
              inspectionNotes: batchNotes,
              conflicts: batchConflicts,
              exportTime: new Date().toISOString()
            };
            
            const mismatches = verifyExportConsistency(
              batchPhotos,
              batchNotes,
              batchConflicts,
              exportPayload
            );
            
            const crossReportMismatches = verifyExportConsistency(
              batchPhotos,
              batchNotes,
              batchConflicts,
              latestReport
            );
            
            const allMismatches = [...mismatches, ...crossReportMismatches];
            const uniqueMismatches = allMismatches.filter((m, idx, arr) => 
              arr.findIndex(x => x.recordId === m.recordId && x.field === m.field) === idx
            );
            
            const passed = uniqueMismatches.length === 0;
            
            const detailParts: string[] = [];
            detailParts.push(`工况照片 ${batchPhotos.length} 条，巡检备注 ${batchNotes.length} 条，冲突 ${batchConflicts.length} 条`);
            detailParts.push(`报告项 ${latestReport.items.length} 条(去重后 ${latestReport.deduplicatedItemCount} 条)`);
            detailParts.push(`扩散计算结果 ${latestReport.diffusionResults.length} 条`);
            
            if (uniqueMismatches.length > 0) {
              detailParts.push(`⚠️ 发现 ${uniqueMismatches.length} 处不一致：`);
              uniqueMismatches.slice(0, 10).forEach(m => {
                detailParts.push(`[${m.category}] ${m.field}: 期望=${m.expectedValue}, 实际=${m.actualValue}`);
              });
              if (uniqueMismatches.length > 10) {
                detailParts.push(`... 及其他 ${uniqueMismatches.length - 10} 处`);
              }
            }
            
            result = {
              id: generateId(),
              checkType: 'export_consistency',
              passed,
              details: detailParts.join('；'),
              checkedAt: new Date().toISOString(),
              data: {
                exportPayload,
                mismatches: uniqueMismatches,
                totalPhotos: batchPhotos.length,
                totalNotes: batchNotes.length,
                totalConflicts: batchConflicts.length,
                reportItemCount: latestReport.items.length
              }
            };
            break;
          }
        }
        
        set((state) => ({
          selfCheckResults: [...state.selfCheckResults.filter(r => r.checkType !== type), result]
        }));
        
        return result;
      },

      runAllSelfChecks: () => {
        const types: ('duplicate_import' | 'temperature_mixed' | 'recalculation' | 'export_consistency')[] = [
          'duplicate_import', 'temperature_mixed', 'recalculation', 'export_consistency'
        ];
        return types.map(t => get().runSelfCheck(t));
      },

      getWorkPhotosByBatch: (batchType) => {
        return get().workPhotos.filter(p => p.batchType === batchType);
      },

      getConflictsForPhoto: (photoId) => {
        return get().conflicts.filter(c => c.workPhotoId === photoId);
      },

      getNotesForPhoto: (photoId) => {
        return get().inspectionNotes.filter(n => n.workPhotoId === photoId);
      },

      getHistoryForReport: (reportId) => {
        return get().historyEntries.filter(e => e.reportId === reportId);
      },

      clearBatchData: (batchType) => {
        set((state) => {
          const photoIds = state.workPhotos.filter(p => p.batchType === batchType).map(p => p.id);
          return {
            workPhotos: state.workPhotos.filter(p => p.batchType !== batchType),
            inspectionNotes: state.inspectionNotes.filter(n => !photoIds.includes(n.workPhotoId)),
            conflicts: state.conflicts.filter(c => !photoIds.includes(c.workPhotoId)),
            reports: state.reports.filter(r => r.batchType !== batchType),
            historyEntries: state.historyEntries.filter(e => 
              !state.reports.filter(r => r.batchType === batchType).some(r => r.id === e.reportId)
            ),
            pendingHistoryEntries: state.pendingHistoryEntries.filter(p => p.batchType !== batchType)
          };
        });
      },

      resetAll: () => set(initialState),

      addMockData: () => {
        const now = new Date();
        const batchTypes: BatchType[] = ['normal', 'wrong_caliber', 'supplementary'];
        
        set({ workPhotos: [], inspectionNotes: [], conflicts: [], reports: [], historyEntries: [] });
        
        const allPhotos: WorkPhoto[] = [];
        
        batchTypes.forEach((batchType) => {
          for (let i = 0; i < 3; i++) {
            const baseOffset = i;
            const recordTime = new Date(now.getTime() - baseOffset * 3600000).toISOString();
            const useKelvin = batchType === 'wrong_caliber' && i === 1;
            const tempValue = useKelvin ? 293.15 : 20 + i * 0.5;
            const doValue = batchType === 'supplementary'
              ? 6.5 + i * 0.3 + 0.2
              : 6.5 + i * 0.3;
            
            allPhotos.push({
              ...{
                batchType,
                deviceNo: `DEV-${String(i + 1).padStart(3, '0')}`,
                dissolvedOxygen: doValue,
                temperature: tempValue,
                temperatureUnit: useKelvin ? 'K' : 'C',
                recordTime,
                imageName: `工况照片_${batchType}_${i + 1}.jpg`
              },
              id: generateId(),
              createdAt: new Date().toISOString()
            });
          }
        });
        
        set(() => ({ workPhotos: allPhotos }));
        
        allPhotos.forEach((photo, idx) => {
          if (idx % 2 === 0 || photo.batchType === 'supplementary') {
            const hasConflict = idx % 3 === 0;
            const noteTemp = hasConflict ? 23 : photo.temperature;
            const noteUnit = photo.batchType === 'wrong_caliber' ? 'C' : photo.temperatureUnit;
            
            const note: Omit<InspectionNote, 'id' | 'createdAt'> = {
              workPhotoId: photo.id,
              inspectorName: '老岑',
              content: hasConflict 
                ? '现场巡检发现温度显示异常，已重新校准设备' 
                : '巡检正常，溶氧扩散符合预期',
              temperature: noteTemp,
              temperatureUnit: noteUnit,
              inspectionTime: new Date(Date.parse(photo.recordTime) + 1800000).toISOString()
            };
            
            get().addInspectionNote(note);
          }
        });
      }
    }),
    {
      name: 'fish-pond-diffusion-storage'
    }
  )
);
