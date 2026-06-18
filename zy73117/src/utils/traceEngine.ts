import { format } from 'date-fns';
import { zhCN } from 'date-fns/locale';
import type { Material, TraceRecord, ChangeExplanation } from '@/types';

export function getRecordsForMaterial(
  materialId: string,
  allRecords: TraceRecord[]
): TraceRecord[] {
  return allRecords
    .filter(r => r.materialId === materialId)
    .sort((a, b) => new Date(a.operateTime).getTime() - new Date(b.operateTime).getTime());
}

export function generateChangeExplanation(
  record: TraceRecord,
  allRecords: TraceRecord[]
): ChangeExplanation {
  const typeLabels: { [key: string]: string } = {
    create: '创建记录',
    withdraw: '撤回操作',
    change: '变更操作',
    note: '添加备注',
  };

  const date = format(new Date(record.operateTime), 'yyyy年MM月dd日 HH:mm', { locale: zhCN });
  
  let text = `原结论为「${record.previousConclusion}」，`;
  text += `因${record.reason || '未说明原因'}，`;
  text += `于${date}由${record.operator}进行${typeLabels[record.type]}，`;
  text += `变更为「${record.newConclusion}」。`;
  if (record.remark) {
    text += `备注：${record.remark}`;
  }

  let withdrawnToFinal: string | null = null;
  let hasWithdrawnChain = false;

  if (record.type === 'withdraw') {
    hasWithdrawnChain = true;
    const laterRecords = allRecords
      .filter(r => 
        r.materialId === record.materialId && 
        new Date(r.operateTime) > new Date(record.operateTime)
      )
      .sort((a, b) => new Date(a.operateTime).getTime() - new Date(b.operateTime).getTime());
    
    if (laterRecords.length > 0) {
      const finalRecord = laterRecords[laterRecords.length - 1];
      withdrawnToFinal = `撤回原因：${record.reason || '未说明'} → 最终结论：「${finalRecord.newConclusion}」`;
    } else {
      withdrawnToFinal = `撤回原因：${record.reason || '未说明'} → 暂无后续结论`;
    }
  }

  return {
    recordId: record.id,
    text,
    hasWithdrawnChain,
    withdrawnToFinal,
  };
}

export function detectExceptions(
  material: Material,
  records: TraceRecord[]
): { hasException: boolean; reason: string; nextStep: string } {
  const materialRecords = getRecordsForMaterial(material.id, records);
  const changeRecords = materialRecords.filter(r => r.type === 'change');

  for (const record of changeRecords) {
    if (!record.hasChangeOrder) {
      return {
        hasException: true,
        reason: `变更记录「${record.content}」缺少变更单`,
        nextStep: `请尽快补充变更单，可点击记录后填写变更单号，预计3个工作日内完成`,
      };
    }
    if (record.changeOrderLate) {
      return {
        hasException: true,
        reason: `变更单「${record.changeOrderNo}」晚到，已影响材料追踪结果`,
        nextStep: `1. 确认变更单「${record.changeOrderNo}」原件已签收；2. 与设计部确认变更内容是否已落实；3. 更新材料结论并标记异常已处理`,
      };
    }
  }

  return {
    hasException: false,
    reason: '',
    nextStep: '',
  };
}

export function getPendingMaterials(materials: Material[], records: TraceRecord[]): Material[] {
  return materials.filter(m => {
    if (m.isPending) return true;
    const { hasException } = detectExceptions(m, records);
    return hasException;
  });
}

export function getTraceChainSummary(material: Material, records: TraceRecord[]): string {
  const materialRecords = getRecordsForMaterial(material.id, records);
  if (materialRecords.length <= 1) {
    return `原始结论：「${material.originalConclusion}」，无变更记录`;
  }

  const changes = materialRecords.filter(r => r.type !== 'create' && r.type !== 'note');
  if (changes.length === 0) {
    return `原始结论：「${material.originalConclusion}」，仅添加过备注`;
  }

  return `原始结论「${material.originalConclusion}」经过${changes.length}次${changes.some(c => c.type === 'withdraw') ? '撤回/' : ''}变更，当前结论为「${material.currentConclusion}」`;
}

export function generateWithdrawTrace(
  withdrawRecord: TraceRecord,
  allRecords: TraceRecord[]
): { trace: string; finalConclusion: string; hasFollowUp: boolean } {
  const laterRecords = allRecords
    .filter(r => 
      r.materialId === withdrawRecord.materialId && 
      new Date(r.operateTime) > new Date(withdrawRecord.operateTime)
    )
    .sort((a, b) => new Date(a.operateTime).getTime() - new Date(b.operateTime).getTime());

  let trace = `[${format(new Date(withdrawRecord.operateTime), 'MM-dd HH:mm')}] `;
  trace += `${withdrawRecord.operator} 撤回了结论「${withdrawRecord.previousConclusion}」`;
  trace += `，原因：${withdrawRecord.reason || '未说明'}`;

  if (laterRecords.length > 0) {
    const followUps = laterRecords.map(r => 
      `→ [${format(new Date(r.operateTime), 'MM-dd HH:mm')}] ${r.operator} ${r.type === 'change' ? '变更为' : r.type === 'withdraw' ? '再次撤回' : '备注'}「${r.newConclusion}」`
    ).join('\n');
    trace += '\n' + followUps;
    return {
      trace,
      finalConclusion: laterRecords[laterRecords.length - 1].newConclusion,
      hasFollowUp: true,
    };
  }

  return {
    trace,
    finalConclusion: '待重新提交',
    hasFollowUp: false,
  };
}
