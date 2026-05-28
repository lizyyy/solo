import type { ECharts } from 'echarts';
import type {
  PrintBatch,
  StressResult,
  IssueTrack,
  Correction,
  ReportData,
  Suggestion,
} from '../types';
import { getMaterialById, getMaterialName } from '../data/materials';
import { getRiskLevelLabel } from './stressCalculator';
import { getIssueTypeLabel } from './suggestionEngine';

export const exportChartAsImage = (
  chartInstance: ECharts | undefined,
  filename: string,
  format: 'png' | 'svg' = 'png',
): boolean => {
  if (!chartInstance) return false;

  const dataUrl = chartInstance.getDataURL({
    type: format,
    pixelRatio: 2,
    backgroundColor: '#172033',
  });

  const link = document.createElement('a');
  link.download = `${filename}.${format}`;
  link.href = dataUrl;
  link.click();

  return true;
};

export const generateReportData = (
  batch: PrintBatch,
  stressResult: StressResult,
  issues: IssueTrack[],
  corrections: Correction[],
  suggestions: Suggestion[],
  confirmedBy?: string,
  confirmedAt?: string,
): ReportData => {
  const material = getMaterialById(batch.materialId);
  const keyIssues = issues.map((i) => getIssueTypeLabel(i.issueType) + ': ' + i.description);

  if (stressResult.validationErrors.length > 0) {
    stressResult.validationErrors.forEach((err) => {
      keyIssues.unshift(
        getIssueTypeLabel(err.type as never) + ': ' + err.message,
      );
    });
  }

  if (stressResult.riskLevel === 'high' || stressResult.riskLevel === 'critical') {
    keyIssues.unshift(
      `应力风险为${getRiskLevelLabel(stressResult.riskLevel)}，风险评分 ${stressResult.stressRiskScore}`,
    );
  }

  return {
    batchId: batch.id,
    generatedAt: new Date().toISOString(),
    analysisSummary: {
      material: material?.name || getMaterialName(batch.materialId),
      riskLevel: stressResult.riskLevel,
      stressScore: stressResult.stressRiskScore,
      shrinkageRate: stressResult.shrinkageRate,
      keyIssues,
    },
    corrections,
    issues,
    confirmedBy,
    confirmedAt,
  };
};

