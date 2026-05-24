import jsPDF from 'jspdf';
import { ReportData, CrackStatus, STATUS_LABELS, STATUS_COLORS } from '../types';

export const generateReportPDF = async (reportData: ReportData): Promise<void> => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  let yPos = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text('桥梁裂缝巡检报告', pageWidth / 2, yPos, { align: 'center' });
  yPos += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, margin, yPos);
  yPos += 8;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('一、巡检批次信息', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`批次名称: ${reportData.batchName}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`巡检日期: ${reportData.batchDate}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`巡检人员: ${reportData.inspector}`, margin + 5, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('二、裂缝统计', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`裂缝总数: ${reportData.totalCracks}`, margin + 5, yPos);
  yPos += 8;

  const statuses: CrackStatus[] = ['new', 'developing', 'stable', 'repaired', 'pending_review'];
  statuses.forEach((status) => {
    const count = reportData.statusCounts[status] || 0;
    doc.text(`${STATUS_LABELS[status]}: ${count}`, margin + 5, yPos);
    yPos += 6;
  });

  yPos += 4;
  if (reportData.filters.status.length > 0 || reportData.filters.searchQuery) {
    doc.setFont('helvetica', 'bold');
    doc.text('筛选条件:', margin + 5, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    if (reportData.filters.status.length > 0) {
      const statusLabels = reportData.filters.status.map((s) => STATUS_LABELS[s]).join(', ');
      doc.text(`状态: ${statusLabels}`, margin + 10, yPos);
      yPos += 6;
    }
    if (reportData.filters.searchQuery) {
      doc.text(`搜索: ${reportData.filters.searchQuery}`, margin + 10, yPos);
      yPos += 6;
    }
  }

  yPos += 10;
  if (yPos + 80 > pageHeight - margin) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('三、裂缝详情列表', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const tableHeaders = ['编号', '位置', '长度(m)', '宽度(mm)', '状态', '描述'];
  const colWidths = [20, 35, 18, 18, 25, 60];
  let xPos = margin;

  tableHeaders.forEach((header, i) => {
    doc.text(header, xPos, yPos);
    xPos += colWidths[i];
  });
  yPos += 6;

  doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
  yPos += 4;

  reportData.cracks.forEach((crack, index) => {
    if (yPos > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }

    xPos = margin;
    const pos = crack.position;

    doc.text(crack.id.substring(6), xPos, yPos);
    xPos += colWidths[0];

    doc.text(`(${pos.x.toFixed(1)}, ${pos.y.toFixed(1)}, ${pos.z.toFixed(1)})`, xPos, yPos);
    xPos += colWidths[1];

    doc.text(crack.length.toFixed(2), xPos, yPos);
    xPos += colWidths[2];

    doc.text(crack.width.toFixed(1), xPos, yPos);
    xPos += colWidths[3];

    doc.text(STATUS_LABELS[crack.status], xPos, yPos);
    xPos += colWidths[4];

    const desc = crack.description.length > 20 ? crack.description.substring(0, 20) + '...' : crack.description;
    doc.text(desc, xPos, yPos);
    yPos += 7;
  });

  const fileName = `桥梁巡检报告_${reportData.batchDate}_${reportData.batchName.substring(0, 10)}.pdf`;
  doc.save(fileName);
};
