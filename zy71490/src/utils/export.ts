import type { FilterState, ExportFormat } from '@/types';
import type { Preset, KeyboardModel, PedalMapping } from '@/types';

export function exportData(
  data: {
    presets: Preset[];
    models: KeyboardModel[];
    mappings: PedalMapping[];
  },
  filters: FilterState,
  format: ExportFormat
): void {
  const exportPayload = {
    exportedAt: new Date().toISOString(),
    filters,
    data,
  };

  if (format === 'json') {
    const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
      type: 'application/json',
    });
    downloadBlob(blob, `preset-repo-export-${Date.now()}.json`);
  } else {
    const headers = ['类型', '名称', '版本', '来源', '状态', '导入时间'];
    const rows: string[][] = [];

    for (const p of data.presets) {
      rows.push(['预设', p.name, p.version, p.source, p.isArchived ? '已归档' : p.status, p.importedAt]);
    }
    for (const m of data.models) {
      rows.push(['型号', `${m.brand} ${m.model}`, m.firmwareVersion, '', '活跃', m.addedAt]);
    }
    for (const mp of data.mappings) {
      rows.push(['映射', mp.name, mp.version, mp.source, mp.isActive ? '活跃' : '停用', mp.importedAt]);
    }

    const csvContent = [headers, ...rows].map((r) => r.map(escapeCsv).join(',')).join('\n');
    const bom = '\uFEFF';
    const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8' });
    downloadBlob(blob, `preset-repo-export-${Date.now()}.csv`);
  }
}

function escapeCsv(val: string): string {
  if (val.includes(',') || val.includes('"') || val.includes('\n')) {
    return `"${val.replace(/"/g, '""')}"`;
  }
  return val;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
