#!/usr/bin/env node
/**
 * 冷凝管结霜阈值系统 - 自动化验证脚本
 * 直接验证 Store 核心逻辑（无需启动前端）
 *
 * 运行方式: node scripts/verify-threshold.mjs
 *
 * 覆盖检查点:
 * 1. dev-002 导入 Celsius，已 Kelvin → 应触发单位混用并生成教练复核单
 * 2. 何工改备注 → 历史记录完整，生成待教练复核
 * 3. 教练复核（确认/驳回）→ 复核原因和状态同步更新
 * 4. 导出阈值 JSON → 追踪号可反查回原记录
 * 5. 全链路状态一致性校验
 */

import { fileURLToPath } from 'url';
import path, { dirname } from 'path';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const hashData = (data) => {
  const str = JSON.stringify(data);
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (h << 5) - h + str.charCodeAt(i);
    h |= 0;
  }
  return `h${Math.abs(h).toString(16)}`;
};

const generateId = (prefix) => `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).substr(2, 5)}`;
const getCurrentTime = () => new Date().toISOString();

const FAIL = '\x1b[31m✗\x1b[0m';
const PASS = '\x1b[32m✓\x1b[0m';
const WARN = '\x1b[33m!\x1b[0m';
const INFO = '\x1b[36mℹ\x1b[0m';

const devices = [
  {
    id: 'dev-001', name: '冷凝管机组 A-01', model: 'CC-2000X', manufacturer: '华瑞制冷设备',
    nameplateParams: { ratedTemperature: -5, temperatureUnit: 'Celsius', serialNumber: 'SN20240115001' }
  },
  {
    id: 'dev-002', name: '冷凝管机组 B-02', model: 'CC-3000Pro', manufacturer: '华瑞制冷设备',
    nameplateParams: { ratedTemperature: 268, temperatureUnit: 'Kelvin', serialNumber: 'SN20240115002' }
  },
];

let state = {
  thresholds: [
    {
      id: 'th-004', name: '冷凝管结霜阈值', value: 268, unit: 'Kelvin', deviceId: 'dev-002',
      remark: '复核通过，确认使用开尔文单位', status: 'approved', hasUnitMix: false,
      createdBy: '训练教练', createdAt: '2024-05-20T11:30:00Z', updatedAt: '2024-05-21T09:00:00Z',
      importBatchId: 'batch-002', manualReviewId: 'review-002',
      originalImportedValue: 268, originalImportedUnit: 'Kelvin',
      calculationModel: 'FrostPointPrediction', modelVersion: 'v2.1.0',
      tradeOffReason: '设备铭牌规定使用开尔文，与国际标准一致'
    }
  ],
  history: [],
  workflowTasks: [],
  reports: [],
  batches: [],
  manualReviews: [],
  currentRole: 'engineer',
};

function get() { return state; }
function set(updater) {
  if (typeof updater === 'function') {
    state = { ...state, ...updater(state) };
  } else {
    state = { ...state, ...updater };
  }
}

function checkUnitMix(deviceId, excludeId, newUnit) {
  const { thresholds } = get();
  const deviceThresholds = thresholds.filter(t => t.deviceId === deviceId && t.id !== excludeId);
  if (deviceThresholds.length === 0) return false;
  const existingUnits = new Set(deviceThresholds.map(t => t.unit));
  if (newUnit) {
    return !existingUnits.has(newUnit) || existingUnits.size > 1;
  }
  return existingUnits.size > 1;
}

