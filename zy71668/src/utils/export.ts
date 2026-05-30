import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import * as XLSX from 'xlsx';
import type { CalculationResult, HistoryRecord, RiskItem } from '@/types';
import { formatTime, formatDistance } from './calculator';

export function exportToJSON(result: CalculationResult, filename?: string): void {
  const data = JSON.stringify(result, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `drone_calculation_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportToExcel(result: CalculationResult, filename?: string): void {
  const wb = XLSX.utils.book_new();

  const summaryData = [
    ['项目', '数值', '单位', '说明'],
    ['无人机型号', result.droneParams.model, '', ''],
    ['估算飞行时间', result.estimatedFlightTime.toFixed(1), '分钟', ''],
    ['估算航程', result.estimatedRange.toFixed(2), 'km', ''],
    ['总任务距离', result.totalDistance.toFixed(2), 'km', ''],
    ['返航距离', result.returnDistance.toFixed(2), 'km', ''],
    ['返航电量阈值', result.returnBatteryThreshold.toFixed(1), '%', ''],
    ['剩余电量余量', result.remainingBatteryMargin.toFixed(1), '%', ''],
    ['基础功率', result.basePower.toFixed(2), 'W', ''],
    ['载重影响系数', result.payloadEnergyImpact.toFixed(2), 'x', ''],
    ['风阻影响系数', result.windResistanceImpact.toFixed(2), 'x', ''],
    ['风阻力', result.dragForce.toFixed(3), 'N', ''],
    ['逆风分量', result.headwindComponent.toFixed(1), 'm/s', ''],
    ['置信度评分', result.confidenceScore.toFixed(0), '%', ''],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
  XLSX.utils.book_append_sheet(wb, ws1, '计算摘要');

  const risksData = [
    ['风险等级', '类别', '标题', '描述', '来源', '建议'],
    ...result.risks.map((risk: RiskItem) => [
      risk.level === 'critical' ? '严重' : risk.level === 'warning' ? '警告' : '注意',
      risk.category,
      risk.title,
      risk.description,
      risk.source,
      risk.suggestion,
    ]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(risksData);
  XLSX.utils.book_append_sheet(wb, ws2, '风险清单');

  const paramsData = [
    ['参数类型', '参数名', '数值', '单位'],
    ['无人机参数', '最大起飞重量', result.droneParams.maxTakeoffWeight, 'g'],
    ['无人机参数', '空机重量', result.droneParams.emptyWeight, 'g'],
    ['无人机参数', '电池容量', result.droneParams.batteryCapacity, 'mAh'],
    ['无人机参数', '电池电压', result.droneParams.batteryVoltage, 'V'],
    ['无人机参数', '标称续航', result.droneParams.maxFlightTime, 'min'],
    ['无人机参数', '巡航速度', result.droneParams.cruiseSpeed, 'm/s'],
    ['风速数据', '风速', result.windData.speed, 'm/s'],
    ['风速数据', '风向', result.windData.direction, '°'],
    ['风速数据', '飞行方向', result.windData.flightDirection, '°'],
    ['风速数据', '海拔高度', result.windData.altitude, 'm'],
    ['载重数据', '相机重量', result.payloadData.cameraWeight, 'g'],
    ['载重数据', '电池重量', result.payloadData.batteryWeight, 'g'],
    ['载重数据', '附件重量', result.payloadData.accessoriesWeight, 'g'],
    ['载重数据', '总载重', result.payloadData.totalWeight, 'g'],
    ['电池状态', '当前电量', result.batteryStatus.currentCapacity, '%'],
    ['电池状态', '循环次数', result.batteryStatus.cycleCount, '次'],
    ['电池状态', '温度', result.batteryStatus.temperature, '°C'],
    ['电池状态', '健康度', result.batteryStatus.health, '%'],
  ];
  const ws3 = XLSX.utils.aoa_to_sheet(paramsData);
  XLSX.utils.book_append_sheet(wb, ws3, '参数详情');

  XLSX.writeFile(wb, filename || `drone_calculation_${new Date().toISOString().split('T')[0]}.xlsx`);
}

export async function exportToPDF(elementId: string, filename?: string): Promise<void> {
  const element = document.getElementById(elementId);
  if (!element) {
    console.error('Element not found for PDF export');
    return;
  }

  try {
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#0f172a',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = Math.min(pdfWidth / imgWidth, pdfHeight / imgHeight);
    const imgX = (pdfWidth - imgWidth * ratio) / 2;
    const imgY = 10;

    pdf.addImage(imgData, 'PNG', imgX, imgY, imgWidth * ratio, imgHeight * ratio);
    pdf.save(filename || `drone_report_${new Date().toISOString().split('T')[0]}.pdf`);
  } catch (error) {
    console.error('PDF export failed:', error);
  }
}

export function exportHistoryToJSON(history: HistoryRecord[], filename?: string): void {
  const data = JSON.stringify(history, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename || `drone_history_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function generateReportMarkdown(result: CalculationResult): string {
  const date = new Date(result.timestamp).toLocaleString('zh-CN');
  
  let md = `# 无人机续航风阻估算报告\n\n`;
  md += `**生成时间**: ${date}\n\n`;
  md += `**无人机型号**: ${result.droneParams.model}\n\n`;
  
  md += `## 计算摘要\n\n`;
  md += `| 指标 | 数值 |\n`;
  md += `|------|------|\n`;
  md += `| 估算飞行时间 | ${formatTime(result.estimatedFlightTime)} |\n`;
  md += `| 估算航程 | ${formatDistance(result.estimatedRange)} |\n`;
  md += `| 总任务距离 | ${formatDistance(result.totalDistance)} |\n`;
  md += `| 返航距离 | ${formatDistance(result.returnDistance)} |\n`;
  md += `| 返航电量阈值 | ${result.returnBatteryThreshold.toFixed(1)}% |\n`;
  md += `| 剩余电量余量 | ${result.remainingBatteryMargin.toFixed(1)}% |\n`;
  md += `| 置信度评分 | ${result.confidenceScore.toFixed(0)}% |\n\n`;
  
  md += `## 风险评估\n\n`;
  if (result.risks.length === 0) {
    md += `✅ 未检测到风险\n\n`;
  } else {
    result.risks.forEach((risk) => {
      const level = risk.level === 'critical' ? '🔴 严重' : risk.level === 'warning' ? '🟠 警告' : '🟡 注意';
      md += `### ${level}: ${risk.title}\n\n`;
      md += `${risk.description}\n\n`;
      md += `**来源**: ${risk.source}\n\n`;
      if (risk.formula) {
        md += `**计算公式**: \`${risk.formula}\`\n\n`;
      }
      md += `**建议**: ${risk.suggestion}\n\n`;
    });
  }
  
  md += `## 详细计算\n\n`;
  md += `### 能耗估算\n\n`;
  md += `- 基础功率: ${result.basePower.toFixed(2)} W\n`;
  md += `- 载重影响系数: ${result.payloadEnergyImpact.toFixed(2)}x\n`;
  md += `- 风阻影响系数: ${result.windResistanceImpact.toFixed(2)}x\n\n`;
  
  md += `### 风阻修正\n\n`;
  md += `- 空气密度: ${result.airDensity.toFixed(4)} kg/m³\n`;
  md += `- 逆风分量: ${result.headwindComponent.toFixed(1)} m/s\n`;
  md += `- 风阻力: ${result.dragForce.toFixed(3)} N\n`;
  md += `- 风阻功率: ${result.dragPower.toFixed(2)} W\n\n`;
  
  md += `---\n\n`;
  md += `*本报告由无人机续航风阻估算工具自动生成，所有计算基于保守估算原则。*\n`;
  
  return md;
}

export function downloadReport(result: CalculationResult): void {
  const md = generateReportMarkdown(result);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `drone_report_${new Date().toISOString().split('T')[0]}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