export const exportReportAsJSON = (reportData: ReportData, filename: string): void => {
  const jsonStr = JSON.stringify(reportData, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `${filename}.json`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
};

export const generateReportHTML = (
  reportData: ReportData,
  batch: PrintBatch,
  stressResult: StressResult,
  suggestions: Suggestion[],
): string => {
  const material = getMaterialById(batch.materialId);

  const issuesHTML = reportData.issues
    .map(
      (issue) => `
    <div class="issue-item" style="margin-bottom: 12px; padding: 12px; background: #f5f5f5; border-left: 4px solid #f53f3f;">
      <div style="font-weight: bold;">${getIssueTypeLabel(issue.issueType)}</div>
      <div style="color: #333;">${issue.description}</div>
      <div style="font-size: 12px; color: #666; margin-top: 4px;">
        发现人: ${issue.discoveredBy} | ${new Date(issue.discoveredAt).toLocaleString('zh-CN')}
      </div>
    </div>
  `,
    )
    .join('');

  const correctionsHTML = reportData.corrections
    .map(
      (corr) => `
    <div class="correction-item" style="margin-bottom: 12px; padding: 12px; background: #f0f7ff; border-left: 4px solid #165dff;">
      <div style="font-weight: bold;">修正方案</div>
      <div style="color: #333;">${corr.suggestion}</div>
      <div style="font-size: 12px; color: #666; margin-top: 4px;">
        预期改善: ${corr.expectedImprovement}% | 修正人: ${corr.correctedBy} | ${new Date(corr.correctedAt).toLocaleString('zh-CN')}
      </div>
      ${
        corr.confirmationResult
          ? `
        <div style="margin-top: 8px; padding-top: 8px; border-top: 1px dashed #ddd;">
          <span style="color: ${corr.confirmationResult === 'pass' ? '#00b42a' : '#f53f3f'}; font-weight: bold;">
            ${corr.confirmationResult === 'pass' ? '✓ 确认通过' : '✗ 验证失败'}
          </span>
          ${
            corr.confirmedBy
              ? ` | 确认人: ${corr.confirmedBy} | ${new Date(corr.confirmedAt || '').toLocaleString('zh-CN')}`
              : ''
          }
          ${corr.notes ? `<div style="margin-top: 4px;">备注: ${corr.notes}</div>` : ''}
        </div>
      `
          : ''
      }
    </div>
  `,
    )
    .join('');

  const suggestionsHTML = suggestions
    .map(
      (sug) => `
    <div style="margin-bottom: 10px; padding: 10px; background: #fafff2; border-left: 4px solid #00b42a;">
      <div style="font-weight: bold;">${sug.title}</div>
      <div style="color: #333; font-size: 14px;">${sug.description}</div>
      <div style="font-size: 12px; color: #666; margin-top: 4px;">
        ${sug.parameter}: ${sug.currentValue} → ${sug.recommendedValue} | 预期改善: ${sug.expectedImprovement}%
      </div>
    </div>
  `,
    )
    .join('');

  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>3D打印翘曲热应力分析报告 - ${batch.id}</title>
  <style>
    body { font-family: 'Microsoft YaHei', Arial, sans-serif; margin: 40px; color: #333; }
    h1 { color: #165DFF; border-bottom: 3px solid #165DFF; padding-bottom: 10px; }
    h2 { color: #333; margin-top: 30px; border-left: 4px solid #165DFF; padding-left: 10px; }
    .param-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px; margin: 20px 0; }
    .param-item { background: #f9f9f9; padding: 10px; border-radius: 4px; }
    .param-label { font-size: 12px; color: #666; }
    .param-value { font-size: 16px; font-weight: bold; }
    .summary-box { background: linear-gradient(135deg, #165DFF, #00B42A); color: white; padding: 20px; border-radius: 8px; margin: 20px 0; }
    .summary-item { display: inline-block; margin-right: 40px; }
    .summary-label { font-size: 12px; opacity: 0.8; }
    .summary-value { font-size: 24px; font-weight: bold; }
    .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 12px; color: #666; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    td, th { border: 1px solid #ddd; padding: 8px; text-align: left; }
    th { background: #f5f5f5; }
    .risk-critical { color: #F53F3F; font-weight: bold; }
    .risk-high { color: #FF7D00; font-weight: bold; }
    .risk-medium { color: #FFAA00; font-weight: bold; }
    .risk-low { color: #00B42A; font-weight: bold; }
  </style>
</head>
<body>
  <h1>3D打印翘曲热应力分析报告</h1>
  
  <div class="summary-box">
    <div class="summary-item">
      <div class="summary-label">批次ID</div>
      <div class="summary-value">${batch.id}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">材料</div>
      <div class="summary-value">${material?.name || '未知'}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">风险等级</div>
      <div class="summary-value risk-${reportData.analysisSummary.riskLevel}">${getRiskLevelLabel(reportData.analysisSummary.riskLevel)}</div>
    </div>
    <div class="summary-item">
      <div class="summary-label">应力评分</div>
      <div class="summary-value">${stressResult.stressRiskScore}/100</div>
    </div>
  </div>

  <h2>打印参数</h2>
  <div class="param-grid">
    <div class="param-item"><div class="param-label">床温</div><div class="param-value">${batch.bedTemp}°C</div></div>
    <div class="param-item"><div class="param-label">喷嘴温度</div><div class="param-value">${batch.nozzleTemp}°C</div></div>
    <div class="param-item"><div class="param-label">环境温度</div><div class="param-value">${batch.ambientTemp}°C</div></div>
    <div class="param-item"><div class="param-label">冷却风扇</div><div class="param-value">${batch.coolingFanSpeed}%</div></div>
    <div class="param-item"><div class="param-label">模型宽度</div><div class="param-value">${batch.modelWidth}${batch.widthUnit}</div></div>
    <div class="param-item"><div class="param-label">模型高度</div><div class="param-value">${batch.modelHeight}${batch.heightUnit}</div></div>
    <div class="param-item"><div class="param-label">模型深度</div><div class="param-value">${batch.modelDepth}${batch.depthUnit}</div></div>
    <div class="param-item"><div class="param-label">打印速度</div><div class="param-value">${batch.printSpeed}mm/s</div></div>
  </div>

  <h2>分析结果</h2>
  <table>
    <tr><th>指标</th><th>数值</th><th>说明</th></tr>
    <tr><td>温差</td><td>${stressResult.temperatureDiff.toFixed(1)}°C</td><td>喷嘴温度 - 环境温度</td></tr>
    <tr><td>收缩率</td><td>${stressResult.shrinkageRate.toFixed(2)}%</td><td>基于热膨胀系数计算</td></tr>
    <tr><td>总收缩量</td><td>${stressResult.totalShrinkage.toFixed(2)}mm</td><td>最大尺寸方向的收缩量</td></tr>
    <tr><td>冷却速率</td><td>${stressResult.coolingRate.toFixed(2)}</td><td>综合冷却强度指标</td></tr>
    <tr><td>应力风险评分</td><td class="risk-${stressResult.riskLevel}">${stressResult.stressRiskScore}</td><td>0-100，越高风险越大</td></tr>
  </table>

  <h2>主要问题 (${reportData.analysisSummary.keyIssues.length}项)</h2>
  <ul>
    ${reportData.analysisSummary.keyIssues.map((i) => `<li>${i}</li>`).join('')}
  </ul>

  <h2>问题追踪记录</h2>
  ${issuesHTML || '<p>暂无问题记录</p>'}

  <h2>修正方案</h2>
  ${correctionsHTML || '<p>暂无修正方案</p>'}

  <h2>优化建议</h2>
  ${suggestionsHTML || '<p>当前参数设置合理，暂无优化建议</p>'}

  <h2>各维度收缩量</h2>
  <table>
    <tr><th>维度</th><th>原尺寸</th><th>收缩量</th><th>收缩后尺寸</th></tr>
    <tr><td>宽度</td><td>${batch.modelWidth}${batch.widthUnit}</td><td>${stressResult.shrinkageByDimension.width.toFixed(2)}mm</td><td>${(batch.modelWidth - stressResult.shrinkageByDimension.width).toFixed(2)}mm</td></tr>
    <tr><td>高度</td><td>${batch.modelHeight}${batch.heightUnit}</td><td>${stressResult.shrinkageByDimension.height.toFixed(2)}mm</td><td>${(batch.modelHeight - stressResult.shrinkageByDimension.height).toFixed(2)}mm</td></tr>
    <tr><td>深度</td><td>${batch.modelDepth}${batch.depthUnit}</td><td>${stressResult.shrinkageByDimension.depth.toFixed(2)}mm</td><td>${(batch.modelDepth - stressResult.shrinkageByDimension.depth).toFixed(2)}mm</td></tr>
  </table>

  <div class="footer">
    <p>报告生成时间: ${new Date(reportData.generatedAt).toLocaleString('zh-CN')}</p>
    <p>批次创建时间: ${new Date(batch.createdAt).toLocaleString('zh-CN')} | 创建人: ${batch.createdBy}</p>
    ${
      reportData.confirmedBy
        ? `<p>确认人: ${reportData.confirmedBy} | 确认时间: ${new Date(reportData.confirmedAt || '').toLocaleString('zh-CN')}</p>`
        : ''
    }
  </div>
</body>
</html>
`;
};

export const exportReportAsHTML = (
  reportData: ReportData,
  batch: PrintBatch,
  stressResult: StressResult,
  suggestions: Suggestion[],
  filename: string,
): void => {
  const html = generateReportHTML(reportData, batch, stressResult, suggestions);
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.download = `${filename}.html`;
  link.href = url;
  link.click();

  URL.revokeObjectURL(url);
};
