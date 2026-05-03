import { AppState, Risk } from '../types';
import { store } from '../store';

type ExportFormat = 'markdown' | 'json';

let selectedFormat: ExportFormat = 'markdown';

export function showExportModal(state: AppState): void {
  const container = document.getElementById('export-modal-container');
  if (!container) return;

  const validationResult = store.getValidationResult();

  container.innerHTML = `
    <div class="modal-overlay" id="export-modal-overlay">
      <div class="modal" style="max-width: 700px;">
        <header class="modal-header">
          <h3>导出复核报告</h3>
          <button class="modal-close" id="export-modal-close">&times;</button>
        </header>
        <div class="modal-body">
          <div style="margin-bottom: 20px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">选择导出格式</label>
            <div style="display: flex; gap: 12px;">
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="export-format" value="markdown" ${selectedFormat === 'markdown' ? 'checked' : ''} />
                <span>Markdown</span>
              </label>
              <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                <input type="radio" name="export-format" value="json" ${selectedFormat === 'json' ? 'checked' : ''} />
                <span>JSON</span>
              </label>
            </div>
          </div>
          
          <div style="margin-bottom: 16px;">
            <label style="display: block; margin-bottom: 8px; font-weight: 500;">预览</label>
            <div id="export-preview" style="
              background: var(--bg-tertiary);
              border-radius: 8px;
              padding: 16px;
              font-family: 'SF Mono', Monaco, monospace;
              font-size: 0.75rem;
              max-height: 300px;
              overflow-y: auto;
              white-space: pre-wrap;
              word-break: break-all;
            ">${generatePreview(state, validationResult)}</div>
          </div>
        </div>
        <footer class="modal-footer">
          <button class="btn btn-secondary" id="export-modal-cancel">取消</button>
          <button class="btn btn-primary" id="export-modal-download">
            📥 下载报告
          </button>
        </footer>
      </div>
    </div>
  `;

  setupModalEventListeners(state, validationResult);
}

function setupModalEventListeners(
  state: AppState,
  validationResult: ReturnType<typeof store.getValidationResult>
): void {
  document.getElementById('export-modal-close')?.addEventListener('click', closeExportModal);
  document.getElementById('export-modal-cancel')?.addEventListener('click', closeExportModal);
  document.getElementById('export-modal-overlay')?.addEventListener('click', (e) => {
    if (e.target === e.currentTarget) {
      closeExportModal();
    }
  });

  const radioButtons = document.querySelectorAll('input[name="export-format"]');
  radioButtons.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      selectedFormat = target.value as ExportFormat;
      const preview = document.getElementById('export-preview');
      if (preview) {
        preview.textContent = generatePreview(state, validationResult);
      }
    });
  });

  document.getElementById('export-modal-download')?.addEventListener('click', () => {
    const content = generateExportContent(state, validationResult);
    downloadFile(content, selectedFormat);
    closeExportModal();
  });
}

function closeExportModal(): void {
  const container = document.getElementById('export-modal-container');
  if (container) {
    container.innerHTML = '';
  }
}

function generatePreview(
  state: AppState,
  validationResult: ReturnType<typeof store.getValidationResult>
): string {
  if (selectedFormat === 'json') {
    const jsonData = generateJSONReport(state, validationResult);
    return JSON.stringify(jsonData, null, 2).substring(0, 2000) + '\n... (更多内容已省略)';
  }
  return generateMarkdownReport(state, validationResult).substring(0, 2000) + '\n... (更多内容已省略)';
}

function generateExportContent(
  state: AppState,
  validationResult: ReturnType<typeof store.getValidationResult>
): string {
  if (selectedFormat === 'json') {
    return JSON.stringify(generateJSONReport(state, validationResult), null, 2);
  }
  return generateMarkdownReport(state, validationResult);
}

