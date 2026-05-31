import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { BaseRecord, Route, Exhibit } from '@/types';
import { sourceLabels, statusLabels } from '@/types';
import { formatDate, downloadBlob } from './helpers';

export function exportInspectionPDF(
  records: BaseRecord[],
  route: Route | null,
  exhibits: Exhibit[]
): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let y = 20;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('展车巡检单', pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`导出时间: ${formatDate(new Date())}`, 14, y);
  doc.text(`记录总数: ${records.length}`, pageWidth - 60, y);
  y += 10;

  const lineY = y;
  doc.setLineWidth(0.5);
  doc.line(14, lineY, pageWidth - 14, lineY);
  y += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('一、展车明细', 14, y);
  y += 8;

  const headers = ['序号', '车型', 'VIN', '颜色', '来源', '状态', '位置', '备注'];
  const colWidths = [12, 35, 30, 18, 22, 16, 25, 40];
  
  doc.setFontSize(9);
  doc.setFillColor(240, 245, 255);
  let x = 14;
  headers.forEach((header, i) => {
    doc.rect(x, y, colWidths[i], 8, 'FD');
    doc.text(header, x + 1, y + 5.5);
    x += colWidths[i];
  });
  y += 10;

  doc.setFont('helvetica', 'normal');
  records.forEach((record, index) => {
    if (y > 270) {
      doc.addPage();
      y = 20;
    }
    
    x = 14;
    const content = record.content;
    const rowData = [
      String(index + 1),
      content.carModel || '-',
      content.vin ? content.vin.slice(-8) : '-',
      content.color || '-',
      sourceLabels[record.source],
      statusLabels[record.status],
      content.position || '-',
      content.notes || record.pendingReason || '',
    ];
    
    rowData.forEach((text, i) => {
      doc.text(String(text).substring(0, 15), x + 1, y + 5);
      x += colWidths[i];
    });
    y += 8;
  });

  y += 5;
  doc.setLineWidth(0.5);
  doc.line(14, y, pageWidth - 14, y);
  y += 10;

  if (route && route.points.length > 0) {
    doc.setFontSize(12);
    doc.setFont('helvetica', 'bold');
    doc.text('二、讲解路线', 14, y);
    y += 8;
    
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.text(`路线名称: ${route.name}`, 14, y);
    doc.text(`版本: v${route.version}`, 80, y);
    doc.text(`修改人: ${route.modifiedBy}`, pageWidth - 60, y);
    y += 7;
    doc.text(`路线点数: ${route.points.length}`, 14, y);
    doc.text(`创建时间: ${formatDate(route.createdAt)}`, 80, y);
    y += 5;

    const lineY2 = y;
    doc.setLineWidth(0.5);
    doc.line(14, lineY2, pageWidth - 14, lineY2);
    y += 8;

    doc.setFontSize(10);
    doc.setFont('helvetica', 'bold');
    const routeHeaders = ['序号', 'X坐标', 'Y坐标'];
    const routeColWidths = [20, 30, 30];
    let rx = 14;
    routeHeaders.forEach((header, i) => {
      doc.setFillColor(240, 245, 255);
      doc.rect(rx, y, routeColWidths[i], 8, 'FD');
      doc.text(header, rx + 1, y + 5.5);
      rx += routeColWidths[i];
    });
    y += 10;

    doc.setFont('helvetica', 'normal');
    route.points.forEach((point, index) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      rx = 14;
      doc.text(String(index + 1), rx + 1, y + 5);
      rx += routeColWidths[0];
      doc.text(point.x.toFixed(1), rx + 1, y + 5);
      rx += routeColWidths[1];
      doc.text(point.y.toFixed(1), rx + 1, y + 5);
      y += 8;
    });
  }

  y += 10;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'italic');
  doc.text('本单由展车动线预演系统自动生成', pageWidth / 2, y, { align: 'center' });

  const blob = doc.output('blob');
  downloadBlob(blob, `展车巡检单_${new Date().toISOString().split('T')[0]}.pdf`);
}

export function exportRecordsExcel(records: BaseRecord[]): void {
  const exportData = records.map((record, index) => ({
    '序号': index + 1,
    '来源': sourceLabels[record.source],
    '状态': statusLabels[record.status],
    '车型': record.content.carModel || '',
    'VIN码': record.content.vin || '',
    '颜色': record.content.color || '',
    '型号': record.content.modelNumber || '',
    '展位位置': record.content.position || '',
    '到店日期': record.content.arrivalDate || '',
    '巡检日期': record.content.inspectionDate || '',
    '待处理原因': record.pendingReason || '',
    '修改人': record.modifiedBy,
    '创建时间': formatDate(record.createdAt),
    '更新时间': formatDate(record.updatedAt),
    '附件数量': record.attachments.length,
    '备注': record.content.notes || '',
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '展车明细');

  worksheet['!cols'] = [
    { wch: 6 }, { wch: 10 }, { wch: 8 }, { wch: 15 }, { wch: 20 },
    { wch: 8 }, { wch: 15 }, { wch: 12 }, { wch: 12 }, { wch: 12 },
    { wch: 20 }, { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 10 }, { wch: 30 },
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
  downloadBlob(blob, `展车明细_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export function exportRouteComparison(routes: Route[]): void {
  const exportData = routes.map(route => ({
    '路线名称': route.name,
    '版本号': `v${route.version}`,
    '是否当前版本': route.isActive ? '是' : '否',
    '路线点数': route.points.length,
    '修改人': route.modifiedBy,
    '创建时间': formatDate(route.createdAt),
    '路线坐标': route.points.map(p => `(${p.x.toFixed(1)}, ${p.y.toFixed(1)})`).join(' → '),
  }));

  const worksheet = XLSX.utils.json_to_sheet(exportData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '路线历史版本');

  worksheet['!cols'] = [
    { wch: 15 }, { wch: 10 }, { wch: 12 }, { wch: 10 },
    { wch: 12 }, { wch: 20 }, { wch: 80 },
  ];

  const excelBuffer = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([excelBuffer], { type: 'application/octet-stream' });
  downloadBlob(blob, `路线历史版本对比_${new Date().toISOString().split('T')[0]}.xlsx`);
}
