import { AppState, Risk, RiskSeverity } from '../types';
import { sortRisksBySeverity } from '../validators';

const riskTypeLabels: Record<Risk['type'], string> = {
  channel_conflict: '通道冲突',
  fade_overlap: '淡入淡出重叠',
  excessive_blackout: '黑场过长',
  missing_safety_light: '缺少安全灯',
  invalid_value: '无效值',
  missing_fixture: '缺少灯具'
};

const severityLabels: Record<RiskSeverity, string> = {
  critical: '严重',
  warning: '警告',
  info: '提示'
};

export function renderRiskList(
  state: AppState,
  selectedRiskId: string | null
): string {
  const risks = state.risks;
  
  if (risks.length === 0) {
    return `
      <div class="empty-state">
        <div class="empty-state-icon">✅</div>
        <div class="empty-state-text">暂无风险</div>
      </div>
    `;
  }

  const sortedRisks = sortRisksBySeverity(risks);

  return `
    <div class="risk-list">
      ${sortedRisks.map((risk) => renderRiskItem(risk, selectedRiskId)).join('')}
    </div>
  `;
}

function renderRiskItem(risk: Risk, selectedRiskId: string | null): string {
  const isSelected = risk.id === selectedRiskId;
  
  return `
    <div 
      class="risk-item ${isSelected ? 'selected' : ''}"
      data-risk-id="${risk.id}"
      data-cue-id="${risk.cueId || ''}"
    >
      <div class="risk-header">
        <span class="risk-severity ${risk.severity}">${severityLabels[risk.severity]}</span>
        <span class="risk-type">${riskTypeLabels[risk.type]}</span>
      </div>
      <div class="risk-message">${risk.message}</div>
      ${risk.cueNumber ? `
        <div class="risk-cue">
          关联 Cue: <span class="risk-cue-number">#${risk.cueNumber}</span>
        </div>
      ` : ''}
    </div>
  `;
}

export function getRiskTypeIcon(type: Risk['type']): string {
  const icons: Record<Risk['type'], string> = {
    channel_conflict: '🔀',
    fade_overlap: '⏱️',
    excessive_blackout: '🌑',
    missing_safety_light: '🔦',
    invalid_value: '⚠️',
    missing_fixture: '❓'
  };
  return icons[type] || '⚠️';
}