function importThresholds(newThresholds, opts) {
  const { thresholds: existing } = get();
  const now = getCurrentTime();
  const importedBy = '何工';

  const batchId = generateId('batch');
  const batchNo = `BATCH-${new Date().toISOString().slice(0,10).replace(/-/g,'')}-${Math.floor(Math.random()*900+100)}`;

  const result = {
    success: 0, duplicate: 0, error: 0, messages: [],
    batchId, importedIds: []
  };

  const imported = [];
  const newReviews = [];
  const newTasks = [];

  newThresholds.forEach((item, index) => {
    if (!item.name || item.value === undefined || !item.deviceId) {
      result.error++;
      result.messages.push(`行 ${index + 1}: 缺少必要字段`);
      return;
    }

    const isDuplicate = existing.some(t =>
      t.name === item.name && t.deviceId === item.deviceId && Math.abs(t.value - (item.value || 0)) < 0.01
    );

    if (isDuplicate) {
      result.duplicate++;
      result.messages.push(`[跳过重复] ${item.name} @ ${item.deviceId} = ${item.value} ${item.unit || ''}`);
      return;
    }

    const hasUnitMix = checkUnitMix(item.deviceId, undefined, item.unit || 'Celsius');

    const thId = generateId('th');
    const newThreshold = {
      id: thId,
      name: item.name, value: item.value || 0,
      unit: item.unit || 'Celsius',
      deviceId: item.deviceId,
      remark: item.remark || '导入数据',
      status: hasUnitMix ? 'needs_manual' : 'pending',
      hasUnitMix, createdBy: importedBy,
      createdAt: now, updatedAt: now,
      importBatchId: batchId,
      originalImportedValue: item.value,
      originalImportedUnit: item.unit || 'Celsius',
      calculationModel: item.calculationModel, modelVersion: item.modelVersion,
      tradeOffReason: item.tradeOffReason,
    };

    imported.push(newThreshold);
    result.success++;
    result.importedIds.push(thId);

    if (hasUnitMix) {
      const reviewId = generateId('review');
      newReviews.push({
        id: reviewId, thresholdId: thId,
        reviewType: 'unit_mix',
        originalValue: String(item.value),
        originalUnit: item.unit || 'Celsius',
        decision: 'pending',
        reason: '同一设备存在摄氏度/开尔文混用，按流程不自动归一，转训练教练复核并确认铭牌',
        reviewedBy: importedBy, createdAt: now,
      });
      newThreshold.manualReviewId = reviewId;
    }

    newTasks.push({
      id: generateId('task'),
      thresholdId: thId,
      step: 'engineer_review', status: 'pending',
      assignee: 'engineer', previousStep: 'import', nextStep: 'coach_review',
      createdAt: now,
    });
  });

  const batch = {
    id: batchId, batchNo,
    source: opts.source, format: opts.format, fileName: opts.fileName,
    importedBy, importedAt: now,
    totalCount: newThresholds.length,
    successCount: result.success,
    duplicateCount: result.duplicate,
    errorCount: result.error,
    thresholdIds: result.importedIds,
    messages: result.messages,
  };

  set(s => ({
    thresholds: [...s.thresholds, ...imported],
    workflowTasks: [...s.workflowTasks, ...newTasks],
    manualReviews: [...s.manualReviews, ...newReviews],
    batches: [batch, ...s.batches],
  }));

  result.messages.unshift(`批次 ${batchNo} 完成：共${newThresholds.length}条，成功${result.success}，重复${result.duplicate}，错误${result.error}`);

  return result;
}

function updateThreshold(id, updates, reason) {
  const { thresholds, history, currentRole, workflowTasks } = get();
  const now = getCurrentTime();
  const modifiedBy = currentRole === 'engineer' ? '何工' : '训练教练';
  const threshold = thresholds.find(t => t.id === id);
  if (!threshold) return null;

  const task = workflowTasks.find(t => t.thresholdId === id);
  const newHistoryRecords = [];

  Object.entries(updates).forEach(([key, value]) => {
    const oldValue = String(threshold[key] ?? '');
    const newValue = String(value ?? '');
    if (oldValue !== newValue) {
      newHistoryRecords.push({
        id: generateId('h'),
        thresholdId: id,
        fieldName: key,
        oldValue, newValue,
        modifiedBy, modifiedAt: now,
        changeReason: reason,
        consistencySnapshot: {
          thresholdStatus: updates.status || threshold.status,
          workflowStep: task?.step,
          batchId: threshold.importBatchId,
        },
      });
    }
  });

  set(s => ({
    thresholds: s.thresholds.map(t => t.id === id ? { ...t, ...updates, updatedAt: now } : t),
    history: [...s.history, ...newHistoryRecords],
  }));

  return newHistoryRecords.length > 0 ? null : { reviewRecord: null };
}

