import { ExportOptions } from '../types';
import { exportReports } from '../systems/battleReport';
import { addHistory } from '../store/localStorage';
import { getFilteredReports, getState } from '../store/gameStore';

function setStatus(msg: string): void {
  const bar = document.getElementById('status-bar');
  if (bar) bar.textContent = msg;
}

export function initExportPanel(): void {
  renderExportPanel();
}

export function renderExportPanel(): void {
  const container = document.getElementById('panel-export');
  if (!container) return;

  const filteredReports = getFilteredReports();
  const filter = getState().currentFilter;

  container.innerHTML = `
    <div class="section-title">导出复盘报告</div>
    <div class="field-label">当前筛选范围</div>
    <div class="field-value">共 ${filteredReports.length} 条战报将纳入导出</div>

    <div class="field-label">导出格式</div>
    <div class="export-format-row">
      <label style="color:#e0e0e0;font-size:13px;">
        <input type="radio" name="export-format" value="text" checked /> 文本报告
      </label>
      <label style="color:#e0e0e0;font-size:13px;">
        <input type="radio" name="export-format" value="json" /> JSON
      </label>
      <label style="color:#e0e0e0;font-size:13px;">
        <input type="radio" name="export-format" value="csv" /> CSV
      </label>
    </div>

    <div class="field-label">内容选项</div>
    <div style="margin-bottom:8px;">
      <label style="color:#e0e0e0;font-size:13px;">
        <input type="checkbox" id="export-include-reasons" checked /> 包含判断理由
      </label>
    </div>
    <div style="margin-bottom:12px;">
      <label style="color:#e0e0e0;font-size:13px;">
        <input type="checkbox" id="export-include-nextsteps" checked /> 包含下一步建议
      </label>
    </div>

    <button class="btn btn-success" id="export-generate-btn" style="margin-bottom:12px;">生成报告</button>
    <button class="btn btn-primary" id="export-download-btn" style="margin-bottom:12px;">下载文件</button>

    <div class="section-title">报告预览</div>
    <div id="export-preview" style="background:#0a0a1e;border:1px solid #0f3460;border-radius:4px;padding:8px;max-height:400px;overflow-y:auto;font-family:'Consolas',monospace;font-size:12px;color:#a0a0c0;white-space:pre-wrap;">点击"生成报告"预览内容</div>
  `;

  let lastGenerated = '';

  document.getElementById('export-generate-btn')?.addEventListener('click', () => {
    const format = (document.querySelector('input[name="export-format"]:checked') as HTMLInputElement)?.value as ExportOptions['format'] || 'text';
    const includeReasons = (document.getElementById('export-include-reasons') as HTMLInputElement)?.checked ?? true;
    const includeNextSteps = (document.getElementById('export-include-nextsteps') as HTMLInputElement)?.checked ?? true;

    const options: ExportOptions = {
      format,
      includeReasons,
      includeNextSteps,
      filter: getState().currentFilter,
    };

    lastGenerated = exportReports(options);
    const preview = document.getElementById('export-preview');
    if (preview) {
      preview.textContent = lastGenerated;
    }

    addHistory('export', `导出${format.toUpperCase()}报告，${filteredReports.length} 条战报`, {
      id: '__export__',
      createdAt: Date.now(),
      scenarioName: '导出操作',
      units: [],
      turnOrder: { entries: [], overallReason: '', nextStepSuggestion: '', checksum: '' },
      corrected: false,
      correctionNote: '',
      version: 1,
    });

    setStatus(`报告已生成，${filteredReports.length} 条战报`);
  });

  document.getElementById('export-download-btn')?.addEventListener('click', () => {
    if (!lastGenerated) {
      setStatus('请先生成报告');
      return;
    }

    const format = (document.querySelector('input[name="export-format"]:checked') as HTMLInputElement)?.value || 'text';
    const ext = format === 'json' ? 'json' : format === 'csv' ? 'csv' : 'txt';
    const mime = format === 'json' ? 'application/json' : format === 'csv' ? 'text/csv' : 'text/plain';

    const blob = new Blob([lastGenerated], { type: `${mime};charset=utf-8` });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `蒸汽工厂战棋_复盘报告_${new Date().toISOString().slice(0, 10)}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);

    setStatus('文件已下载');
  });
}
