import type { WorkOrder, DuplicateWarning, DuplicateResolutionResult } from '../types';

export function detectDuplicates(
  existingOrders: WorkOrder[],
  newOrders: WorkOrder[]
): DuplicateWarning[] {
  const warnings: DuplicateWarning[] = [];
  const existingDeviceMap = new Map<string, WorkOrder>();
  for (const o of existingOrders) {
    existingDeviceMap.set(o.deviceNo, o);
  }
  for (const n of newOrders) {
    const existing = existingDeviceMap.get(n.deviceNo);
    if (existing) {
      warnings.push({
        deviceNo: n.deviceNo,
        existingOrderId: existing.id,
        newOrderId: n.id,
        existingOrderNo: existing.orderNo,
        newOrderNo: n.orderNo,
        suggestion: existing.manualRemark ? 'skip' : 'merge',
        nextStepText: existing.manualRemark
          ? `设备编号 ${n.deviceNo} 已存在（工单 ${existing.orderNo}）。检测到已有【人工备注】，建议默认跳过不覆盖；如需合并照片/附件可点"合并"。`
          : `设备编号 ${n.deviceNo} 已存在（工单 ${existing.orderNo}）。可选择跳过/合并（照片附件合并保留较新判断）/覆盖字段（除人工备注外）。`,
      });
    }
  }
  return warnings;
}

export function applyDuplicateAction(
  existingOrders: WorkOrder[],
  newOrders: WorkOrder[],
  actionMap: Record<string, 'skip' | 'merge' | 'overwrite'>
): { orders: WorkOrder[]; result: DuplicateResolutionResult } {
  const result: DuplicateResolutionResult = { imported: 0, skipped: 0, merged: 0, overwritten: 0, warnings: [] };
  const existingById = new Map<string, WorkOrder>();
  const duplicateWarnings = detectDuplicates(existingOrders, newOrders);
  const warningByNewOrderId = new Map<string, DuplicateWarning>();
  for (const warning of duplicateWarnings) {
    warningByNewOrderId.set(warning.newOrderId, warning);
  }

  for (const o of existingOrders) {
    existingById.set(o.id, {
      ...o,
      photos: [...o.photos],
      attachments: [...o.attachments],
      judgmentHistory: [...o.judgmentHistory],
    });
  }
  const finalOrders: WorkOrder[] = [];

  for (const n of newOrders) {
    const dupKey = `${n.deviceNo}::${n.id}`;
    const dupWarning = warningByNewOrderId.get(n.id);
    if (!dupWarning) {
      finalOrders.push(n);
      result.imported++;
      continue;
    }

    const action = actionMap[dupKey] ?? dupWarning.suggestion;
    if (action === 'skip') {
      result.skipped++;
      continue;
    }
    if (action === 'merge') {
      const existing = existingById.get(dupWarning.existingOrderId);
      if (existing) {
        const mergedPhotos = [
          ...existing.photos,
          ...n.photos.filter((np) => !existing.photos.some((ep) => ep.id === np.id)),
        ];
        const mergedAttachments = [
          ...existing.attachments,
          ...n.attachments.filter((na) => !existing.attachments.some((ea) => ea.id === na.id)),
        ];
        let { judgment, judgmentAt, judgmentBy } = existing;
        if (new Date(n.reportTime).getTime() > new Date(existing.reportTime).getTime()) {
          judgment = n.judgment;
          judgmentAt = n.judgmentAt;
          judgmentBy = n.judgmentBy;
        }
        existingById.set(existing.id, {
          ...existing,
          photos: mergedPhotos,
          attachments: mergedAttachments,
          judgment,
          judgmentAt,
          judgmentBy,
          isDuplicateWarning: true,
          duplicateAction: 'merge',
        });
        result.merged++;
        continue;
      }
    }
    if (action === 'overwrite') {
      const existing = existingById.get(dupWarning.existingOrderId);
      if (existing) {
        const preservedRemark = existing.manualRemark;
        existingById.set(existing.id, {
          ...n,
          manualRemark: preservedRemark,
          isDuplicateWarning: true,
          duplicateAction: 'overwrite',
        });
        result.overwritten++;
        continue;
      }
    }
  }

  for (const e of existingById.values()) {
    finalOrders.push(e);
  }

  result.warnings = duplicateWarnings;
  return { orders: finalOrders, result };
}

export function buildNextStepCard(warning: DuplicateWarning): { title: string; actions: string[]; suggestion: string } {
  const suggestionText =
    warning.suggestion === 'skip'
      ? '建议跳过：避免人工备注被覆盖，也不产生重复记录。'
      : warning.suggestion === 'merge'
      ? '建议合并：将新工单的照片/附件并入已有工单，判断取较新者。'
      : '建议覆盖：仅更新字段（人工备注始终保留）。';
  return {
    title: `设备编号重复：${warning.deviceNo}`,
    actions: ['跳过（不导入）', '合并到现有工单', '覆盖字段（保留备注）'],
    suggestion: suggestionText,
  };
}
