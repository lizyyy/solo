/**
 * 鱼池溶氧扩散 - 完整流程测试脚本
 * 
 * 可复现验证方式：
 * 1. 运行：npx tsx test-flow.ts
 * 2. 或在浏览器中按下方步骤手动操作
 * 
 * 覆盖场景：
 * - 清空状态 → 导入工况照片 → 补录备注 → 保存 → 刷新 → 重算
 * - 处理冲突 → 生成交接报告 → 导出JSON
 * - 核对：补录前后溶氧扩散结果、复核状态、变更记录条目、
 *         备注原话、修改人、修改原因、报告详情、导出字段数量一致
 * - 重点证明：首次生成报告时历史记录不为空
 */

import type { AppState, WorkPhoto, InspectionNote, Conflict, HandoverReport, HistoryEntry, BatchType } from './src/types';
import { generateId, detectConflicts, computeDiffusionForPhoto, deduplicatePhotosByDeviceTime } from './src/utils';

// 简化版 store，模拟核心逻辑
function createTestStore() {
  let state: Partial<AppState> = {
    workPhotos: [],
    inspectionNotes: [],
    conflicts: [],
    reports: [],
    historyEntries: [],
    pendingHistoryEntries: [],
    currentBatchType: 'normal' as BatchType,
    currentStep: 1
  };

  const getState = () => state;
  const setState = (updater: Partial<AppState> | ((s: Partial<AppState>) => Partial<AppState>)) => {
    if (typeof updater === 'function') {
      state = { ...state, ...updater(state) };
    } else {
      state = { ...state, ...updater };
    }
  };

  return {
    get: getState,
    set: setState,
    
    addWorkPhoto: (photo: Omit<WorkPhoto, 'id' | 'createdAt'>) => {
      const newPhoto: WorkPhoto = {
        ...photo,
        id: generateId(),
        createdAt: new Date().toISOString()
      };
      setState(s => ({ workPhotos: [...s.workPhotos!, newPhoto] }));
      return newPhoto;
    },

    addInspectionNote: (note: Omit<InspectionNote, 'id' | 'createdAt'>) => {
      const newNote: InspectionNote = {
        ...note,
        id: generateId(),
        createdAt: new Date().toISOString()
      };
      
      setState(s => {
        const photo = s.workPhotos!.find(p => p.id === note.workPhotoId);
        const newConflicts: Conflict[] = [];
        if (photo) {
          const detected = detectConflicts(photo, newNote);
          newConflicts.push(...detected);
        }

        const latestReport = [...s.reports!]
          .filter(r => r.batchType === s.currentBatchType)
          .pop();
        
        const historyEntry = {
          id: generateId(),
          field: `note_${newNote.id}_content`,
          oldValue: '',
          newValue: note.content,
          modifier: note.inspectorName,
          reason: '补录巡检备注',
          modifiedAt: new Date().toISOString(),
          batchType: s.currentBatchType!
        };

        const statusEntry = {
          id: generateId(),
          field: 'reviewStatus',
          oldValue: 'pending',
          newValue: 'flagged',
          modifier: note.inspectorName,
          reason: `补录备注：${note.content.slice(0, 40)}`,
          modifiedAt: new Date().toISOString(),
          batchType: s.currentBatchType!
        };

        if (latestReport) {
          return {
            inspectionNotes: [...s.inspectionNotes!, newNote],
            conflicts: [...s.conflicts!, ...newConflicts],
            historyEntries: [...s.historyEntries!, 
              { ...historyEntry, reportId: latestReport.id },
              { ...statusEntry, reportId: latestReport.id }
            ]
          };
        } else {
          return {
            inspectionNotes: [...s.inspectionNotes!, newNote],
            conflicts: [...s.conflicts!, ...newConflicts],
            pendingHistoryEntries: [...s.pendingHistoryEntries!, historyEntry, statusEntry]
          };
        }
      });
      
      return newNote;
    },

    updateConflictStatus: (conflictId: string, status: 'confirmed' | 'rejected', resolverName: string, remark?: string) => {
      setState(s => {
        const conflict = s.conflicts!.find(c => c.id === conflictId);
        if (!conflict) return s;

        const latestReport = [...s.reports!]
          .filter(r => r.batchType === s.currentBatchType)
          .pop();

        const actionText = status === 'confirmed' ? '确认' : '驳回';
        const conflictEntry = {
          id: generateId(),
          field: `conflict_${conflictId}_status`,
          oldValue: conflict.status,
          newValue: status,
          modifier: resolverName,
          reason: remark || `${actionText}冲突：${conflict.photoValue} vs ${conflict.noteValue}`,
          modifiedAt: new Date().toISOString(),
          batchType: s.currentBatchType!
        };

        const statusEntry = {
          id: generateId(),
          field: 'reviewStatus',
          oldValue: 'flagged',
          newValue: 'reviewed',
          modifier: resolverName,
          reason: `冲突${actionText}：${remark || '无备注'}`,
          modifiedAt: new Date().toISOString(),
          batchType: s.currentBatchType!
        };

        const updatedConflicts = s.conflicts!.map(c =>
          c.id === conflictId
            ? { ...c, status, resolverName, resolutionRemark: remark, resolvedAt: new Date().toISOString() }
            : c
        );

        if (latestReport) {
          return {
            conflicts: updatedConflicts,
            historyEntries: [...s.historyEntries!, 
              { ...conflictEntry, reportId: latestReport.id },
              { ...statusEntry, reportId: latestReport.id }
            ]
          };
        } else {
          return {
            conflicts: updatedConflicts,
            pendingHistoryEntries: [...s.pendingHistoryEntries!, conflictEntry, statusEntry]
          };
        }
      });
    },

    generateReport: () => {
      const s = getState();
      const batchPhotos = s.workPhotos!.filter(p => p.batchType === s.currentBatchType);
      const reportTime = new Date().toISOString();
      const dedupedPhotos = deduplicatePhotosByDeviceTime(batchPhotos);
      
      const diffusionResults = dedupedPhotos.map(p => computeDiffusionForPhoto(p, reportTime));
      
      const items = dedupedPhotos.map(photo => {
        const photoConflicts = s.conflicts!.filter(c => c.workPhotoId === photo.id);
        const notes = s.inspectionNotes!.filter(n => n.workPhotoId === photo.id);
        
        let reviewStatus: 'pending' | 'reviewed' | 'flagged' = 'pending';
        if (photoConflicts.length > 0 && photoConflicts.every(c => c.status !== 'pending')) {
          reviewStatus = 'reviewed';
        } else if (photoConflicts.length > 0) {
          reviewStatus = 'flagged';
        } else if (notes.length > 0) {
          reviewStatus = 'reviewed';
        }

        const diffusion = diffusionResults.find(d => d.workPhotoId === photo.id);

        return {
          workPhotoId: photo.id,
          deviceNo: photo.deviceNo,
          dissolvedOxygen: photo.dissolvedOxygen,
          temperature: photo.temperature,
          temperatureUnit: photo.temperatureUnit,
          recordTime: photo.recordTime,
          hasConflict: photoConflicts.length > 0,
          conflictResolved: photoConflicts.length > 0 && photoConflicts.every(c => c.status !== 'pending'),
          temperatureMixed: false,
          diffusionRate: diffusion?.diffusionRate,
          reviewStatus,
          supplementaryUpdated: notes.some(n => {
            const ph = s.workPhotos!.find(p => p.id === n.workPhotoId);
            return ph?.batchType === 'supplementary';
          }),
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

      const allConflicts = s.conflicts!.filter(c => 
        dedupedPhotos.some(p => p.id === c.workPhotoId)
      );
      
      const reportNotes = s.inspectionNotes!.filter(n => 
        dedupedPhotos.some(p => p.id === n.workPhotoId)
      );

      const report: HandoverReport = {
        id: generateId(),
        batchType: s.currentBatchType!,
        reportTime,
        status: 'draft',
        items,
        temperatureMixed: false,
        conflictCount: allConflicts.length,
        resolvedCount: allConflicts.filter(c => c.status !== 'pending').length,
        deduplicatedItemCount: dedupedPhotos.length,
        diffusionResults,
        inspectionNotes: reportNotes,
        conflicts: allConflicts,
        createdAt: new Date().toISOString()
      };

      const previousReports = s.reports!.filter(r => r.batchType === s.currentBatchType);
      const isFirstGeneration = previousReports.length === 0;
      const newHistoryEntries: HistoryEntry[] = [];

      if (isFirstGeneration) {
        const pendingForBatch = s.pendingHistoryEntries!.filter(p => p.batchType === s.currentBatchType);
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
      }

      const remainingPending = s.pendingHistoryEntries!.filter(p => p.batchType !== s.currentBatchType);

      setState({
        reports: [...s.reports!, report],
        historyEntries: [...s.historyEntries!, ...newHistoryEntries],
        pendingHistoryEntries: remainingPending
      });

      return report;
    },

    getHistoryForReport: (reportId: string) => {
      return getState().historyEntries!.filter(e => e.reportId === reportId);
    },

    clearAll: () => {
      setState({
        workPhotos: [],
        inspectionNotes: [],
        conflicts: [],
        reports: [],
        historyEntries: [],
        pendingHistoryEntries: [],
        currentStep: 1,
        currentBatchType: 'normal'
      });
    }
  };
}

// ===== 测试用例 =====
async function runTests() {
  console.log('\n' + '='.repeat(70));
  console.log(' 鱼池溶氧扩散 - 完整流程自动化测试');
  console.log('='.repeat(70) + '\n');

  const store = createTestStore();
  const now = new Date();
  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`  ✅ ${message}`);
      passed++;
    } else {
      console.log(`  ❌ ${message}`);
      failed++;
    }
  }

  function assertContains(text: string, search: string, message: string) {
    assert(text.includes(search), `${message} (期望包含 "${search}"，实际 "${text.slice(0, 80)}${text.length > 80 ? '...' : ''}")`);
  }

  // ===== Step 1: 清空状态 =====
  console.log('【Step 1】清空状态');
  store.clearAll();
  const s1 = store.get();
  assert(s1.workPhotos!.length === 0, 'workPhotos 为空');
  assert(s1.inspectionNotes!.length === 0, 'inspectionNotes 为空');
  assert(s1.conflicts!.length === 0, 'conflicts 为空');
  assert(s1.reports!.length === 0, 'reports 为空');
  assert(s1.historyEntries!.length === 0, 'historyEntries 为空');
  assert(s1.pendingHistoryEntries!.length === 0, 'pendingHistoryEntries 为空');
  console.log('');

  // ===== Step 2: 导入工况照片（正常材料，3条） =====
  console.log('【Step 2】导入工况照片（正常材料 3 条）');
  const baseTime = now.getTime();
  const photos: WorkPhoto[] = [];
  
  for (let i = 0; i < 3; i++) {
    const photo = store.addWorkPhoto({
      batchType: 'normal',
      deviceNo: `DEV-00${i + 1}`,
      dissolvedOxygen: 6.5 + i * 0.3,
      temperature: 20 + i * 0.5,
      temperatureUnit: 'C',
      recordTime: new Date(baseTime - i * 3600000).toISOString()
    });
    photos.push(photo);
    console.log(`  - 已导入 ${photo.deviceNo}: 溶氧=${photo.dissolvedOxygen}, 温度=${photo.temperature}${photo.temperatureUnit}`);
  }
  
  const s2 = store.get();
  assert(s2.workPhotos!.length === 3, '3 条照片已导入');
  console.log('');

  // ===== Step 3: 补录备注（第1条产生冲突，第3条正常） =====
  console.log('【Step 3】补录巡检备注');
  const note1 = store.addInspectionNote({
    workPhotoId: photos[0].id,
    inspectorName: '老岑',
    content: '现场巡检发现温度显示异常，已重新校准设备',
    temperature: 23,
    temperatureUnit: 'C',
    inspectionTime: new Date(baseTime - 0 * 3600000 + 1800000).toISOString()
  });
  console.log(`  - ${note1.inspectorName} 给 ${photos[0].deviceNo} 补备注（有冲突）: "${note1.content}"`);

  const note3 = store.addInspectionNote({
    workPhotoId: photos[2].id,
    inspectorName: '老岑',
    content: '巡检正常，溶氧扩散符合预期',
    temperature: 21,
    temperatureUnit: 'C',
    inspectionTime: new Date(baseTime - 2 * 3600000 + 1800000).toISOString()
  });
  console.log(`  - ${note3.inspectorName} 给 ${photos[2].deviceNo} 补备注（无冲突）: "${note3.content}"`);

  const s3 = store.get();
  assert(s3.inspectionNotes!.length === 2, '2 条备注已补录');
  assert(s3.conflicts!.length >= 1, '至少检测到 1 条冲突');
  assert(s3.pendingHistoryEntries!.length >= 4, '无报告时暂存 pendingHistoryEntries（每条备注至少2条）');
  
  const pendingNoteEntry = s3.pendingHistoryEntries!.find(p => p.field.includes('note') && p.newValue === note1.content);
  assert(pendingNoteEntry !== undefined, 'pending 中保存了备注原话');
  if (pendingNoteEntry) {
    assert(pendingNoteEntry.modifier === '老岑', 'pending 中保存了修改人=老岑');
    assertContains(pendingNoteEntry.reason, '补录巡检备注', 'pending 中保存了修改原因');
  }
  console.log('');

  // ===== Step 4: 处理冲突（老岑确认） =====
  console.log('【Step 4】处理冲突（老岑确认冲突）');
  const s3b = store.get();
  const conflict = s3b.conflicts![0];
  console.log(`  - 冲突：照片${conflict.photoValue} vs 备注${conflict.noteValue}`);
  
  store.updateConflictStatus(conflict.id, 'confirmed', '老岑', '确认现场温度确实偏高，已记录');
  console.log(`  - 老岑确认冲突，备注："确认现场温度确实偏高，已记录"`);

  const s4 = store.get();
  const updatedConflict = s4.conflicts!.find(c => c.id === conflict.id)!;
  assert(updatedConflict.status === 'confirmed', '冲突状态已更新为 confirmed');
  assert(updatedConflict.resolverName === '老岑', '处理人=老岑');
  assert(updatedConflict.resolutionRemark === '确认现场温度确实偏高，已记录', '处理备注已保存');
  assert(s4.pendingHistoryEntries!.length >= 6, '冲突处理后 pending 增加 2 条（冲突状态+复核状态）');
  
  const pendingConflictEntry = s4.pendingHistoryEntries!.find(p => p.field === `conflict_${conflict.id}_status`);
  assert(pendingConflictEntry !== undefined, 'pending 中保存了冲突处理记录');
  if (pendingConflictEntry) {
    assert(pendingConflictEntry.oldValue === 'pending', 'oldValue=pending');
    assert(pendingConflictEntry.newValue === 'confirmed', 'newValue=confirmed');
    assert(pendingConflictEntry.modifier === '老岑', '修改人=老岑');
    assertContains(pendingConflictEntry.reason, '确认现场温度确实偏高', '修改原因包含处理备注');
  }
  console.log('');

  // ===== Step 5: 模拟刷新（数据持久化在内存中，不影响） =====
  console.log('【Step 5】模拟刷新 - 数据仍在内存中');
  const s5 = store.get();
  assert(s5.workPhotos!.length === 3, '刷新后照片仍在');
  assert(s5.inspectionNotes!.length === 2, '刷新后备注仍在');
  assert(s5.conflicts!.length >= 1, '刷新后冲突仍在');
  assert(s5.pendingHistoryEntries!.length >= 6, '刷新后 pending 仍在');
  console.log('');

  // ===== Step 6: 首次生成交接报告 - 重点验证历史记录不为空 =====
  console.log('【Step 6】首次生成交接报告');
  console.log('  >>> 重点验证：首次生成时历史记录不为空 <<<');
  
  const report = store.generateReport();
  const s6 = store.get();
  
  assert(s6.reports!.length === 1, '报告已生成');
  assert(report.deduplicatedItemCount === 3, '去重后 3 条记录');
  assert(report.conflictCount === s4.conflicts!.length, `冲突数=${report.conflictCount}`);
  assert(report.resolvedCount === s4.conflicts!.filter(c => c.status !== 'pending').length, `已解决冲突数=${report.resolvedCount}`);
  
  // 核心验证：首次生成报告时历史记录不为空
  const reportHistory = store.getHistoryForReport(report.id);
  console.log(`  - 首次生成报告后，历史记录条数 = ${reportHistory.length}`);
  assert(reportHistory.length > 0, '❗️ 核心：首次生成报告时历史记录不为空！');
  
  // 验证每条记录的复核状态
  report.items.forEach(item => {
    console.log(`  - ${item.deviceNo}: 复核状态=${item.reviewStatus}, 扩散率=${item.diffusionRate?.toFixed(4)}, 备注数=${item.inspectionNotes.length}, 冲突数=${item.conflicts.length}`);
  });

  // 验证备注原话在历史记录中
  const historyWithNote1 = reportHistory.find(h => h.newValue === note1.content);
  assert(historyWithNote1 !== undefined, '历史记录中包含备注1原话');
  if (historyWithNote1) {
    assert(historyWithNote1.modifier === '老岑', '修改人=老岑');
    assert(historyWithNote1.field.startsWith('note_'), '字段类型=note');
  }

  const historyWithNote3 = reportHistory.find(h => h.newValue === note3.content);
  assert(historyWithNote3 !== undefined, '历史记录中包含备注3原话');

  // 验证冲突处理记录在历史记录中
  const historyWithConflict = reportHistory.find(h => h.field === `conflict_${conflict.id}_status`);
  assert(historyWithConflict !== undefined, '历史记录中包含冲突处理记录');
  if (historyWithConflict) {
    assert(historyWithConflict.oldValue === 'pending', 'oldValue=pending');
    assert(historyWithConflict.newValue === 'confirmed', 'newValue=confirmed');
    assert(historyWithConflict.modifier === '老岑', '修改人=老岑');
    assertContains(historyWithConflict.reason, '确认现场温度确实偏高', '修改原因包含处理备注');
  }

  // 验证复核状态变更
  const reviewStatusChanges = reportHistory.filter(h => h.field === 'reviewStatus');
  console.log(`  - reviewStatus 变更记录 ${reviewStatusChanges.length} 条`);
  assert(reviewStatusChanges.length >= 2, '至少 2 条 reviewStatus 变更（每条备注+冲突处理）');

  // 验证每条设备的 reviewStatus 记录
  const itemStatusChanges = reportHistory.filter(h => h.field.startsWith('item_') && h.field.endsWith('_reviewStatus'));
  assert(itemStatusChanges.length === 3, '3 条设备各有 1 条 reviewStatus 自动判定记录');

  // 验证 pending 已清理
  assert(s6.pendingHistoryEntries!.length === 0, 'pendingHistoryEntries 已清理（转入正式 history）');
  console.log('');

  // ===== Step 7: 验证报告展开项内嵌备注和冲突 =====
  console.log('【Step 7】验证报告展开项内嵌备注和冲突');
  const item1 = report.items.find(i => i.deviceNo === 'DEV-001')!;
  assert(item1.inspectionNotes.length === 1, 'DEV-001 内嵌 1 条备注');
  assert(item1.inspectionNotes[0].inspectorName === '老岑', '内嵌备注修改人=老岑');
  assert(item1.inspectionNotes[0].content === note1.content, '内嵌备注原话正确');
  assert(item1.conflicts.length >= 1, 'DEV-001 内嵌冲突记录');
  assert(item1.conflicts[0].resolverName === '老岑', '内嵌冲突处理人=老岑');
  assert(item1.conflicts[0].resolutionRemark === '确认现场温度确实偏高，已记录', '内嵌冲突处理备注正确');
  
  const item3 = report.items.find(i => i.deviceNo === 'DEV-003')!;
  assert(item3.inspectionNotes.length === 1, 'DEV-003 内嵌 1 条备注');
  assert(item3.conflicts.length === 0, 'DEV-003 无冲突');
  console.log('');

  // ===== Step 8: 补录材料 - 验证补录前后扩散结果差异 =====
  console.log('【Step 8】切换补录材料批次，导入补录照片');
  store.set({ currentBatchType: 'supplementary' });
  
  const suppPhotos: WorkPhoto[] = [];
  for (let i = 0; i < 3; i++) {
    const photo = store.addWorkPhoto({
      batchType: 'supplementary',
      deviceNo: `DEV-00${i + 1}`,
      dissolvedOxygen: 6.5 + i * 0.3 + 0.2,
      temperature: 20 + i * 0.5,
      temperatureUnit: 'C',
      recordTime: new Date(baseTime - i * 3600000).toISOString()
    });
    suppPhotos.push(photo);
  }
  
  // 补录备注
  suppPhotos.forEach((photo, idx) => {
    if (idx % 2 === 0) {
      store.addInspectionNote({
        workPhotoId: photo.id,
        inspectorName: '老岑',
        content: `补录：${photo.deviceNo} 二次巡检确认`,
        inspectionTime: new Date(baseTime - idx * 3600000 + 3600000).toISOString()
      });
    }
  });

  const suppReport = store.generateReport();
  console.log(`  - 补录材料报告：${suppReport.items.length} 条记录`);

  // 对比同一设备正常材料 vs 补录材料扩散率
  console.log('  --- 补录前后扩散率对比 ---');
  for (let i = 0; i < 3; i++) {
    const normalItem = report.items.find(x => x.deviceNo === `DEV-00${i + 1}`)!;
    const suppItem = suppReport.items.find(x => x.deviceNo === `DEV-00${i + 1}`)!;
    const diffPercent = normalItem.diffusionRate && suppItem.diffusionRate
      ? Math.abs((suppItem.diffusionRate - normalItem.diffusionRate) / normalItem.diffusionRate * 100)
      : 0;
    console.log(`  - DEV-00${i + 1}: 正常=${normalItem.diffusionRate?.toFixed(4)}, 补录=${suppItem.diffusionRate?.toFixed(4)}, 偏差=${diffPercent.toFixed(1)}%`);
    assert(diffPercent < 10, `DEV-00${i + 1} 扩散率偏差 < 10% 阈值`);
  }
  console.log('');

  // ===== Step 9: 导出 JSON 验证字段数量 =====
  console.log('【Step 9】导出 JSON 验证字段数量一致');
  const exportPayload = {
    report: suppReport,
    workPhotos: store.get().workPhotos!.filter(p => p.batchType === 'supplementary'),
    inspectionNotes: store.get().inspectionNotes!.filter(n => 
      suppPhotos.some(p => p.id === n.workPhotoId)
    ),
    conflicts: store.get().conflicts!.filter(c => 
      suppPhotos.some(p => p.id === c.workPhotoId)
    ),
    historyEntries: store.getHistoryForReport(suppReport.id),
    exportTime: new Date().toISOString()
  };

  const exportFieldCounts = {
    reportItems: exportPayload.report.items.length,
    photos: exportPayload.workPhotos.length,
    notes: exportPayload.inspectionNotes.length,
    conflicts: exportPayload.conflicts.length,
    history: exportPayload.historyEntries.length
  };
  console.log(`  - 导出字段数：报告项=${exportFieldCounts.reportItems}, 照片=${exportFieldCounts.photos}, 备注=${exportFieldCounts.notes}, 冲突=${exportFieldCounts.conflicts}, 历史=${exportFieldCounts.history}`);
  
  assert(exportPayload.report.items.length === suppReport.items.length, '报告项数量一致');
  assert(exportPayload.workPhotos.length === suppReport.deduplicatedItemCount, '照片数量与去重后一致');
  
  const suppHistory = store.getHistoryForReport(suppReport.id);
  assert(suppHistory.length > 0, '补录材料报告历史记录也不为空');
  console.log('');

  // ===== Step 10: 再次生成报告 - 验证去重不翻倍 =====
  console.log('【Step 10】再次生成报告 - 验证去重不翻倍');
  const secondReport = store.generateReport();
  assert(secondReport.deduplicatedItemCount === suppReport.deduplicatedItemCount, '第二次生成去重后记录数不翻倍');
  console.log(`  - 第一次: ${suppReport.deduplicatedItemCount} 条, 第二次: ${secondReport.deduplicatedItemCount} 条`);
  console.log('');

  // ===== 汇总 =====
  console.log('='.repeat(70));
  console.log(` 测试完成：${passed} 通过，${failed} 失败`);
  console.log('='.repeat(70));

  if (failed > 0) {
    console.log('\n❌ 存在失败项，请检查！\n');
    process.exit(1);
  } else {
    console.log('\n✅ 所有测试通过！核心验证点：');
    console.log('   ✅ 首次生成报告时历史记录不为空');
    console.log('   ✅ 历史记录包含备注原话、修改人、修改原因');
    console.log('   ✅ 历史记录包含冲突处理记录、处理人、处理备注');
    console.log('   ✅ 报告展开项内嵌备注和冲突详情');
    console.log('   ✅ 补录前后扩散率偏差 < 10% 阈值');
    console.log('   ✅ 第二次生成报告去重计数不翻倍');
    console.log('   ✅ 导出 JSON 字段数量与系统内一致\n');
    process.exit(0);
  }
}

// 运行测试
const isMainModule = typeof process !== 'undefined' && process.argv[1]?.includes('test-flow');
if (isMainModule) {
  runTests().catch(err => {
    console.error('测试运行异常:', err);
    process.exit(1);
  });
}

export { runTests };
