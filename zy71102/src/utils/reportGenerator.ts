import { jsPDF } from 'jspdf';
import { Statistics, StationScene } from '../simulation/types';

export interface ReportData {
  sceneName: string;
  sceneDescription: string;
  statistics: Statistics;
  timestamp: Date;
  simulationDuration: number;
}

export const generateJSONReport = (data: ReportData): string => {
  return JSON.stringify(data, null, 2);
};

export const downloadJSONReport = (data: ReportData): void => {
  const json = generateJSONReport(data);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `evacuation-report-${data.timestamp.getTime()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const generatePDFReport = async (data: ReportData): Promise<void> => {
  const doc = new jsPDF();
  
  doc.setFontSize(20);
  doc.setTextColor(30, 58, 95);
  doc.text('地铁站客流疏散模拟报告', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(100);
  doc.text(`生成时间: ${data.timestamp.toLocaleString('zh-CN')}`, 105, 30, { align: 'center' });
  
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text('一、场景信息', 20, 45);
  
  doc.setFontSize(11);
  doc.setTextColor(0);
  doc.text(`场景名称: ${data.sceneName}`, 25, 55);
  doc.text(`场景描述: ${data.sceneDescription}`, 25, 62);
  doc.text(`模拟时长: ${data.simulationDuration.toFixed(1)} 秒`, 25, 69);
  
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text('二、疏散统计', 20, 85);
  
  const stats = data.statistics;
  doc.setFontSize(11);
  doc.setTextColor(0);
  
  const completionRate = (stats.completionRate * 100).toFixed(1);
  doc.text(`总人数: ${stats.totalPassengers} 人`, 25, 95);
  doc.text(`已疏散: ${stats.exitedCount} 人`, 25, 102);
  doc.text(`疏散完成率: ${completionRate}%`, 25, 109);
  doc.text(`平均疏散时间: ${stats.avgEvacuationTime.toFixed(1)} 秒`, 25, 116);
  doc.text(`最长等待时间: ${stats.maxWaitTime.toFixed(1)} 秒`, 25, 123);
  doc.text(`等待中: ${stats.waitingCount} 人`, 25, 130);
  doc.text(`滞留: ${stats.stuckCount} 人`, 25, 137);
  
  doc.setFontSize(14);
  doc.setTextColor(30, 58, 95);
  doc.text('三、瓶颈分析', 20, 152);
  
  doc.setFontSize(11);
  doc.setTextColor(0);
  
  if (stats.bottleneckRanking.length === 0) {
    doc.text('本次模拟未检测到明显瓶颈区域。', 25, 162);
  } else {
    const maxBottlenecks = Math.min(stats.bottleneckRanking.length, 5);
    for (let i = 0; i < maxBottlenecks; i++) {
      const bn = stats.bottleneckRanking[i];
      const typeName = bn.type === 'stair' ? '楼梯' : bn.type === 'gate' ? '闸机' : '通道';
      const severityName = bn.severity === 'high' ? '严重' : bn.severity === 'medium' ? '中等' : '轻微';
      doc.text(
        `${i + 1}. ${typeName} - 严重程度: ${severityName}, 排队人数: ${bn.queueLength}人`,
        25,
        160 + i * 8
      );
    }
  }
  
  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text('报告由地铁站客流疏散模拟系统自动生成', 105, 280, { align: 'center' });
  
  doc.save(`evacuation-report-${data.timestamp.getTime()}.pdf`);
};
