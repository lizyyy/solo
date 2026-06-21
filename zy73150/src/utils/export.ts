import { AnomalyItem, LabRecord, RecordStatus } from '../types';
import {
  ANOMALY_TYPE_LABEL,
  STATUS_LABEL,
  buildAnomalies
} from './cleaningLogic';

export function updateRecordStatus(
  records: LabRecord[],
  recordId: string,
  status: RecordStatus
): LabRecord[] {
  return records.map((r) => (r.id === recordId ? { ...r, status } : r));
}

export function buildCommunicationList(
  records: LabRecord[],
  anomalies: AnomalyItem[]
): string {
  const headers = [
    '异常ID',
    '异常类型',
    '采样瓶编号',
    '采样点',
    '来源表',
    '采样日期',
    '当前状态',
    '异常说明',
    '判断口径',
    '受影响记录',
    '处理建议'
  ];
  const rows = anomalies.map((a) => {
    const affected = a.affectedRecords
      ? a.affectedRecords.map((r) => `${r.bottleNo}@${r.samplePoint}`).join(' | ')
      : a.affectedRecordIds.length > 0
        ? a.affectedRecordIds.join(',')
        : '-';
    return [
      a.id,
      ANOMALY_TYPE_LABEL[a.type],
      a.record.bottleNo,
      a.record.samplePoint,
      a.record.sourceTable,
      a.record.samplingDate,
      STATUS_LABEL[a.record.status],
      a.description,
      a.criterion,
      affected,
      a.suggestion
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });
  const summary = [
    `# 海洋牧场数据清洗异常沟通清单`,
    `生成时间：${new Date().toLocaleString('zh-CN')}`,
    `记录总数：${records.length}`,
    `异常条目数：${anomalies.length}`,
    `  - 离群值：${anomalies.filter((a) => a.type === 'outlier').length} 条`,
    `  - 采样瓶重复：${anomalies.filter((a) => a.type === 'duplicate_bottle').length} 条`,
    `  - 材料不齐整：${anomalies.filter((a) => a.type === 'incomplete_material').length} 条`,
    `已确认：${records.filter((r) => r.status === 'confirmed').length} 条`,
    `待补件：${records.filter((r) => r.status === 'pending').length} 条`,
    `退回：${records.filter((r) => r.status === 'returned').length} 条`,
    '',
    '--- 详细清单（CSV 格式，可直接复制到 Excel） ---',
    headers.join(','),
    ...rows
  ];
  return summary.join('\n');
}

export function downloadTextFile(filename: string, content: string) {
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportCommunicationList(records: LabRecord[]) {
  const anomalies = buildAnomalies(records);
  const text = buildCommunicationList(records, anomalies);
  const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  downloadTextFile(`海洋牧场数据清洗异常沟通清单_${ts}.txt`, text);
}
