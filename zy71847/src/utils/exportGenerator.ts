import { CableRecord, ExportConfig, STATUS_LABELS } from '@/types';
import { findSourceById } from '@/data/mockSources';
import { findPersonById } from '@/data/mockPersons';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const CALIBER_DESCRIPTION = `
【处理口径说明】
1. 已确认：数据经过双人复核，坐标和走向准确无误
2. 待补：信息不完整或存在疑问，需要现场核实后补充
3. 人工修改：原始数据存在问题（如坐标轴翻转），已人工修正
4. 如有疑问，请联系对应记录的负责人确认
`;

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('zh-CN');
}

function groupByStatus(records: CableRecord[]): Record<string, CableRecord[]> {
  return records.reduce((acc, record) => {
    const status = record.status;
    if (!acc[status]) acc[status] = [];
    acc[status].push(record);
    return acc;
  }, {} as Record<string, CableRecord[]>);
}

function mapRecordsForExport(records: CableRecord[]): any[] {
  return records.map(record => {
    const source = findSourceById(record.sourceId);
    const owner = findPersonById(record.ownerId);
    return {
      '线缆编号': record.cableNo,
      '机房': record.room,
      '机柜': record.cabinet,
      '起点坐标': `(${record.startPoint.x}, ${record.startPoint.y})`,
      '终点坐标': `(${record.endPoint.x}, ${record.endPoint.y})`,
      '线缆类型': record.cableType,
      '状态': STATUS_LABELS[record.status],
      '数据来源': source?.name || '未知',
      '负责人': owner?.name || '未知',
      '备注': record.remark,
      '更新时间': formatDate(record.updatedAt),
    };
  });
}

export function generatePDF(records: CableRecord[], config: ExportConfig): void {
  const doc = new jsPDF();
  let yPosition = 20;

  doc.setFontSize(16);
  doc.text(config.title || '机房线缆巡检单', 105, yPosition, { align: 'center' });
  yPosition += 15;

  doc.setFontSize(10);
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 14, yPosition);
  yPosition += 10;
  
  if (config.remark) {
    doc.text(`备注: ${config.remark}`, 14, yPosition);
    yPosition += 10;
  }

  const groups = config.groupByStatus ? groupByStatus(records) : { all: records };
  const statusOrder: (keyof typeof STATUS_LABELS)[] = ['confirmed', 'pending', 'manual'];

  Object.keys(groups).forEach(statusKey => {
    const groupRecords = groups[statusKey];
    if (groupRecords.length === 0) return;

    if (config.groupByStatus) {
      doc.setFontSize(12);
      const statusLabel = STATUS_LABELS[statusKey as keyof typeof STATUS_LABELS] || statusKey;
      doc.text(`【${statusLabel}】共 ${groupRecords.length} 条`, 14, yPosition);
      yPosition += 8;
    }

    const tableData = mapRecordsForExport(groupRecords);
    const headers = Object.keys(tableData[0] || {});

    autoTable(doc, {
      startY: yPosition,
      head: [headers],
      body: tableData.map(row => Object.values(row)),
      styles: { fontSize: 8 },
      headStyles: { fillColor: [30, 41, 59] },
      alternateRowStyles: { fillColor: [248, 250, 252] },
      margin: { left: 14, right: 14 },
    });

    yPosition = (doc as any).lastAutoTable.finalY + 10;
  });

  if (config.includeCaliber) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    const lines = doc.splitTextToSize(CALIBER_DESCRIPTION.trim(), 182);
    doc.text(lines, 14, yPosition);
  }

  const fileName = config.title ? `${config.title}.pdf` : '机房线缆巡检单.pdf';
  doc.save(fileName);
}

export function generateExcel(records: CableRecord[], config: ExportConfig): void {
  const wb = XLSX.utils.book_new();
  const groups = config.groupByStatus ? groupByStatus(records) : { '巡检记录': records };
  const statusOrder: (keyof typeof STATUS_LABELS)[] = ['confirmed', 'pending', 'manual'];

  const keys = config.groupByStatus ? statusOrder.filter(s => groups[s]?.length > 0) : Object.keys(groups);

  keys.forEach(key => {
    const groupRecords = groups[key];
    if (!groupRecords || groupRecords.length === 0) return;

    const sheetName = config.groupByStatus 
      ? STATUS_LABELS[key as keyof typeof STATUS_LABELS] 
      : key;

    const tableData = mapRecordsForExport(groupRecords);
    const wsData: any[][] = [];

    if (config.groupByStatus) {
      wsData.push([`【${sheetName}】共 ${groupRecords.length} 条`]);
      wsData.push([]);
    }

    if (tableData.length > 0) {
      wsData.push(Object.keys(tableData[0]));
      tableData.forEach(row => wsData.push(Object.values(row)));
    }

    if (config.includeCaliber) {
      wsData.push([]);
      wsData.push(['【处理口径说明】']);
      CALIBER_DESCRIPTION.trim().split('\n').forEach(line => {
        wsData.push([line]);
      });
    }

    const ws = XLSX.utils.aoa_to_sheet(wsData);
    ws['!cols'] = Array(Object.keys(tableData[0] || {}).length).fill({ wch: 15 });
    XLSX.utils.book_append_sheet(wb, ws, sheetName.slice(0, 30));
  });

  const fileName = config.title ? `${config.title}.xlsx` : '机房线缆巡检单.xlsx';
  XLSX.writeFile(wb, fileName);
}

export function getStatistics(records: CableRecord[]) {
  const groups = groupByStatus(records);
  return {
    total: records.length,
    confirmed: groups.confirmed?.length || 0,
    pending: groups.pending?.length || 0,
    manual: groups.manual?.length || 0,
    hasDuplicates: records.some(r => r.isDuplicate),
    hasFlipped: records.some(r => r.coordinatesFlipped),
  };
}