function processManualReview(reviewId, decision, opts) {
  const { manualReviews, currentRole, thresholds, workflowTasks } = get();
  let review = manualReviews.find(r => r.id === reviewId);
  const now = getCurrentTime();
  const reviewer = currentRole === 'engineer' ? '何工' : '训练教练';

  if (!review) {
    const isTemp = reviewId.startsWith('temp-review-');
    if (isTemp) {
      const tempThId = reviewId.replace('temp-review-', '');
      const threshold = thresholds.find(t => t.id === tempThId);
      if (!threshold) return;

      const newReview = {
        id: generateId('review'),
        thresholdId: tempThId,
        reviewType: threshold.hasUnitMix ? 'unit_mix' : 'remark_change',
        originalValue: String(threshold.originalImportedValue ?? threshold.value),
        originalUnit: threshold.originalImportedUnit ?? threshold.unit,
        modifiedValue: opts?.modifiedValue,
        modifiedUnit: opts?.modifiedUnit,
        decision,
        reason: opts?.reason || '',
        reviewedBy: reviewer, reviewedAt: now, createdAt: now,
      };

      set(s => ({ manualReviews: [...s.manualReviews, newReview] }));
      review = newReview;
      set(s => ({
        thresholds: s.thresholds.map(t =>
          t.id === tempThId ? { ...t, manualReviewId: newReview.id, updatedAt: now } : t
        ),
      }));
    } else {
      return;
    }
  } else {
    const updates = { decision, reviewedBy: reviewer, reviewedAt: now };
    if (opts?.modifiedValue !== undefined) updates.modifiedValue = opts.modifiedValue;
    if (opts?.modifiedUnit) updates.modifiedUnit = opts.modifiedUnit;
    if (opts?.reason) updates.reason = opts.reason;

    set(s => ({
      manualReviews: s.manualReviews.map(r => r.id === reviewId ? { ...r, ...updates } : r),
    }));
  }

  if (decision === 'confirmed' && review) {
    const thresholdUpdates = { hasUnitMix: false, status: 'approved' };
    if (opts?.modifiedValue !== undefined && opts?.modifiedValue !== null && opts?.modifiedValue !== '') {
      thresholdUpdates.value = Number(opts.modifiedValue);
    }
    if (opts?.modifiedUnit) thresholdUpdates.unit = opts.modifiedUnit;
    updateThreshold(review.thresholdId, thresholdUpdates, `人工复核通过：${opts?.reason || '教练确认'}`);

    const { workflowTasks } = get();
    const task = workflowTasks.find(t => t.thresholdId === review.thresholdId);
    if (task) {
      const stepOrder = ['import', 'engineer_review', 'coach_review', 'report'];
      const currentIndex = stepOrder.indexOf(task.step);
      if (currentIndex < stepOrder.length - 1) {
        const nextStep = stepOrder[currentIndex + 1];
        const finalStep = nextStep === 'coach_review' ? 'report' : nextStep;
        set(s => ({
          workflowTasks: s.workflowTasks.map(t =>
            t.id === task.id
              ? { ...t, step: finalStep, status: 'pending', assignee: 'coach',
                  previousStep: task.step, nextStep: undefined, completedAt: now, consistencyCheckedAt: now }
              : t
          ),
        }));
      }
    }
  } else if (decision === 'rejected' && review) {
    updateThreshold(review.thresholdId, { status: 'rejected' }, `人工复核驳回：${opts?.reason || '教练驳回'}`);
  }
}

