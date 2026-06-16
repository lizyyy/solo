import * as XLSX from 'xlsx';
import { Point, PointStatus } from '../types';

function getResolutionsSummary(point: Point): string {
  const resolutionLabel: Record<string, string> = {
    use_gis: '采用GIS数据',
    use_import: '采用导入数据',
    custom: '手动处理',
  };
  const fieldLabel: Record<string, string> = {
    name: '名称',
    address: '地址',
    category: '类别',
  };
  return point.conflicts
    .filter((c) => c.resolved)
    .map(
      (c) =>
        `${fieldLabel[c.type]}：${resolutionLabel[c.resolution || '']} → ${c.resolvedValue || ''}`
    )
    .join('；');
}

function getFeedbacksSummary(point: Point): string {
  return point.feedbacks
    .map((fb) => `[${fb.source}] ${fb.content}`)
    .join('；');
}

function getPhotosSummary(point: Point): string {
  return point.photos
    .map((ph) => ph.description || '无说明')
    .join('；');
}

function getHistorySummary(point: Point): string {
  return point.history
    .map((h) => {
      const parts: string[] = [];
      parts.push(`[${h.operator}]`);
      if (h.action === 'status_change') parts.push('状态变更');
      if (h.action === 'remark') parts.push('备注');
      if (h.action === 'merge') parts.push('归并');
      if (h.action === 'update') parts.push('更新');
      if (h.action === 'import') parts.push('导入');
      if (h.remark) parts.push(h.remark);
      return parts.join(' ');
    })
    .join(' | ');
}

export function exportToExcel(points: Point[], filename: string): void {
  const data = points.map((point) => ({
    '点位名称': point.name,
    '地址': point.address,
    '经度': point.lng,
    '纬度': point.lat,
    '数据来源': getSourceLabel(point.source),
    '类别': point.category,
    '状态': getStatusLabel(point.status),
    '描述': point.description,
    '反馈记录': getFeedbacksSummary(point),
    '照片说明': getPhotosSummary(point),
    '冲突处理结果': getResolutionsSummary(point),
    '历史意见': getHistorySummary(point),
    '创建时间': point.createdAt,
    '更新时间': point.updatedAt,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '点位清单');

  worksheet['!cols'] = [
    { wch: 20 },
    { wch: 30 },
    { wch: 12 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 15 },
    { wch: 40 },
    { wch: 40 },
    { wch: 20 },
    { wch: 30 },
    { wch: 40 },
    { wch: 20 },
    { wch: 20 },
  ];

  XLSX.writeFile(workbook, `${filename}.xlsx`);
}

export function exportToCSV(points: Point[], filename: string): void {
  const headers = [
    '点位名称',
    '地址',
    '经度',
    '纬度',
    '数据来源',
    '类别',
    '状态',
    '描述',
    '反馈记录',
    '照片说明',
    '冲突处理结果',
    '历史意见',
  ];

  const rows = points.map((point) => [
    `"${point.name}"`,
    `"${point.address}"`,
    point.lng,
    point.lat,
    `"${getSourceLabel(point.source)}"`,
    `"${point.category}"`,
    `"${getStatusLabel(point.status)}"`,
    `"${(point.description || '').replace(/"/g, '""')}"`,
    `"${getFeedbacksSummary(point).replace(/"/g, '""')}"`,
    `"${getPhotosSummary(point).replace(/"/g, '""')}"`,
    `"${getResolutionsSummary(point).replace(/"/g, '""')}"`,
    `"${getHistorySummary(point).replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}.csv`;
  link.click();
}

export function getSourceLabel(source: string): string {
  const labels: Record<string, string> = {
    gis: 'GIS点位',
    resident: '居民反馈',
    inspection: '巡检记录',
    street: '街道备注',
  };
  return labels[source] || source;
}

export function getStatusLabel(status: PointStatus): string {
  const labels: Record<PointStatus, string> = {
    pending: '待核实',
    verified: '已处理',
    onsite: '需要现场复看',
    processed: '已完成',
  };
  return labels[status] || status;
}

export function getStatusColor(status: PointStatus): string {
  const colors: Record<PointStatus, string> = {
    pending: 'bg-orange-100 text-orange-800',
    verified: 'bg-green-100 text-green-800',
    onsite: 'bg-red-100 text-red-800',
    processed: 'bg-blue-100 text-blue-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getSourceColor(source: string): string {
  const colors: Record<string, string> = {
    gis: 'bg-blue-100 text-blue-800',
    resident: 'bg-purple-100 text-purple-800',
    inspection: 'bg-teal-100 text-teal-800',
    street: 'bg-amber-100 text-amber-800',
  };
  return colors[source] || 'bg-gray-100 text-gray-800';
}
