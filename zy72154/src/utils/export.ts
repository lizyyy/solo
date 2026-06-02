import * as XLSX from 'xlsx';
import { MatchResult, ReviewStatus } from '@/types';
import { getAnomalyTypeLabel, getSeverityLabel } from './anomaly';

export interface ExportOptions {
  status?: ReviewStatus;
  includeAnomalies?: boolean;
  format: 'xlsx' | 'csv';
}

export function exportToExcel(
  matchResults: MatchResult[],
  filename: string,
  options: ExportOptions
) {
  let filteredResults = matchResults;
  if (options.status) {
    filteredResults = matchResults.filter(r => r.mergedRecord.review_status === options.status);
  }

  const data = filteredResults.map(result => {
    const { mergedRecord, gisPoint, feedback, inspection, anomalies } = result;
    
    const row: Record<string, any> = {
      '路灯编号': mergedRecord.lamp_id,
      '地址': mergedRecord.address,
      '坐标': mergedRecord.longitude && mergedRecord.latitude 
        ? `${mergedRecord.longitude.toFixed(6)}, ${mergedRecord.latitude.toFixed(6)}`
        : '',
      '匹配度': `${mergedRecord.match_score.toFixed(0)}%`,
      '复核状态': getReviewStatusLabel(mergedRecord.review_status),
      '复核备注': mergedRecord.review_note || '',
      'GIS功率(W)': gisPoint?.power_rating || '',
      'GIS运行时间': gisPoint?.operating_hours || '',
      '反馈描述': feedback?.description || '',
      '反馈人': feedback?.reporter || '',
      '反馈原始备注': feedback?.raw_note || '',
      '巡检人': inspection?.inspector || '',
      '巡检时间': inspection?.inspection_time || '',
      '巡检备注': inspection?.manual_note || '',
    };

    if (options.includeAnomalies && anomalies.length > 0) {
      row['异常数量'] = anomalies.length;
      row['异常类型'] = anomalies.map(a => getAnomalyTypeLabel(a.type)).join('; ');
      row['异常说明'] = anomalies.map(a => a.human_readable).join('\n\n');
    }

    return row;
  });

  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, '巡检记录');
  
  if (options.format === 'xlsx') {
    XLSX.writeFile(wb, `${filename}.xlsx`);
  } else {
    XLSX.writeFile(wb, `${filename}.csv`, { bookType: 'csv' });
  }
}

export function exportByStatus(
  matchResults: MatchResult[],
  baseFilename: string,
  includeAnomalies: boolean = true
) {
  const statuses: ReviewStatus[] = ['confirmed', 'need_verify', 'on_site'];
  const statusNames = {
    confirmed: '已处理',
    need_verify: '待核实',
    on_site: '需现场复看'
  };

  statuses.forEach(status => {
    const filtered = matchResults.filter(r => r.mergedRecord.review_status === status);
    if (filtered.length > 0) {
      exportToExcel(matchResults, `${baseFilename}_${statusNames[status]}`, {
        status,
        includeAnomalies,
        format: 'xlsx'
      });
    }
  });
}

export function generateReport(matchResults: MatchResult[]): string {
  const total = matchResults.length;
  const statusCounts: Record<ReviewStatus, number> = {
    pending: 0,
    confirmed: 0,
    need_verify: 0,
    on_site: 0
  };
  
  const anomalyTypeCounts: Record<string, number> = {};

  matchResults.forEach(r => {
    statusCounts[r.mergedRecord.review_status]++;
    r.anomalies.forEach(a => {
      anomalyTypeCounts[getAnomalyTypeLabel(a.type)] = (anomalyTypeCounts[getAnomalyTypeLabel(a.type)] || 0) + 1;
    });
  });

  const report = `
城市照明能耗巡检报告
生成时间: ${new Date().toLocaleString('zh-CN')}

一、总体统计
- 总记录数: ${total}条
- 已处理: ${statusCounts.confirmed}条
- 待核实: ${statusCounts.need_verify}条
- 需现场复看: ${statusCounts.on_site}条
- 待复核: ${statusCounts.pending}条

二、异常统计
${Object.entries(anomalyTypeCounts).map(([type, count]) => `- ${type}: ${count}条`).join('\n')}

三、重点关注
${matchResults.filter(r => r.anomalies.some(a => a.severity === 'high')).map(r => 
  `  - ${r.mergedRecord.lamp_id} ${r.mergedRecord.address}: 
${r.anomalies.filter(a => a.severity === 'high').map(a => '    ' + a.human_readable).join('\n')}`
).join('\n')}
`;

  return report;
}

export function getReviewStatusLabel(status: ReviewStatus): string {
  const labels: Record<ReviewStatus, string> = {
    pending: '待复核',
    confirmed: '已处理',
    need_verify: '待核实',
    on_site: '需现场复看'
  };
  return labels[status];
}

export function getReviewStatusColor(status: ReviewStatus): string {
  const colors: Record<ReviewStatus, string> = {
    pending: 'bg-gray-100 text-gray-800',
    confirmed: 'bg-green-100 text-green-800',
    need_verify: 'bg-yellow-100 text-yellow-800',
    on_site: 'bg-red-100 text-red-800'
  };
  return colors[status];
}