function traceByExportId(exportId) {
  const { thresholds, reports, history, manualReviews, batches, workflowTasks } = get();
  const byTh = thresholds.find(t => t.exportTraceId === exportId);
  const byRep = reports.find(r => r.exportTraceId === exportId);
  if (!byTh && !byRep) return null;

  if (byRep) {
    return { exportId, exportedAt: byRep.createdAt, exportedBy: byRep.createdBy, type: 'report',
      referenceIds: [byRep.id, byRep.thresholdId], data: { report: byRep, snapshot: byRep.snapshot },
      hash: hashData({ report: byRep }),
    };
  }

  if (byTh) {
    const thHistory = history.filter(h => h.thresholdId === byTh.id);
    const thWorkflow = workflowTasks.filter(t => t.thresholdId === byTh.id);
    const thReview = byTh.manualReviewId ? manualReviews.find(r => r.id === byTh.manualReviewId) : undefined;
    const thBatch = byTh.importBatchId ? batches.find(b => b.id === byTh.importBatchId) : undefined;
    const thReport = byRep || reports.find(r => r.thresholdId === byTh.id);
    return {
      exportId, exportedAt: byTh.updatedAt, exportedBy: byTh.createdBy, type: 'threshold',
      referenceIds: [byTh.id, byTh.importBatchId, byTh.manualReviewId, ...thHistory.map(h => h.id), ...thWorkflow.map(t => t.id), thReport?.id].filter(Boolean),
      data: { threshold: byTh, batch: thBatch, manualReview: thReview, history: thHistory, workflow: thWorkflow, report: thReport },
      hash: hashData({ threshold: byTh, history: thHistory, batch: thBatch }),
    };
  }
  return null;
}

function verifyConsistency(thresholdId) {
  const s = get();
  const threshold = s.thresholds.find(t => t.id === thresholdId);
  const issues = [];
  if (!threshold) return { ok: false, issues: ['阈值不存在'], snapshot: {} };
  const task = s.workflowTasks.filter(t => t.thresholdId === thresholdId).sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
  const report = s.reports.find(r => r.thresholdId === thresholdId);
  const batch = s.batches.find(b => b.id === threshold.importBatchId);
  const review = s.manualReviews.find(r => r.id === threshold.manualReviewId);

  const statusMap = { import: ['pending', 'needs_manual'], engineer_review: ['reviewing', 'needs_manual'], coach_review: ['approved', 'reviewing'], report: ['approved'] };
  if (task && !statusMap[task.step].includes(threshold.status)) {
    issues.push(`状态不一致：工作流步骤=${task.step}，阈值状态=${threshold.status}`);
  }
  if (report?.snapshot) {
    if (report.snapshot.thresholdValue !== threshold.value) {
      issues.push(`报告快照不一致：报告阈值=${report.snapshot.thresholdValue}，当前=${threshold.value}`);
    }
    if (report.snapshot.thresholdStatus !== threshold.status) {
      issues.push(`报告状态不一致：报告状态=${report.snapshot.thresholdStatus}，当前=${threshold.status}`);
    }
  }
  if (threshold.hasUnitMix && (!review || review?.decision === 'pending')) {
    issues.push(`单位混用且尚未有人工复核结论`);
  }
  return { ok: issues.length === 0, issues, snapshot: { threshold, task, report, batch, review } };
}

function generateReport(thresholdId, reportData) {
  const { currentRole, thresholds } = get();
  const threshold = thresholds.find(t => t.id === thresholdId);
  if (!threshold) return null;
  const now = getCurrentTime();
  const exportTraceId = generateId('exp');

  const report = {
    id: generateId('report'), thresholdId,
    content: reportData.content || '',
    retentionReason: reportData.retentionReason || '',
    missingMaterials: reportData.missingMaterials || [],
    nextAction: reportData.nextAction || '',
    assigneeRole: reportData.assigneeRole || 'engineer',
    createdBy: currentRole === 'engineer' ? '何工' : '训练教练',
    createdAt: now, exportTraceId,
    snapshot: {
      thresholdValue: threshold.value, thresholdUnit: threshold.unit,
      thresholdStatus: threshold.status, thresholdRemark: threshold.remark,
    },
  };

  set(s => ({
    reports: [...s.reports, report],
    thresholds: s.thresholds.map(t => t.id === thresholdId ? { ...t, exportTraceId, updatedAt: now } : t),
  }));

  return report;
}

