import type { ExperimentRecord } from '@/types';

export function exportRecordsToJson(records: ExperimentRecord[], pretty: boolean = true): string {
  const exportData = {
    exportTime: new Date().toISOString(),
    recordCount: records.length,
    records: records.map((record) => ({
      id: record.id,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      raw: record.raw,
      corrected: record.corrected,
      conclusion: {
        ...record.conclusion,
        errorMarks: record.conclusion.errorMarks.map((e) => ({
          id: e.id,
          type: e.type,
          frame: e.frame,
          timestamp: e.timestamp,
          description: e.description,
          data: e.data,
        })),
      },
      noteVersions: record.noteVersions,
      trajectorySummary: {
        positionCount: record.trajectory.positions.length,
        startTime: record.trajectory.timestamps[0] || 0,
        endTime: record.trajectory.timestamps[record.trajectory.timestamps.length - 1] || 0,
      },
    })),
  };

  return JSON.stringify(exportData, null, pretty ? 2 : 0);
}

export function downloadJson(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'application/json;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