function generateMarkdownReport(
  state: AppState,
  validationResult: ReturnType<typeof store.getValidationResult>
): string {
  const now = new Date();
  const timestamp = now.toLocaleString('zh-CN');

  let report = `# 剧院舞台灯光 Cue 表复核报告

> 生成时间: ${timestamp}

---

## 📊 概览

| 项目 | 数量 |
|------|------|
| 灯具 | ${state.fixtures.length} |
| Cue | ${state.cues.length} |
| 总风险 | ${validationResult?.summary.total || 0} |
| 严重风险 | ${validationResult?.summary.critical || 0} |
| 警告 | ${validationResult?.summary.warning || 0} |
| 提示 | ${validationResult?.summary.info || 0} |

`;

  if (validationResult && validationResult.risks.length > 0) {
    const criticalRisks = validationResult.risks.filter((r) => r.severity === 'critical');
    const warningRisks = validationResult.risks.filter((r) => r.severity === 'warning');
    const infoRisks = validationResult.risks.filter((r) => r.severity === 'info');

    report += `---

## ⚠️ 风险清单

`;

    if (criticalRisks.length > 0) {
      report += `### 🔴 严重风险 (${criticalRisks.length})

`;
      criticalRisks.forEach((risk, index) => {
        report += `${index + 1}. **${risk.message}**
   - 类型: ${getRiskTypeLabel(risk.type)}
   ${risk.cueNumber ? `- 关联 Cue: #${risk.cueNumber}\n` : ''}
   - 详情: ${JSON.stringify(risk.details)}

`;
      });
    }

    if (warningRisks.length > 0) {
      report += `### 🟡 警告 (${warningRisks.length})

`;
      warningRisks.forEach((risk, index) => {
        report += `${index + 1}. **${risk.message}**
   - 类型: ${getRiskTypeLabel(risk.type)}
   ${risk.cueNumber ? `- 关联 Cue: #${risk.cueNumber}\n` : ''}

`;
      });
    }

    if (infoRisks.length > 0) {
      report += `### 🔵 提示 (${infoRisks.length})

`;
      infoRisks.forEach((risk, index) => {
        report += `${index + 1}. **${risk.message}**
   - 类型: ${getRiskTypeLabel(risk.type)}
   ${risk.cueNumber ? `- 关联 Cue: #${risk.cueNumber}\n` : ''}

`;
      });
    }
  } else {
    report += `---

## ✅ 风险检查

暂无发现风险。

`;
  }

  report += `---

## 🎭 灯具列表

`;

  state.fixtures.forEach((fixture) => {
    report += `### ${fixture.name} (ID: ${fixture.id})

| 通道 | DMX 地址 | 类型 |
|------|----------|------|
`;
    fixture.channels.forEach((channel) => {
      report += `| ${channel.name} | ${channel.dmxAddress} | ${channel.type} |
`;
    });
    report += `
`;
  });

  report += `---

## 🎬 Cue 列表

`;

  state.cues.forEach((cue) => {
    const endTime = cue.startTime + cue.duration + cue.fadeOut;
    report += `### Cue ${cue.number}: ${cue.name}

- **开始时间**: ${formatTime(cue.startTime)}
- **结束时间**: ${formatTime(endTime)}
- **淡入**: ${cue.fadeIn}s
- **淡出**: ${cue.fadeOut}s
- **持续时间**: ${cue.duration}s
- **通道数**: ${cue.channelValues.length}
${cue.notes ? `- **备注**: ${cue.notes}\n` : ''}

`;
  });

  report += `---

## 📋 场景规则

- **黑场阈值**: ${state.rules.blackoutThreshold}s
- **安全灯检查**: ${state.rules.requiresSafetyLight ? '启用' : '禁用'}
- **安全灯通道**: ${state.rules.safetyLightChannels.length > 0 ? state.rules.safetyLightChannels.join(', ') : '未配置'}
- **最大淡入重叠**: ${state.rules.maxFadeOverlap}s

`;

  report += `---

*此报告由 Cue 表预演工具自动生成*
`;

  return report;
}

function generateJSONReport(
  state: AppState,
  validationResult: ReturnType<typeof store.getValidationResult>
): Record<string, unknown> {
  return {
    reportInfo: {
      generatedAt: new Date().toISOString(),
      tool: 'Stage Lighting Cue Preview Tool',
      version: '1.0.0'
    },
    summary: {
      fixtureCount: state.fixtures.length,
      cueCount: state.cues.length,
      riskSummary: validationResult?.summary || { total: 0, critical: 0, warning: 0, info: 0 }
    },
    risks: validationResult?.risks.map((risk) => ({
      id: risk.id,
      type: risk.type,
      severity: risk.severity,
      cueId: risk.cueId,
      cueNumber: risk.cueNumber,
      message: risk.message,
      details: risk.details
    })) || [],
    fixtures: state.fixtures.map((fixture) => ({
      id: fixture.id,
      name: fixture.name,
      universe: fixture.universe,
      channels: fixture.channels.map((channel) => ({
        id: channel.id,
        name: channel.name,
        dmxAddress: channel.dmxAddress,
        type: channel.type
      }))
    })),
    cues: state.cues.map((cue) => ({
      id: cue.id,
      number: cue.number,
      name: cue.name,
      startTime: cue.startTime,
      fadeIn: cue.fadeIn,
      fadeOut: cue.fadeOut,
      duration: cue.duration,
      notes: cue.notes,
      channelValues: cue.channelValues
    })),
    sceneRules: {
      blackoutThreshold: state.rules.blackoutThreshold,
      requiresSafetyLight: state.rules.requiresSafetyLight,
      safetyLightChannels: state.rules.safetyLightChannels,
      maxFadeOverlap: state.rules.maxFadeOverlap
    }
  };
}

function downloadFile(content: string, format: ExportFormat): void {
  const extension = format === 'markdown' ? 'md' : 'json';
  const mimeType = format === 'markdown' ? 'text/markdown' : 'application/json';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `cue-report-${timestamp}.${extension}`;

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

function getRiskTypeLabel(type: Risk['type']): string {
  const labels: Record<Risk['type'], string> = {
    channel_conflict: '通道冲突',
    fade_overlap: '淡入淡出重叠',
    excessive_blackout: '黑场过长',
    missing_safety_light: '缺少安全灯',
    invalid_value: '无效值',
    missing_fixture: '缺少灯具'
  };
  return labels[type] || type;
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 100);
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}.${ms.toString().padStart(2, '0')}`;
}
