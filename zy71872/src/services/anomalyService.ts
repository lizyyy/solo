import type { AnomalyRecord, Submission, Material, Team } from '../types';
import { generateId } from '../utils/hash';
import { appendToStorage } from '../utils/storage';

const ANOMALY_EXPLANATIONS: Record<string, { severity: 'info' | 'warning' | 'error'; message: string; explanation: string }> = {
  missing_notes: {
    severity: 'error',
    message: '缺少队员笔记',
    explanation: '该队伍提交的材料中缺少队员笔记文件。队员笔记是必填材料，用于记录队员分工和协作情况。请要求队伍补充后再提交。',
  },
  duplicate_chart: {
    severity: 'warning',
    message: '存在重复结果图',
    explanation: '检测到多份同名的结果图文件。这可能是上传错误或版本混淆。请与队伍确认哪一份是最终版本，避免后续评审出错。',
  },
  boundary_case: {
    severity: 'warning',
    message: '边界情况提交',
    explanation: '该提交发生在窗口关闭前10秒内，属于边界时间提交。请注意检查材料完整性，避免因时间仓促导致遗漏。',
  },
  draft_modified: {
    severity: 'info',
    message: '参数草稿被修改',
    explanation: '参数草稿在提交后被修改过。系统已记录修改人和修改时间，请确认修改内容是否经过批准。',
  },
  resubmission: {
    severity: 'info',
    message: '二次提交',
    explanation: '该队伍此前已有成功提交记录。本次为二次提交，系统已保留历史记录，未覆盖原有成功记录。请注意对比两次提交的差异。',
  },
};

export function detectAnomalies(
  submission: Submission,
  team: Team,
  allSubmissions: Submission[],
  windowCloseTime: number,
  currentTime: number
): AnomalyRecord[] {
  const anomalies: AnomalyRecord[] = [];

  // 检测缺少队员笔记
  const hasNotes = submission.materials.some(
    (m) => m.type === 'team_notes' && !m.hasIssue
  );
  if (!hasNotes) {
    anomalies.push(createAnomaly('missing_notes', submission, team, currentTime));
  }

  // 检测重复结果图
  const chartNames = submission.materials
    .filter((m) => m.type === 'result_chart')
    .map((m) => m.name);
  const uniqueCharts = new Set(chartNames);
  if (chartNames.length !== uniqueCharts.size) {
    anomalies.push(createAnomaly('duplicate_chart', submission, team, currentTime));
  }

  // 检测边界情况（窗口关闭前10秒）
  if (windowCloseTime - currentTime < 10000 && windowCloseTime > currentTime) {
    anomalies.push(createAnomaly('boundary_case', submission, team, currentTime));
  }

  // 检测二次提交
  const previousSuccess = allSubmissions.find(
    (s) => s.teamId === team.id && s.status === 'success' && s.id !== submission.id
  );
  if (previousSuccess) {
    anomalies.push(createAnomaly('resubmission', submission, team, currentTime));
  }

  // 检测有问题的材料
  const hasIssueMaterials = submission.materials.filter((m) => m.hasIssue);
  hasIssueMaterials.forEach((m) => {
    if (m.issueDesc && m.issueDesc.includes('草稿')) {
      anomalies.push(createAnomaly('draft_modified', submission, team, currentTime));
    }
  });

  return anomalies;
}

function createAnomaly(
  type: string,
  submission: Submission,
  team: Team,
  timestamp: number
): AnomalyRecord {
  const config = ANOMALY_EXPLANATIONS[type] || {
    severity: 'warning' as const,
    message: '未知异常',
    explanation: '系统检测到未定义的异常情况，请进一步检查。',
  };

  const anomaly: AnomalyRecord = {
    id: generateId('anomaly'),
    type: type as AnomalyRecord['type'],
    severity: config.severity,
    message: `${team.name}: ${config.message}`,
    explanation: config.explanation,
    submissionId: submission.id,
    teamId: team.id,
    timestamp,
    handled: false,
  };

  appendToStorage('anomalies', anomaly);
  return anomaly;
}

export function getAnomalyTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    missing_notes: '缺队员笔记',
    duplicate_chart: '重复结果图',
    boundary_case: '边界情况',
    draft_modified: '草稿修改',
    resubmission: '二次提交',
  };
  return labels[type] || type;
}

export function getAnomalySeverityColor(severity: string): string {
  const colors: Record<string, string> = {
    info: 'text-blue-400 bg-blue-900/30 border-blue-500/50',
    warning: 'text-amber-400 bg-amber-900/30 border-amber-500/50',
    error: 'text-red-400 bg-red-900/30 border-red-500/50',
  };
  return colors[severity] || colors.info;
}

export function getMaterialTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    param_draft: '参数草稿',
    team_notes: '队员笔记',
    result_chart: '结果图',
    boundary_doc: '边界情况说明',
  };
  return labels[type] || type;
}

export function validateMaterials(materials: Material[]): { valid: boolean; issues: string[] } {
  const issues: string[] = [];

  const hasDraft = materials.some((m) => m.type === 'param_draft');
  if (!hasDraft) {
    issues.push('缺少参数草稿');
  }

  const hasNotes = materials.some((m) => m.type === 'team_notes' && !m.hasIssue);
  if (!hasNotes) {
    issues.push('缺少有效的队员笔记');
  }

  const hasChart = materials.some((m) => m.type === 'result_chart');
  if (!hasChart) {
    issues.push('缺少结果图');
  }

  const materialIssues = materials.filter((m) => m.hasIssue);
  materialIssues.forEach((m) => {
    issues.push(`${m.name}: ${m.issueDesc || '存在问题'}`);
  });

  return {
    valid: issues.length === 0,
    issues,
  };
}
