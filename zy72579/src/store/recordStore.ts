import { create } from 'zustand';
import type { CheckRecord, ConflictEvidence, FeatureVersion, ReconcileResult, ReconcileItem } from '@/types';
import { mockRecords } from '@/data/mockRecords';

const incrementVersion = (version: string): string => {
  const match = version.match(/^v(\d+)\.(\d+)\.(\d+)/);
  if (match) {
    const [, major, minor, patch] = match;
    return `v${major}.${minor}.${parseInt(patch, 10) + 1}`;
  }
  const looseMatch = version.match(/v(\d+)/);
  if (looseMatch) return `v${parseInt(looseMatch[1], 10) + 1}.0.0`;
  return 'v1.0.0';
};

const cleanVersionTag = (raw: string): string => {
  const m = raw.match(/(v\d+\.\d+\.\d+)/);
  return m ? m[1] : raw;
};

const nowStr = () => new Date().toLocaleString('zh-CN');

export const buildReconcileResult = (record: CheckRecord): ReconcileResult => {
  const items: ReconcileItem[] = [];
  const { featureVersions, reviewHistory, conflicts, steps, currentStep, status, trainingLog, thresholdNote } =
    record;

  // 对账项 1：版本表最新版本 ↔ 调参笔记版本
  const latestV = featureVersions[0];
  const noteV = cleanVersionTag(thresholdNote.version);
  items.push({
    id: 'item-1',
    label: '特征版本表最新版本 ↔ 阈值调参笔记版本',
    match: latestV?.version === noteV,
    left: `版本表最新：${latestV?.version || 'N/A'}`,
    right: `笔记版本：${noteV}`,
    detail: latestV
      ? `版本表口径：「${latestV.caliber}」 | 操作人 ${latestV.operator} @ ${latestV.updateTime}`
      : undefined,
  });

  // 对账项 2：历史操作数量 ↔ 版本表记录数量（合理范围 历史≥版本）
  items.push({
    id: 'item-2',
    label: '审核历史操作数 ↔ 特征版本记录数',
    match: reviewHistory.length >= featureVersions.length,
    left: `历史操作：${reviewHistory.length} 条`,
    right: `版本记录：${featureVersions.length} 条`,
    detail: '每发一个新版本都会同时写入历史，故历史条数应≥版本条数',
  });

  // 对账项 3：步骤状态 ↔ 当前记录状态
  const anyBlocked = steps.some((s) => s.status === 'blocked');
  const allDone = steps.every((s) => s.status === 'completed');
  const stepStatusOk = allDone
    ? status === 'completed'
    : anyBlocked
    ? status === 'conflict' || status === 'pending_review'
    : true;
  items.push({
    id: 'item-3',
    label: '三步流程状态 ↔ 记录总状态',
    match: stepStatusOk,
    left: `三步：${steps
      .map((s) => (s.status === 'completed' ? '✓' : s.status === 'blocked' ? '✗' : s.status === 'current' ? '●' : '○'))
      .join('-')} | 当前步：${currentStep}`,
    right: `总状态：${status}`,
    detail: anyBlocked
      ? '存在阻断步骤，请按提示完成人工处理'
      : allDone
      ? '三步全完成，记录状态应为 completed'
      : '流程进行中，操作应可推进',
  });

  // 对账项 4：日志 ↔ 笔记 口径一致性（若有冲突）
  if (conflicts.length > 0) {
    const unresolved = conflicts.filter((c) => !c.resolution).length;
    items.push({
      id: 'item-4',
      label: '训练日志口径 ↔ 阈值调参笔记口径',
      match: unresolved === 0,
      left: `日志批次：${trainingLog.batchId}（${trainingLog.isDuplicate ? '重复训练' : '首次导入'}）`,
      right: `笔记：${thresholdNote.isOldCaliber ? '旧口径' : '新口径'}，待处理冲突 ${unresolved} 项`,
      detail: unresolved > 0 ? '存在口径冲突，需小乔确认或驳回' : '所有冲突均已处理',
    });
  }

  // 综合判断
  let reconcileStatus: ReconcileResult['status'] = 'ok';
  let summary = '对账通过：版本表、历史记录、流程状态三者一致';
  let nextAction: string | undefined;

  if (items.some((i) => !i.match)) {
    reconcileStatus = 'warn';
    summary = '对账提示：存在未对齐项，需按下方建议处理';
  }
  if (anyBlocked) {
    reconcileStatus = 'blocked';
    summary = '流程阻断：存在人工处理项，处理完成后自动恢复对账';
    if (record.type === 'duplicate_training') {
      nextAction = '请策略产品点击顶部「策略产品复核」按钮处理重复训练';
    } else if (conflicts.some((c) => !c.resolution)) {
      nextAction = '请算法工程师小乔在冲突面板选择「确认」或「驳回」';
    }
  }
  if (!allDone && !anyBlocked) {
    reconcileStatus = 'pending';
    summary = '对账正常：流程未结束，按步骤推进即可';
    nextAction =
      currentStep === 'update_version'
        ? '请点击「完成并发布新版本」确认最终口径，写入特征版本表'
        : '请点击「推进到下一步」继续流程';
  }
  if (allDone) {
    reconcileStatus = 'ok';
    summary = '对账通过：三步闭环完成，新版本已写入特征版本表并留有完整历史';
  }

  return { status: reconcileStatus, summary, items, nextAction };
};

