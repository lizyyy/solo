export const RISK_LEVELS = {
  NORMAL: 'normal',
  CAUTION: 'caution',
  WARNING: 'warning',
  CRITICAL: 'critical',
  SCRAP: 'scrap'
};

export const RISK_LABELS = {
  [RISK_LEVELS.NORMAL]: '正常',
  [RISK_LEVELS.CAUTION]: '注意',
  [RISK_LEVELS.WARNING]: '警告',
  [RISK_LEVELS.CRITICAL]: '严重',
  [RISK_LEVELS.SCRAP]: '报废'
};

export const RISK_COLORS = {
  [RISK_LEVELS.NORMAL]: '#10b981',
  [RISK_LEVELS.CAUTION]: '#f59e0b',
  [RISK_LEVELS.WARNING]: '#ef4444',
  [RISK_LEVELS.CRITICAL]: '#dc2626',
  [RISK_LEVELS.SCRAP]: '#7f1d1d'
};

export const RISK_PRIORITY = [
  RISK_LEVELS.SCRAP,
  RISK_LEVELS.CRITICAL,
  RISK_LEVELS.WARNING,
  RISK_LEVELS.CAUTION,
  RISK_LEVELS.NORMAL
];

export function getRiskLevelLabel(level) {
  return RISK_LABELS[level] || RISK_LABELS[RISK_LEVELS.NORMAL];
}

export function getRiskLevelColor(level) {
  return RISK_COLORS[level] || RISK_COLORS[RISK_LEVELS.NORMAL];
}

export function getRiskBadgeClass(level) {
  const classes = {
    [RISK_LEVELS.NORMAL]: 'risk-badge-normal',
    [RISK_LEVELS.CAUTION]: 'risk-badge-caution',
    [RISK_LEVELS.WARNING]: 'risk-badge-warning',
    [RISK_LEVELS.CRITICAL]: 'risk-badge-critical',
    [RISK_LEVELS.SCRAP]: 'risk-badge-scrap'
  };
  return classes[level] || classes[RISK_LEVELS.NORMAL];
}

export function getTimelineItemClass(level) {
  const classes = {
    [RISK_LEVELS.NORMAL]: 'timeline-item-normal',
    [RISK_LEVELS.CAUTION]: 'timeline-item-caution',
    [RISK_LEVELS.WARNING]: 'timeline-item-warning',
    [RISK_LEVELS.CRITICAL]: 'timeline-item-critical',
    [RISK_LEVELS.SCRAP]: 'timeline-item-scrap'
  };
  return classes[level] || classes[RISK_LEVELS.NORMAL];
}

export function sortByRisk(ropes, getRiskLevel) {
  return [...ropes].sort((a, b) => {
    const riskA = RISK_PRIORITY.indexOf(getRiskLevel(a));
    const riskB = RISK_PRIORITY.indexOf(getRiskLevel(b));
    return riskA - riskB;
  });
}

export function filterByRisk(ropes, riskLevel, getRiskLevel) {
  if (!riskLevel) return ropes;
  return ropes.filter(rope => getRiskLevel(rope) === riskLevel);
}

export function formatDate(dateStr) {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return dateStr;
  return date.toLocaleDateString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  });
}

export function formatNumber(num, decimals = 2) {
  if (num === null || num === undefined) return '-';
  return Number(num).toFixed(decimals);
}

export function downloadFile(blob, filename) {
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(url);
}

export function getEffectiveRiskLevel(rope) {
  if (rope.latest_assessment?.effective_risk_level) {
    return rope.latest_assessment.effective_risk_level;
  }
  if (rope.latest_assessment?.overall_risk_level) {
    return rope.latest_assessment.overall_risk_level;
  }
  return RISK_LEVELS.NORMAL;
}

export function hasReviewDecision(rope) {
  return !!rope.latest_assessment?.review_decision;
}

export function groupByRisk(ropes) {
  const groups = {
    [RISK_LEVELS.SCRAP]: [],
    [RISK_LEVELS.CRITICAL]: [],
    [RISK_LEVELS.WARNING]: [],
    [RISK_LEVELS.CAUTION]: [],
    [RISK_LEVELS.NORMAL]: []
  };
  
  for (const rope of ropes) {
    const riskLevel = getEffectiveRiskLevel(rope);
    if (groups[riskLevel]) {
      groups[riskLevel].push(rope);
    } else {
      groups[RISK_LEVELS.NORMAL].push(rope);
    }
  }
  
  return groups;
}

export function getRiskIconName(level) {
  const icons = {
    [RISK_LEVELS.NORMAL]: 'CheckCircle',
    [RISK_LEVELS.CAUTION]: 'AlertTriangle',
    [RISK_LEVELS.WARNING]: 'AlertOctagon',
    [RISK_LEVELS.CRITICAL]: 'XOctagon',
    [RISK_LEVELS.SCRAP]: 'Trash2'
  };
  return icons[level] || icons[RISK_LEVELS.NORMAL];
}

export function getStatIconClass(level) {
  const classes = {
    [RISK_LEVELS.NORMAL]: 'stat-icon-normal',
    [RISK_LEVELS.CAUTION]: 'stat-icon-caution',
    [RISK_LEVELS.WARNING]: 'stat-icon-warning',
    [RISK_LEVELS.CRITICAL]: 'stat-icon-critical',
    [RISK_LEVELS.SCRAP]: 'stat-icon-scrap'
  };
  return classes[level] || classes[RISK_LEVELS.NORMAL];
}
