import jsPDF from 'jspdf';
import * as XLSX from 'xlsx';
import type { FlightRecord, ReviewReport } from '../types';
import { statusConfig } from './status';

const getStatusLabel = (status: FlightRecord['status']): string => {
  return statusConfig[status].label;
};

const formatRecordsForExport = (records: FlightRecord[]) => {
  return records.map(r => ({
    '架次编号': r.flightNo,
    '飞行日期': r.flightDate,
    '作业区域': r.location,
    '状态': getStatusLabel(r.status),
    '返航点': r.hasReturnPoint ? '正常' : '丢失',
    '气象上传时间': r.weatherData.uploadTime,
    '气象是否补录': r.weatherData.isSupplement ? '是' : '否',
    '温度(°C)': r.weatherData.temperature,
    '湿度(%)': r.weatherData.humidity,
    '风速(m/s)': r.weatherData.windSpeed,
    '降水(mm)': r.weatherData.rainfall,
    '飞手': r.pilotNote.pilotName,
    '备注时间': r.pilotNote.noteTime,
    '飞行时段': `${r.pilotNote.flightStartTime} - ${r.pilotNote.flightEndTime}`,
    '备注是否补录': r.pilotNote.isSupplement ? '是' : '否',
    '延迟(小时)': r.pilotNote.delayHours || 0,
    '照片数量': r.photos.length,
    '手工改动照片数': r.photos.filter(p => p.isManuallyModified).length,
    '异常数量': r.anomalies.length,
    '异常类型': r.anomalies.map(a => a.type).join('; ') || '无',
  }));
};

export const exportToExcel = (report: ReviewReport): void => {
  const wb = XLSX.utils.book_new();

  const allRecords = [
    ...report.records.confirmed,
    ...report.records.pending,
    ...report.records.modified,
  ];
  const allData = formatRecordsForExport(allRecords);
  const wsAll = XLSX.utils.json_to_sheet(allData);
  XLSX.utils.book_append_sheet(wb, wsAll, '全部记录');

  if (report.records.confirmed.length > 0) {
    const confirmedData = formatRecordsForExport(report.records.confirmed);
    const wsConfirmed = XLSX.utils.json_to_sheet(confirmedData);
    XLSX.utils.book_append_sheet(wb, wsConfirmed, '已确认');
  }

  if (report.records.pending.length > 0) {
    const pendingData = formatRecordsForExport(report.records.pending);
    const wsPending = XLSX.utils.json_to_sheet(pendingData);
    XLSX.utils.book_append_sheet(wb, wsPending, '待补');
  }

  if (report.records.modified.length > 0) {
    const modifiedData = formatRecordsForExport(report.records.modified);
    const wsModified = XLSX.utils.json_to_sheet(modifiedData);
    XLSX.utils.book_append_sheet(wb, wsModified, '人工改过');
  }

  const summaryData = [
    { '项目': '生成时间', '内容': report.generatedAt },
    { '项目': '复核人', '内容': report.reviewedBy },
    { '项目': '总架次', '内容': report.totalRecords },
    { '项目': '已确认', '内容': report.confirmedCount },
    { '项目': '待补', '内容': report.pendingCount },
    { '项目': '人工改过', '内容': report.modifiedCount },
    { '项目': '处理口径摘要', '内容': report.handlingSummary },
  ];
  const wsSummary = XLSX.utils.json_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, wsSummary, '复盘摘要');

  XLSX.writeFile(wb, `农田病虫航拍复盘_${new Date().toISOString().split('T')[0]}.xlsx`);
};

