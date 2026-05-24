import { jsPDF } from 'jspdf';
import { SceneState } from '../types';
import { getRiskTypeLabel, getSeverityLabel } from './riskDetection';

export const generateReportData = (state: SceneState) => {
  const now = new Date();
  const timestamp = now.toLocaleString('zh-CN');
  
  const riskStats = {
    critical: state.risks.filter(r => r.severity === 'critical').length,
    high: state.risks.filter(r => r.severity === 'high').length,
    medium: state.risks.filter(r => r.severity === 'medium').length,
    low: state.risks.filter(r => r.severity === 'low').length,
  };
  
  return {
    title: '塔吊吊装预演报告',
    timestamp,
    crane: {
      name: state.crane.name,
      height: state.crane.height,
      maxRadius: state.crane.maxRadius,
      maxWeight: state.crane.maxWeight,
      currentAngle: state.crane.currentAngle.toFixed(1),
      currentRadius: state.crane.currentRadius.toFixed(1),
    },
    liftObject: {
      weight: state.liftObject.weight,
      progress: (state.liftObject.currentProgress * 100).toFixed(0),
    },
    environment: {
      windSpeed: state.environment.windSpeed,
      maxAllowedWindSpeed: state.environment.maxAllowedWindSpeed,
    },
    riskStats,
    totalRisks: state.risks.length,
    risks: state.risks.map(r => ({
      type: getRiskTypeLabel(r.type),
      severity: getSeverityLabel(r.severity),
      message: r.message,
    })),
  };
};

export const exportPDFReport = async (
  state: SceneState,
  canvasElement: HTMLCanvasElement | null
) => {
  const doc = new jsPDF('landscape', 'mm', 'a4');
  const reportData = generateReportData(state);
  
  doc.setFontSize(20);
  doc.setTextColor(22, 93, 255);
  doc.text(reportData.title, 148, 15, { align: 'center' });
  
  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`生成时间: ${reportData.timestamp}`, 148, 22, { align: 'center' });
  
  doc.setDrawColor(22, 93, 255);
  doc.setLineWidth(0.5);
  doc.line(20, 27, 277, 27);
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.text('塔吊参数', 20, 38);
  
  doc.setFontSize(10);
  doc.text(`型号: ${reportData.crane.name}`, 25, 45);
  doc.text(`高度: ${reportData.crane.height}m`, 25, 52);
  doc.text(`最大半径: ${reportData.crane.maxRadius}m`, 25, 59);
  doc.text(`最大起重量: ${reportData.crane.maxWeight}吨`, 25, 66);
  doc.text(`当前角度: ${reportData.crane.currentAngle}°`, 25, 73);
  doc.text(`当前半径: ${reportData.crane.currentRadius}m`, 25, 80);
  
  doc.setFontSize(12);
  doc.text('吊装参数', 100, 38);
  
  doc.setFontSize(10);
  doc.text(`吊物重量: ${reportData.liftObject.weight}吨`, 105, 45);
  doc.text(`预演进度: ${reportData.liftObject.progress}%`, 105, 52);
  doc.text(`当前风速: ${reportData.environment.windSpeed}m/s`, 105, 59);
  doc.text(`允许风速: ${reportData.environment.maxAllowedWindSpeed}m/s`, 105, 66);
  
  doc.setFontSize(12);
  doc.text('风险统计', 20, 92);
  
  const stats = reportData.riskStats;
  doc.setFontSize(10);
  doc.text(`严重风险: ${stats.critical}`, 25, 99);
  doc.text(`高风险: ${stats.high}`, 60, 99);
  doc.text(`中风险: ${stats.medium}`, 95, 99);
  doc.text(`低风险: ${stats.low}`, 130, 99);
  doc.text(`总计: ${reportData.totalRisks}`, 165, 99);
  
  if (reportData.risks.length > 0) {
    doc.setFontSize(12);
    doc.text('风险详情', 20, 110);
    
    let yPos = 117;
    reportData.risks.slice(0, 6).forEach((risk, index) => {
      if (yPos < 180) {
        doc.setFontSize(9);
        doc.text(`${index + 1}. [${risk.severity}] ${risk.type}: ${risk.message}`, 25, yPos);
        yPos += 7;
      }
    });
  }
  
  if (canvasElement) {
    try {
      const imgData = canvasElement.toDataURL('image/jpeg', 0.8);
      doc.addPage();
      doc.setFontSize(14);
      doc.setTextColor(0);
      doc.text('场景截图', 148, 15, { align: 'center' });
      doc.addImage(imgData, 'JPEG', 20, 25, 257, 160);
    } catch (e) {
      console.error('Failed to add screenshot to PDF:', e);
    }
  }
  
  const fileName = `塔吊预演报告_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
};

export const exportJSONReport = (state: SceneState) => {
  const reportData = generateReportData(state);
  const dataStr = JSON.stringify(reportData, null, 2);
  const dataBlob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(dataBlob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `塔吊预演报告_${new Date().toISOString().slice(0, 10)}.json`;
  link.click();
  URL.revokeObjectURL(url);
};
