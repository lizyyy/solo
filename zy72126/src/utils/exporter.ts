import * as XLSX from 'xlsx';
import type { Track, Annotation, Conflict, ImportRecord } from '@/types';

interface ExportOptions {
  includeAnnotations: boolean;
  includeConflicts: boolean;
  includeImportRecords: boolean;
  format: 'xlsx' | 'json';
}

export const generateReport = (
  tracks: Track[],
  annotations: Annotation[],
  conflicts: Conflict[],
  importRecords: ImportRecord[],
  options: ExportOptions
) => {
  const trackData = tracks.map((track) => {
    const trackAnnotations = annotations.filter((a) => a.trackId === track.id);
    const trackConflicts = conflicts.filter((c) => c.trackId === track.id);
    const importRecord = importRecords.find((r) => r.trackId === track.id);

    const row: Record<string, any> = {
      '舞台通道号': track.channelNo,
      '曲目名称': track.trackName,
      '艺术家': track.artist || '-',
      '时长': track.duration || '-',
      '原始文件名': track.fileName,
      '文件大小': track.fileSize ? formatFileSize(track.fileSize) : '-',
      '状态': getStatusText(track.status),
      '异常原因': track.status === 'error' ? importRecord?.errorReason || '-' : '-',
      '创建时间': formatDate(track.createdAt),
      '更新时间': formatDate(track.updatedAt),
    };

    if (options.includeAnnotations) {
      row['批注数量'] = trackAnnotations.length;
      row['最新批注'] = trackAnnotations.length > 0 
        ? trackAnnotations[trackAnnotations.length - 1].content 
        : '-';
    }

    if (options.includeConflicts) {
      const pendingConflicts = trackConflicts.filter((c) => c.status === 'pending');
      row['待处理冲突'] = pendingConflicts.length;
      if (pendingConflicts.length > 0) {
        row['冲突详情'] = pendingConflicts
          .map((c) => `${c.field}: ${c.sourceA}="${c.valueA}" vs ${c.sourceB}="${c.valueB}"`)
          .join('; ');
      } else {
        row['冲突详情'] = '-';
      }
    }

    if (options.includeImportRecords) {
      row['导入状态'] = importRecord ? getImportStatusText(importRecord.status) : '-';
    }

    return row;
  });

  return trackData;
};

export const exportToExcel = (
  tracks: Track[],
  annotations: Annotation[],
  conflicts: Conflict[],
  importRecords: ImportRecord[],
  options: ExportOptions,
  fileName: string = '音乐版权分成追踪报告'
) => {
  const trackData = generateReport(tracks, annotations, conflicts, importRecords, options);
  
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(trackData);

  ws['!cols'] = Object.keys(trackData[0] || {}).map(() => ({ wch: 18 }));

  XLSX.utils.book_append_sheet(wb, ws, '曲目台账');

  if (options.includeAnnotations) {
    const annotationData = annotations.map((a) => ({
      '关联曲目': tracks.find((t) => t.id === a.trackId)?.trackName || '-',
      '批注内容': a.content,
      '作者': a.author,
      '版本': `v${a.version}`,
      '与上一版本差异': a.diffFromPrev || '-',
      '创建时间': formatDate(a.createdAt),
    }));
    const wsAnnotations = XLSX.utils.json_to_sheet(annotationData);
    XLSX.utils.book_append_sheet(wb, wsAnnotations, '批注记录');
  }

  if (options.includeConflicts) {
    const conflictData = conflicts.map((c) => ({
      '关联曲目': tracks.find((t) => t.id === c.trackId)?.trackName || '-',
      '冲突字段': c.field,
      '数据源A': c.sourceA,
      'A值': c.valueA,
      '数据源B': c.sourceB,
      'B值': c.valueB,
      '建议动作': c.suggestedAction,
      '状态': c.status === 'pending' ? '待处理' : '已解决',
      '裁决结果': c.resolution ? getResolutionText(c.resolution) : '-',
      '解决时间': c.resolvedAt ? formatDate(c.resolvedAt) : '-',
    }));
    const wsConflicts = XLSX.utils.json_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, wsConflicts, '冲突记录');
  }

  if (options.includeImportRecords) {
    const importData = importRecords.map((r) => ({
      '文件名': r.fileName,
      '文件大小': formatFileSize(r.fileSize),
      '导入状态': getImportStatusText(r.status),
      '失败原因': r.errorReason || '-',
      '导入时间': formatDate(r.importedAt),
      '关联曲目': r.trackId ? (tracks.find((t) => t.id === r.trackId)?.trackName || '-') : '-',
    }));
    const wsImport = XLSX.utils.json_to_sheet(importData);
    XLSX.utils.book_append_sheet(wb, wsImport, '导入记录');
  }

  XLSX.writeFile(wb, `${fileName}_${formatDateForFileName()}.xlsx`);
};

export const exportToJSON = (
  tracks: Track[],
  annotations: Annotation[],
  conflicts: Conflict[],
  importRecords: ImportRecord[],
  options: ExportOptions,
  fileName: string = '音乐版权分成追踪报告'
) => {
  const data: Record<string, any> = {
    exportTime: new Date().toISOString(),
    summary: {
      totalTracks: tracks.length,
      normalTracks: tracks.filter((t) => t.status === 'normal').length,
      conflictTracks: tracks.filter((t) => t.status === 'conflict').length,
      errorTracks: tracks.filter((t) => t.status === 'error').length,
    },
    tracks,
  };

  if (options.includeAnnotations) {
    data.annotations = annotations;
  }
  if (options.includeConflicts) {
    data.conflicts = conflicts;
  }
  if (options.includeImportRecords) {
    data.importRecords = importRecords;
  }

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}_${formatDateForFileName()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

const formatDateForFileName = (): string => {
  const date = new Date();
  return date.toISOString().slice(0, 10);
};

const getStatusText = (status: string): string => {
  const map: Record<string, string> = {
    normal: '正常',
    conflict: '有冲突',
    error: '异常',
    pending: '处理中',
  };
  return map[status] || status;
};

const getImportStatusText = (status: string): string => {
  const map: Record<string, string> = {
    success: '成功',
    failed: '失败',
    skipped: '跳过',
    processing: '处理中',
  };
  return map[status] || status;
};

const getResolutionText = (resolution: string): string => {
  const map: Record<string, string> = {
    A: '采用数据源A',
    B: '采用数据源B',
    manual: '人工输入',
  };
  return map[resolution] || resolution;
};