export const exportToPDF = (report: ReviewReport): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFontSize(18);
  doc.setFont('helvetica', 'bold');
  doc.text('农田病虫航拍飞行复盘报告', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`生成时间：${report.generatedAt}`, margin, y);
  y += 6;
  doc.text(`复核人：${report.reviewedBy}`, margin, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('一、统计概览', margin, y);
  y += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(`总架次：${report.totalRecords}`, margin, y);
  doc.text(`已确认：${report.confirmedCount} 架次`, margin + 40, y);
  doc.text(`待补：${report.pendingCount} 架次`, margin + 80, y);
  doc.text(`人工改过：${report.modifiedCount} 架次`, margin + 120, y);
  y += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('二、处理口径', margin, y);
  y += 8;

  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const summaryLines = doc.splitTextToSize(report.handlingSummary, pageWidth - margin * 2);
  doc.text(summaryLines, margin, y);
  y += summaryLines.length * 5 + 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('三、详细记录', margin, y);
  y += 8;

  const addRecordSection = (title: string, records: FlightRecord[], statusColor: string) => {
    if (records.length === 0) return;
    if (y > 250) {
      doc.addPage();
      y = margin;
    }

    doc.setFontSize(11);
    doc.setTextColor(statusColor === 'confirmed' ? 75 : statusColor === 'pending' ? 217 : 220, 
                    statusColor === 'confirmed' ? 85 : statusColor === 'pending' ? 119 : 38,
                    statusColor === 'confirmed' ? 99 : statusColor === 'pending' ? 6 : 38);
    doc.setFont('helvetica', 'bold');
    doc.text(`${title}（${records.length}架次）`, margin, y);
    y += 7;
    doc.setTextColor(0, 0, 0);

    records.forEach((r, idx) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }

      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.text(`${idx + 1}. ${r.flightNo} - ${r.location}`, margin + 5, y);
      y += 5;

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.text(`   日期：${r.flightDate} | 返航点：${r.hasReturnPoint ? '正常' : '丢失'} | 照片：${r.photos.length}张`, margin + 5, y);
      y += 4;
      doc.text(`   气象：${r.weatherData.uploadTime}${r.weatherData.isSupplement ? '（补录）' : ''}`, margin + 5, y);
      y += 4;
      doc.text(`   飞手：${r.pilotNote.pilotName} | 备注：${r.pilotNote.noteTime}${r.pilotNote.isSupplement ? '（补录）' : ''}`, margin + 5, y);
      y += 4;

      if (r.anomalies.length > 0) {
        doc.setTextColor(220, 38, 38);
        doc.setFont('helvetica', 'bold');
        doc.text(`   异常（${r.anomalies.length}项）：`, margin + 5, y);
        y += 4;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');

        r.anomalies.forEach(a => {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          const descLines = doc.splitTextToSize(`     - ${a.description}`, pageWidth - margin * 2 - 10);
          doc.text(descLines, margin + 5, y);
          y += descLines.length * 4;
          const ruleLines = doc.splitTextToSize(`       ${a.handlingRule}`, pageWidth - margin * 2 - 10);
          doc.text(ruleLines, margin + 5, y);
          y += ruleLines.length * 4;
        });
      }

      if (r.photos.filter(p => p.isManuallyModified).length > 0) {
        doc.setTextColor(217, 119, 6);
        doc.setFont('helvetica', 'bold');
        doc.text(`   照片改动（${r.photos.filter(p => p.isManuallyModified).length}张）：`, margin + 5, y);
        y += 4;
        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');

        r.photos.filter(p => p.isManuallyModified).forEach(p => {
          if (y > 270) {
            doc.addPage();
            y = margin;
          }
          doc.text(`     - ${p.locationTag}`, margin + 5, y);
          y += 4;
          if (p.modifyReason) {
            const reasonLines = doc.splitTextToSize(`       原因：${p.modifyReason}`, pageWidth - margin * 2 - 10);
            doc.text(reasonLines, margin + 5, y);
            y += reasonLines.length * 4;
          }
          if (p.modifiedBy && p.modifiedTime) {
            doc.text(`       修改人：${p.modifiedBy} | 修改时间：${p.modifiedTime}`, margin + 5, y);
            y += 4;
          }
        });
      }

      y += 3;
    });

    y += 5;
  };

  addRecordSection('已确认', report.records.confirmed, 'confirmed');
  addRecordSection('待补', report.records.pending, 'pending');
  addRecordSection('人工改过', report.records.modified, 'modified');

  doc.save(`农田病虫航拍复盘_${new Date().toISOString().split('T')[0]}.pdf`);
};
