import { useCallback, useMemo } from 'react';
import { WeeklyReport, ConflictResolution } from '@/types';
import { useAppStore } from '@/store/useAppStore';
import { generateWeeklyReportContent } from '@/data/sampleData';
import { formatDuration } from '@/utils/stringUtils';

export function useWeeklyReport() {
  const { getCurrentWeekData, setReport, reports, currentRecordId } = useAppStore();
  const data = getCurrentWeekData();

  const summary = useMemo(() => {
    if (!data.record) return null;

    const totalDuration = data.tracks.reduce((sum, t) => sum + (t.duration || 0), 0);
    const matchedCount = data.tracks.filter(t => t.status === 'matched' || t.status === 'manual').length;
    const unresolvedConflicts = data.conflicts.filter(c => c.resolution === 'unresolved');
    const resolvedConflicts = data.conflicts.filter(c => c.resolution !== 'unresolved');

    return {
      totalTracks: data.tracks.length,
      totalDuration: Math.round((totalDuration / 60) * 10) / 10,
      totalDurationFormatted: formatDuration(totalDuration),
      matchedTracks: matchedCount,
      unmatchedTracks: data.tracks.length - matchedCount,
      totalFiles: data.files.length,
      successFiles: data.files.filter(f => f.status === 'success').length,
      warningFiles: data.files.filter(f => f.status === 'warning').length,
      errorFiles: data.files.filter(f => f.status === 'error').length,
      conflicts: data.conflicts.length,
      resolvedConflicts: resolvedConflicts.length,
      unresolvedConflicts: unresolvedConflicts.length,
      annotations: data.annotations.length,
      notes: data.notes.length,
      supplements: data.notes.filter(n => n.isSupplement).length,
    };
  }, [data]);

  const anomalies = useMemo(() => {
    if (!data.record) return [];

    const result: WeeklyReport['anomalies'] = [];

    data.files
      .filter(f => f.status === 'warning')
      .forEach(f => {
        const track = data.tracks.find(t => t.fileId === f.id);
        result.push({
          trackId: f.id,
          trackName: track?.name || f.name,
          issue: f.warningReason || '有异常',
          status: '有异常',
        });
      });

    data.files
      .filter(f => f.status === 'error')
      .forEach(f => {
        result.push({
          trackId: f.id,
          trackName: f.name,
          issue: f.errorReason || '导入失败',
          status: '导入失败',
        });
      });

    data.conflicts
      .filter(c => c.resolution === 'unresolved')
      .forEach(c => {
        const track = data.tracks.find(t => t.id === c.trackId);
        result.push({
          trackId: c.id,
          trackName: track?.name || '未知曲目',
          issue: `${c.sideA.source}说${c.sideA.value}，${c.sideB.source}说${c.sideB.value}`,
          status: '待处理',
        });
      });

    data.conflicts
      .filter(c => c.resolution !== 'unresolved')
      .forEach(c => {
        const track = data.tracks.find(t => t.id === c.trackId);
        const resolutionText =
          c.resolution === 'use_a'
            ? `采用了「${c.sideA.source}」的说法`
            : c.resolution === 'use_b'
              ? `采用了「${c.sideB.source}」的说法`
              : '两边都保留了';
        result.push({
          trackId: c.id,
          trackName: track?.name || '未知曲目',
          issue: `${resolutionText}：${c.resolutionNote}`,
          status: '已处理',
          handler: c.resolvedBy,
          handledAt: c.resolvedAt,
        });
      });

    return result;
  }, [data]);

  const generateReport = useCallback((): WeeklyReport | null => {
    if (!data.record) return null;

    const content = generateWeeklyReportContent(
      data.record,
      data.tracks,
      data.files,
      data.conflicts,
      data.annotations,
      data.notes
    );

    const report: WeeklyReport = {
      recordId: data.record.id,
      generatedAt: new Date().toISOString(),
      summary: {
        totalTracks: data.tracks.length,
        totalDuration: data.tracks.reduce((sum, t) => sum + (t.duration || 0), 0) / 60,
        matchedTracks: data.tracks.filter(t => t.status === 'matched' || t.status === 'manual').length,
        unmatchedTracks: data.tracks.filter(t => t.status === 'unmatched').length,
        conflicts: data.conflicts.length,
        resolvedConflicts: data.conflicts.filter(c => c.resolution !== 'unresolved').length,
        annotations: data.annotations.length,
        notes: data.notes.length,
      },
      content,
      anomalies,
    };

    setReport(data.record.id, report);
    return report;
  }, [data, anomalies, setReport]);

  const exportReport = useCallback(() => {
    if (!currentRecordId) return;
    
    const report = reports[currentRecordId];
    if (!report) return;

    const blob = new Blob([report.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `钢琴陪练周报-${data.record?.weekKey || new Date().toISOString()}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [currentRecordId, reports, data.record]);

  const exportReportAsJSON = useCallback(() => {
    if (!data.record) return;

    const exportData = {
      record: data.record,
      files: data.files,
      tracks: data.tracks,
      annotations: data.annotations,
      conflicts: data.conflicts,
      notes: data.notes,
      report: reports[data.record.id],
      exportedAt: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `钢琴陪练周报-完整数据-${data.record.weekKey}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, [data, reports]);

  const getConflictResolutionText = (resolution: ConflictResolution): string => {
    switch (resolution) {
      case 'use_a':
        return '采用A方';
      case 'use_b':
        return '采用B方';
      case 'keep_both':
        return '两边都保留';
      default:
        return '待处理';
    }
  };

  return {
    summary,
    anomalies,
    currentReport: currentRecordId ? reports[currentRecordId] : null,
    generateReport,
    exportReport,
    exportReportAsJSON,
    getConflictResolutionText,
  };
}
