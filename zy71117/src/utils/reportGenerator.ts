import { jsPDF } from 'jspdf';
import { SimulationReport, VehicleParams, SceneData, CollisionPoint, PathPoint } from '../types';
import { calculatePathLength } from './pathCalculator';
import { getCollisionSummary } from './collision';

export function generateReport(
  sampleName: string,
  vehicle: VehicleParams,
  scene: SceneData,
  path: PathPoint[],
  collisions: CollisionPoint[]
): SimulationReport {
  const collisionSummary = getCollisionSummary(collisions);
  const pathLength = calculatePathLength(path);
  const hasCollision = collisions.length > 0;

  let summary = '';
  const recommendations: string[] = [];

  if (!hasCollision) {
    summary = '模拟完成，车辆可以安全入库，无碰撞风险。';
    recommendations.push('当前场地布局合理，可以按此方案画线施工。');
    recommendations.push('建议预留10%的安全余量，应对实际操作中的偏差。');
  } else {
    summary = `模拟检测到 ${collisions.length} 处碰撞风险，请调整方案。`;
    
    if (collisionSummary.boundaryCount > 0) {
      recommendations.push(`检测到 ${collisionSummary.boundaryCount} 次边界越界，建议扩大场地或调整入口位置。`);
    }
    if (collisionSummary.obstacleCount > 0) {
      recommendations.push(`检测到 ${collisionSummary.obstacleCount} 次障碍物碰撞，建议移除或重新布置障碍物。`);
    }
    recommendations.push('考虑使用较短的车辆或调整转弯路径。');
    recommendations.push('建议增加转弯半径或重新规划行车路线。');
  }

  return {
    id: `report-${Date.now()}`,
    timestamp: new Date().toISOString(),
    sampleName,
    vehicle,
    scene,
    result: {
      hasCollision,
      collisionCount: collisions.length,
      collisionDetails: collisions,
      pathLength,
      duration: path.length * 0.05,
    },
    summary,
    recommendations,
  };
}

export function generateReportHTML(report: SimulationReport): string {
  const collisionDetails = report.result.collisionDetails
    .map((c, i) => `<li>${i + 1}. ${c.description}</li>`)
    .join('');

  return `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
      <meta charset="UTF-8">
      <title>装卸月台转弯模拟报告</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; }
        h1 { color: #165DFF; border-bottom: 2px solid #165DFF; padding-bottom: 10px; }
        h2 { color: #1D2129; margin-top: 30px; }
        .section { background: #F7F8FA; padding: 20px; border-radius: 8px; margin: 15px 0; }
        .status { padding: 10px 15px; border-radius: 6px; font-weight: bold; }
        .status-safe { background: #E8FFEA; color: #00B42A; }
        .status-danger { background: #FFECE8; color: #F53F3F; }
        table { width: 100%; border-collapse: collapse; margin: 10px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #E5E6EB; }
        th { background: #F2F3F5; }
        .collision-list { background: #FFF1F0; padding: 15px; border-radius: 6px; }
        .recommendations { background: #E8F3FF; padding: 15px; border-radius: 6px; }
        .timestamp { color: #86909C; font-size: 14px; }
      </style>
    </head>
    <body>
      <h1>🚚 装卸月台转弯模拟报告</h1>
      <p class="timestamp">生成时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}</p>
      
      <div class="status ${report.result.hasCollision ? 'status-danger' : 'status-safe'}">
        ${report.result.hasCollision ? '⚠️ 检测到碰撞风险' : '✅ 模拟通过，无碰撞'}
      </div>

      <h2>📋 基本信息</h2>
      <div class="section">
        <p><strong>场景名称:</strong> ${report.sampleName}</p>
        <p><strong>车辆类型:</strong> ${report.vehicle.name}</p>
      </div>

      <h2>🚛 车辆参数</h2>
      <div class="section">
        <table>
          <tr><th>参数</th><th>数值</th></tr>
          <tr><td>车长</td><td>${report.vehicle.length} 米</td></tr>
          <tr><td>车宽</td><td>${report.vehicle.width} 米</td></tr>
          <tr><td>轴距</td><td>${report.vehicle.wheelbase} 米</td></tr>
          <tr><td>转弯半径</td><td>${report.vehicle.turningRadius} 米</td></tr>
          <tr><td>车高</td><td>${report.vehicle.height} 米</td></tr>
        </table>
      </div>

      <h2>📊 模拟结果</h2>
      <div class="section">
        <table>
          <tr><th>指标</th><th>数值</th></tr>
          <tr><td>碰撞数量</td><td>${report.result.collisionCount} 处</td></tr>
          <tr><td>路径长度</td><td>${report.result.pathLength.toFixed(2)} 米</td></tr>
          <tr><td>预计耗时</td><td>${report.result.duration.toFixed(1)} 秒</td></tr>
        </table>
      </div>

      ${report.result.collisionDetails.length > 0 ? `
        <h2>🚨 碰撞详情</h2>
        <div class="collision-list">
          <ul>${collisionDetails}</ul>
        </div>
      ` : ''}

      <h2>💡 总结与建议</h2>
      <div class="section">
        <p><strong>总结:</strong> ${report.summary}</p>
      </div>

      <h2>📝 建议</h2>
      <div class="recommendations">
        <ol>
          ${report.recommendations.map(r => `<li>${r}</li>`).join('')}
        </ol>
      </div>
    </body>
    </html>
  `;
}

