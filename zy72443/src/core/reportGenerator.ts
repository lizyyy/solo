import { SplitReport, LessonVerification, AnomalyRecord, ChangeHistory } from '../models';
import { dataStore } from './dataStore';

export function generateReport(period: string = '2025-06'): SplitReport {
  const verifications = dataStore.getAllVerifications();
  const anomalies = dataStore.getAllAnomalies();
  const tickets = dataStore.getAllTickets();
  const changeHistories = dataStore.getAllChangeHistories();

  const totalRevenue = verifications.reduce((sum, v) => sum + v.finalRevenue, 0);
  const verifiedCount = verifications.filter(v => v.status === 'verified').length;
  const pendingCount = verifications.filter(v => v.status === 'pending' || v.status === 'reserved').length;
  const anomalyCount = anomalies.filter(a => !a.resolved).length;

  const cityTraceability: SplitReport['cityTraceability'] = {};
  
  for (const v of verifications) {
    for (const city of v.authorizedCities) {
      if (!cityTraceability[city]) {
        cityTraceability[city] = {
          ticketIds: [],
          musicianNames: [],
          triggeredAnomalies: [],
          fixActions: []
        };
      }
      if (!cityTraceability[city].ticketIds.includes(v.ticketId)) {
        cityTraceability[city].ticketIds.push(v.ticketId);
      }
      if (!cityTraceability[city].musicianNames.includes(v.musicianName)) {
        cityTraceability[city].musicianNames.push(v.musicianName);
      }
    }
  }

  for (const a of anomalies) {
    const cityMatches = a.description.match(/[\u4e00-\u9fa5]{2,3}(?=、|，|。|$)/g);
    if (cityMatches) {
      for (const city of cityMatches) {
        if (cityTraceability[city]) {
          if (!cityTraceability[city].triggeredAnomalies.includes(a.id)) {
            cityTraceability[city].triggeredAnomalies.push(a.id);
          }
        }
      }
    }
  }

  for (const h of changeHistories) {
    if (h.fieldName === 'actualAuthorizedCities' || h.fieldName === 'authorizedCities') {
      const allCities = new Set([...h.oldValue.split(/[、,，;；]/), ...h.newValue.split(/[、,，;；]/)]);
      for (const city of allCities) {
        const cityTrimmed = city.trim();
        if (cityTrimmed && cityTraceability[cityTrimmed]) {
          const action = `[${new Date(h.changedAt).toLocaleString('zh-CN')}] ${h.changedBy}: ${h.oldValue} → ${h.newValue} (${h.changeReason})`;
          if (!cityTraceability[cityTrimmed].fixActions.includes(action)) {
            cityTraceability[cityTrimmed].fixActions.push(action);
          }
        }
      }
    }
  }

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
    anomalyList: anomalies,
    changeHistoryList: changeHistories,
    cityTraceability
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
  lines.push(`数据文件: ${dataStore.getDataFilePath()}`);
  lines.push('');

  lines.push('--- 汇总 ---');
  lines.push(`  票单总数: ${report.summary.totalTickets}`);
  lines.push(`  分账总金额: ¥${report.summary.totalRevenue.toFixed(2)}`);
  lines.push(`  ✅ 已核销: ${report.summary.verifiedCount} 笔`);
  lines.push(`  ⏳ 待处理: ${report.summary.pendingCount} 笔`);
  lines.push(`  ⚠️  未解决异常: ${report.summary.anomalyCount} 笔`);
  lines.push(`  📝 修改历史记录: ${report.changeHistoryList.length} 条`);
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
    
    const histories = dataStore.getChangeHistoriesByTicket(v.ticketId);
    if (histories.length > 0) {
      lines.push(`  📜 修改历史 (${histories.length} 条):`);
      for (const h of histories) {
        lines.push(`     - [${new Date(h.changedAt).toLocaleString('zh-CN')}] ${h.changedBy} 修改 ${h.fieldName}: "${h.oldValue}" → "${h.newValue}" (原因: ${h.changeReason})`);
      }
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
      lines.push(`  检测时间: ${new Date(a.detectedAt).toLocaleString('zh-CN')} | 检测人: ${a.detectedBy}`);
      lines.push(`  数据来源: ${a.sourceData.source} -> ${a.sourceData.fieldName}`);
      lines.push(`  📄 原始值(票务导出表): ${a.sourceData.originalValue}`);
      if (a.sourceData.expectedValue) {
        lines.push(`  🎵 期望值(音频备注):  ${a.sourceData.expectedValue}`);
      }
      if (a.resolved) {
        lines.push(`  ✅ 解决人: ${a.resolvedBy} | 解决时间: ${a.resolvedAt ? new Date(a.resolvedAt).toLocaleString('zh-CN') : '-'}`);
        lines.push(`  📝 解决说明: ${a.resolutionNotes}`);
      } else {
        lines.push(`  👉 待处理: 请店长复核后，转交录音师小段补录音频备注`);
      }
      lines.push('');
    }
  }

  lines.push('--- 城市可追溯性（从城市反查原始材料）---');
  lines.push('');
  for (const [city, info] of Object.entries(report.cityTraceability)) {
    lines.push(`【城市: ${city}】`);
    lines.push(`  🎫 关联票单: ${info.ticketIds.join(', ')}`);
    lines.push(`  🎤 涉及音乐人: ${info.musicianNames.join(', ')}`);
    if (info.triggeredAnomalies.length > 0) {
      lines.push(`  ⚠️  触发异常: ${info.triggeredAnomalies.join(', ')}`);
    }
    if (info.fixActions.length > 0) {
      lines.push(`  🔧 补录/修改记录:`);
      for (const action of info.fixActions) {
        lines.push(`     ${action}`);
      }
    }
    lines.push('');
  }

  if (report.changeHistoryList.length > 0) {
    lines.push('--- 完整修改历史时间线 ---');
    lines.push('');
    for (const h of report.changeHistoryList) {
      const entityLabel: Record<string, string> = {
        ticket: '票务导出表',
        audio_remark: '音频文件备注',
        verification: '课时核销单',
        anomaly: '异常记录'
      };
      lines.push(`[${new Date(h.changedAt).toLocaleString('zh-CN')}]`);
      lines.push(`  票单: ${h.ticketId}`);
      lines.push(`  修改对象: ${entityLabel[h.entityType] || h.entityType} (${h.entityId})`);
      lines.push(`  修改字段: ${h.fieldName}`);
      lines.push(`  改前: "${h.oldValue}"`);
      lines.push(`  改后: "${h.newValue}"`);
      lines.push(`  修改人: ${h.changedBy} | 修改原因: ${h.changeReason}`);
      lines.push('');
    }
  }

  lines.push('='.repeat(80));
  lines.push('报告结束');
  lines.push('='.repeat(80));

  return lines.join('\n');
}