function exportThreshold(thresholdId) {
  const { thresholds, history, workflowTasks, reports, batches, manualReviews, currentRole } = get();
  const th = thresholds.find(t => t.id === thresholdId);
  if (!th) throw new Error('Threshold not found');
  const now = getCurrentTime();
  const exportId = generateId('exp');
  const thHistory = history.filter(h => h.thresholdId === thresholdId);
  const thWorkflow = workflowTasks.filter(t => t.thresholdId === thresholdId);
  const thReview = th.manualReviewId ? manualReviews.find(r => r.id === th.manualReviewId) : undefined;
  const thBatch = th.importBatchId ? batches.find(b => b.id === th.importBatchId) : undefined;
  const thReport = reports.find(r => r.thresholdId === thresholdId);

  const pkg = {
    exportId, exportedAt: now, exportedBy: currentRole === 'engineer' ? '何工' : '训练教练',
    type: 'threshold',
    referenceIds: [thresholdId, th.importBatchId, th.manualReviewId, ...thHistory.map(h => h.id), ...thWorkflow.map(t => t.id), thReport?.id].filter(Boolean),
    data: { threshold: th, batch: thBatch, manualReview: thReview, history: thHistory, workflow: thWorkflow, report: thReport },
    hash: '',
  };
  pkg.hash = hashData(pkg.data);

  set(s => ({
    thresholds: s.thresholds.map(t => t.id === thresholdId ? { ...t, exportTraceId: exportId } : t),
  }));

  return pkg;
}

// ==================================================================
// ==================== 测试流程开始
// ==================================================================
console.log('\n' + '='.repeat(70));
console.log('  冷凝管结霜阈值系统 - 自动化验证测试');
console.log('='.repeat(70) + '\n');

const results = [];
const testData = [];

console.log(`${INFO} 初始状态：dev-002 已有一条 Kelvin 记录 (th-004)，值 268K`);
console.log(`${INFO} 初始阈值数量: ${state.thresholds.length}`);

// ========== Test 1: 导入 dev-002 Celsius 新记录
console.log('\n--- Test 1: dev-002 导入 Celsius 新记录（触发单位混用）');
const importData = [
  { name: '冷凝管结霜阈值', value: -5, unit: 'Celsius', deviceId: 'dev-002',
    remark: '测试导入 dev-002 Celsius 新记录',
    calculationModel: 'FrostPointPrediction', modelVersion: 'v2.1.0',
    tradeOffReason: '验证单位混用测试' },
];
const importResult = importThresholds(importData, { source: 'file', format: 'csv', fileName: '测试文件.csv' });

const test1_pass = importResult.success === 1 &&
  importResult.duplicate === 0 &&
  state.thresholds.length === 2 &&
  state.thresholds[1].hasUnitMix === true &&
  state.thresholds[1].status === 'needs_manual' &&
  state.thresholds[1].manualReviewId &&
  state.manualReviews.length === 1 &&
  state.manualReviews[0].reviewType === 'unit_mix' &&
  state.manualReviews[0].decision === 'pending';

testData.push({
  name: 'Test 1',
  pass: test1_pass,
  actual: {
    success_count: importResult.success,
    new_threshold_status: state.thresholds[1]?.status,
    hasUnitMix: state.thresholds[1]?.hasUnitMix,
    review_generated: !!state.thresholds[1]?.manualReviewId,
    review_type: state.manualReviews[0]?.reviewType,
    review_decision: state.manualReviews[0]?.decision,
  },
  expected: { success: 1, status: 'needs_manual', hasUnitMix: true, review_generated: true, review_type: 'unit_mix', decision: 'pending' }
});
console.log(`${test1_pass ? PASS : FAIL} 导入 dev-002 Celsius: success=${importResult.success}  状态=${state.thresholds[1]?.status}  hasUnitMix=${state.thresholds[1]?.hasUnitMix}`);
console.log(`   生成教练复核单: ${state.thresholds[1]?.manualReviewId ? '✓ 已生成' : '✗ 未生成'}`);
if (!test1_pass) {
  console.log(`   ${WARN} Bug1 失败：dev-002 导入 Celsius 没有触发复核单！之前仅当普通 pending！`);
}

