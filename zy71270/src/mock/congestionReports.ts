import type { CongestionReport } from '../types';

const BASE_TIME = Date.now() - 3600000;

const congestionReasons = [
  '订单波次集中',
  '通道狭窄交汇',
  '机器人避障等待',
  '货架补货作业',
  '拣选任务堆积',
  '临时维护作业',
  'AGV调度冲突',
  '扫码识别延迟',
];

const highCongestionShelves = [8, 22, 33, 51, 56, 77, 82, 91];

const generateReport = (index: number): CongestionReport => {
  const shelfIndex = highCongestionShelves[index % highCongestionShelves.length];
  const shelfId = `shelf-${String(shelfIndex + 1).padStart(3, '0')}`;
  const startOffset = index * 600000 + Math.floor(Math.random() * 300000);
  const duration = 300000 + Math.floor(Math.random() * 900000);

  return {
    id: `congestion-${String(index + 1).padStart(3, '0')}`,
    shelfId,
    startTime: BASE_TIME + startOffset,
    endTime: BASE_TIME + startOffset + duration,
    reason: congestionReasons[index % congestionReasons.length],
    robotCount: 3 + Math.floor(Math.random() * 8),
    avgWaitTime: 45 + Math.floor(Math.random() * 180),
    isManuallyModified: false,
  };
};

export const congestionReports: CongestionReport[] = Array.from({ length: 20 }, (_, i) => generateReport(i));

congestionReports[3].isManuallyModified = true;
congestionReports[3].avgWaitTime = 120;
congestionReports[3].endTime = congestionReports[3].startTime + 600000;

congestionReports[7].isManuallyModified = true;
congestionReports[7].robotCount = 12;
congestionReports[7].reason = '人工修正：订单波次集中 + 通道狭窄交汇';

congestionReports[12].endTime = 0;

congestionReports[15].robotCount = -3;

congestionReports[18].startTime = congestionReports[18].endTime + 1000;

congestionReports[1].avgWaitTime = 0;

congestionReports[5].shelfId = 'shelf-999';

congestionReports[10].reason = '';

export const getReportsByShelf = (shelfId: string): CongestionReport[] => {
  return congestionReports
    .filter(r => r.shelfId === shelfId)
    .sort((a, b) => a.startTime - b.startTime);
};

export const getReportsByTimeRange = (start: number, end: number): CongestionReport[] => {
  return congestionReports.filter(r =>
    r.startTime <= end && (r.endTime === 0 || r.endTime >= start)
  );
};

export const getActiveReports = (timestamp: number): CongestionReport[] => {
  return congestionReports.filter(r =>
    r.startTime <= timestamp && (r.endTime === 0 || r.endTime >= timestamp)
  );
};

export const getModifiedReports = (): CongestionReport[] => {
  return congestionReports.filter(r => r.isManuallyModified);
};

export const getReportsByReason = (reason: string): CongestionReport[] => {
  return congestionReports.filter(r => r.reason.includes(reason));
};

export const getAvgWaitTimeByShelf = (shelfId: string): number => {
  const reports = getReportsByShelf(shelfId);
  if (reports.length === 0) return 0;
  const total = reports.reduce((sum, r) => sum + r.avgWaitTime, 0);
  return Math.round(total / reports.length);
};

export default congestionReports;