export function traceCity(city: string): string {
  const histories = dataStore.getChangeHistoriesByCity(city);
  const verifications = dataStore.getAllVerifications().filter(v => 
    v.authorizedCities.includes(city)
  );
  const anomalies = dataStore.getAllAnomalies().filter(a => 
    a.description.includes(city)
  );

  const lines: string[] = [];
  lines.push('='.repeat(80));
  lines.push(`              城市 "${city}" 追溯报告`);
  lines.push('='.repeat(80));
  lines.push('');

  lines.push(`--- 涉及城市"${city}"的核销单 ---`);
  if (verifications.length === 0) {
    lines.push('  (无)');
  } else {
    for (const v of verifications) {
      lines.push(`  ${v.verificationNo} | ${v.musicianName} | 状态: ${v.status} | 地区: ${v.authorizedCities.join('、')}`);
    }
  }
  lines.push('');

  lines.push(`--- 涉及城市"${city}"的异常 ---`);
  if (anomalies.length === 0) {
    lines.push('  (无)');
  } else {
    for (const a of anomalies) {
      lines.push(`  ${a.id} | ${a.resolved ? '✅已解决' : '⚠️待处理'} | ${a.description}`);
      lines.push(`     票务原始值: ${a.sourceData.originalValue}`);
      if (a.sourceData.expectedValue) {
        lines.push(`     音频期望值: ${a.sourceData.expectedValue}`);
      }
    }
  }
  lines.push('');

  lines.push(`--- 涉及城市"${city}"的修改历史 ---`);
  if (histories.length === 0) {
    lines.push('  (无)');
  } else {
    for (const h of histories) {
      lines.push(`  [${new Date(h.changedAt).toLocaleString('zh-CN')}] ${h.changedBy} | ${h.fieldName}`);
      lines.push(`    改前: "${h.oldValue}" → 改后: "${h.newValue}"`);
      lines.push(`    原因: ${h.changeReason}`);
    }
  }
  lines.push('');
  lines.push('='.repeat(80));

  return lines.join('\n');
}