interface RecordStore {
  records: CheckRecord[];
  initialRecords: CheckRecord[];
  selectedRecordId: string | null;
  setSelectedRecordId: (id: string | null) => void;
  getRecordById: (id: string) => CheckRecord | undefined;
  resolveConflict: (recordId: string, conflictId: string, resolution: 'confirmed' | 'rejected', remark?: string) => void;
  advanceStep: (recordId: string) => void;
  finishUpdateVersion: (recordId: string, finalCaliber?: string) => void;
  reviewDuplicateTraining: (recordId: string, decision: 'proceed' | 'mark_abnormal', remark: string) => void;
  resetRecords: () => void;
  exportReport: (recordId: string) => string;
  getReconcile: (recordId: string) => ReconcileResult | undefined;
}

export const useRecordStore = create<RecordStore>((set, get) => ({
  records: JSON.parse(JSON.stringify(mockRecords)),
  initialRecords: JSON.parse(JSON.stringify(mockRecords)),
  selectedRecordId: null,

  setSelectedRecordId: (id) => set({ selectedRecordId: id }),

  getRecordById: (id) => get().records.find((r) => r.id === id),

  getReconcile: (id) => {
    const r = get().records.find((x) => x.id === id);
    return r ? buildReconcileResult(r) : undefined;
  },

  resolveConflict: (recordId, conflictId, resolution, remark = '') => {
    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record;
        const now = nowStr();
        const updatedConflicts = record.conflicts.map((c: ConflictEvidence) =>
          c.id === conflictId
            ? { ...c, resolution, resolvedBy: '小乔（算法工程师）', resolvedAt: now }
            : c
        );
        const allResolved = updatedConflicts.every((c) => c.resolution !== null);
        const hasRejection = updatedConflicts.some((c) => c.resolution === 'rejected');

        let updatedSteps = [...record.steps];
        let updatedStatus = record.status;

        if (allResolved && !hasRejection) {
          updatedSteps = updatedSteps.map((s) =>
            s.key === 'review_notes'
              ? { ...s, status: 'completed' as const, blockedReason: undefined }
              : s
          );
          updatedStatus = 'normal';
        } else if (hasRejection) {
          updatedSteps = updatedSteps.map((s) =>
            s.key === 'review_notes'
              ? { ...s, status: 'blocked' as const, blockedReason: '冲突已驳回，需重查调参笔记并补录' }
              : s
          );
          updatedStatus = 'conflict';
        }

        const actionLabel =
          resolution === 'confirmed'
            ? '第二步-动作3：小乔确认冲突（通过，按新口径执行）'
            : '第二步-动作3：小乔驳回冲突（不通过，退回重查）';
        const resolutionRemark =
          resolution === 'confirmed'
            ? `对账同步：review_notes 已置 completed；冲突 ${conflictId} 确认通过 ✓；可推进下一步`
            : `对账同步：review_notes 保持 blocked；冲突 ${conflictId} 驳回 ✗；需重新补录笔记`;

        return {
          ...record,
          conflicts: updatedConflicts,
          steps: updatedSteps,
          status: updatedStatus,
          updateTime: now,
          reviewHistory: [
            ...record.reviewHistory,
            {
              operator: '小乔（算法工程师）',
              action: actionLabel,
              time: now,
              remark: `${resolutionRemark}${remark ? ' | 补充：' + remark : ''}`,
            },
          ],
        };
      }),
    }));
  },

  advanceStep: (recordId) => {
    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record;
        const stepOrder = ['import_log', 'review_notes', 'update_version'] as const;
        const currentIdx = stepOrder.indexOf(record.currentStep);
        if (currentIdx >= stepOrder.length - 1) return record;
        const nextStep = stepOrder[currentIdx + 1];
        const now = nowStr();

        const currentStepLabel = record.steps.find((s) => s.key === record.currentStep)?.label || '';
        const nextStepLabel = record.steps.find((s) => s.key === nextStep)?.label || '';

        const updatedSteps = record.steps.map((s) => {
          if (s.key === record.currentStep) {
            return { ...s, status: 'completed' as const, blockedReason: undefined };
          }
          if (s.key === nextStep) {
            return { ...s, status: 'current' as const };
          }
          return s;
        });

        const historyRemark =
          nextStep === 'update_version'
            ? `对账同步：当前步从 ${record.currentStep} 推进至 ${nextStep}（${nextStepLabel}）；状态变为待发布新版本`
            : `对账同步：当前步从 ${record.currentStep} 推进至 ${nextStep}（${nextStepLabel}）`;

        return {
          ...record,
          steps: updatedSteps,
          currentStep: nextStep,
          updateTime: now,
          reviewHistory: [
            ...record.reviewHistory,
            {
              operator: '小乔',
              action: `推进：${currentStepLabel} → ${nextStepLabel}`,
              time: now,
              remark: historyRemark,
            },
          ],
        };
      }),
    }));
  },

  finishUpdateVersion: (recordId, finalCaliber) => {
    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record;
        const now = nowStr();
        const lastVersion = record.featureVersions[0];
        const cleanBaseV = cleanVersionTag(lastVersion?.version || 'v1.0.0');
        const newVersionNum = incrementVersion(cleanBaseV);

        let caliber = finalCaliber;
        if (!caliber) {
          if (record.type === 'old_caliber') {
            caliber = '混合口径：补录旧口径笔记后，人工确认以新口径（首访30天活跃）为准，与线上 v3.0.0 对齐';
          } else if (record.type === 'duplicate_training') {
            caliber = lastVersion?.caliber + '（重复训练复核有效，版本递增）';
          } else {
            caliber = lastVersion?.caliber || '口径未填写';
          }
        }

        const newVersionEntry: FeatureVersion = {
          version: newVersionNum,
          featureName: record.featureName,
          caliber,
          updateTime: now,
          operator: '小乔',
          remark:
            record.type === 'old_caliber'
              ? `对账：第三步完成；由 ${cleanBaseV} 递增至 ${newVersionNum}；历史新增本条与发布记录；口径混合补录确认对齐线上`
              : record.type === 'duplicate_training'
              ? `对账：第三步完成；重复训练复核通过，版本号由 ${cleanBaseV} 递增；两次训练结果合并保留`
              : `对账：第三步完成；由 ${cleanBaseV} 递增至 ${newVersionNum}；一致性检查通过`,
        };

        const updatedSteps = record.steps.map((s) =>
          s.key === 'update_version'
            ? { ...s, status: 'completed' as const, blockedReason: undefined }
            : s
        );

        return {
          ...record,
          steps: updatedSteps,
          currentStep: 'update_version',
          status: 'completed',
          updateTime: now,
          thresholdNote: {
            ...record.thresholdNote,
            version: newVersionNum,
            updateTime: now,
          },
          featureVersions: [newVersionEntry, ...record.featureVersions],
          reviewHistory: [
            ...record.reviewHistory,
            {
              operator: '小乔',
              action: '第三步：更新特征版本表（发布新版本）',
              time: now,
              remark: `对账同步：特征版本表新增 ${newVersionNum}；历史条数 ${record.reviewHistory.length + 1} ≥ 版本条数 ${record.featureVersions.length + 1}；三步均 completed；总状态置为 completed ✓`,
            },
          ],
        };
      }),
    }));
  },

  reviewDuplicateTraining: (recordId, decision, remark) => {
    set((state) => ({
      records: state.records.map((record) => {
        if (record.id !== recordId) return record;
        const now = nowStr();
        let updatedSteps = [...record.steps];
        let updatedStatus = record.status;
        let updatedCurrentStep = record.currentStep;
        let historyAction = '';
        let historyRemark = '';

        if (decision === 'proceed') {
          updatedSteps = updatedSteps.map((s) => {
            if (s.key === 'import_log') {
              return { ...s, status: 'completed' as const, blockedReason: undefined };
            }
            if (s.key === 'review_notes') {
              return { ...s, status: 'current' as const };
            }
            return s;
          });
          updatedStatus = 'normal';
          updatedCurrentStep = 'review_notes';
          historyAction = '策略产品复核：通过（重复训练有效，允许推进）';
          historyRemark = `对账同步：import_log 解除 blocked 并置 completed；当前步推进至 review_notes；版本表未新增（第二次训练尚未发布版本）${
            remark ? ' | 复核意见：' + remark : ''
          }`;
        } else {
          updatedSteps = updatedSteps.map((s) =>
            s.key === 'import_log'
              ? { ...s, status: 'blocked' as const, blockedReason: '策略产品标记为异常：重复训练无效，流程终止' }
              : s
          );
          updatedStatus = 'conflict';
          historyAction = '策略产品复核：驳回（重复训练无效，标记异常）';
          historyRemark = `对账同步：import_log 保持 blocked；总状态置 conflict；版本表不新增；本次第二次训练记录不入库${
            remark ? ' | 复核意见：' + remark : ''
          }`;
        }

        return {
          ...record,
          steps: updatedSteps,
          currentStep: updatedCurrentStep,
          status: updatedStatus,
          updateTime: now,
          reviewHistory: [
            ...record.reviewHistory,
            {
              operator: '策略产品经理',
              action: historyAction,
              time: now,
              remark: historyRemark,
            },
          ],
        };
      }),
    }));
  },

  resetRecords: () => {
    set((state) => ({
      records: JSON.parse(JSON.stringify(state.initialRecords)),
    }));
  },

  exportReport: (recordId) => {
    const record = get().records.find((r) => r.id === recordId);
    if (!record) return '';
    const rec = buildReconcileResult(record);

    const statusText: Record<string, string> = {
      normal: '正常',
      pending_review: '待策略产品复核',
      conflict: '有冲突',
      completed: '已完成',
    };
    const typeText: Record<string, string> = {
      smooth: '顺利记录',
      duplicate_training: '重复训练',
      old_caliber: '旧口径补录',
    };
    const recStatusText: Record<string, string> = {
      ok: '✓ 对账通过',
      warn: '⚠ 对账提示',
      blocked: '✗ 对账阻断',
      pending: '○ 对账待完成',
    };

    let report = '==================================================\n';
    report += '       批流特征一致性检查 - 审核报告\n';
    report += '==================================================\n\n';
    report += `记录标题: ${record.title}\n`;
    report += `记录ID:   ${record.id}\n`;
    report += `记录类型: ${typeText[record.type] || record.type}\n`;
    report += `处理状态: ${statusText[record.status] || record.status}\n`;
    report += `对账结果: ${recStatusText[rec.status]} - ${rec.summary}\n`;
    report += `批次ID:   ${record.batchId}\n`;
    report += `特征名称: ${record.featureName}\n`;
    report += `创建时间: ${record.createTime}\n`;
    report += `最后更新: ${record.updateTime}\n\n`;

    report += '--------------------------------------------------\n';
    report += '一、审核流程进度\n';
    report += '--------------------------------------------------\n';
    record.steps.forEach((s, i) => {
      const t: Record<string, string> = {
        completed: '✅ 已完成',
        current: '🔄 进行中',
        pending: '⏳ 待处理',
        blocked: '🚫 已阻断',
      };
      report += `  ${i + 1}. ${s.label} - ${t[s.status]}\n`;
      if (s.blockedReason) report += `        原因: ${s.blockedReason}\n`;
    });
    report += '\n';

    if (record.conflicts.length > 0) {
      report += '--------------------------------------------------\n';
      report += '二、冲突处理明细（人工判断）\n';
      report += '--------------------------------------------------\n';
      record.conflicts.forEach((c, i) => {
        report += `  冲突${i + 1} (ID: ${c.id}): ${c.description}\n`;
        report += `    日志证据: ${c.logEvidence}\n`;
        report += `    笔记证据: ${c.noteEvidence}\n`;
        if (c.resolution) {
          report += `    处理: ${c.resolution === 'confirmed' ? '✅ 确认通过' : '❌ 驳回'}\n`;
          report += `    操作人: ${c.resolvedBy} | 时间: ${c.resolvedAt}\n`;
        } else {
          report += `    处理: 待算法工程师人工裁决\n`;
        }
        report += '\n';
      });
    }

    report += '--------------------------------------------------\n';
    report += '三、对账明细（特征版本表 ↔ 审核历史 ↔ 状态）\n';
    report += '--------------------------------------------------\n';
    rec.items.forEach((it, i) => {
      report += `  ${i + 1}. ${it.label}\n`;
      report += `     比对: [${it.match ? '✓ 匹配' : '✗ 不匹配/需处理'}]\n`;
      report += `     左: ${it.left}\n`;
      report += `     右: ${it.right}\n`;
      if (it.detail) report += `     说明: ${it.detail}\n`;
      report += '\n';
    });
    if (rec.nextAction) report += `  ▶ 下一步: ${rec.nextAction}\n\n`;

    report += '--------------------------------------------------\n';
    report += '四、特征版本表（按倒序，最新置顶）\n';
    report += '--------------------------------------------------\n';
    record.featureVersions.forEach((v) => {
      report += `  * ${v.version}  ${v.caliber}\n`;
      report += `     操作人: ${v.operator} | 时间: ${v.updateTime}\n`;
      report += `     备注: ${v.remark}\n\n`;
    });

    report += '--------------------------------------------------\n';
    report += '五、审核历史时间线（倒序，最新置顶）\n';
    report += '--------------------------------------------------\n';
    record.reviewHistory
      .slice()
      .reverse()
      .forEach((h, idx) => {
        report += `  [${record.reviewHistory.length - idx}] ${h.time}\n`;
        report += `      ${h.operator} → ${h.action}\n`;
        if (h.remark) report += `      备注: ${h.remark}\n`;
        report += '\n';
      });

    report += '==================================================\n';
    report += '  生成时间: ' + nowStr() + '\n';
    report += '==================================================\n';
    return report;
  },
}));
