import { JobConfig, PreflightIssue } from './types';
import { parseJobJson, parseRulesYaml } from './parser';
import { CanvasRenderer } from './renderer';
import { InteractiveController } from './interactive';
import { preflightCheck } from './geometry';
import { downloadJson, downloadMarkdown } from './exporter';
import { calculateWorkpiecePosition } from './geometry';
import sampleJobJson from '../data/sample.job.json';
import sampleRulesYaml from '../data/sample.rules.yaml?raw';

let config: JobConfig;
let controller: InteractiveController | null = null;

function loadSampleData(): void {
  const { config: jobConfig, issues } = parseJobJson(JSON.stringify(sampleJobJson));
  const { rules, issues: ruleIssues } = parseRulesYaml(sampleRulesYaml);
  
  console.log('Loaded sample data');
  console.log('Job issues:', issues);
  console.log('Rules:', rules);
  console.log('Rule issues:', ruleIssues);
  
  initApp(jobConfig);
}

function initApp(jobConfig: JobConfig): void {
  config = jobConfig;
  
  const canvas = document.getElementById('canvas') as HTMLCanvasElement;
  const renderer = new CanvasRenderer(canvas);
  controller = new InteractiveController(renderer, config, () => {
    controller?.render();
    updatePreflight();
  });
  
  config.workpieces.forEach((wp, index) => {
    const pos = calculateWorkpiecePosition(index, config);
    wp.x = pos.x + toMM(wp.width) / 2;
    wp.y = pos.y + toMM(wp.height) / 2;
  });
  
  controller.render();
  updatePreflight();
}

function toMM(value: { value: number; unit: string }): number {
  switch (value.unit) {
    case 'in': return value.value * 25.4;
    case 'pt': return (value.value / 72) * 25.4;
    default: return value.value;
  }
}

function updatePreflight(): void {
  const result = preflightCheck(config);
  const preflightDiv = document.getElementById('preflight-results') as HTMLDivElement;
  const statusDiv = document.getElementById('preflight-status') as HTMLDivElement;
  
  let html = '';
  
  if (result.errors.length > 0) {
    statusDiv.innerHTML = '<span style="color: red;">❌ 预检未通过</span>';
    html += '<h3>❌ 错误</h3>';
    html += '<ul>';
    result.errors.forEach(issue => {
      html += `<li><strong>${issue.code}</strong>: ${issue.message}`;
      if (issue.details) {
        html += `<br><small>${issue.details}</small>`;
      }
      html += '</li>';
    });
    html += '</ul>';
  } else {
    statusDiv.innerHTML = '<span style="color: green;">✅ 预检通过</span>';
  }
  
  if (result.warnings.length > 0) {
    html += '<h3>⚠️ 警告</h3>';
    html += '<ul>';
    result.warnings.forEach(issue => {
      html += `<li><strong>${issue.code}</strong>: ${issue.message}`;
      if (issue.details) {
        html += `<br><small>${issue.details}</small>`;
      }
      html += '</li>';
    });
    html += '</ul>';
  }
  
  if (result.errors.length === 0 && result.warnings.length === 0) {
    html += '<p>所有检查通过，拼版方案可以发版。</p>';
  }
  
  preflightDiv.innerHTML = html;
}

function handleJobFileUpload(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    const { config: jobConfig, issues } = parseJobJson(content);
    
    if (issues.some(i => i.type === 'error')) {
      alert(`加载失败:\n${issues.filter(i => i.type === 'error').map(i => i.message).join('\n')}`);
      return;
    }
    
    initApp(jobConfig);
    updatePreflight();
  };
  reader.readAsText(file);
}

function handleRulesFileUpload(event: Event): void {
  const input = event.target as HTMLInputElement;
  const file = input.files?.[0];
  
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = (e) => {
    const content = e.target?.result as string;
    const { rules, issues } = parseRulesYaml(content);
    
    console.log('Loaded rules:', rules);
    console.log('Rule issues:', issues);
    
    if (issues.some(i => i.type === 'error')) {
      alert(`规则文件加载失败:\n${issues.filter(i => i.type === 'error').map(i => i.message).join('\n')}`);
    }
  };
  reader.readAsText(file);
}

function handleExportJson(): void {
  if (config) {
    downloadJson(config);
  }
}

function handleExportMarkdown(): void {
  if (config) {
    const result = preflightCheck(config);
    downloadMarkdown(config, result);
  }
}

function handleRotateLeft(): void {
  controller?.rotateSelectedWorkpiece(-90);
}

function handleRotateRight(): void {
  controller?.rotateSelectedWorkpiece(90);
}

function handleToggleBleed(): void {
  const checkbox = document.getElementById('toggle-bleed') as HTMLInputElement;
  controller?.setOptions({ showBleed: checkbox.checked });
}

function handleToggleSafe(): void {
  const checkbox = document.getElementById('toggle-safe') as HTMLInputElement;
  controller?.setOptions({ showSafeMargin: checkbox.checked });
}

function handleToggleGrid(): void {
  const checkbox = document.getElementById('toggle-grid') as HTMLInputElement;
  controller?.setOptions({ showGrid: checkbox.checked });
}

function handleToggleLabels(): void {
  const checkbox = document.getElementById('toggle-labels') as HTMLInputElement;
  controller?.setOptions({ showLabels: checkbox.checked });
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('job-file')?.addEventListener('change', handleJobFileUpload);
  document.getElementById('rules-file')?.addEventListener('change', handleRulesFileUpload);
  document.getElementById('export-json')?.addEventListener('click', handleExportJson);
  document.getElementById('export-markdown')?.addEventListener('click', handleExportMarkdown);
  document.getElementById('rotate-left')?.addEventListener('click', handleRotateLeft);
  document.getElementById('rotate-right')?.addEventListener('click', handleRotateRight);
  document.getElementById('toggle-bleed')?.addEventListener('change', handleToggleBleed);
  document.getElementById('toggle-safe')?.addEventListener('change', handleToggleSafe);
  document.getElementById('toggle-grid')?.addEventListener('change', handleToggleGrid);
  document.getElementById('toggle-labels')?.addEventListener('change', handleToggleLabels);
  document.getElementById('load-sample')?.addEventListener('click', loadSampleData);
  
  loadSampleData();
});
