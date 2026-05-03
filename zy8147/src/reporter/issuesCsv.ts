import { stringify as csvStringify } from 'csv-stringify/sync';
import { Issue, IssueType } from '../types';

const issueTypeLabels: Record<IssueType, string> = {
  calibration_expired: '校准过期',
  weight_jump: '重量跳变',
  duplicate_frame: '重复帧',
  midnight_batch_misalignment: '跨午夜批次错位',
  bad_frame: '坏帧',
  weight_out_of_tolerance: '重量超差',
  unstable_reading: '不稳定读数',
  missing_data: '数据缺失',
};

const severityLabels: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

export function generateIssuesCsv(issues: Issue[]): string {
  const records = issues.map((issue) => ({
    issue_id: issue.id,
    timestamp: issue.timestamp.toISOString(),
    station_id: issue.stationId,
    issue_type: issueTypeLabels[issue.type] || issue.type,
    severity: severityLabels[issue.severity] || issue.severity,
    description: issue.description,
    details: JSON.stringify(issue.details),
  }));

  return csvStringify(records, {
    header: true,
    columns: [
      'issue_id',
      'timestamp',
      'station_id',
      'issue_type',
      'severity',
      'description',
      'details',
    ],
  });
}
