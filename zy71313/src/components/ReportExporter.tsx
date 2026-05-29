import { Download, FileText, AlertTriangle, CheckCircle2, Clock, X } from 'lucide-react';
import { useState } from 'react';
import { useFlowStore } from '@/store/useFlowStore';
import { getFlowRegimeLabel, formatRe } from '@/utils/calculator';
import type { SampleRecord } from '@/types';

export default function ReportExporter() {
  const {
    pipeDiameter,
    velocity,
    density,
    viscosity,
    temperature,
    result,
    currentSampleName,
    calculationTime,
  } = useFlowStore();

  const [showPreview, setShowPreview] = useState(false);
  const [loading, setLoading] = useState(false);

  const canExport = result !== null && result.canCalculate;

  const handleExport = async () => {
    setLoading(true);

    setTimeout(() => {
      const reportHtml = generateReportHtml();
      const blob = new Blob([reportHtml], { type: 'text/html;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `雷诺数判别报告_${calculationTime ? calculationTime.replace(/[:\s]/g, '-') : Date.now()}.html`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setLoading(false);
      setShowPreview(false);
    }, 500);
  };

  const generateReportHtml = () => {
    if (!result) return '';

    const anomaliesHtml = result.anomalies.length > 0
      ? `
        <div class="section">
          <h3>⚠️ 异常标注</h3>
          <table class="data-table">
            <thead>
              <tr><th>字段</th><th>问题描述</th><th>严重程度</th><th>修正建议</th></tr>
            </thead>
            <tbody>
              ${result.anomalies.map(a => `
                <tr>
                  <td>${a.fieldLabel}</td>
                  <td>${a.message}</td>
                  <td class="${a.severity === 'error' ? 'severity-error' : 'severity-warning'}">
                    ${a.severity === 'error' ? '错误' : '警告'}
                  </td>
                  <td>${a.suggestion}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `
      : `<div class="section"><h3>✓ 数据完整性</h3><p>所有参数完整，无异常。</p></div>`;

    const todoHtml = currentSampleName === '待补资料记录'
      ? `
        <div class="section">
          <h3>📋 待办事项</h3>
          <ul>
            <li>确认黏度单位是否应为 mPa·s</li>
            <li>补充实验温度数据</li>
          </ul>
        </div>
      `
      : '';

    const finalConclusion = result.anomalies.length === 0
      ? `
        <div class="conclusion-box conclusion-good">
          <h4>最终结论</h4>
          <p>Re = <strong>${result.reynoldsNumber !== null ? formatRe(result.reynoldsNumber) : '—'}</strong>，判定为 <strong>${result.flowRegime ? getFlowRegimeLabel(result.flowRegime) : ''}</strong>。</p>
          <p class="note">数据完整，计算有效，可直接使用此结果。</p>
        </div>
      `
      : `
        <div class="conclusion-box conclusion-caution">
          <h4>最终结论（待确认）</h4>
          <p>基于当前数据，Re = <strong>${result.reynoldsNumber !== null ? formatRe(result.reynoldsNumber) : '—'}</strong>，判定为 <strong>${result.flowRegime ? getFlowRegimeLabel(result.flowRegime) : ''}</strong>。</p>
          <p class="note">存在 ${result.anomalies.length} 处异常，修正后建议重新计算以确认最终结论。</p>
        </div>
      `;

    return `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>流体雷诺数判别报告</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Noto Sans SC', -apple-system, sans-serif;
      background: #f4f4f5;
      padding: 40px 20px;
      color: #18181b;
      line-height: 1.6;
    }
    .report-container {
      max-width: 800px;
      margin: 0 auto;
      background: white;
      padding: 60px;
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0,0,0,0.08);
    }
    .report-header {
      text-align: center;
      padding-bottom: 30px;
      border-bottom: 3px double #0D7377;
      margin-bottom: 30px;
    }
    .report-header h1 {
      font-size: 28px;
      color: #0D7377;
      margin-bottom: 8px;
    }
    .report-header .subtitle {
      color: #71717a;
      font-size: 14px;
    }
    .report-meta {
      display: flex;
      justify-content: space-between;
      font-size: 13px;
      color: #52525b;
      margin-bottom: 30px;
      padding: 12px 20px;
      background: #f4f4f5;
      border-radius: 8px;
    }
    .section {
      margin-bottom: 25px;
    }
    .section h3 {
      color: #0D7377;
      font-size: 16px;
      margin-bottom: 12px;
      padding-bottom: 6px;
      border-bottom: 1px solid #e4e4e7;
    }
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 14px;
    }
    .data-table th, .data-table td {
      padding: 10px 14px;
      text-align: left;
      border-bottom: 1px solid #e4e4e7;
    }
    .data-table th {
      background: #fafafa;
      font-weight: 600;
      color: #3f3f46;
    }
    .data-table tr:hover td {
      background: #fafafa;
    }
    .result-box {
      text-align: center;
      padding: 30px;
      background: linear-gradient(135deg, #f0fdf4, #ccfbf1);
      border-radius: 10px;
      margin: 20px 0;
    }
    .result-box .re-value {
      font-size: 48px;
      font-weight: bold;
      color: #0D7377;
      margin: 8px 0;
    }
    .result-box .re-label {
      font-size: 13px;
      color: #0f766e;
    }
    .regime-badge {
      display: inline-block;
      padding: 6px 18px;
      border-radius: 20px;
      font-weight: 600;
      margin-top: 10px;
    }
    .regime-laminar { background: #dcfce7; color: #166534; }
    .regime-transitional { background: #fef3c7; color: #92400e; }
    .regime-turbulent { background: #fee2e2; color: #991b1b; }
    .conversion-list {
      list-style: none;
      font-family: monospace;
      font-size: 13px;
      color: #3f3f46;
    }
    .conversion-list li {
      padding: 6px 0;
      border-bottom: 1px dashed #e4e4e7;
    }
    .formula-box {
      background: #fafafa;
      padding: 15px 20px;
      border-left: 4px solid #0D7377;
      font-family: monospace;
      font-size: 14px;
      margin: 10px 0;
    }
    .severity-error { color: #dc2626; font-weight: 600; }
    .severity-warning { color: #d97706; font-weight: 600; }
    .conclusion-box {
      padding: 20px;
      border-radius: 8px;
      margin-top: 20px;
    }
    .conclusion-box h4 {
      margin-bottom: 10px;
      font-size: 15px;
    }
    .conclusion-good {
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
    }
    .conclusion-good h4 { color: #166534; }
    .conclusion-caution {
      background: #fffbeb;
      border: 1px solid #fcd34d;
    }
    .conclusion-caution h4 { color: #92400e; }
    .note {
      font-size: 13px;
      color: #71717a;
      margin-top: 8px;
    }
    ul { padding-left: 20px; }
    li { margin-bottom: 4px; }
    .report-footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #e4e4e7;
      text-align: center;
      color: #a1a1aa;
      font-size: 12px;
    }
    @media print {
      body { background: white; padding: 0; }
      .report-container { box-shadow: none; border-radius: 0; }
    }
  </style>
</head>
<body>
  <div class="report-container">
    <div class="report-header">
      <h1>流体雷诺数判别报告</h1>
      <p class="subtitle">流体流态自动判别分析</p>
    </div>

    <div class="report-meta">
      <span>生成时间：${calculationTime ?? '未知'}</span>
      ${currentSampleName ? `<span>数据来源：${currentSampleName}</span>` : '<span>数据来源：手动输入</span>'}
    </div>

    <div class="section">
      <h3>📊 输入参数</h3>
      <table class="data-table">
        <thead>
          <tr><th>参数</th><th>符号</th><th>值</th><th>单位</th></tr>
        </thead>
        <tbody>
          <tr><td>管径</td><td>d</td><td>${pipeDiameter.value ?? '—'}</td><td>${pipeDiameter.unit}</td></tr>
          <tr><td>流速</td><td>v</td><td>${velocity.value ?? '—'}</td><td>${velocity.unit}</td></tr>
          <tr><td>密度</td><td>ρ</td><td>${density.value ?? '—'}</td><td>${density.unit}</td></tr>
          <tr><td>黏度</td><td>μ</td><td>${viscosity.value ?? '—'}</td><td>${viscosity.unit}</td></tr>
          <tr><td>温度</td><td>T</td><td>${temperature.value ?? '—'}</td><td>${temperature.unit}</td></tr>
        </tbody>
      </table>
    </div>

    <div class="section">
      <h3>🔄 单位换算</h3>
      <ul class="conversion-list">
        ${result.conversionSteps.map(s => `<li>${s.parameterLabel}：${s.formula}</li>`).join('')}
      </ul>
    </div>

    <div class="section">
      <h3>🔢 雷诺数计算</h3>
      <div class="formula-box">
        Re = ρ · v · d / μ
      </div>
      <div class="result-box">
        <div class="re-label">雷诺数 Re</div>
        <div class="re-value">${result.reynoldsNumber !== null ? formatRe(result.reynoldsNumber) : '—'}</div>
        <span class="regime-badge regime-${result.flowRegime ?? 'laminar'}">
          ${result.flowRegime ? getFlowRegimeLabel(result.flowRegime) : ''}
        </span>
      </div>
    </div>

    <div class="section">
      <h3>📈 流态判定标准</h3>
      <table class="data-table">
        <thead>
          <tr><th>范围</th><th>流态</th><th>说明</th></tr>
        </thead>
        <tbody>
          <tr><td>Re &lt; 2000</td><td>层流</td><td>流体分层流动，互不混合</td></tr>
          <tr class="${result.isCritical ? 'bg-amber-50' : ''}"><td>2000 ≤ Re ≤ 4000</td><td>过渡区</td><td>流态不稳定</td></tr>
          <tr><td>Re &gt; 4000</td><td>紊流</td><td>流体混合剧烈</td></tr>
        </tbody>
      </table>
    </div>

    ${anomaliesHtml}
    ${todoHtml}
    ${finalConclusion}

    <div class="report-footer">
      <p>报告由「流体雷诺数判别」工具自动生成</p>
    </div>
  </div>
</body>
</html>`;
  };

  return (
    <>
      <button
        onClick={() => setShowPreview(true)}
        disabled={!canExport}
        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all group"
      >
        <Download className="w-4 h-4 group-hover:scale-110 transition-transform" />
        <span>导出报告</span>
      </button>

      {showPreview && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="flex items-center justify-between p-5 border-b border-zinc-100">
              <h3 className="text-lg font-bold text-zinc-800 flex items-center gap-2" style={{ fontFamily: '"LXGW WenKai", "Noto Sans SC", serif' }}>
                <FileText className="w-5 h-5 text-teal-700" />
                判别报告预览
              </h3>
              <button
                onClick={() => setShowPreview(false)}
                className="p-1.5 rounded-lg hover:bg-zinc-100 text-zinc-400 hover:text-zinc-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-zinc-50">
              {result && result.canCalculate && (
                <div className="space-y-4">
                  <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100">
                    <div className="flex items-center gap-3 mb-4">
                      <CheckCircle2 className="w-5 h-5 text-emerald-500" />
                      <span className="text-sm font-medium text-zinc-800">计算结果</span>
                    </div>
                    <div className="text-center py-4 bg-gradient-to-br from-zinc-50 to-teal-50 rounded-lg mb-4">
                      <div className="text-xs text-teal-600 mb-1">Re</div>
                      <div className="text-3xl font-bold text-teal-800">
                        {result.reynoldsNumber !== null ? formatRe(result.reynoldsNumber) : '—'}
                      </div>
                      <div className="mt-2 text-sm font-semibold">
                        {result.flowRegime ? getFlowRegimeLabel(result.flowRegime) : ''}
                      </div>
                    </div>
                  </div>

                  {result.anomalies.length > 0 && (
                    <div className="bg-amber-50 rounded-xl p-5 border border-amber-200">
                      <div className="flex items-center gap-3 mb-3">
                        <AlertTriangle className="w-5 h-5 text-amber-500" />
                        <span className="text-sm font-medium text-amber-800">
                          {result.anomalies.length} 处异常需要注意
                        </span>
                      </div>
                      <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                        {result.anomalies.map((a, i) => (
                          <li key={i}>{a.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {currentSampleName === '待补资料记录' && (
                    <div className="bg-orange-50 rounded-xl p-5 border border-orange-200">
                      <div className="flex items-center gap-3 mb-3">
                        <Clock className="w-5 h-5 text-orange-500" />
                        <span className="text-sm font-medium text-orange-800">待办事项</span>
                      </div>
                      <ul className="text-sm text-orange-700 space-y-1 list-disc list-inside">
                        <li>确认黏度单位是否应为 mPa·s</li>
                        <li>补充实验温度数据</li>
                      </ul>
                    </div>
                  )}

                  <div className="bg-white rounded-xl p-5 shadow-sm border border-zinc-100 text-sm text-zinc-600">
                    <p className="font-medium text-zinc-800 mb-2">报告包含内容：</p>
                    <ul className="list-disc list-inside space-y-1">
                      <li>输入参数汇总表</li>
                      <li>单位换算过程</li>
                      <li>雷诺数计算公式与结果</li>
                      <li>流态判定标准对比</li>
                      <li>异常标注与修正建议</li>
                      <li>待办事项（如适用）</li>
                      <li>最终结论</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-3 p-4 border-t border-zinc-100 bg-white">
              <button
                onClick={() => setShowPreview(false)}
                className="px-4 py-2 text-sm rounded-lg border border-zinc-200 text-zinc-600 hover:bg-zinc-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleExport}
                disabled={loading}
                className="flex items-center gap-2 px-5 py-2 text-sm font-medium rounded-lg bg-teal-700 text-white hover:bg-teal-800 disabled:opacity-70 transition-colors"
              >
                {loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    导出中...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    下载 HTML 报告
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