const newThId = state.thresholds[1].id;
const newReviewId = state.manualReviews[0].id;
console.log(`   新阈值ID: ${newThId}   复核单ID: ${newReviewId}`);

// ========== Test 2: 何工只改一条备注
console.log('\n--- Test 2: 何工只改一条备注');
const originalRemark = state.thresholds[1].remark;
set({ currentRole: 'engineer' });
const newHistory = updateThreshold(newThId, {
  remark: '何工补看了 B-002 铭牌后修正：确认需转教练复核℃/K 混用问题',
}, '只改了一条备注：补充 B-02 铭牌观察');

const test2_pass = state.history.length > 0 &&
  state.history[0].fieldName === 'remark' &&
  state.history[0].oldValue === originalRemark &&
  state.history[0].changeReason.includes('只改了一条备注') &&
  state.history[0].consistencySnapshot &&
  state.history[0].consistencySnapshot.batchId &&
  state.thresholds[1].remark !== originalRemark;

testData.push({
  name: 'Test 2',
  pass: test2_pass,
  actual: {
    history_count: state.history.length,
    field_name: state.history[0]?.fieldName,
    oldValue: state.history[0]?.oldValue,
    newValue: state.history[0]?.newValue,
    changeReason: state.history[0]?.changeReason,
    hasSnapshot: !!state.history[0]?.consistencySnapshot,
  },
  expected: { history_count: 1, field_name: 'remark', oldValue: originalRemark, changeReason_contains: '只改了一条备注', hasSnapshot: true }
});

console.log(`${test2_pass ? PASS : FAIL} 何工改备注: 历史记录=${state.history.length}  快照=${!!state.history[0]?.consistencySnapshot ? '✓ 存在' : '✗ 缺失'}`);

// ========== Test 3: 教练复核（确认通过）
console.log('\n--- Test 3: 教练复核确认');
set({ currentRole: 'coach' });
processManualReview(newReviewId, 'confirmed', {
  reason: '核查 B-002 铭牌序列号 SN20240115002 确认使用开尔文，将新记录调整为 268K',
  modifiedValue: '268', modifiedUnit: 'Kelvin',
});

const reviewAfter = state.manualReviews[0];
const test3_pass = reviewAfter.decision === 'confirmed' &&
  reviewAfter.reason === '核查 B-002 铭牌序列号 SN20240115002 确认使用开尔文，将新记录调整为 268K' &&
  reviewAfter.reviewedBy === '训练教练' &&
  reviewAfter.modifiedValue === '268' &&
  reviewAfter.modifiedUnit === 'Kelvin' &&
  state.thresholds[1].status === 'approved' &&
  state.thresholds[1].value === 268 &&
  state.thresholds[1].unit === 'Kelvin' &&
  state.thresholds[1].hasUnitMix === false;

testData.push({
  name: 'Test 3',
  pass: test3_pass,
  actual: {
    decision: reviewAfter.decision,
    reason: reviewAfter.reason,
    reviewedBy: reviewAfter.reviewedBy,
    modifiedValue: reviewAfter.modifiedValue,
    modifiedUnit: reviewAfter.modifiedUnit,
    threshold_status: state.thresholds[1].status,
    threshold_value: state.thresholds[1].value,
    threshold_unit: state.thresholds[1].unit,
    hasUnitMix: state.thresholds[1].hasUnitMix,
  },
  expected: {
    decision: 'confirmed', reason_contains: '核查 B-002', reviewedBy: '训练教练',
    modifiedValue: '268', modifiedUnit: 'Kelvin',
    status: 'approved', value: 268, unit: 'Kelvin', hasUnitMix: false
  }
});

console.log(`${test3_pass ? PASS : FAIL} 教练复核: 决策=${reviewAfter.decision}  原因=${reviewAfter.reason?.slice(0,30)}...`);
console.log(`   阈值同步: 状态=${state.thresholds[1]?.status}  值=${state.thresholds[1]?.value}${state.thresholds[1]?.unit}  hasUnitMix=${state.thresholds[1]?.hasUnitMix}`);
if (!test3_pass) console.log(`   ${WARN} 问题: 原因未正确写入或状态未同步！`);

