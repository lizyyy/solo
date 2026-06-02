import type { Track, Playlist } from '../types';
import { ANOMALY_LABELS, LICENSE_LABELS } from '../types';
import { formatDuration, formatDateTime } from './formatters';

interface ExportOptions {
  playlist: Playlist;
  tracks: Track[];
  filename?: string;
}

function escapeCsvValue(value: string | number): string {
  const str = String(value ?? '');
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function exportToCsv({ playlist, tracks, filename }: ExportOptions): void {
  const headers = [
    '序号',
    '曲目名称',
    '艺术家',
    'ISRC编码',
    '时长',
    '时码',
    '授权状态',
    '异常类型',
    '异常原因',
    '备注',
    '原始来源',
    '添加时间',
    '最后更新',
  ];

  const rows = tracks.map((track, index) => {
    const anomalyTypes = track.anomalyTypes.map((t) => ANOMALY_LABELS[t]).join('；');
    const anomalyReasons = track.anomalyTypes
      .map((t) => {
        switch (t) {
          case 'expired_license':
            return '授权已过期，需确认续签';
          case 'timecode_mismatch':
            return '时码与相邻曲目重叠，需调整';
          case 'duplicate_track':
            return '存在相同ISRC或同名同艺术家曲目';
          default:
            return '';
        }
      })
      .join('；');

    return [
      index + 1,
      track.title || '--',
      track.artist || '--',
      track.isrc || '--',
      formatDuration(track.duration),
      track.timecode || '--',
      LICENSE_LABELS[track.licenseStatus],
      anomalyTypes || '正常',
      anomalyReasons || '无',
      track.remark || '--',
      playlist.source,
      formatDateTime(track.createdAt),
      formatDateTime(track.updatedAt),
    ].map(escapeCsvValue).join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute(
    'download',
    filename || `${playlist.name}_${new Date().toISOString().slice(0, 10)}.csv`
  );
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
