import { SplitReport, LessonVerification, AnomalyRecord } from '../models';
import { dataStore } from './dataStore';

export function generateReport(period: string = '2025-06'): SplitReport {
  const verifications = dataStore.getAllVerifications();
  const anomalies = dataStore.getAllAnomalies();
  const tickets = dataStore.getAllTickets();

  const totalRevenue = verifications.reduce((sum, v) => sum + v.finalRevenue, 0);
  const verifiedCount = verifications.filter(v => v.status === 'verified').length;
  const pendingCount = verifications.filter(v => v.status === 'pending' || v.status === 'reserved').length;
  const anomalyCount = anomalies.filter(a => !a.resolved).length;

  return {
    reportId: `RPT-${Date.now()}`,
    generatedAt: new Date().toISOString(),
    period,
    summary: {
      totalTickets: tickets.length,
      totalRevenue: Math.round(totalRevenue * 100) / 100,
      anomalyCount,
      verifiedCount,
      pendingCount
    },
    verificationList: verifications,
    anomalyList: anomalies
  };
}

export function formatVerificationForDisplay(v: LessonVerification): Record<string, string> {
  const statusMap: Record<string, string> = {
    pending: '待处理',
    reserved: '已预留(异常)',
    verified: '已核销',
    rejected: '已驳回'
  };

  return {
    '核销单号': v.verificationNo,
    '票单号': v.ticketId,
    '音乐人': v.musicianName,
    '直播日期': v.liveDate,
    '打赏总额': `¥${v.totalTips.toFixed(2)}`,
    '应结金额': `¥${v.finalRevenue.toFixed(2)}`,
    '授权地区': v.authorizedCities.join('、'),
    '状态': statusMap[v.status] || v.status,
    '预留原因': v.reservedReason || '-',
    '缺材料': v.missingMaterials.length > 0 ? v.missingMaterials.join('；') : '-',
    '下一步找': v.nextAction,
    '操作说明': v.actionNotes,
    '复核人': v.reviewedBy || '-',
    '创建时间': v.createdAt,
    '更新时间': v.updatedAt
  };
}

export function generateHumanReadableReport(): string {
  const report = generateReport();
  const lines: string[] = [];

  lines.push('='.repeat(80));
  lines.push('                    音乐人直播打赏分账报告');
  lines.push('='.repeat(80));
  lines.push(`报告编号: ${report.reportId}`);
  lines.push(`生成时间: ${new Date(report.generatedAt).toLocaleString('zh-CN')}`);
  lines.push(`统计周期: ${report.period}`);
  lines.push('');

  lines.push('--- 汇总 ---');
  lines.push(`  票单总数: ${report.summary.totalTickets}`);
  lines.push(`  分账总金额: ¥${report.summary.totalRevenue.toFixed(2)}`);
  lines.push(`  已核销: ${report.summary.verifiedCount} 笔`);
  lines.push(`  待处理: ${report.summary.pendingCount} 笔`);
  lines.push(`  异常数: ${report.summary.anomalyCount} 笔`);
  lines.push('');

  lines.push('--- 课时核销单明细 ---');
  lines.push('');

  for (const v of report.verificationList) {
    const statusLabel = v.status === 'reserved' ? '⚠️ 已预留' : 
                        v.status === 'verified' ? '✅ 已核销' : 
                        v.status === 'pending' ? '⏳ 待处理' : '❌ 已驳回';
    
    lines.push(`【${statusLabel}】核销单: ${v.verificationNo} | 音乐人: ${v.musicianName}`);
    lines.push(`  票单号: ${v.ticketId} | 直播日期: ${v.liveDate}`);
    lines.push(`  打赏总额: ¥${v.totalTips.toFixed(2)} | 应结金额: ¥${v.finalRevenue.toFixed(2)}`);
    lines.push(`  授权地区: ${v.authorizedCities.join('、')}`);
    
    if (v.status === 'reserved') {
      lines.push(`  ❗ 预留原因: ${v.reservedReason}`);
      lines.push(`  📋 还缺材料: ${v.missingMaterials.join('；')}`);
      lines.push(`  👉 下一步找: ${v.nextAction}`);
      lines.push(`  💬 说明: ${v.actionNotes}`);
    } else {
      lines.push(`  💬 操作说明: ${v.actionNotes}`);
    }
    
    if (v.reviewedBy) {
      lines.push(`  👤 复核人: ${v.reviewedBy}`);
    }
    lines.push('');
  }

  if (report.anomalyList.length > 0) {
    lines.push('--- 异常记录 ---');
    lines.push('');
    
    for (const a of report.anomalyList) {
      const statusLabel = a.resolved ? '✅ 已解决' : '⚠️ 待处理';
      lines.push(`【${statusLabel}】异常ID: ${a.id}`);
      lines.push(`  类型: 授权地区缺失 | 严重程度: ${a.severity === 'high' ? '高' : a.severity === 'medium' ? '中' : '低'}`);
      lines.push(`  关联票单: ${a.ticketId}`);
      lines.push(`  描述: ${a.description}`);
      lines.push(`  检测时间: ${new Date(a.detectedAt).toLocaleString('zh-CN')}`);
      lines.push(`  数据来源: ${a.sourceData.source} -> ${a.sourceData.fieldName}`);
      lines.push(`  原始值: ${a.sourceData.originalValue}`);
      if (a.sourceData.expectedValue) {
        lines.push(`  期望值: ${a.sourceData.expectedValue}`);
      }
      if (a.resolved) {
        lines.push(`  解决人: ${a.resolvedBy} | 解决时间: ${a.resolvedAt ? new Date(a.resolvedAt).toLocaleString('zh-CN') : '-'}`);
        lines.push(`  解决说明: ${a.resolutionNotes}`);
      }
      lines.push('');
    }
  }

  lines.push('='.repeat(80));
  lines.push('报告结束');
  lines.push('='.repeat(80));

  return lines.join('\n');
}
