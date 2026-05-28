import { Session, ReportData, SynthParams, Preset, HistoryItem, Score, Warning } from '../types/synth';
import { generateSoundDescription, generateRecommendations } from './scoring';

export function exportConfigAsJson(params: SynthParams): string {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    type: 'config',
    params,
  };
  return JSON.stringify(exportData, null, 2);
}

export function exportSessionAsJson(session: Session): string {
  const exportData = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    type: 'session',
    session,
  };
  return JSON.stringify(exportData, null, 2);
}

export function generateReportData(
  session: Session,
  warnings: Warning[]
): ReportData {
  return {
    sessionId: session.id,
    createdAt: session.updatedAt,
    score: session.currentScore,
    finalParams: session.params,
    history: session.history,
    warnings,
    presetsSaved: session.presets.length,
    soundDescription: generateSoundDescription(session.params),
    recommendations: generateRecommendations(session.currentScore),
  };
}

export function exportReportAsText(report: ReportData): string {
  const lines: string[] = [];
  const date = new Date(report.createdAt).toLocaleString('zh-CN');

  lines.push('========================================');
  lines.push('      声音合成实验室 - 音色分析报告');
  lines.push('========================================');
  lines.push('');
  lines.push(`会话ID: ${report.sessionId}`);
  lines.push(`生成时间: ${date}`);
  lines.push('');

  lines.push('----------------------------------------');
  lines.push('                综合评分');
  lines.push('----------------------------------------');
  lines.push('');
  lines.push(`总分: ${report.score.total} / 100`);
  lines.push('');
  lines.push(`  音色丰富度: ${report.score.dimensions.richness} / 25`);
  lines.push(`  参数合理性: ${report.score.dimensions.reasonableness} / 25`);
  lines.push(`  操作流畅度: ${report.score.dimensions.fluency} / 20`);
  lines.push(`  探索广度:   ${report.score.dimensions.exploration} / 20`);
  lines.push(`  风险控制:   ${report.score.dimensions.riskControl} / 10`);
  lines.push('');

  lines.push('----------------------------------------');
  lines.push('              音色描述');
  lines.push('----------------------------------------');
  lines.push('');
  lines.push(report.soundDescription);
  lines.push('');

  lines.push('----------------------------------------');
  lines.push('            最终参数配置');
  lines.push('----------------------------------------');
  lines.push('');
  lines.push('[振荡器]');
  lines.push(`  波形: ${report.finalParams.oscillator.waveform}`);
  lines.push(`  频率: ${report.finalParams.oscillator.frequency} Hz`);
  lines.push(`  失谐: ${report.finalParams.oscillator.detune} cents`);
  lines.push('');
  lines.push('[滤波器]');
  lines.push(`  类型: ${report.finalParams.filter.type}`);
  lines.push(`  截止频率: ${report.finalParams.filter.cutoff} Hz`);
  lines.push(`  谐振: ${report.finalParams.filter.resonance}`);
  lines.push(`  包络量: ${report.finalParams.filter.envelopeAmount}`);
  lines.push('');
  lines.push('[包络]');
  lines.push(`  Attack:  ${report.finalParams.envelope.attack}s`);
  lines.push(`  Decay:   ${report.finalParams.envelope.decay}s`);
  lines.push(`  Sustain: ${report.finalParams.envelope.sustain}`);
  lines.push(`  Release: ${report.finalParams.envelope.release}s`);
  lines.push('');
  lines.push('[LFO]');
  lines.push(`  波形: ${report.finalParams.lfo.waveform}`);
  lines.push(`  速率: ${report.finalParams.lfo.rate} Hz`);
  lines.push(`  深度: ${report.finalParams.lfo.depth}`);
  lines.push(`  目标: ${report.finalParams.lfo.target}`);
  lines.push('');
  lines.push('[主控]');
  lines.push(`  音量: ${report.finalParams.master.volume}`);
  lines.push('');

  lines.push('----------------------------------------');
  lines.push('            操作统计');
  lines.push('----------------------------------------');
  lines.push('');
  lines.push(`总操作次数: ${report.score.stats.totalOperations}`);
  lines.push(`使用过的波形: ${report.score.stats.waveformsUsed.join(', ')}`);
  lines.push(`使用过的滤波类型: ${report.score.stats.filterTypesUsed.join(', ')}`);
  lines.push(`使用过的LFO目标: ${report.score.stats.lfoTargetsUsed.join(', ')}`);
  lines.push(`探索过的参数: ${report.score.stats.paramsTouched.length} / 13`);
  lines.push(`警告次数: ${report.warnings.length}`);
  lines.push(`保存预设数: ${report.presetsSaved}`);
  lines.push('');

  if (report.warnings.length > 0) {
    lines.push('----------------------------------------');
    lines.push('              警告记录');
    lines.push('----------------------------------------');
    lines.push('');
    report.warnings.forEach((w, i) => {
      lines.push(`${i + 1}. [${w.severity}] ${w.message}`);
    });
    lines.push('');
  }

  lines.push('----------------------------------------');
  lines.push('            改进建议');
  lines.push('----------------------------------------');
  lines.push('');
  report.recommendations.forEach((r, i) => {
    lines.push(`${i + 1}. ${r}`);
  });
  lines.push('');

  lines.push('========================================');
  lines.push('          报告结束');
  lines.push('========================================');

  return lines.join('\n');
}

export function exportReportAsJson(report: ReportData): string {
  return JSON.stringify(report, null, 2);
}

export function downloadFile(content: string, filename: string, mimeType: string): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadConfig(params: SynthParams): void {
  const json = exportConfigAsJson(params);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadFile(json, `synth-config-${timestamp}.json`, 'application/json');
}

export function downloadSession(session: Session): void {
  const json = exportSessionAsJson(session);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  downloadFile(json, `synth-session-${timestamp}.synthsession.json`, 'application/json');
}

export function downloadReport(report: ReportData, format: 'txt' | 'json'): void {
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  if (format === 'txt') {
    const text = exportReportAsText(report);
    downloadFile(text, `synth-report-${timestamp}.txt`, 'text/plain');
  } else {
    const json = exportReportAsJson(report);
    downloadFile(json, `synth-report-${timestamp}.json`, 'application/json');
  }
}

export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsText(file);
  });
}
