import { Router } from 'express';
import { getAllRecords } from '../services/recordService';
import { statusLabels, sourceLabels } from '../../shared/types';
import type { FilterState, TrackCleanupRecord } from '../../shared/types';

const router = Router();

function recordToCsvRow(record: TrackCleanupRecord): string {
  const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;

  const flags = [];
  if (record.isOldMaster) flags.push('旧版母带');
  if (record.isDuplicate) flags.push('重复曲目');
  if (!record.hasAuthorization) flags.push('缺授权');
  if (record.isRenamed) flags.push(`人工改名(原:${record.originalTrackName})`);

  const fields = [
    record.trackName,
    record.artistName,
    statusLabels[record.status],
    sourceLabels[record.source],
    flags.join('、') || '无',
    record.currentNote.replace(/\n/g, ' '),
    record.latestHandler,
    record.latestHandleTime,
    record.originalSource,
    record.originalHandleTime,
  ];

  return fields.map(escape).join(',');
}

function generateCsvContent(records: TrackCleanupRecord[]): string {
  const headers = [
    '曲目名称',
    '艺人/学生',
    '状态',
    '来源',
    '特殊标记',
    '处理备注',
    '最后处理人',
    '最后处理时间',
    '原始来源',
    '原始处理时间',
  ];

  const headerRow = headers.map((h) => `"${h}"`).join(',');
  const dataRows = records.map(recordToCsvRow);

  return '\uFEFF' + [headerRow, ...dataRows].join('\n');
}

router.get('/csv', (req, res) => {
  const filters: FilterState = {
    status: req.query.status as FilterState['status'],
    source: req.query.source as FilterState['source'],
    searchKeyword: req.query.searchKeyword as string,
    dateFrom: req.query.dateFrom as string,
    dateTo: req.query.dateTo as string,
  };

  Object.keys(filters).forEach((key) => {
    if ((filters as any)[key] === undefined || (filters as any)[key] === '') {
      delete (filters as any)[key];
    }
  });

  const records = getAllRecords(Object.keys(filters).length > 0 ? filters : undefined);
  const csvContent = generateCsvContent(records);

  const filename = `编曲工程轨道清理清单_${new Date().toISOString().slice(0, 10)}.csv`;

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(filename)}"`);
  res.send(csvContent);
});

router.get('/preview', (req, res) => {
  const filters: FilterState = {
    status: req.query.status as FilterState['status'],
    source: req.query.source as FilterState['source'],
    searchKeyword: req.query.searchKeyword as string,
    dateFrom: req.query.dateFrom as string,
    dateTo: req.query.dateTo as string,
  };

  Object.keys(filters).forEach((key) => {
    if ((filters as any)[key] === undefined || (filters as any)[key] === '') {
      delete (filters as any)[key];
    }
  });

  const records = getAllRecords(Object.keys(filters).length > 0 ? filters : undefined);
  res.json(records);
});

export default router;
