import { format } from 'date-fns';
import type { ShortageRecord, VersionHistory, ChangeDetail } from '../types';
import { hasConclusionChanges, hasMaterialOnlyChanges } from './compare';

const STATUS_LABELS: Record<string, string> = {
  pending: '待处理',
  investigating: '核查中',
  resolved: '已解决',
  disputed: '有争议'
};

const CHANGE_TYPE_LABELS: Record<string, string> = {
  material_only: '仅补材料',
  conclusion_changed: '结论变更'
};

const SOURCE_LABELS: Record<string, string> = {
  refund_list: '退款清单',
  settlement_attachment: '结算附件',
  bank_statement: '银行对账单',
  manual_adjustment: '手工调整'
};

const CATEGORY_LABELS: Record<string, string> = {
  fee_carryover: '手续费跨期',
  refund_early_arrival: '退款清单早到',
  attachment_late_submit: '结算附件晚补',
  statement_manual_edit: '对账单手工改动',
  amount_mismatch: '金额不符',
  missing_document: '缺少单据',
  other: '其他'
};

export function formatDate(dateStr: string): string {
  return format(new Date(dateStr), 'yyyy-MM-dd HH:mm');
}

export function generateAuditNote(record: ShortageRecord): string {
  const lines: string[] = [];

  lines.push('='.repeat(60));
  lines.push(`门店短款追踪 - 对账说明`);
  lines.push('='.repeat(60));
  lines.push(`导出时间: ${formatDate(new Date().toISOString())}`);
  lines.push('');

  lines.push('【基本信息】');
  lines.push(`记录ID: ${record.id}`);
  lines.push(`门店: ${record.storeName} (${record.storeId})`);
  lines.push(`账期: ${record.accountingPeriod}`);
  lines.push(`来源: ${SOURCE_LABELS[record.source] || record.source}`);
  lines.push(`来源参考: ${record.sourceRef}`);
  lines.push(`金额: ¥${record.amount.toFixed(2)}`);
  lines.push(`当前状态: ${STATUS_LABELS[record.status]}`);
  lines.push(`问题分类: ${CATEGORY_LABELS[record.issueCategory] || record.issueCategory}`);
  lines.push('');

  if (record.pendingReason) {
    lines.push('【待处理原因】');
    lines.push(record.pendingReason);
    lines.push('');
  }

  if (record.conclusion) {
    lines.push('【当前结论】');
    lines.push(record.conclusion);
    lines.push('');
  }

  if (record.latestAlert) {
    lines.push('【重要提醒】');
    lines.push(`⚠️  ${record.latestAlert}`);
    lines.push('');
  }

  lines.push('【附件清单】');
  if (record.attachments.length === 0) {
    lines.push('  (无附件)');
  } else {
    record.attachments.forEach(att => {
      lines.push(`  - ${att.name} (v${att.version}) [${SOURCE_LABELS[att.type]}]`);
      lines.push(`      上传: ${att.uploadedBy} at ${formatDate(att.uploadedAt)}`);
      if (att.note) lines.push(`      备注: ${att.note}`);
    });
  }
  lines.push('');

  lines.push('【版本历史】');
  lines.push('-' .repeat(60));
  
  [...record.versionHistory].reverse().forEach((version, idx) => {
    lines.push(`\n版本 v${version.version} (${idx === 0 ? '当前' : '历史'})`);
    lines.push(`  时间: ${formatDate(version.timestamp)}`);
    lines.push(`  操作人: ${version.modifiedBy}`);
    lines.push(`  原因: ${version.changeReason}`);
    
    const hasConclusion = hasConclusionChanges(version.changes);
    const hasMaterial = hasMaterialOnlyChanges(version.changes);
    
    if (hasConclusion) {
      lines.push(`  变更类型: ${CHANGE_TYPE_LABELS.conclusion_changed} ⚠️`);
    } else if (hasMaterial) {
      lines.push(`  变更类型: ${CHANGE_TYPE_LABELS.material_only}`);
    }
    
    lines.push('  变更明细:');
    version.changes.forEach(change => {
      const prefix = change.changeType === 'conclusion_changed' ? '  ⚠️ ' : '  •  ';
      lines.push(`${prefix}${formatFieldName(change.field)}: ${change.oldValue} → ${change.newValue}`);
    });
  });

  lines.push('');
  lines.push('='.repeat(60));
  lines.push('下一班跟进提示：');
  lines.push(`1. 当前状态为"${STATUS_LABELS[record.status]}"，需${getNextAction(record)}`);
  lines.push(`2. 重点关注版本历史中标注⚠️的结论变更`);
  lines.push(`3. 附件版本回传或内容变更已在历史中标记`);
  lines.push('='.repeat(60));

  return lines.join('\n');
}

function formatFieldName(field: string): string {
  const labels: Record<string, string> = {
    amount: '金额',
    status: '状态',
    conclusion: '结论',
    issueCategory: '问题分类',
    pendingReason: '待处理原因',
    sourceRef: '来源参考'
  };
  if (field.startsWith('attachment:')) {
    return `附件[${field.replace('attachment:', '')}]`;
  }
  return labels[field] || field;
}

function getNextAction(record: ShortageRecord): string {
  switch (record.status) {
    case 'pending':
      return '尽快联系门店补充材料或核实情况';
    case 'investigating':
      return '继续跟进核查进度，确认差异原因';
    case 'resolved':
      return '已解决，可关账';
    case 'disputed':
      return '有争议，需升级或协调';
    default:
      return '跟进处理';
  }
}

export function downloadTextFile(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateExportFilename(record: ShortageRecord): string {
  const dateStr = format(new Date(), 'yyyyMMdd_HHmm');
  return `短款追踪_${record.storeId}_${record.accountingPeriod}_${dateStr}.txt`;
}

export function formatChangeSummary(changes: ChangeDetail[]): { material: ChangeDetail[]; conclusion: ChangeDetail[] } {
  return {
    material: changes.filter(c => c.changeType === 'material_only'),
    conclusion: changes.filter(c => c.changeType === 'conclusion_changed')
  };
}
