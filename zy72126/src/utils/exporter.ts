import * as XLSX from 'xlsx';
import type { Track, Annotation, Conflict, ImportRecord, ChannelTableEntry } from '@/types';

interface ExportOptions {
  includeAnnotations: boolean;
  includeConflicts: boolean;
  includeImportRecords: boolean;
  format: 'xlsx' | 'json';
}

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
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
  });
};

const formatDateForFileName = (): string => new Date().toISOString().slice(0, 10);

const getStatusText = (status: string): string => ({
  normal: '正常', conflict: '有冲突', error: '异常', pending: '处理中',
}[status] || status);

const getImportStatusText = (status: string): string => ({
  success: '成功', failed: '失败', skipped: '跳过', processing: '处理中',
}[status] || status);

const getResolutionText = (r: string): string => ({
  A: '采用数据源A', B: '采用数据源B', manual: '人工输入',
  ignore: '确认无对应文件/暂忽略', delete_track: '已从通道表移除',
  add_to_channel: '已补录到通道表',
}[r] || r);

const getConflictTypeText = (t: string): string => ({
  value_mismatch: '字段值冲突',
  extra_file: '多余文件（通道表无对应条目）',
  missing_file: '缺失文件（通道表有条目但无文件）',
}[t] || t);

export const generateReport = (
  tracks: Track[],
  annotations: Annotation[],
  conflicts: Conflict[],
  importRecords: ImportRecord[],
  channelTable: ChannelTableEntry[],
  options: ExportOptions
) => {
  return tracks.map((track) => {
    const trackConflicts = conflicts.filter((c) => c.trackId === track.id);
    const trackAnnotations = annotations.filter((a) => a.trackId === track.id);
    const importRecord = importRecords.find((r) => r.trackId === track.id);
    const channelEntry = track.channelTableId
      ? channelTable.find((e) => e.id === track.channelTableId)
      : undefined;

    const resolvedConflicts = trackConflicts.filter((c) => c.status === 'resolved');
    const pendingConflicts = trackConflicts.filter((c) => c.status === 'pending');

    const row: Record<string, any> = {
      '曲目ID': track.id,
      '舞台通道号': track.channelNo || '-',
      '曲目名称': track.trackName,
      '艺术家': track.artist || '-',
      '时长': track.duration || '-',
      '原始文件名': track.fileName,
      '文件大小': track.fileSize ? formatFileSize(track.fileSize) : '-',
      '通道表匹配': channelEntry
        ? `第${channelEntry.channelNo}通道 · ${channelEntry.trackName}`
        : '未匹配',
      '通道表来源': channelEntry?.source || '-',
      '状态': getStatusText(track.status),
      '待处理冲突数': pendingConflicts.length,
      '已裁决冲突数': resolvedConflicts.length,
      '处理人': track.resolvedBy || '-',
      '处理备注': track.resolutionNote || '-',
      '导入状态': importRecord ? getImportStatusText(importRecord.status) : '-',
      '导入异常原因': importRecord?.errorReason || '-',
      '创建时间': formatDate(track.createdAt),
      '更新时间': formatDate(track.updatedAt),
    };

    if (options.includeAnnotations) {
      row['批注数量'] = trackAnnotations.length;
      row['最新批注'] = trackAnnotations.length > 0
        ? trackAnnotations[trackAnnotations.length - 1].content
        : '-';
    }

    if (options.includeConflicts && resolvedConflicts.length > 0) {
      row['裁决证据链'] = resolvedConflicts
        .map((c) =>
          `[${getConflictTypeText(c.conflictType)}] ${c.field}: ${c.sourceA}="${c.originalValueA}" vs ${c.sourceB}="${c.originalValueB}" → ${getResolutionText(c.resolution || '')}` +
          (c.manualValue ? `（人工值: ${c.manualValue}）` : '') +
          (c.resolvedBy ? ` · 处理人:${c.resolvedBy}` : '') +
          (c.resolutionReason ? ` · 原因:${c.resolutionReason}` : '') +
          (c.resolvedAt ? ` · 时间:${formatDate(c.resolvedAt)}` : '')
        )
        .join(' || ');
    } else {
      row['裁决证据链'] = pendingConflicts.length > 0
        ? pendingConflicts
            .map((c) => `[${getConflictTypeText(c.conflictType)}] ${c.field}: ${c.originalValueA} vs ${c.originalValueB}`)
            .join(' || ')
        : '-';
    }

    return row;
  });
};

