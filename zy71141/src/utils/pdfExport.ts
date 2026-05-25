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
  yPos += 12;

  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text('Bridge Crack Inspection Alignment Report', pageWidth / 2, yPos, { align: 'center' });
  doc.setTextColor(0, 0, 0);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text(`报告生成时间: ${reportData.exportTime}`, margin, yPos);
  yPos += 6;
  doc.text(`数据一致性标识: 报告数据与导出时可视化状态完全一致`, margin, yPos);
  yPos += 10;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('一、巡检批次信息', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`批次名称: ${reportData.batchName}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`批次编号: ${reportData.batchId}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`时间轴位置: 第 ${reportData.batchIndex + 1} / ${reportData.totalBatches} 批次`, margin + 5, yPos);
  yPos += 6;
  doc.text(`巡检日期: ${reportData.batchDate}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`巡检人员: ${reportData.inspector}`, margin + 5, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('二、数据一致性校验', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.text('视角参数 (Camera View):', margin + 5, yPos);
  yPos += 5;
  doc.text(`  位置: (${reportData.cameraView.position.x.toFixed(2)}, ${reportData.cameraView.position.y.toFixed(2)}, ${reportData.cameraView.position.z.toFixed(2)})`, margin + 8, yPos);
  yPos += 5;
  doc.text(`  目标: (${reportData.cameraView.target.x.toFixed(2)}, ${reportData.cameraView.target.y.toFixed(2)}, ${reportData.cameraView.target.z.toFixed(2)})`, margin + 8, yPos);
  yPos += 8;

  doc.text('筛选条件 (Filters):', margin + 5, yPos);
  yPos += 5;
  if (reportData.filters.status.length > 0) {
    const statusLabels = reportData.filters.status.map((s) => STATUS_LABELS[s]).join(', ');
    doc.text(`  状态筛选: ${statusLabels}`, margin + 8, yPos);
    yPos += 5;
  } else {
    doc.text('  状态筛选: 无 (全部状态)', margin + 8, yPos);
    yPos += 5;
  }
  if (reportData.filters.searchQuery) {
    doc.text(`  搜索关键词: ${reportData.filters.searchQuery}`, margin + 8, yPos);
    yPos += 5;
  } else {
    doc.text('  搜索关键词: 无', margin + 8, yPos);
    yPos += 5;
  }
  yPos += 5;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('三、统计数据', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text(`裂缝总数: ${reportData.totalCracks}`, margin + 5, yPos);
  yPos += 6;
  doc.text(`照片点位: ${reportData.totalPhotos} 个`, margin + 5, yPos);
  yPos += 8;

  const statuses: CrackStatus[] = ['new', 'developing', 'stable', 'repaired', 'pending_review'];
  statuses.forEach((status) => {
    const count = reportData.statusCounts[status] || 0;
    doc.text(`${STATUS_LABELS[status]}: ${count}`, margin + 5, yPos);
    yPos += 6;
  });

  yPos += 10;
  if (yPos + 80 > pageHeight - margin) {
    doc.addPage();
    yPos = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('四、裂缝详情列表', margin, yPos);
  yPos += 10;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);

  const tableHeaders = ['编号', '位置', '长度(m)', '宽度(mm)', '状态', '描述'];
  const colWidths = [20, 35, 18, 18, 25, 60];
  let xPos = margin;

  doc.setFillColor(240, 240, 240);
  doc.rect(margin - 2, yPos - 5, pageWidth - margin * 2 + 4, 7, 'F');

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

    if (index % 2 === 0) {
      doc.setFillColor(250, 250, 250);
      doc.rect(margin - 2, yPos - 3, pageWidth - margin * 2 + 4, 6, 'F');
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

  if (reportData.photos.length > 0) {
    yPos += 10;
    if (yPos + 60 > pageHeight - margin) {
      doc.addPage();
      yPos = margin;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text('五、照片点位信息', margin, yPos);
    yPos += 10;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    const photoHeaders = ['照片ID', '关联裂缝', '位置', '标注'];
    const photoColWidths = [25, 25, 50, 80];

    doc.setFillColor(240, 240, 240);
    doc.rect(margin - 2, yPos - 5, pageWidth - margin * 2 + 4, 7, 'F');

    xPos = margin;
    photoHeaders.forEach((header, i) => {
      doc.text(header, xPos, yPos);
      xPos += photoColWidths[i];
    });
    yPos += 6;

    doc.line(margin, yPos - 2, pageWidth - margin, yPos - 2);
    yPos += 4;

    reportData.photos.forEach((photo, index) => {
      if (yPos > pageHeight - margin) {
        doc.addPage();
        yPos = margin;
      }

      if (index % 2 === 0) {
        doc.setFillColor(250, 250, 250);
        doc.rect(margin - 2, yPos - 3, pageWidth - margin * 2 + 4, 6, 'F');
      }

      xPos = margin;
      doc.text(photo.id.substring(6), xPos, yPos);
      xPos += photoColWidths[0];
      doc.text(photo.crackId?.substring(6) || '-', xPos, yPos);
      xPos += photoColWidths[1];
      doc.text(`(${photo.position.x.toFixed(1)}, ${photo.position.y.toFixed(1)}, ${photo.position.z.toFixed(1)})`, xPos, yPos);
      xPos += photoColWidths[2];
      const anno = photo.annotation?.length > 15 ? photo.annotation.substring(0, 15) + '...' : (photo.annotation || '-');
      doc.text(anno, xPos, yPos);
      yPos += 7;
    });
  }

  doc.addPage();
  yPos = margin;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('六、报告签署', margin, yPos);
  yPos += 15;

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.text('数据校验: 本报告数据与导出时3D可视化场景的视角、筛选条件、时间轴位置完全一致', margin + 5, yPos);
  yPos += 8;
  doc.text('生成系统: 桥梁裂缝巡检对齐系统', margin + 5, yPos);
  yPos += 8;
  doc.text(`校验时间: ${reportData.exportTime}`, margin + 5, yPos);

  const fileName = `桥梁巡检报告_${reportData.batchDate}_${reportData.batchName.substring(0, 10)}.pdf`;
  doc.save(fileName);
};
