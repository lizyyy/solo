import { jsPDF } from 'jspdf';
import { HeightReport, Garage, Vehicle } from '../types';

export function generateHeightReport(
  garage: Garage,
  vehicle: Vehicle,
  checkData: {
    riskPoints: HeightReport['riskPoints'];
    measurements: HeightReport['measurements'];
    missingSigns: string[];
    overallResult: HeightReport['overallResult'];
  }
): HeightReport {
  return {
    garageId: garage.id,
    vehicleId: vehicle.id,
    checkTime: new Date(),
    overallResult: checkData.overallResult,
    riskPoints: checkData.riskPoints,
    measurements: checkData.measurements,
    missingSigns: checkData.missingSigns,
  };
}

export function exportReportToPDF(report: HeightReport, garageName: string, vehicleName: string): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.width;
  const margin = 20;
  let y = margin;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('停车库坡道净高检查报告', pageWidth / 2, y, { align: 'center' });
  y += 15;

  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.text(`检查时间: ${report.checkTime.toLocaleString('zh-CN')}`, margin, y);
  y += 8;
  doc.text(`车库名称: ${garageName}`, margin, y);
  y += 8;
  doc.text(`车辆类型: ${vehicleName}`, margin, y);
  y += 10;

  doc.setFont('helvetica', 'bold');
  const resultText =
    report.overallResult === 'pass'
      ? '通过'
      : report.overallResult === 'warning'
      ? '警告'
      : '不通过';
  const resultColor =
    report.overallResult === 'pass'
      ? [0, 180, 42]
      : report.overallResult === 'warning'
      ? [255, 125, 0]
      : [245, 63, 63];
  doc.setTextColor(resultColor[0], resultColor[1], resultColor[2]);
  doc.text(`检查结果: ${resultText}`, margin, y);
  doc.setTextColor(0, 0, 0);
  y += 15;

  if (report.riskPoints.length > 0) {
    doc.setFont('helvetica', 'bold');
    doc.text('风险点列表:', margin, y);
    y += 8;
    doc.setFont('helvetica', 'normal');

    report.riskPoints.forEach((risk, index) => {
      if (y > 250) {
        doc.addPage();
        y = margin;
      }

      const levelText = risk.level === 'danger' ? '【危险】' : '【警告】';
      const levelColor = risk.level === 'danger' ? [245, 63, 63] : [255, 125, 0];

      doc.setTextColor(levelColor[0], levelColor[1], levelColor[2]);
      doc.text(`${index + 1}. ${levelText} ${risk.location}`, margin + 5, y);
      y += 6;
      doc.setTextColor(0, 0, 0);
      doc.text(`   ${risk.description}`, margin + 5, y);
      y += 6;
      doc.text(
        `   净空高度: ${risk.clearHeight.toFixed(2)}m | 车辆高度: ${risk.vehicleHeight.toFixed(2)}m | 间隙: ${risk.delta.toFixed(2)}m`,
        margin + 5,
        y
      );
      y += 10;
    });
  }

  if (report.missingSigns.length > 0) {
    if (y > 240) {
      doc.addPage();
      y = margin;
    }
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(255, 125, 0);
    doc.text('缺失限高标识的入口:', margin, y);
    doc.setTextColor(0, 0, 0);
    y += 8;
    doc.setFont('helvetica', 'normal');
    report.missingSigns.forEach((sign) => {
      doc.text(`- ${sign}`, margin + 5, y);
      y += 6;
    });
    y += 5;
  }

  if (y > 200) {
    doc.addPage();
    y = margin;
  }

  doc.setFont('helvetica', 'bold');
  doc.text('净高测量数据（沿坡道）:', margin, y);
  y += 8;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);

  const tableY = y;
  const colWidths = [30, 35, 35, 35];
  const tableHeaders = ['位置(%)', '地面高(m)', '梁底高(m)', '净空(m)'];

  let currentX = margin;
  tableHeaders.forEach((header, i) => {
    doc.text(header, currentX, tableY);
    currentX += colWidths[i];
  });
  y += 6;

  const step = Math.ceil(report.measurements.length / 15);
  for (let i = 0; i < report.measurements.length; i += step) {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    const meas = report.measurements[i];
    const progress = Math.round((i / report.measurements.length) * 100);
    currentX = margin;
    doc.text(`${progress}%`, currentX, y);
    currentX += colWidths[0];
    doc.text(meas.groundHeight.toFixed(2), currentX, y);
    currentX += colWidths[1];
    doc.text(meas.ceilingHeight.toFixed(2), currentX, y);
    currentX += colWidths[2];
    doc.text(meas.clearHeight.toFixed(2), currentX, y);
    y += 5;
  }

  doc.save(`净高检查报告-${garageName}-${new Date().toLocaleDateString('zh-CN')}.pdf`);
}
