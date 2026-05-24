import jsPDF from 'jspdf';
import { SceneData } from '../types';
import { getRiskLevelColor, getSeverityColor } from './dataValidator';

export function exportJSON(data: SceneData, filename: string = 'scene-data.json') {
  const jsonString = JSON.stringify(data, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export async function exportPDF(
  sceneData: SceneData,
  canvasElement?: HTMLCanvasElement,
  filename: string = 'ski-resort-report.pdf'
) {
  const pdf = new jsPDF('portrait', 'mm', 'a4');
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  let yPosition = 20;

  pdf.setFontSize(20);
  pdf.setTextColor(22, 93, 255);
  pdf.text('滑雪道风险分析报告', pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  pdf.setFontSize(10);
  pdf.setTextColor(100);
  pdf.text(`生成时间: ${new Date().toLocaleString()}`, pageWidth / 2, yPosition, { align: 'center' });
  yPosition += 15;

  if (canvasElement) {
    try {
      const imgData = canvasElement.toDataURL('image/png', 0.8);
      const imgWidth = 170;
      const imgHeight = 100;
      pdf.addImage(imgData, 'PNG', (pageWidth - imgWidth) / 2, yPosition, imgWidth, imgHeight);
      yPosition += imgHeight + 15;
    } catch (error) {
      console.error('Failed to add screenshot to PDF:', error);
    }
  }

  pdf.setFontSize(14);
  pdf.setTextColor(22, 93, 255);
  pdf.text('一、数据概览', 20, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setTextColor(0);
  const overviewData = [
    ['滑行轨迹', `${sceneData.trajectories.length} 条`],
    ['摔倒点', `${sceneData.fallPoints.length} 个`],
    ['救援站', `${sceneData.rescueStations.length} 个`],
    ['风险区域', `${sceneData.riskZones.length} 个`],
    ['救援路线', `${sceneData.rescueRoutes.length} 条`],
  ];

  overviewData.forEach(([label, value]) => {
    pdf.text(label, 25, yPosition);
    pdf.text(value, 80, yPosition);
    yPosition += 7;
  });
  yPosition += 8;

  pdf.setFontSize(14);
  pdf.setTextColor(22, 93, 255);
  pdf.text('二、天气信息', 20, yPosition);
  yPosition += 10;

  pdf.setFontSize(10);
  pdf.setTextColor(0);
  const weatherMap: Record<string, string> = {
    sunny: '晴朗',
    cloudy: '多云',
    snowy: '下雪',
    windy: '大风'
  };
  const weatherData = [
    ['天气状况', weatherMap[sceneData.weather.condition] || sceneData.weather.condition],
    ['温度', `${sceneData.weather.temperature}°C`],
    ['风速', `${sceneData.weather.windSpeed} km/h`],
    ['能见度', `${sceneData.weather.visibility} m`],
  ];

  weatherData.forEach(([label, value]) => {
    pdf.text(label, 25, yPosition);
    pdf.text(value, 80, yPosition);
    yPosition += 7;
  });
  yPosition += 8;

  if (sceneData.validation.errors.length > 0) {
    if (yPosition > 220) {
      pdf.addPage();
      yPosition = 20;
    }

    pdf.setFontSize(14);
    pdf.setTextColor(245, 63, 63);
    pdf.text('三、数据验证问题', 20, yPosition);
    yPosition += 10;

    sceneData.validation.errors.forEach((error, index) => {
      if (yPosition > 260) {
        pdf.addPage();
        yPosition = 20;
      }

      pdf.setFontSize(10);
      const severityText = error.severity === 'error' ? '错误' : '警告';
      pdf.setTextColor(error.severity === 'error' ? 245 : 255, error.severity === 'error' ? 63 : 125, 0);
      pdf.text(`${index + 1}. [${severityText}] ${error.message}`, 25, yPosition);
      yPosition += 6;

      pdf.setFontSize(9);
      pdf.setTextColor(100);
      if (error.details) {
        const splitDetails = pdf.splitTextToSize(error.details, 160);
        splitDetails.forEach((line: string) => {
          pdf.text(line, 30, yPosition);
          yPosition += 5;
        });
      }
      yPosition += 5;
    });
    yPosition += 5;
  }

  if (yPosition > 200) {
    pdf.addPage();
    yPosition = 20;
  }

  pdf.setFontSize(14);
  pdf.setTextColor(22, 93, 255);
  pdf.text('四、摔倒点统计', 20, yPosition);
  yPosition += 10;

  sceneData.fallPoints.forEach((fall, index) => {
    if (yPosition > 260) {
      pdf.addPage();
      yPosition = 20;
    }

    pdf.setFontSize(10);
    pdf.setTextColor(0);
    const severityMap: Record<string, string> = { low: '低', medium: '中', high: '高' };
    pdf.text(`${index + 1}. ${fall.skierName}`, 25, yPosition);
    yPosition += 6;

    pdf.setFontSize(9);
    pdf.setTextColor(100);
    pdf.text(`严重程度: ${severityMap[fall.severity] || fall.severity}`, 30, yPosition);
    yPosition += 5;
    pdf.text(`时间: ${fall.timestamp}`, 30, yPosition);
    yPosition += 5;
    pdf.text(`描述: ${fall.description}`, 30, yPosition);
    yPosition += 7;
  });

  pdf.save(filename);
}

export function generateReportSummary(sceneData: SceneData): string {
  const highRiskZones = sceneData.riskZones.filter(z => z.level === 'high').length;
  const closedZones = sceneData.riskZones.filter(z => z.isClosed).length;
  const errors = sceneData.validation.errors.filter(e => e.severity === 'error').length;
  const warnings = sceneData.validation.errors.filter(e => e.severity === 'warning').length;

  return `
滑雪道风险分析报告摘要
======================

【基本信息】
- 滑行轨迹: ${sceneData.trajectories.length} 条
- 摔倒点: ${sceneData.fallPoints.length} 个
- 救援站: ${sceneData.rescueStations.length} 个
- 风险区域: ${sceneData.riskZones.length} 个 (高风险: ${highRiskZones}个, 已关闭: ${closedZones}个)
- 救援路线: ${sceneData.rescueRoutes.length} 条

【天气信息】
- 天气: ${sceneData.weather.condition}
- 温度: ${sceneData.weather.temperature}°C
- 风速: ${sceneData.weather.windSpeed} km/h
- 能见度: ${sceneData.weather.visibility} m

【数据验证】
- 错误: ${errors} 个
- 警告: ${warnings} 个

【建议】
${errors > 0 ? '⚠️ 存在数据错误，请检查并修正' : '✅ 数据验证通过'}
${highRiskZones > 0 ? '⚠️ 存在高风险区域，请加强巡逻' : ''}
${closedZones > 0 ? 'ℹ️ 有区域已关闭，请确保所有人员知悉' : ''}
  `.trim();
}

export default {
  exportJSON,
  exportPDF,
  generateReportSummary
};
