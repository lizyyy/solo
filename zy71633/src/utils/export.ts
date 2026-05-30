import { jsPDF } from 'jspdf';
import { Experiment } from '../types';

export function exportToJSON(experiment: Experiment): void {
  const data = JSON.stringify(experiment, null, 2);
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `experiment-${experiment.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function exportToHTML(experiment: Experiment): void {
  const anomaliesList = experiment.anomalies.map((a) => `
    <tr class="${a.resolved ? 'opacity-50' : ''}">
      <td class="border border-gray-700 px-3 py-2">${a.type}</td>
      <td class="border border-gray-700 px-3 py-2 ${
        a.severity === 'error' ? 'text-red-400' : a.severity === 'warning' ? 'text-orange-400' : 'text-blue-400'
      }">${a.severity}</td>
      <td class="border border-gray-700 px-3 py-2">${a.description}</td>
      <td class="border border-gray-700 px-3 py-2">${a.resolved ? '已确认' : '待处理'}</td>
    </tr>
  `).join('');

  const html = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <title>电磁轨道炮实验报告 - ${experiment.name}</title>
  <style>
    body { font-family: 'JetBrains Mono', monospace; background: #0a1628; color: #e5e7eb; padding: 40px; }
    .container { max-width: 800px; margin: 0 auto; }
    h1 { color: #00d4ff; border-bottom: 2px solid #00d4ff; padding-bottom: 10px; }
    h2 { color: #00d4ff; margin-top: 30px; }
    .card { background: #0f1f38; padding: 20px; border-radius: 8px; margin: 15px 0; border: 1px solid #00d4ff33; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; }
    .label { color: #9ca3af; font-size: 12px; }
    .value { color: #00d4ff; font-size: 20px; font-weight: bold; }
    table { width: 100%; border-collapse: collapse; margin-top: 15px; }
    th { background: #1a2d4a; color: #00d4ff; text-align: left; padding: 10px; border: 1px solid #374151; }
    .warning { color: #ff6b35; }
    .danger { color: #ff3366; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #374151; color: #6b7280; font-size: 12px; text-align: center; }
  </style>
</head>
<body>
  <div class="container">
    <h1>电磁轨道炮实验报告</h1>
    <p><strong>实验名称:</strong> ${experiment.name}</p>
    <p><strong>实验时间:</strong> ${new Date(experiment.timestamp).toLocaleString('zh-CN')}</p>
    <p><strong>状态:</strong> ${experiment.status === 'completed' ? '<span style="color:#10b981">已完成</span>' : '<span style="color:#f59e0b">进行中</span>'}</p>

    <h2>实验参数</h2>
    <div class="card grid">
      <div><div class="label">线圈电流</div><div class="value">${experiment.params.coilCurrent} A</div></div>
      <div><div class="label">线圈匝数</div><div class="value">${experiment.params.coilTurns} 匝</div></div>
      <div><div class="label">弹丸质量</div><div class="value">${experiment.params.projectileMass} kg</div></div>
      <div><div class="label">加速级数</div><div class="value">${experiment.params.stageCount} 级</div></div>
      <div><div class="label">轨道长度</div><div class="value">${experiment.params.trackLength} m</div></div>
      <div><div class="label">弹丸半径</div><div class="value">${experiment.params.projectileRadius} m</div></div>
    </div>

    ${experiment.result ? `
    <h2>实验结果</h2>
    <div class="card grid">
      <div><div class="label">最终速度</div><div class="value">${experiment.result.finalVelocity.toFixed(2)} m/s</div></div>
      <div><div class="label">动能</div><div class="value">${(experiment.result.kineticEnergy / 1000).toFixed(2)} kJ</div></div>
      <div><div class="label">效率</div><div class="value">${experiment.result.efficiency.toFixed(2)} %</div></div>
      <div><div class="label">最高温度</div><div class="value ${experiment.result.maxTemperature > 80 ? 'danger' : experiment.result.maxTemperature > 60 ? 'warning' : ''}">${experiment.result.maxTemperature.toFixed(1)} °C</div></div>
      <div><div class="label">加速时间</div><div class="value">${experiment.result.duration.toFixed(2)} ms</div></div>
      <div><div class="label">最大加速度</div><div class="value">${(experiment.result.maxAcceleration / 9.8).toFixed(1)} G</div></div>
    </div>
    ` : ''}

    <h2>异常记录</h2>
    <div class="card">
      ${experiment.anomalies.length === 0 ? '<p class="text-green-400">无异常记录</p>' : `
      <table>
        <thead><tr><th>类型</th><th>级别</th><th>描述</th><th>状态</th></tr></thead>
        <tbody>${anomaliesList}</tbody>
      </table>
      `}
    </div>

    <div class="footer">
      <p>电磁轨道炮演示台 - 自动生成报告</p>
      <p>生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    </div>
  </div>
</body>
</html>
  `;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `report-${experiment.id}.html`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function exportToPDF(experiment: HTMLElement): Promise<void> {
  const html2canvas = (await import('html2canvas')).default;
  const canvas = await html2canvas(experiment, {
    backgroundColor: '#0a1628',
    scale: 2,
  });

  const imgData = canvas.toDataURL('image/png');
  const pdf = new jsPDF('p', 'mm', 'a4');
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

  pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
  pdf.save(`report-${Date.now()}.pdf`);
}
