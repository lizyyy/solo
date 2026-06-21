import type { TidalRecord, ReviewStatus, SourceChainItem, Remark } from '../types';
import { getAnomalyTypeLabel, getSourceTypeLabel } from './helpers';

interface GenerateConclusionParams {
  record: TidalRecord;
  newStatus: ReviewStatus;
  operationRemark?: string;
  sourceChain: SourceChainItem[];
  remarks: Remark[];
  operatorName: string;
  operationTime: string;
}

interface MissingItem {
  type: string;
  description: string;
}

export function generateConclusion(params: GenerateConclusionParams): string {
  const { record, newStatus, operationRemark, sourceChain, remarks, operatorName, operationTime } = params;
  
  const context = buildContext(record, sourceChain, remarks);
  
  switch (newStatus) {
    case 'confirmed':
      return generateConfirmedConclusion(record, context, operationRemark, operatorName, operationTime);
    case 'pending':
      return generatePendingConclusion(record, context, operationRemark, operatorName, operationTime);
    case 'returned':
      return generateReturnedConclusion(record, context, operationRemark, operatorName, operationTime);
    default:
      return '';
  }
}

function buildContext(record: TidalRecord, sourceChain: SourceChainItem[], remarks: Remark[]) {
  const hasManualReview = sourceChain.some(s => s.type === 'manual_review');
  const hasVerbalNote = sourceChain.some(s => s.type === 'verbal_note');
  const hasOldBottleId = sourceChain.some(s => s.type === 'old_bottle_id') || record.bottleVersion === 'old';
  const hasUnitMismatch = record.originalUnit !== record.unit;
  
  const affectsConclusionItems = sourceChain.filter(s => s.affectsConclusion);
  const manualReviewItem = sourceChain.find(s => s.type === 'manual_review' && s.affectsConclusion);
  const verbalNoteItems = sourceChain.filter(s => s.type === 'verbal_note');
  const oldBottleItem = sourceChain.find(s => s.type === 'old_bottle_id' && s.affectsConclusion);
  
  const latestRemark = remarks.length > 0 ? remarks[remarks.length - 1] : null;
  
  return {
    hasManualReview,
    hasVerbalNote,
    hasOldBottleId,
    hasUnitMismatch,
    affectsConclusionItems,
    manualReviewItem,
    verbalNoteItems,
    oldBottleItem,
    latestRemark,
    anomalyTypeLabel: getAnomalyTypeLabel(record.anomalyType),
  };
}

function generateConfirmedConclusion(
  record: TidalRecord,
  context: ReturnType<typeof buildContext>,
  operationRemark: string | undefined,
  operatorName: string,
  operationTime: string
): string {
  const parts: string[] = [];
  
  parts.push(`已确认数据有效。`);
  
  if (record.anomalyType !== 'none') {
    parts.push(`异常类型：${context.anomalyTypeLabel}（${record.anomalyReason || '无'}）。`);
  }
  
  if (context.hasUnitMismatch) {
    parts.push(`经复核，单位已从 ${record.originalUnit} 换算为 ${record.unit}，换算关系正确。`);
  }
  
  if (context.hasOldBottleId) {
    const oldId = record.oldBottleId || context.oldBottleItem?.content.match(/BOT-\w+-\d+/)?.[0] || '旧编号';
    const newId = record.bottleId;
    parts.push(`采样瓶编号对照关系已确认：旧版 ${oldId} → 新版 ${newId}，编号转换无误。`);
  }
  
  if (context.manualReviewItem) {
    parts.push(`人工改判已核实：${context.manualReviewItem.content}（操作人：${context.manualReviewItem.operator}）。`);
  }
  
  if (context.verbalNoteItems.length > 0) {
    const notes = context.verbalNoteItems.map(n => `${n.content}（${n.operator}）`).join('；');
    parts.push(`口头备注已记录：${notes}。`);
  }
  
  if (context.latestRemark) {
    parts.push(`复核备注：${context.latestRemark.content}（${context.latestRemark.author}）。`);
  }
  
  if (operationRemark) {
    parts.push(`确认说明：${operationRemark}。`);
  }
  
  parts.push(`复核人：${operatorName}，时间：${formatDateTimeShort(operationTime)}。`);
  
  return parts.join(' ');
}

