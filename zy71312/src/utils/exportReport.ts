import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { SolarParams, SolarResults } from '../types';

export async function exportPDFReport(
  params: SolarParams,
  results: SolarResults,
  elementId?: string
): Promise<void> {
  const doc = new jsPDF('p', 'mm', 'a4');

  doc.setFontSize(20);
  doc.setTextColor(30, 64, 175);
  doc.text('太阳能板倾角收益分析报告', 105, 20, { align: 'center' });

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`生成时间: ${new Date().toLocaleString('zh-CN')}`, 105, 30, { align: 'center' });

  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('一、项目基本信息', 20, 45);

  doc.setFontSize(10);
  doc.setTextColor(0);
  const basicInfo = [
    ['城市', params.city],
    ['纬度', `${params.latitude}°`],
    ['屋顶坡度', `${params.roofAngle}°`],
    ['系统容量', `${((params.panelPower * params.panelCount) / 1000).toFixed(1)} kW`],
    ['组件数量', `${params.panelCount} 块`],
    ['组件功率', `${params.panelPower} W`],
    ['电价', `¥${params.electricityPrice}/kWh`],
  ];

  basicInfo.forEach((item, index) => {
    doc.text(item[0], 25, 55 + index * 7);
    doc.text(item[1], 80, 55 + index * 7);
  });

  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('二、倾角优化结果', 20, 115);

  doc.setFontSize(10);
  doc.setTextColor(0);
  doc.text(`推荐倾角: ${results.optimalAngle}°`, 25, 125);
  doc.text(`遮挡损失: ${results.shadingLoss}%`, 80, 125);
  doc.text('计算说明:', 25, 135);
  doc.setFontSize(9);
  doc.setTextColor(80);
  const reasonLines = doc.splitTextToSize(results.optimalAngleReason, 160);
  doc.text(reasonLines, 25, 142);

  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('三、收益分析', 20, 165);

  doc.setFontSize(10);
  doc.setTextColor(0);
  const profitInfo = [
    ['年发电量', `${results.annualEnergy.toLocaleString()} kWh`],
    ['年收益', `¥${results.annualProfit.toLocaleString()}`],
    ['投资回收期', `${results.paybackYears} 年`],
    ['25年总收益', `¥${Math.round(results.annualProfit * 25 - (params.panelPower * params.panelCount * params.panelPrice * 1.7)).toLocaleString()}`],
  ];

  profitInfo.forEach((item, index) => {
    doc.text(item[0], 25, 175 + index * 8);
    doc.text(item[1], 80, 175 + index * 8);
  });

  doc.setFontSize(14);
  doc.setTextColor(30, 64, 175);
  doc.text('四、月度发电量预测', 20, 215);

  const months = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
  doc.setFontSize(8);
  doc.setTextColor(0);
  months.forEach((month, index) => {
    const x = 25 + (index % 6) * 28;
    const y = 225 + Math.floor(index / 6) * 8;
    doc.text(`${month}: ${results.monthlyEnergy[index] || 0}kWh`, x, y);
  });

  doc.setFontSize(10);
  doc.setTextColor(150);
  doc.text('--- 本报告仅供参考，实际收益受天气、电网等因素影响 ---', 105, 275, { align: 'center' });

  doc.save(`光伏倾角分析报告_${params.city}_${new Date().toLocaleDateString('zh-CN')}.pdf`);
}

export function exportParamsSnapshot(params: SolarParams, results: SolarResults): void {
  const snapshot = {
    exportedAt: new Date().toISOString(),
    params,
    results,
  };

  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `光伏参数快照_${params.city}_${Date.now()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