export const exportToExcel = (
  tracks: Track[],
  annotations: Annotation[],
  conflicts: Conflict[],
  importRecords: ImportRecord[],
  channelTable: ChannelTableEntry[],
  options: ExportOptions,
  fileName: string = '音乐版权分成追踪报告'
) => {
  const trackData = generateReport(tracks, annotations, conflicts, importRecords, channelTable, options);
  const wb = XLSX.utils.book_new();

  const ws = XLSX.utils.json_to_sheet(trackData);
  ws['!cols'] = Object.keys(trackData[0] || {}).map((k) => ({
    wch: k.length > 8 ? Math.min(k.length * 2, 32) : 16,
  }));
  XLSX.utils.book_append_sheet(wb, ws, '曲目台账（报告）');

  const channelData = channelTable.map((e) => {
    const matched = tracks.find((t) => t.channelTableId === e.id);
    return {
      '通道号': e.channelNo,
      '曲目名称': e.trackName,
      '艺术家': e.artist || '-',
      '时长': e.duration || '-',
      '来源': e.source || '-',
      '备注': e.note || '-',
      '是否已匹配文件': matched ? '是' : '否',
      '匹配的文件名': matched?.fileName || '-',
      '录入时间': formatDate(e.createdAt),
    };
  });
  const wsChannel = XLSX.utils.json_to_sheet(channelData);
  wsChannel['!cols'] = [{ wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 16 }, { wch: 24 }, { wch: 14 }, { wch: 32 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, wsChannel, '舞台通道表（原始）');

  if (options.includeConflicts) {
    const conflictData = conflicts.map((c) => ({
      '冲突ID': c.id,
      '冲突类型': getConflictTypeText(c.conflictType),
      '关联曲目': c.trackId
        ? tracks.find((t) => t.id === c.trackId)?.trackName || '已删除曲目'
        : '—',
      '关联通道条目': c.channelEntryId
        ? (() => {
            const e = channelTable.find((x) => x.id === c.channelEntryId);
            return e ? `第${e.channelNo}通道·${e.trackName}` : '已删除通道条目';
          })()
        : '—',
      '冲突字段': c.field,
      '数据源A': c.sourceA,
      'A原始值': c.originalValueA,
      '数据源B': c.sourceB,
      'B原始值': c.originalValueB,
      '系统建议动作': c.suggestedAction,
      '状态': c.status === 'pending' ? '待裁决' : '已裁决',
      '裁决动作': c.resolution ? getResolutionText(c.resolution) : '-',
      '人工输入值': c.manualValue || '-',
      '处理人': c.resolvedBy || '-',
      '处理原因': c.resolutionReason || '-',
      '裁决时间': c.resolvedAt ? formatDate(c.resolvedAt) : '-',
      '证据链': `[${c.field}] ${c.sourceA}="${c.originalValueA}" vs ${c.sourceB}="${c.originalValueB}" → ${c.resolution ? getResolutionText(c.resolution) : '待裁决'}`,
      '创建时间': formatDate(c.createdAt),
    }));
    const wsConflicts = XLSX.utils.json_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, wsConflicts, '冲突记录（明细）');
  }

  if (options.includeAnnotations) {
    const annotationData = annotations.map((a) => ({
      '关联曲目': tracks.find((t) => t.id === a.trackId)?.trackName || '-',
      '批注内容': a.content,
      '作者': a.author,
      '版本': `v${a.version}`,
      '与上一版本差异': a.diffFromPrev || '-',
      '创建时间': formatDate(a.createdAt),
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(annotationData), '批注记录');
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
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(importData), '导入记录');
  }

  XLSX.writeFile(wb, `${fileName}_${formatDateForFileName()}.xlsx`);
};

export const exportToJSON = (
  tracks: Track[],
  annotations: Annotation[],
  conflicts: Conflict[],
  importRecords: ImportRecord[],
  channelTable: ChannelTableEntry[],
  options: ExportOptions,
  fileName: string = '音乐版权分成追踪报告'
) => {
  const data: Record<string, any> = {
    exportTime: new Date().toISOString(),
    summary: {
      channelTableEntries: channelTable.length,
      totalTracks: tracks.length,
      matchedTracks: tracks.filter((t) => t.channelTableId).length,
      normalTracks: tracks.filter((t) => t.status === 'normal').length,
      conflictTracks: tracks.filter((t) => t.status === 'conflict').length,
      errorTracks: tracks.filter((t) => t.status === 'error').length,
      pendingConflicts: conflicts.filter((c) => c.status === 'pending').length,
      resolvedConflicts: conflicts.filter((c) => c.status === 'resolved').length,
    },
    channelTable,
    report: generateReport(tracks, annotations, conflicts, importRecords, channelTable, options),
    tracks,
  };

  if (options.includeAnnotations) data.annotations = annotations;
  if (options.includeConflicts) data.conflicts = conflicts;
  if (options.includeImportRecords) data.importRecords = importRecords;

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${fileName}_${formatDateForFileName()}.json`;
  a.click();
  URL.revokeObjectURL(url);
};
