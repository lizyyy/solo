import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import { PendulumData, CalculationResult, ChartType } from '@/types';
import { formatNumber } from './statistics';

export async function exportToPDF(
  dataList: PendulumData[],
  result: CalculationResult | null,
  studentName: string,
  experimentDate: string,
  chartRefs: Map<ChartType, HTMLCanvasElement>
): Promise<void> {
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 20;
  let y = margin;
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(20);
  pdf.text('单摆法测量重力加速度实验报告', pageWidth / 2, y, { align: 'center' });
  y += 15;
  
  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(12);
  pdf.text(`学生姓名: ${studentName || '未填写'}`, margin, y);
  pdf.text(`实验日期: ${experimentDate || new Date().toLocaleDateString()}`, pageWidth - margin - 60, y);
  y += 10;
  
  pdf.line(margin, y, pageWidth - margin, y);
  y += 10;
  
  if (result) {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('一、实验结果', margin, y);
    y += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(12);
    pdf.text(`重力加速度 g = ${formatNumber(result.gravity, 4)} ± ${formatNumber(result.gravityUncertainty, 4)} m/s²`, margin + 10, y);
    y += 6;
    pdf.text(`拟合优度 R² = ${formatNumber(result.rSquared, 6)}`, margin + 10, y);
    y += 6;
    pdf.text(`有效数据点数: ${result.validDataCount} / ${result.totalDataCount}`, margin + 10, y);
    y += 10;
  }
  
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(14);
  pdf.text('二、实验数据', margin, y);
  y += 8;
  
  pdf.setFontSize(10);
  const headers = ['序号', '摆长(m)', '周期(s)', '测量次数', '摆角(°)', '备注'];
  const colWidths = [15, 25, 25, 25, 20, 50];
  let x = margin;
  
  headers.forEach((header, i) => {
    pdf.text(header, x, y);
    x += colWidths[i];
  });
  y += 6;
  
  dataList.slice(0, 15).forEach((data, index) => {
    x = margin;
    const rowData = [
      String(index + 1),
      formatNumber(data.length, 3),
      formatNumber(data.period, 3),
      String(data.measurements),
      formatNumber(data.angle, 1),
      data.notes || '-',
    ];
    rowData.forEach((cell, i) => {
      pdf.text(cell, x, y);
      x += colWidths[i];
    });
    y += 5;
  });
  
  if (dataList.length > 15) {
    pdf.text(`... 还有 ${dataList.length - 15} 条数据`, margin, y);
    y += 10;
  }
  
  const chartTypes: ChartType[] = ['t2-vs-l', 'residual', 'error-pie'];
  for (const chartType of chartTypes) {
    const canvas = chartRefs.get(chartType);
    if (canvas && y + 80 < pageHeight - margin) {
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = (pageWidth - 2 * margin) / 2;
      const imgHeight = 60;
      pdf.addImage(imgData, 'PNG', margin, y, imgWidth, imgHeight);
      y += imgHeight + 10;
    }
  }
  
  if (result && result.errorSources.length > 0) {
    if (y > pageHeight - margin) {
      pdf.addPage();
      y = margin;
    }
    
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(14);
    pdf.text('三、误差分析', margin, y);
    y += 8;
    
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(10);
    result.errorSources.forEach((source) => {
      if (y > pageHeight - margin - 15) {
        pdf.addPage();
        y = margin;
      }
      pdf.text(`• ${source.name} (${formatNumber(source.contribution, 1)}%): ${source.description}`, margin, y);
      y += 5;
      pdf.text(`  改进建议: ${source.improvement}`, margin + 5, y);
      y += 6;
    });
  }
  
  pdf.save('单摆实验报告.pdf');
}

