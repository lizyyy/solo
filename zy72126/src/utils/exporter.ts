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
  normal: '正常', conflict: '有冲突', error: '异常', pending: '处理中', deleted: '已软删除（保留审计）',
}[status] || status);

const getImportStatusText = (status: string): string => ({
  success: '成功', failed: '失败', skipped: '跳过', processing: '处理中',
  deleted_manually: '已通过冲突裁决删除（保留原始文件记录）',
}[status] || status);

const getResolutionText = (r: string): string => ({
  A: '采用数据源A', B: '采用数据源B', manual: '人工输入',
  ignore: '确认无对应文件/暂忽略', delete_track: '已从通道表移除（软删除）',
  add_to_channel: '已补录到通道表',
}[r] || r);

const getConflictTypeText = (t: string): string => ({
  value_mismatch: '字段值冲突',
  extra_file: '多余文件（通道表无对应条目）',
  missing_file: '缺失文件（通道表有条目但无文件）',
}[t] || t);

const getChannelStatusText = (s: string): string => ({
  pending: '待对账',
  matched: '已匹配文件',
  confirmed_missing: '已确认无文件（现场未用）',
  pending_upload: '待补传文件',
  removed_from_setlist: '已从曲目单移除（软删除）',
}[s] || s);

export const generateReport = (
  tracks: Track[],
  annotations: Annotation[],
  conflicts: Conflict[],
  importRecords: ImportRecord[],
  channelTable: ChannelTableEntry[],
  options: ExportOptions
) => {
  const rows: Record<string, any>[] = [];

  for (const track of tracks) {
    const trackConflicts = conflicts.filter((c) => c.trackId === track.id);
    const trackAnnotations = annotations.filter((a) => a.trackId === track.id);
    const importRecord = importRecords.find((r) => r.trackId === track.id);
    const channelEntry = track.channelTableId
      ? channelTable.find((e) => e.id === track.channelTableId)
      : undefined;

    const resolvedConflicts = trackConflicts.filter((c) => c.status === 'resolved');
    const pendingConflicts = trackConflicts.filter((c) => c.status === 'pending');

    const row: Record<string, any> = {
      '记录类型': track.status === 'deleted' ? '已删除曲目（可审计）' : '已导入曲目',
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
      '当前状态': getStatusText(track.status),
      '待处理冲突数': pendingConflicts.length,
      '已裁决冲突数': resolvedConflicts.length,
      '处理人': track.resolvedBy || importRecord?.resolvedBy || '-',
      '处理备注': track.resolutionNote || importRecord?.resolutionNote || '-',
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

    if (options.includeConflicts && (resolvedConflicts.length > 0 || pendingConflicts.length > 0)) {
      row['裁决证据链'] = [
        ...resolvedConflicts.map((c) =>
          `[已裁决·${getConflictTypeText(c.conflictType)}] ${c.field}: ${c.sourceA}="${c.originalValueA}" vs ${c.sourceB}="${c.originalValueB}" → ${getResolutionText(c.resolution || '')}` +
          (c.manualValue ? `（人工值: ${c.manualValue}）` : '') +
          (c.resolvedBy ? ` · 处理人:${c.resolvedBy}` : '') +
          (c.resolutionReason ? ` · 原因:${c.resolutionReason}` : '') +
          (c.resolvedAt ? ` · 时间:${formatDate(c.resolvedAt)}` : '')
        ),
        ...pendingConflicts.map((c) =>
          `[待处理·${getConflictTypeText(c.conflictType)}] ${c.field}: ${c.originalValueA} vs ${c.originalValueB}（建议:${c.suggestedAction}）`
        ),
      ].join(' || ');
    } else {
      row['裁决证据链'] = '-';
    }

    rows.push(row);
  }

  for (const entry of channelTable) {
    if (tracks.some((t) => t.channelTableId === entry.id)) continue;
    const entryConflicts = conflicts.filter((c) => c.channelEntryId === entry.id);
    const resolvedConflicts = entryConflicts.filter((c) => c.status === 'resolved');
    const pendingConflicts = entryConflicts.filter((c) => c.status === 'pending');

    if (entryConflicts.length === 0 && entry.fileStatus === 'matched') continue;

    const row: Record<string, any> = {
      '记录类型': entry.fileStatus === 'removed_from_setlist'
        ? '通道条目（已从曲目单移除·可审计）'
        : entry.fileStatus === 'confirmed_missing'
        ? '通道条目（已确认无对应文件）'
        : entry.fileStatus === 'pending_upload'
        ? '通道条目（待补传文件）'
        : '通道条目（未匹配）',
      '曲目ID': `CH-${entry.channelNo}-${entry.id.slice(0, 6)}`,
      '舞台通道号': entry.channelNo,
      '曲目名称': entry.trackName,
      '艺术家': entry.artist || '-',
      '时长': entry.duration || '-',
      '原始文件名': entryConflicts[0]?.originalValueA || '（无对应文件）',
      '文件大小': '-',
      '通道表匹配': `第${entry.channelNo}通道 · ${entry.trackName}（仅通道表）`,
      '通道表来源': entry.source || '-',
      '当前状态': getChannelStatusText(entry.fileStatus),
      '待处理冲突数': pendingConflicts.length,
      '已裁决冲突数': resolvedConflicts.length,
      '处理人': entry.resolvedBy || '-',
      '处理备注': entry.resolutionNote || entry.note || '-',
      '导入状态': '（文件缺失/未导入）',
      '导入异常原因': entryConflicts.find((c) => c.conflictType === 'missing_file')?.suggestedAction || '-',
      '创建时间': formatDate(entry.createdAt),
      '更新时间': formatDate(entry.updatedAt),
    };

    if (options.includeAnnotations) {
      row['批注数量'] = 0;
      row['最新批注'] = '-';
    }

    if (options.includeConflicts && entryConflicts.length > 0) {
      row['裁决证据链'] = [
        ...resolvedConflicts.map((c) =>
          `[已裁决·${getConflictTypeText(c.conflictType)}] ${c.field}: ${c.sourceA}="${c.originalValueA}" vs ${c.sourceB}="${c.originalValueB}" → ${getResolutionText(c.resolution || '')}` +
          (c.manualValue ? `（人工值: ${c.manualValue}）` : '') +
          (c.resolvedBy ? ` · 处理人:${c.resolvedBy}` : '') +
          (c.resolutionReason ? ` · 原因:${c.resolutionReason}` : '') +
          (c.resolvedAt ? ` · 时间:${formatDate(c.resolvedAt)}` : '')
        ),
        ...pendingConflicts.map((c) =>
          `[待处理·${getConflictTypeText(c.conflictType)}] ${c.field}: ${c.originalValueA} vs ${c.originalValueB}（建议:${c.suggestedAction}）`
        ),
      ].join(' || ');
    } else {
      row['裁决证据链'] = '-';
    }

    rows.push(row);
  }

  return rows;
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
    wch: k.length > 10 ? Math.min(k.length * 2, 40) : 16,
  }));
  XLSX.utils.book_append_sheet(wb, ws, '曲目台账（含缺失/删除·统一报告）');

  const channelData = channelTable.map((e) => {
    const matched = tracks.find((t) => t.channelTableId === e.id);
    const entryConflicts = conflicts.filter((c) => c.channelEntryId === e.id);
    const lastConflict = entryConflicts.length > 0
      ? entryConflicts[entryConflicts.length - 1]
      : undefined;
    return {
      '通道号': e.channelNo,
      '曲目名称': e.trackName,
      '艺术家': e.artist || '-',
      '时长': e.duration || '-',
      '来源': e.source || '-',
      '原始备注': e.note || '-',
      '文件处理状态': getChannelStatusText(e.fileStatus),
      '是否已匹配文件': matched ? '是' : '否',
      '匹配的曲目ID': matched?.id || '-',
      '匹配的文件名': matched?.fileName || '-',
      '处理人（裁决）': e.resolvedBy || lastConflict?.resolvedBy || '-',
      '处理原因': e.resolutionReason || lastConflict?.resolutionReason || '-',
      '处理时间': e.resolvedAt ? formatDate(e.resolvedAt) : '-',
      '证据链/处理备注': e.resolutionNote || '-',
      '关联冲突数': entryConflicts.length,
      '录入时间': formatDate(e.createdAt),
    };
  });
  const wsChannel = XLSX.utils.json_to_sheet(channelData);
  wsChannel['!cols'] = [
    { wch: 10 }, { wch: 20 }, { wch: 16 }, { wch: 10 }, { wch: 20 }, { wch: 24 },
    { wch: 22 }, { wch: 14 }, { wch: 20 }, { wch: 32 }, { wch: 16 }, { wch: 24 },
    { wch: 18 }, { wch: 60 }, { wch: 12 }, { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsChannel, '舞台通道表（含裁决状态·完整）');

  if (options.includeConflicts) {
    const conflictData = conflicts.map((c) => ({
      '冲突ID': c.id,
      '冲突类型': getConflictTypeText(c.conflictType),
      '关联曲目名称': c.trackId
        ? tracks.find((t) => t.id === c.trackId)?.trackName
          || (tracks.find((t) => t.id === c.trackId && t.status === 'deleted')?.trackName + '（已软删除）')
          || '曲目已被物理删除（无法审计）'
        : '—',
      '关联通道条目': c.channelEntryId
        ? (() => {
            const e = channelTable.find((x) => x.id === c.channelEntryId);
            return e ? `第${e.channelNo}通道·${e.trackName}（状态:${getChannelStatusText(e.fileStatus)}）` : '通道条目不存在';
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
      '完整证据链': `[${c.field}] ${c.sourceA}="${c.originalValueA}" vs ${c.sourceB}="${c.originalValueB}" → ${c.resolution ? getResolutionText(c.resolution) : '待裁决'}` +
        (c.resolvedBy ? ` | 处理人:${c.resolvedBy}` : '') +
        (c.resolutionReason ? ` | 原因:${c.resolutionReason}` : ''),
      '创建时间': formatDate(c.createdAt),
    }));
    const wsConflicts = XLSX.utils.json_to_sheet(conflictData);
    XLSX.utils.book_append_sheet(wb, wsConflicts, '冲突记录（明细·完整）');
  }

  if (options.includeAnnotations) {
    const annotationData = annotations.map((a) => ({
      '关联曲目': (() => {
        const t = tracks.find((x) => x.id === a.trackId);
        return t ? t.trackName : `已删除曲目ID:${a.trackId}`;
      })(),
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
      '原始文件名': r.fileName,
      '文件大小': formatFileSize(r.fileSize),
      '导入状态': getImportStatusText(r.status),
      '失败/处理原因': r.errorReason || r.resolutionReason || '-',
      '导入时间': formatDate(r.importedAt),
      '关联曲目ID': r.trackId || '-',
      '关联曲目名称': (() => {
        const t = tracks.find((x) => x.id === r.trackId);
        if (!t) return r.status === 'deleted_manually' ? '（已通过冲突裁决软删除·曲目行保留）' : '-';
        return `${t.trackName}（当前状态:${getStatusText(t.status)}）`;
      })(),
      '处理人': r.resolvedBy || '-',
      '裁决证据链': r.resolutionNote || '-',
      '处理时间': r.resolvedAt ? formatDate(r.resolvedAt) : '-',
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(importData), '导入记录（完整·含已软删）');
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
      channelTableMatched: channelTable.filter((e) => e.fileStatus === 'matched').length,
      channelTableConfirmedMissing: channelTable.filter((e) => e.fileStatus === 'confirmed_missing').length,
      channelTablePendingUpload: channelTable.filter((e) => e.fileStatus === 'pending_upload').length,
      channelTableRemoved: channelTable.filter((e) => e.fileStatus === 'removed_from_setlist').length,
      totalTracks: tracks.length,
      normalTracks: tracks.filter((t) => t.status === 'normal').length,
      conflictTracks: tracks.filter((t) => t.status === 'conflict').length,
      errorTracks: tracks.filter((t) => t.status === 'error').length,
      deletedTracks: tracks.filter((t) => t.status === 'deleted').length,
      pendingConflicts: conflicts.filter((c) => c.status === 'pending').length,
      resolvedConflicts: conflicts.filter((c) => c.status === 'resolved').length,
      importRecords: importRecords.length,
      successfulImports: importRecords.filter((r) => r.status === 'success').length,
      deletedManuallyImports: importRecords.filter((r) => r.status === 'deleted_manually').length,
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