export function downloadReport(report: SimulationReport, format: 'html' | 'pdf' = 'html'): void {
  if (format === 'pdf') {
    downloadReportPDF(report);
  } else {
    downloadReportHTML(report);
  }
}

export function downloadReportHTML(report: SimulationReport): void {
  const html = generateReportHTML(report);
  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `模拟报告-${report.sampleName}-${Date.now()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadReportPDF(report: SimulationReport): void {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  let y = margin;

  doc.setFontSize(20);
  doc.setTextColor(22, 93, 255);
  doc.text('Loading Dock Turning Simulation Report', pageWidth / 2, y, { align: 'center' });
  y += 10;

  doc.setFontSize(10);
  doc.setTextColor(100);
  doc.text(`Generated: ${new Date(report.timestamp).toLocaleString('en-US')}`, pageWidth / 2, y, { align: 'center' });
  y += 15;

  const statusColor = report.result.hasCollision ? [245, 63, 63] : [0, 180, 42];
  doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  doc.rect(margin, y, pageWidth - 2 * margin, 10, 'F');
  doc.setTextColor(255);
  doc.setFontSize(12);
  doc.text(
    report.result.hasCollision ? '⚠️  COLLISION RISK DETECTED' : '✓  SIMULATION PASSED - NO COLLISION',
    pageWidth / 2,
    y + 7,
    { align: 'center' }
  );
  y += 20;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Basic Information', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Scenario: ${report.sampleName}`, margin + 5, y);
  y += 6;
  doc.text(`Vehicle: ${report.vehicle.name}`, margin + 5, y);
  y += 12;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Vehicle Parameters', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(80);
  const vehicleParams = [
    [`Length: ${report.vehicle.length} m`, `Width: ${report.vehicle.width} m`],
    [`Wheelbase: ${report.vehicle.wheelbase} m`, `Turning Radius: ${report.vehicle.turningRadius} m`],
    [`Height: ${report.vehicle.height} m`, ''],
  ];
  vehicleParams.forEach((row) => {
    doc.text(row[0], margin + 5, y);
    if (row[1]) doc.text(row[1], margin + 80, y);
    y += 6;
  });
  y += 6;

  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Simulation Results', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(80);
  doc.text(`Collision Count: ${report.result.collisionCount}`, margin + 5, y);
  y += 6;
  doc.text(`Path Length: ${report.result.pathLength.toFixed(2)} m`, margin + 5, y);
  y += 6;
  doc.text(`Estimated Duration: ${report.result.duration.toFixed(1)} s`, margin + 5, y);
  y += 12;

  if (report.result.collisionDetails.length > 0) {
    if (y > 200) {
      doc.addPage();
      y = margin;
    }
    doc.setFontSize(14);
    doc.setTextColor(245, 63, 63);
    doc.text('Collision Details', margin, y);
    y += 8;
    doc.setFontSize(9);
    doc.setTextColor(80);
    report.result.collisionDetails.slice(0, 8).forEach((c) => {
      if (y > 270) {
        doc.addPage();
        y = margin;
      }
      doc.text(`• ${c.description}`, margin + 5, y);
      y += 5;
    });
    if (report.result.collisionDetails.length > 8) {
      doc.text(`... and ${report.result.collisionDetails.length - 8} more collisions`, margin + 5, y);
      y += 8;
    }
    y += 4;
  }

  if (y > 220) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(14);
  doc.setTextColor(0);
  doc.text('Summary', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(80);
  const summaryLines = doc.splitTextToSize(report.summary, pageWidth - 2 * margin - 5);
  summaryLines.forEach((line: string) => {
    doc.text(line, margin + 5, y);
    y += 5;
  });
  y += 8;

  if (y > 220) {
    doc.addPage();
    y = margin;
  }
  doc.setFontSize(14);
  doc.setTextColor(22, 93, 255);
  doc.text('Recommendations', margin, y);
  y += 8;
  doc.setFontSize(10);
  doc.setTextColor(80);
  report.recommendations.forEach((r, i) => {
    if (y > 270) {
      doc.addPage();
      y = margin;
    }
    doc.text(`${i + 1}. ${r}`, margin + 5, y);
    y += 5;
  });

  doc.save(`模拟报告-${report.sampleName}-${Date.now()}.pdf`);
}
