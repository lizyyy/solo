import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import type { Batch, SamplePoint, FitResult, HistoryRecord } from '@/types';

const fmt = (v: number | null, d = 4): string => (v === null ? '-' : v.toFixed(d));

/**
 * 生成报告文件名
 * 格式：RC实验报告_{学生姓名}_{批次编号}_{日期}.pdf
 */
export const generateReportFileName = (batch: Batch): string =>
  `RC实验报告_${batch.studentName}_${batch.batchNo}_${batch.experimentDate.replace(/-/g, '')}.pdf`;

/**
 * 生成完整的HTML报告内容
 */
export const generateReportHTML = (
  batch: Batch,
  points: SamplePoint[],
  fitResult: FitResult | null,
  history: HistoryRecord[]
): string => {
  const validCount = points.filter(p => !p.isOutlier).length;
  const recent = [...history]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, 5);

  const r = batch.resistance;
  const c = batch.capacitance;
  const rStr = r !== null ? `${fmt(r, 2)} ${batch.resistanceUnit}` : '-';
  const cStr = c !== null ? `${fmt(c, 2)} ${batch.capacitanceUnit}` : '-';
  const vsStr = batch.supplyVoltage !== null ? `${fmt(batch.supplyVoltage, 2)} V` : '-';
  const viStr = batch.initialVoltage !== null ? `${fmt(batch.initialVoltage, 2)} V` : '-';

  const css = `<style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{font-family:"SimSun","宋体",serif;font-size:12pt;line-height:1.6;color:#333;padding:20px;background:#fff}
    .report{max-width:800px;margin:0 auto}
    .header{text-align:center;border-bottom:2px solid #333;padding-bottom:15px;margin-bottom:20px}
    .header h1{font-size:20pt;font-weight:bold;margin-bottom:15px;letter-spacing:2px}
    .info{display:grid;grid-template-columns:1fr 1fr;gap:8px;text-align:left;font-size:11pt}
    .info span{display:flex}
    .info strong{min-width:80px;font-weight:normal}
    section{margin-bottom:25px}
    h2{font-size:14pt;font-weight:bold;border-left:4px solid #333;padding-left:10px;margin-bottom:12px;color:#222}
    table{width:100%;border-collapse:collapse;margin-bottom:10px;font-size:11pt}
    th,td{border:1px solid #666;padding:8px 12px;text-align:center}
    th{background:#f5f5f5;font-weight:bold}
    .param td:first-child{width:35%;text-align:left;background:#fafafa}
    .chart{width:100%;height:300px;border:1px dashed #999;display:flex;align-items:center;justify-content:center;background:#fafafa;margin:10px 0}
    .chart img{max-width:100%;max-height:100%;object-fit:contain}
    .chart .ph{color:#999;font-size:11pt}
    .grid{display:grid;grid-template-columns:1fr 1fr;gap:15px}
    .history{list-style:none}
    .history li{border:1px solid #ddd;padding:10px;margin-bottom:8px;background:#fafafa;font-size:10.5pt}
    .history .meta{color:#666;font-size:9.5pt;margin-top:5px}
    .watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);font-size:60pt;color:rgba(200,200,200,0.15);pointer-events:none;z-index:-1;white-space:nowrap}
    @media print{.page-break{page-break-before:always}}
  </style>`;

  const fitTable = fitResult ? `
    <table>
      <tr><th>参数名称</th><th>符号</th><th>数值</th><th>单位</th><th>标准误差</th></tr>
      <tr><td>时间常数</td><td>τ</td><td>${fmt(fitResult.tau, 6)}</td><td>s</td><td>${fmt(fitResult.tauStdErr, 6)}</td></tr>
      <tr><td>决定系数</td><td>R²</td><td colspan="3">${fmt(fitResult.rSquared, 6)}</td></tr>
      <tr><td>校正决定系数</td><td>Adjusted R²</td><td colspan="3">${fmt(fitResult.adjustedRSquared, 6)}</td></tr>
      <tr><td>均方根误差</td><td>RMSE</td><td colspan="3">${fmt(fitResult.rootMeanSquaredError, 6)}</td></tr>
      <tr><td>拟合算法</td><td>-</td><td colspan="3">${fitResult.algorithm}</td></tr>
    </table>
    <div class="grid">
      <table>
        <tr><th colspan="2">拟合参数值</th></tr>
        <tr><td>V₀ (初始电压)</td><td>${fmt(fitResult.fittedParams.V0, 4)} V</td></tr>
        <tr><td>Vₛ (电源电压)</td><td>${fmt(fitResult.fittedParams.Vs, 4)} V</td></tr>
        <tr><td>τ (时间常数)</td><td>${fmt(fitResult.fittedParams.tau, 6)} s</td></tr>
      </table>
      <table>
        <tr><th colspan="2">质量评估</th></tr>
        <tr><td>R² ≥ 0.99</td><td style="color:${fitResult.rSquared >= 0.99 ? '#2e7d32' : '#c62828'}">${fitResult.rSquared >= 0.99 ? '优秀' : '需改进'}</td></tr>
        <tr><td>RMSE &lt; 0.01</td><td style="color:${fitResult.rootMeanSquaredError < 0.01 ? '#2e7d32' : '#c62828'}">${fitResult.rootMeanSquaredError < 0.01 ? '优秀' : '需改进'}</td></tr>
        <tr><td>计算时间</td><td>${fitResult.computedAt}</td></tr>
      </table>
    </div>
  ` : '<p style="color:#999;text-align:center;padding:30px">暂无拟合结果</p>';

  const historyList = recent.length > 0 ? `
    <ul class="history">
      ${recent.map((h, i) => `
        <li>
          <strong>${i + 1}. </strong>${h.description}
          <div class="meta">修改人：${h.modifiedBy} | 类型：${h.changeType === 'manual' ? '手动' : '自动'} | 时间：${h.timestamp} | 版本：v${h.version}</div>
        </li>
      `).join('')}
    </ul>
  ` : '<p style="color:#999;text-align:center;padding:20px">暂无修改记录</p>';

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>RC电路实验报告</title>${css}</head><body>
    <div class="watermark">RC实验报告 - ${batch.batchNo}</div>
    <div class="report">
      <div class="header">
        <h1>RC 电路暂态过程实验报告</h1>
        <div class="info">
          <span><strong>批次编号：</strong>${batch.batchNo}</span>
          <span><strong>实验日期：</strong>${batch.experimentDate}</span>
          <span><strong>学生姓名：</strong>${batch.studentName}</span>
          <span><strong>实验模式：</strong>${batch.fitMode === 'charge' ? '充电过程' : '放电过程'}</span>
          <span><strong>电阻规格：</strong>${rStr}</span>
          <span><strong>电容规格：</strong>${cStr}</span>
        </div>
      </div>
      <section>
        <h2>一、实验参数</h2>
        <table class="param">
          <tr><td>电源电压</td><td>${vsStr}</td><td>初始电压</td><td>${viStr}</td></tr>
          <tr><td>采样点总数</td><td>${points.length}</td><td>有效采样点</td><td>${validCount}</td></tr>
          <tr><td>时间单位</td><td>${batch.timeUnit}</td><td>数据版本</td><td>v${batch.dataVersion}</td></tr>
        </table>
      </section>
      <section><h2>二、拟合曲线图</h2><div class="chart" id="fitChart"><div class="ph">拟合曲线图（将在生成PDF时自动填充）</div></div></section>
      <section class="page-break"><h2>三、残差分析图</h2><div class="chart" id="residualChart"><div class="ph">残差分析图（将在生成PDF时自动填充）</div></div></section>
      <section><h2>四、拟合参数结果</h2>${fitTable}</section>
      <section><h2>五、历史修改记录</h2>${historyList}</section>
    </div>
  </body></html>`;
};

/**
 * 生成PDF报告
 */
export const generatePDF = async (
  batch: Batch,
  points: SamplePoint[],
  fitResult: FitResult | null,
  history: HistoryRecord[],
  chartRef?: React.RefObject<HTMLDivElement>
): Promise<Blob> => {
  const container = document.createElement('div');
  container.innerHTML = generateReportHTML(batch, points, fitResult, history);
  container.style.cssText = 'position:absolute;left:-9999px;width:800px';
  document.body.appendChild(container);

  try {
    if (chartRef?.current) {
      const fitDiv = container.querySelector('#fitChart') as HTMLDivElement;
      const resDiv = container.querySelector('#residualChart') as HTMLDivElement;
      const canvases = chartRef.current.querySelectorAll('canvas');

      const captureChart = async (el: HTMLElement, target: HTMLDivElement | null) => {
        if (!target) return;
        const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#fff', useCORS: true });
        target.innerHTML = `<img src="${canvas.toDataURL('image/png')}" />`;
      };

      if (canvases[0] as HTMLElement) await captureChart(canvases[0] as HTMLElement, fitDiv);
      if (canvases[1] as HTMLElement) await captureChart(canvases[1] as HTMLElement, resDiv);
    }

    const canvas = await html2canvas(container.querySelector('.report') as HTMLElement, {
      scale: 2,
      backgroundColor: '#fff',
      useCORS: true,
      logging: false,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pw = pdf.internal.pageSize.getWidth();
    const ph = pdf.internal.pageSize.getHeight();
    const margin = 10;
    const iw = pw - margin * 2;
    const ih = (canvas.height * iw) / canvas.width;

    let hl = ih;
    let pos = 0;
    pdf.addImage(imgData, 'PNG', margin, margin + pos, iw, ih);
    hl -= ph - margin * 2;

    while (hl >= 0) {
      pos = hl - ih;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', margin, margin + pos, iw, ih);
      hl -= ph - margin * 2;
    }

    const total = pdf.getNumberOfPages();
    for (let i = 1; i <= total; i++) {
      pdf.setPage(i);
      pdf.setFontSize(9);
      pdf.setTextColor(128);
      pdf.text(`第 ${i} 页 / 共 ${total} 页`, pw / 2, ph - 10, { align: 'center' });
      pdf.setFontSize(40);
      pdf.setTextColor(220);
      pdf.text(batch.batchNo, pw / 2, ph / 2, { align: 'center', angle: -30 });
    }

    return pdf.output('blob');
  } finally {
    document.body.removeChild(container);
  }
};

/**
 * 触发浏览器下载
 */
export const downloadReport = (blob: Blob, filename: string): void => {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};
