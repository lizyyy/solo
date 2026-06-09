import type { Batch, BatchSnapshot, ExportFormat } from '@/shared/types';

function escapeCsv(s: unknown): string {
  const str = String(s ?? '');
  if (/[",\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function buildCsv(batch: Batch): string {
  const header = [
    '批次号',
    '批次名称',
    '构件编号',
    '构件说明',
    '签证单编号',
    '签证来源文件',
    '材料批号',
    '材料来源文件',
    '施工口径',
    '比对状态',
    '备注',
  ];
  const lines = [header.map(escapeCsv).join(',')];
  const compById: Record<string, { name: string; id: string }> = {};
  batch.items.forEach((it) => {
    compById[it.componentId] = { id: it.componentId, name: it.componentId };
  });
  batch.items.forEach((it) => {
    lines.push(
      [
        batch.batchId,
        batch.name,
        it.componentId,
        compById[it.componentId]?.name ?? '',
        it.visaFormId ?? '（无）',
        '',
        it.materialId ?? '（无）',
        '',
        it.constructionStandard,
        it.matchStatus,
        it.remarks,
      ]
        .map(escapeCsv)
        .join(','),
    );
  });
  return '\uFEFF' + lines.join('\n');
}

export function buildJson(batch: Batch): string {
  return JSON.stringify(
    {
      exportedAt: new Date().toISOString(),
      batch,
    },
    null,
    2,
  );
}

export function downloadFile(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportBatch(batch: Batch, format: ExportFormat): BatchSnapshot {
  const now = new Date().toISOString();
  let content: string;
  let mime: string;
  let filename: string;
  if (format === 'csv') {
    content = buildCsv(batch);
    mime = 'text/csv;charset=utf-8';
    filename = `结构加固交底清单_${batch.batchId}.csv`;
  } else {
    content = buildJson(batch);
    mime = 'application/json;charset=utf-8';
    filename = `结构加固交底清单_${batch.batchId}.json`;
  }
  downloadFile(filename, content, mime);
  return {
    snapshotId: `snap-${Date.now()}`,
    batchId: batch.batchId,
    createdAt: now,
    data: JSON.parse(JSON.stringify(batch)),
    exportFormat: format,
  };
}
