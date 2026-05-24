import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import { CoverageResult, Environment, Sprinkler, FieldConfig } from '../types';

interface ReportData {
  coverageResult: CoverageResult;
  environment: Environment;
  sprinklers: Sprinkler[];
  field: FieldConfig;
  scenarioName: string;
  timestamp: Date;
}

export async function exportReportAsPDF(
  reportData: ReportData
): Promise<void> {
  const { coverageResult, environment, sprinklers, field, scenarioName, timestamp } = reportData;

  const reportContainer = document.createElement('div');
  reportContainer.style.cssText = `
    position: fixed;
    left: -9999px;
    top: 0;
    width: 800px;
    padding: 40px;
    background: white;
    font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  `;

  const coveragePercent = (coverageResult.coverageRate * 100).toFixed(1);
  const missedPercent = ((1 - coverageResult.coverageRate) * 100).toFixed(1);

  reportContainer.innerHTML = `
    <div style="margin-bottom: 30px;">
      <h1 style="color: #2D5A27; font-size: 28px; margin: 0 0 10px 0;">农田喷灌覆盖分析报告</h1>
      <p style="color: #666; font-size: 14px; margin: 0;">
        场景: ${scenarioName} | 生成时间: ${timestamp.toLocaleString('zh-CN')}
      </p>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 30px;">
      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h3 style="color: #333; font-size: 16px; margin: 0 0 15px 0;">覆盖统计</h3>
        <div style="display: flex; align-items: center; gap: 20px;">
          <div style="width: 100px; height: 100px; border-radius: 50%; background: conic-gradient(#2196F3 ${coveragePercent}%, #F44336 ${coveragePercent}%); display: flex; align-items: center; justify-content: center;">
            <div style="width: 70px; height: 70px; border-radius: 50%; background: white; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; color: #2196F3;">
              ${coveragePercent}%
            </div>
          </div>
          <div>
            <p style="margin: 5px 0; font-size: 14px;"><span style="color: #2196F3;">●</span> 覆盖面积: ${coverageResult.coveredArea.toFixed(1)} m²</p>
            <p style="margin: 5px 0; font-size: 14px;"><span style="color: #F44336;">●</span> 漏浇面积: ${coverageResult.missedArea.toFixed(1)} m²</p>
            <p style="margin: 5px 0; font-size: 14px;">总面积: ${coverageResult.totalArea.toFixed(1)} m²</p>
          </div>
        </div>
      </div>

      <div style="background: #f8f9fa; padding: 20px; border-radius: 8px;">
        <h3 style="color: #333; font-size: 16px; margin: 0 0 15px 0;">环境参数</h3>
        <p style="margin: 8px 0; font-size: 14px;">坡度: ${environment.slope}° (方向: ${environment.slopeDirection}°)</p>
        <p style="margin: 8px 0; font-size: 14px;">风速: ${environment.windSpeed} m/s (方向: ${environment.windDirection}°)</p>
        <p style="margin: 8px 0; font-size: 14px;">水压系数: ${environment.globalPressure.toFixed(2)}</p>
        <p style="margin: 8px 0; font-size: 14px;">地块尺寸: ${field.width}m × ${field.height}m</p>
      </div>
    </div>

    <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
      <h3 style="color: #333; font-size: 16px; margin: 0 0 15px 0;">喷头配置 (${sprinklers.length}个)</h3>
      <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
        <thead>
          <tr style="background: #e9ecef;">
            <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">编号</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">位置(X,Z)</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">射程(m)</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">水压</th>
            <th style="padding: 10px; text-align: left; border: 1px solid #dee2e6;">流量</th>
          </tr>
        </thead>
        <tbody>
          ${sprinklers.map((s, i) => `
            <tr>
              <td style="padding: 8px; border: 1px solid #dee2e6;">${i + 1}</td>
              <td style="padding: 8px; border: 1px solid #dee2e6;">(${s.x.toFixed(1)}, ${s.z.toFixed(1)})</td>
              <td style="padding: 8px; border: 1px solid #dee2e6;">${s.radius}</td>
              <td style="padding: 8px; border: 1px solid #dee2e6;">${s.pressure.toFixed(2)}</td>
              <td style="padding: 8px; border: 1px solid #dee2e6;">${s.flowRate}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>

    ${coverageResult.missedZones.length > 0 ? `
      <div style="background: #fff5f5; padding: 20px; border-radius: 8px; border: 1px solid #fecaca;">
        <h3 style="color: #dc2626; font-size: 16px; margin: 0 0 15px 0;">⚠️ 漏浇区域分析</h3>
        <p style="margin: 0 0 10px 0; font-size: 14px;">共发现 ${coverageResult.missedZones.length} 个漏浇区域</p>
        <ul style="margin: 0; padding-left: 20px;">
          ${coverageResult.missedZones.slice(0, 5).map((zone, i) => `
            <li style="margin: 5px 0; font-size: 14px;">
              区域${i + 1}: 位置(${zone.x.toFixed(1)}, ${zone.z.toFixed(1)}), 
              面积 ${zone.area.toFixed(1)} m², 
              类型: ${zone.type === 'corner' ? '边角漏浇' : '间隙漏浇'}
            </li>
          `).join('')}
        </ul>
        ${coverageResult.missedZones.length > 5 ? `<p style="margin: 10px 0 0 0; font-size: 13px; color: #666;">...还有 ${coverageResult.missedZones.length - 5} 个小区域</p>` : ''}
      </div>
    ` : `
      <div style="background: #f0fdf4; padding: 20px; border-radius: 8px; border: 1px solid #bbf7d0;">
        <h3 style="color: #16a34a; font-size: 16px; margin: 0;">✅ 覆盖良好 - 未发现漏浇区域</h3>
      </div>
    `}

    <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e5e7eb; color: #6b7280; font-size: 12px;">
      <p style="margin: 0;">报告生成系统: 农田喷灌覆盖模拟器</p>
      <p style="margin: 5px 0 0 0;">* 本报告基于模拟计算结果，实际效果可能因现场条件有所差异</p>
    </div>
  `;

  document.body.appendChild(reportContainer);

  try {
    const canvas = await html2canvas(reportContainer, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(`喷灌覆盖报告_${scenarioName}_${timestamp.getTime()}.pdf`);
  } finally {
    document.body.removeChild(reportContainer);
  }
}

export function exportReportAsJSON(reportData: ReportData): void {
  const jsonStr = JSON.stringify(reportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `喷灌覆盖数据_${reportData.scenarioName}_${reportData.timestamp.getTime()}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportScreenshot(canvasElement: HTMLCanvasElement, scenarioName: string): void {
  const link = document.createElement('a');
  link.download = `喷灌模拟截图_${scenarioName}_${Date.now()}.png`;
  link.href = canvasElement.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