export function exportToExcel(
  dataList: PendulumData[],
  result: CalculationResult | null
): void {
  const wb = XLSX.utils.book_new();
  
  const dataSheetData = [
    ['单摆实验原始数据'],
    ['序号', '摆长(m)', '周期(s)', '测量次数', '摆角(°)', '学生姓名', '备注', '标记'],
    ...dataList.map((data, index) => [
      index + 1,
      data.length,
      data.period,
      data.measurements,
      data.angle,
      data.studentName,
      data.notes,
      data.flags.map(f => f.message).join('; '),
    ]),
  ];
  
  const ws1 = XLSX.utils.aoa_to_sheet(dataSheetData);
  XLSX.utils.book_append_sheet(wb, ws1, '原始数据');
  
  if (result) {
    const resultSheetData = [
      ['计算结果'],
      ['重力加速度 (m/s²)', result.gravity],
      ['不确定度 (m/s²)', result.gravityUncertainty],
      ['拟合斜率', result.fitSlope],
      ['拟合截距', result.fitIntercept],
      ['R²', result.rSquared],
      ['有效数据点', result.validDataCount],
      ['总数据点', result.totalDataCount],
      [],
      ['误差来源分析'],
      ['来源', '贡献率(%)', '描述', '改进建议'],
      ...result.errorSources.map(e => [e.name, e.contribution, e.description, e.improvement]),
    ];
    
    const ws2 = XLSX.utils.aoa_to_sheet(resultSheetData);
    XLSX.utils.book_append_sheet(wb, ws2, '计算结果');
  }
  
  XLSX.writeFile(wb, '单摆实验数据.xlsx');
}

export async function exportChartAsPNG(canvas: HTMLCanvasElement, filename: string): Promise<void> {
  const link = document.createElement('a');
  link.download = `${filename}.png`;
  link.href = canvas.toDataURL('image/png');
  link.click();
}

export function generateReportContent(
  dataList: PendulumData[],
  result: CalculationResult | null,
  studentName: string
): string {
  let content = '';
  
  content += '# 单摆法测量重力加速度实验报告\n\n';
  content += `**学生姓名**: ${studentName || '未填写'}\n\n`;
  content += `**实验日期**: ${new Date().toLocaleDateString()}\n\n`;
  
  if (result) {
    content += '## 一、实验结果\n\n';
    content += `- **重力加速度 g** = ${formatNumber(result.gravity, 4)} ± ${formatNumber(result.gravityUncertainty, 4)} m/s²\n`;
    content += `- **拟合优度 R²** = ${formatNumber(result.rSquared, 6)}\n`;
    content += `- **有效数据点数**: ${result.validDataCount} / ${result.totalDataCount}\n\n`;
  }
  
  content += '## 二、实验数据\n\n';
  content += '| 序号 | 摆长(m) | 周期(s) | 测量次数 | 摆角(°) | 备注 |\n';
  content += '|------|---------|---------|----------|---------|------|\n';
  
  dataList.forEach((data, index) => {
    content += `| ${index + 1} | ${formatNumber(data.length, 3)} | ${formatNumber(data.period, 3)} | ${data.measurements} | ${formatNumber(data.angle, 1)} | ${data.notes || '-'} |\n`;
  });
  
  content += '\n';
  
  if (result && result.errorSources.length > 0) {
    content += '## 三、误差分析\n\n';
    result.errorSources.forEach((source) => {
      content += `### ${source.name} (${formatNumber(source.contribution, 1)}%)\n\n`;
      content += `${source.description}\n\n`;
      content += `**改进建议**: ${source.improvement}\n\n`;
    });
  }
  
  content += '## 四、实验步骤\n\n';
  content += '1. 调节单摆装置，使摆线自然下垂\n';
  content += '2. 测量摆长（从悬点到小球质心的距离）\n';
  content += '3. 将小球拉开一个小角度（<15°）并释放\n';
  content += '4. 用秒表测量多个周期的总时间，计算平均周期\n';
  content += '5. 改变摆长，重复上述步骤\n';
  content += '6. 用 T²-L 图进行线性拟合，计算重力加速度\n\n';
  
  return content;
}
