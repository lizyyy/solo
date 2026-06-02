import * as XLSX from 'xlsx';
import { Point, PointStatus } from '../types';

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
    { wch: 30 },
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
  ];

  const rows = points.map((point) => [
    `"${point.name}"`,
    `"${point.address}"`,
    point.lng,
    point.lat,
    `"${getSourceLabel(point.source)}"`,
    `"${point.category}"`,
    `"${getStatusLabel(point.status)}"`,
    `"${point.description}"`,
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
