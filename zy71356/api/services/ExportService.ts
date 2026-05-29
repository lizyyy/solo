import * as XLSX from 'xlsx';
import {
  ArrangementWithDetails,
  AssignmentWithDetails,
  Vendor,
  Stall,
  Conflict,
  CATEGORY_LABELS,
  CONFLICT_TYPE_LABELS,
} from '../../shared/types';

export class ExportService {
  exportToExcel(
    arrangement: ArrangementWithDetails,
    assignments: AssignmentWithDetails[],
    vendors: Vendor[],
    stalls: Stall[],
    conflicts: Conflict[]
  ): Buffer {
    const wb = XLSX.utils.book_new();

    const summaryData = [
      ['排布报告'],
      ['版本', arrangement.version],
      ['名称', arrangement.name],
      ['创建时间', arrangement.createdAt],
      ['创建人', arrangement.createdBy],
      ['备注', arrangement.note || ''],
      [],
      ['统计信息'],
      ['摊主总数', vendors.length],
      ['摊位总数', stalls.length],
      ['已分配摊位', assignments.length],
      ['冲突数量', conflicts.length],
      ['  - 高功率错配', conflicts.filter(c => c.type === 'power_mismatch').length],
      ['  - 同类集中', conflicts.filter(c => c.type === 'category_cluster').length],
      ['  - 无记录换位', conflicts.filter(c => c.type === 'unrecorded_swap').length],
    ];
    const summaryWs = XLSX.utils.aoa_to_sheet(summaryData);
    XLSX.utils.book_append_sheet(wb, summaryWs, '概览');

    const assignmentData = [
      ['摊位号', '摊主名称', '品类', '用电需求(W)', '摊位最大供电(W)', '人流入口', '分配时间', '来源'],
      ...assignments.map((a) => [
        a.stall.name,
        a.vendor.name,
        CATEGORY_LABELS[a.vendor.category],
        a.vendor.powerRequirement,
        a.stall.maxPower,
        a.stall.isEntrance ? '是' : '否',
        a.assignedAt,
        a.source || '',
      ]),
    ];
    const assignmentWs = XLSX.utils.aoa_to_sheet(assignmentData);
    XLSX.utils.book_append_sheet(wb, assignmentWs, '摊位分配');

    const vendorData = [
      ['摊主名称', '品类', '用电需求(W)', '联系方式', '备注', '创建时间'],
      ...vendors.map((v) => [
        v.name,
        CATEGORY_LABELS[v.category],
        v.powerRequirement,
        v.contact,
        v.note || '',
        v.createdAt,
      ]),
    ];
    const vendorWs = XLSX.utils.aoa_to_sheet(vendorData);
    XLSX.utils.book_append_sheet(wb, vendorWs, '摊主清单');

    const stallData = [
      ['摊位号', '行', '列', '最大供电(W)', '人流入口', '宽度', '高度'],
      ...stalls.map((s) => [
        s.name,
        s.row,
        s.col,
        s.maxPower,
        s.isEntrance ? '是' : '否',
        s.width,
        s.height,
      ]),
    ];
    const stallWs = XLSX.utils.aoa_to_sheet(stallData);
    XLSX.utils.book_append_sheet(wb, stallWs, '摊位配置');

    const conflictData = [
      ['类型', '严重程度', '描述', '影响对象', '来源', '创建时间'],
      ...conflicts.map((c) => [
        CONFLICT_TYPE_LABELS[c.type],
        c.severity === 'error' ? '错误' : '警告',
        c.message,
        c.affectedItems.join(', '),
        c.source || '',
        c.createdAt,
      ]),
    ];
    const conflictWs = XLSX.utils.aoa_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, conflictWs, '冲突报告');

    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' });
    return buf as Buffer;
  }

  generateConflictReport(
    arrangement: ArrangementWithDetails,
    conflicts: Conflict[]
  ): string {
    const lines: string[] = [];

    lines.push('========================================');
    lines.push('      艺术市集摊位排布冲突报告');
    lines.push('========================================');
    lines.push('');
    lines.push(`版本: ${arrangement.version}`);
    lines.push(`名称: ${arrangement.name}`);
    lines.push(`生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    if (conflicts.length === 0) {
      lines.push('✓ 未检测到任何冲突，排布符合所有规则。');
      return lines.join('\n');
    }

    lines.push(`检测到 ${conflicts.length} 个冲突:`);
    lines.push('');

    const byType = conflicts.reduce((acc, c) => {
      if (!acc[c.type]) acc[c.type] = [];
      acc[c.type].push(c);
      return acc;
    }, {} as Record<string, Conflict[]>);

    for (const [type, typeConflicts] of Object.entries(byType)) {
      lines.push(`【${CONFLICT_TYPE_LABELS[type as keyof typeof CONFLICT_TYPE_LABELS]}】`);
      lines.push(`共 ${typeConflicts.length} 项`);
      lines.push('');

      typeConflicts.forEach((c, i) => {
        const severity = c.severity === 'error' ? '❌ 错误' : '⚠️  警告';
        lines.push(`${i + 1}. ${severity}`);
        lines.push(`   ${c.message}`);
        lines.push(`   影响对象: ${c.affectedItems.join(', ')}`);
        if (c.source) {
          lines.push(`   来源: ${c.source}`);
        }
        lines.push('');
      });

      lines.push('---');
      lines.push('');
    }

    lines.push('建议操作:');
    lines.push('1. 优先处理标记为「错误」的高功率错配问题');
    lines.push('2. 调整同类集中的摊位位置，确保品类分散');
    lines.push('3. 补充换位操作的原因记录');
    lines.push('4. 重新运行冲突检测确认问题已解决');

    return lines.join('\n');
  }
}