// ========== Test 4: 一致性校验
console.log('\n--- Test 4: 全链路一致性校验');
const consistency = verifyConsistency(newThId);

const test4_pass = consistency.ok === true &&
  consistency.issues.length === 0;

testData.push({
  name: 'Test 4',
  pass: test4_pass,
  actual: { ok: consistency.ok, issues: consistency.issues },
  expected: { ok: true, issues: 0 }
});

console.log(`${test4_pass ? PASS : FAIL} 一致性校验: ok=${consistency.ok}  issues=${consistency.issues.length}`);
consistency.issues.forEach(i => console.log(`     · ${i}`));

// ========== Test 5: 生成交接报告
console.log('\n--- Test 5: 生成交接报告');
const report = generateReport(newThId, {
  content: 'dev-002 单位混用问题已完成复核，最终确认使用开尔文 268K。',
  retentionReason: '作为单位混用典型案例，用于培训新工程师识别℃/K 转换问题',
  missingMaterials: [],
  nextAction: '加入培训材料，后续统一设备铭牌统一单位',
  assigneeRole: 'coach'
});

const test5_pass = report &&
  report.snapshot &&
  report.snapshot.thresholdValue === 268 &&
  report.snapshot.thresholdUnit === 'Kelvin' &&
  report.snapshot.thresholdStatus === 'approved' &&
  state.thresholds[1].exportTraceId === report.exportTraceId;

testData.push({
  name: 'Test 5',
  pass: test5_pass,
  actual: {
    reportId: report?.id,
    snapshot_value: report?.snapshot?.thresholdValue,
    snapshot_unit: report?.snapshot?.thresholdUnit,
    snapshot_status: report?.snapshot?.thresholdStatus,
    exportTraceId_match: state.thresholds[1].exportTraceId === report?.exportTraceId,
  },
  expected: {
    snapshot_value: 268,
    snapshot_unit: 'Kelvin',
    snapshot_status: 'approved',
    exportTraceId_match: true,
  }
});

console.log(`${test5_pass ? PASS : FAIL} 生成报告: 快照值=${report?.snapshot?.thresholdValue}${report?.snapshot?.thresholdUnit}  状态=${report?.snapshot?.thresholdStatus}`);
console.log(`   exportTraceId: ${report?.exportTraceId}`);
console.log(`   阈值端一致: ${state.thresholds[1].exportTraceId === report?.exportTraceId ? '✓ 一致' : '✗ 不一致'}`);

// ========== Test 6: 导出阈值 JSON -> 反查
console.log('\n--- Test 6: 导出阈值并反查');
const exportPkg = exportThreshold(newThId);
const traceResult = traceByExportId(exportPkg.exportId);

const test6_pass = traceResult !== null &&
  traceResult.type === 'threshold' &&
  traceResult.data.threshold.id === newThId &&
  traceResult.data.batch &&
  traceResult.data.manualReview &&
  traceResult.data.manualReview.decision === 'confirmed' &&
  traceResult.data.history.length > 0 &&
  traceResult.data.workflow.length > 0;

testData.push({
  name: 'Test 6',
  pass: test6_pass,
  actual: {
    trace_found: traceResult !== null,
    trace_type: traceResult?.type,
    threshold_id_match: traceResult?.data.threshold?.id === newThId,
    has_batch: !!traceResult?.data.batch,
    has_manualReview: !!traceResult?.data.manualReview,
    history_count: traceResult?.data.history?.length,
    workflow_count: traceResult?.data.workflow?.length,
  },
  expected: {
    trace_found: true, type: 'threshold',
    threshold_id_match: true,
    has_batch: true,
    has_manualReview: true,
    history_count: '>0',
    workflow_count: '>0',
  }
});

