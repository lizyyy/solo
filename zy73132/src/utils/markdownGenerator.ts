import type { TidalRecord, Station, SourceChainItem, Remark } from '../types';
import { getStatusLabel, getAnomalyTypeLabel, formatDateTime, getSourceTypeLabel } from './helpers';

interface ReportData {
  station: Station;
  records: TidalRecord[];
  sourceChains: Record<string, SourceChainItem[]>;
  remarks: Record<string, Remark[]>;
  reportTime: string;
}

export function generateMarkdownReport(data: ReportData): string {
  const { station, records, sourceChains, remarks, reportTime } = data;
  
  const totalRecords = records.length;
  const anomalyRecords = records.filter(r => r.isAnomaly);
  const confirmedCount = records.filter(r => r.status === 'confirmed').length;
  const pendingCount = records.filter(r => r.status === 'pending').length;
  const returnedCount = records.filter(r => r.status === 'returned').length;
  
  const unitMismatchCount = records.filter(r => r.anomalyType === 'unit_mismatch').length;
  const bottleMismatchCount = records.filter(r => r.anomalyType === 'bottle_mismatch').length;
  const manualChangeCount = records.filter(r => r.anomalyType === 'manual_change').length;
  const outlierCount = records.filter(r => r.anomalyType === 'outlier').length;

  let md = '';
  
  md += `# 潮汐能站时序回放复核报告\n\n`;
  md += `> **站点**: ${station.name}  \n`;
  md += `> **报告生成时间**: ${reportTime}  \n`;
  md += `> **数据时段**: ${formatDateTime(records[0]?.timestamp || '')} ~ ${formatDateTime(records[records.length - 1]?.timestamp || '')}\n\n`;
  
  md += `## 一、概况统计\n\n`;
  md += `| 指标 | 数量 | 占比 |\n`;
  md += `|------|------|------|\n`;
  md += `| 总记录数 | ${totalRecords} | 100% |\n`;
  md += `| 异常记录 | ${anomalyRecords.length} | ${((anomalyRecords.length / totalRecords) * 100).toFixed(1)}% |\n`;
  md += `| 已确认 | ${confirmedCount} | ${((confirmedCount / totalRecords) * 100).toFixed(1)}% |\n`;
  md += `| 待补件 | ${pendingCount} | ${((pendingCount / totalRecords) * 100).toFixed(1)}% |\n`;
  md += `| 退回 | ${returnedCount} | ${((returnedCount / totalRecords) * 100).toFixed(1)}% |\n\n`;
  
  md += `## 二、异常分类汇总\n\n`;
  md += `| 异常类型 | 数量 | 说明 |\n`;
  md += `|----------|------|------|\n`;
  md += `| 离群值 | ${outlierCount} | 数值偏离正常范围，需人工判定是否为噪声 |\n`;
  md += `| 单位混写 | ${unitMismatchCount} | 原始单位与标准单位不一致 |\n`;
  md += `| 旧版编号 | ${bottleMismatchCount} | 采样瓶使用旧版编号规则 |\n`;
  md += `| 人工改判 | ${manualChangeCount} | 经人工复核后修改原始数据 |\n\n`;
  
  md += `## 三、逐条复核详情\n\n`;
  
  const abnormalRecords = records.filter(r => r.isAnomaly);
  const normalRecords = records.filter(r => !r.isAnomaly);
  
  if (abnormalRecords.length > 0) {
    md += `### 3.1 异常记录\n\n`;
    
    abnormalRecords.forEach((record, index) => {
      md += `#### ${index + 1}. ${formatDateTime(record.timestamp)}\n\n`;
      md += `- **采样瓶编号**: ${record.bottleId}${record.bottleVersion === 'old' ? ' (旧版)' : ''}\n`;
      md += `- **潮位值**: ${record.waterLevel} ${record.unit}`;
      if (record.originalUnit !== record.unit) {
        md += ` (原始单位: ${record.originalUnit})`;
      }
      md += `\n`;
      md += `- **异常类型**: ${getAnomalyTypeLabel(record.anomalyType)}\n`;
      md += `- **异常原因**: ${record.anomalyReason || '无'}\n`;
      md += `- **当前状态**: ${getStatusLabel(record.status)}\n`;
      md += `- **复核结论**: ${record.conclusion || '待判定'}\n\n`;
      
      const chain = sourceChains[record.id];
      if (chain && chain.length > 0) {
        md += `**数据来源链**\n\n`;
        chain.forEach(item => {
          const prefix = item.affectsConclusion ? '⚠️ ' : '• ';
          md += `${prefix}**${getSourceTypeLabel(item.type)}** - ${item.content}  \n`;
          md += `  &nbsp;&nbsp;操作人: ${item.operator} | 时间: ${formatDateTime(item.time)}`;
          if (item.affectsConclusion) {
            md += ` | **影响结论**`;
          }
          md += `\n\n`;
        });
      }
      
      const recordRemarks = remarks[record.id];
      if (recordRemarks && recordRemarks.length > 0) {
        md += `**备注记录**\n\n`;
        recordRemarks.forEach(remark => {
          const verbalTag = remark.isVerbal ? ' 🗣️ *口头*' : '';
          md += `> ${remark.content}${verbalTag}  \n`;
          md += `> —— ${remark.author} · ${formatDateTime(remark.time)}\n\n`;
        });
      }
      
      md += `---\n\n`;
    });
  }
  
  if (normalRecords.length > 0) {
    md += `### 3.2 正常记录（节选）\n\n`;
    md += `共 ${normalRecords.length} 条正常记录，以下为最近 5 条：\n\n`;
    
    normalRecords.slice(-5).reverse().forEach(record => {
      md += `- ${formatDateTime(record.timestamp)} | ${record.waterLevel} ${record.unit} | ${record.bottleId} | ✅ 已确认\n`;
    });
    md += `\n`;
  }
  
  md += `## 四、复核结论\n\n`;
  
  if (pendingCount > 0 || returnedCount > 0) {
    md += `**待跟进事项**:\n\n`;
    if (pendingCount > 0) {
      md += `- ⏳ 有 ${pendingCount} 条记录处于"待补件"状态，需补充相关材料\n`;
    }
    if (returnedCount > 0) {
      md += `- 🔴 有 ${returnedCount} 条记录被退回，需修正后重新提交\n`;
    }
    if (unitMismatchCount > 0) {
      md += `- 🔢 存在单位混写问题，需统一单位标准\n`;
    }
    if (bottleMismatchCount > 0) {
      md += `- 🏷️ 存在旧版采样瓶编号，需更新编号对照\n`;
    }
    md += `\n`;
  } else {
    md += `✅ 本期所有记录均已确认无误，数据质量良好。\n\n`;
  }
  
  md += `---\n\n`;
  md += `*本报告由潮汐能站时序回放系统自动生成，数据以系统最新状态为准。*\n`;
  
  return md;
}
