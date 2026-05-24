import { ExcavationSquare, Artifact } from '../types';

export const exportToCSV = (artifacts: Artifact[], filename: string): void => {
  const headers = [
    '编号',
    '名称',
    '类型',
    'X坐标',
    'Y坐标',
    '深度',
    '层位',
    '年代',
    '描述',
  ];

  const rows = artifacts.map((a) => [
    a.artifactId,
    a.name,
    a.type,
    a.position.x,
    a.position.y,
    a.position.z,
    a.layerId,
    a.period,
    `"${a.description.replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join(
    '\n'
  );

  const blob = new Blob(['\uFEFF' + csvContent], {
    type: 'text/csv;charset=utf-8;',
  });
  downloadBlob(blob, filename);
};

export const exportToJSON = (data: ExcavationSquare, filename: string): void => {
  const jsonContent = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonContent], { type: 'application/json' });
  downloadBlob(blob, filename);
};

const downloadBlob = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