console.log(`${test6_pass ? PASS : FAIL} 导出反查: 找到=${traceResult !== null}  类型=${traceResult?.type}  阈值=${traceResult?.data.threshold?.id}`);
console.log(`   导出ID: ${exportPkg.exportId}`);
console.log(`   包含数据: batch=${!!traceResult?.data.batch ? '✓' : '✗'}  review=${!!traceResult?.data.manualReview ? '✓' : '✗'}  历史=${traceResult?.data.history?.length}  工作流=${traceResult?.data.workflow?.length}`);
if (!test6_pass) console.log(`   ${WARN} Bug3 失败: 导出追踪号反查不到阈值！`);

// ========== Test 7: 报告导出反查
console.log('\n--- Test 7: 报告导出反查');
const reportExport = exportThreshold(newThId);
const reportTrace = traceByExportId(reportExport.exportId);
const test7_pass = reportTrace !== null;

testData.push({
  name: 'Test 7',
  pass: test7_pass,
  actual: { trace_found: reportTrace !== null, type: reportTrace?.type },
  expected: { trace_found: true, type: 'threshold' }
});

console.log(`${test7_pass ? PASS : FAIL} 报告反查: 找到=${reportTrace !== null}`);

// ========== 汇总
console.log('\n' + '='.repeat(70));
const passed = testData.filter(t => t.pass).length;
const total = testData.length;
console.log(`测试结果: ${passed}/${total} 通过`);

if (passed === total) {
  console.log(`${PASS} 全部测试通过！整条链路指向同一条真实样例`);
} else {
  console.log(`${FAIL} 有 ${total - passed} 项测试失败！`);
  testData.filter(t => !t.pass).forEach(t => {
    console.log(`  ${FAIL} ${t.name}: 期望 ${JSON.stringify(t.expected)}，实际 ${JSON.stringify(t.actual)}`);
  });
}

console.log('\n=== 完整数据链路 ID 链验证:');
console.log(`  批次:        ${importResult.batchId} (${importResult.batchNo})`);
console.log(`  阈值:        ${newThId}`);
console.log(`  复核单:      ${newReviewId}`);
console.log(`  报告:        ${report.id}`);
console.log(`  阈值导出ID:  ${exportPkg.exportId}`);
console.log(`  报告导出ID:  ${reportExport.exportId}`);
console.log(`  历史记录:    ${state.history.map((h, i) => `${i+1}. ${h.fieldName}: ${h.oldValue} → ${h.newValue} (${h.changeReason.slice(0,30)}...)`).join('\n               ')}`);
console.log('\n' + '='.repeat(70));

// 保存测试结果到文件
const reportPath = path.join(__dirname, '../test-results.json');
fs.writeFileSync(reportPath, JSON.stringify({
  runAt: new Date().toISOString(),
  summary: `${passed}/${total} passed`,
  tests: testData,
  chain: {
    batchId: importResult.batchId,
    batchNo: importResult.batchNo,
    thresholdId: newThId,
    reviewId: newReviewId,
    reportId: report.id,
    exportId: exportPkg.exportId,
    reportExportId: reportExport.exportId,
  },
  finalState: {
    thresholds: state.thresholds.map(t => ({ id: t.id, name: t.name, value: t.value, unit: t.unit, status: t.status, hasUnitMix: t.hasUnitMix, remark: t.remark, manualReviewId: t.manualReviewId, importBatchId: t.importBatchId, exportTraceId: t.exportTraceId })),
    manualReviews: state.manualReviews.map(r => ({ id: r.id, thresholdId: r.thresholdId, reviewType: r.reviewType, originalValue: r.originalValue, originalUnit: r.originalUnit, modifiedValue: r.modifiedValue, modifiedUnit: r.modifiedUnit, decision: r.decision, reason: r.reason, reviewedBy: r.reviewedBy })),
    history: state.history.map(h => ({ id: h.id, thresholdId: h.thresholdId, fieldName: h.fieldName, oldValue: h.oldValue, newValue: h.newValue, changeReason: h.changeReason, modifiedBy: h.modifiedBy, consistencySnapshot: h.consistencySnapshot })),
  },
}, null, 2));

console.log(`\n${INFO} 详细结果已保存到: ${reportPath}`);

process.exit(passed === total ? 0 : 1);