function generatePendingConclusion(
  record: TidalRecord,
  context: ReturnType<typeof buildContext>,
  operationRemark: string | undefined,
  operatorName: string,
  operationTime: string
): string {
  const parts: string[] = [];
  const missingItems: MissingItem[] = [];
  
  parts.push(`待补充材料，暂无法确认。`);
  
  if (record.anomalyType !== 'none') {
    parts.push(`异常类型：${context.anomalyTypeLabel}（${record.anomalyReason || '无'}）。`);
  }
  
  if (context.hasUnitMismatch && record.anomalyType === 'unit_mismatch') {
    missingItems.push({
      type: '单位换算依据',
      description: `当前单位 ${record.unit} 与原始单位 ${record.originalUnit} 不一致，需提供单位转换的依据文件或现场说明`
    });
  }
  
  if (context.hasOldBottleId && record.anomalyType === 'bottle_mismatch') {
    const oldId = record.oldBottleId || '旧编号';
    missingItems.push({
      type: '编号对照表',
      description: `采样瓶 ${oldId} 使用旧版编号规则，需提供新旧编号对照表或现场确认记录`
    });
  }
  
  if (record.anomalyType === 'outlier') {
    missingItems.push({
      type: '现场复核材料',
      description: `潮位值偏离正常范围，需补充现场照片、同期其他站点数据或仪器校验记录`
    });
  }
  
  if (record.anomalyType === 'manual_change' && !context.manualReviewItem) {
    missingItems.push({
      type: '人工改判依据',
      description: `数据经过人工改判，需补充改判原因说明、现场佐证材料或审批记录`
    });
  }
  
  if (context.verbalNoteItems.length > 0 && !context.manualReviewItem) {
    missingItems.push({
      type: '口头备注书面化',
      description: `存在口头备注信息，需补充书面确认材料或正式审批流程`
    });
  }
  
  if (operationRemark) {
    parts.push(`待补说明：${operationRemark}。`);
  }
  
  if (missingItems.length > 0) {
    parts.push(`需补充材料：`);
    missingItems.forEach((item, idx) => {
      parts.push(`${idx + 1}. ${item.type}：${item.description}`);
    });
  }
  
  parts.push(`登记人：${operatorName}，时间：${formatDateTimeShort(operationTime)}。`);
  
  return parts.join(' ');
}

function generateReturnedConclusion(
  record: TidalRecord,
  context: ReturnType<typeof buildContext>,
  operationRemark: string | undefined,
  operatorName: string,
  operationTime: string
): string {
  const parts: string[] = [];
  const returnReasons: string[] = [];
  
  parts.push(`退回修正，数据需重新处理后提交。`);
  
  if (record.anomalyType !== 'none') {
    parts.push(`异常类型：${context.anomalyTypeLabel}（${record.anomalyReason || '无'}）。`);
  }
  
  if (context.hasUnitMismatch && record.anomalyType === 'unit_mismatch') {
    returnReasons.push(`单位混写未修正：原始单位为 ${record.originalUnit}，当前单位为 ${record.unit}，需统一换算后重新入库`);
  }
  
  if (context.hasOldBottleId && record.anomalyType === 'bottle_mismatch') {
    const oldId = record.oldBottleId || '旧编号';
    returnReasons.push(`采样瓶编号未更新：${oldId} 为旧版编号，需对照转换表更新为新版编号`);
  }
  
  if (record.anomalyType === 'outlier' && !context.manualReviewItem) {
    returnReasons.push(`离群值未处理：潮位值明显偏离正常范围，未提供人工改判说明或现场复核材料，不能直接采信`);
  }
  
  if (context.manualReviewItem && context.affectsConclusionItems.some(s => s.type === 'manual_review')) {
    if (!operationRemark?.includes('同意') && !operationRemark?.includes('确认')) {
      returnReasons.push(`人工改判依据不足：${context.manualReviewItem.content}，需补充完整的改判审批材料和现场佐证`);
    }
  }
  
  if (context.hasVerbalNote && !context.manualReviewItem) {
    returnReasons.push(`存在口头备注未书面化：相关说明仅口头传达，需补充正式书面记录并走审批流程`);
  }
  
  if (operationRemark) {
    parts.push(`退回说明：${operationRemark}。`);
  }
  
  if (returnReasons.length > 0) {
    parts.push(`退回原因：`);
    returnReasons.forEach((reason, idx) => {
      parts.push(`${idx + 1}. ${reason}`);
    });
  }
  
  if (record.anomalyType !== 'none') {
    parts.push(`修正后请重新提交复核。`);
  }
  
  parts.push(`复核人：${operatorName}，时间：${formatDateTimeShort(operationTime)}。`);
  
  return parts.join(' ');
}

function formatDateTimeShort(isoString: string): string {
  const date = new Date(isoString);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d} ${h}:${min}`;
}

export function getStatusExplanation(status: ReviewStatus): string {
  const map = {
    confirmed: '经复核，数据有效，可纳入统计分析',
    pending: '缺少必要材料，需补充后再进行复核',
    returned: '数据存在问题，需修正后重新提交',
  };
  return map[status];
}
