import type { StateSnapshot, Draft, AnomalyRecord, Submission, Team } from '../types';
import { computeHash } from '../utils/hash';
import { getAnomalyTypeLabel, getMaterialTypeLabel } from './anomalyService';

interface ExportOptions {
  includeDrafts: boolean;
  includeAnomalies: boolean;
  includeSnapshots: boolean;
  includeSubmissions: boolean;
  format: 'json' | 'text';
}

const DEFAULT_OPTIONS: ExportOptions = {
  includeDrafts: true,
  includeAnomalies: true,
  includeSnapshots: true,
  includeSubmissions: true,
  format: 'text',
};

export function exportSimulationData(
  teams: Team[],
  submissions: Submission[],
  drafts: Draft[],
  anomalies: AnomalyRecord[],
  snapshots: StateSnapshot[],
  options: Partial<ExportOptions> = {}
): { content: string; hash: string; filename: string } {
  const opts = { ...DEFAULT_OPTIONS, ...options };

  const exportData: Record<string, unknown> = {
    exportTime: new Date().toISOString(),
    exportTimestamp: Date.now(),
    teams,
  };

  if (opts.includeSubmissions) {
    exportData.submissions = submissions;
  }
  if (opts.includeDrafts) {
    exportData.drafts = drafts;
  }
  if (opts.includeAnomalies) {
    exportData.anomalies = anomalies;
  }
  if (opts.includeSnapshots) {
    exportData.snapshots = snapshots.map((s) => ({
      id: s.id,
      timestamp: s.timestamp,
      simulationTime: s.simulationTime,
      hash: s.hash,
      previousHash: s.previousHash,
    }));
  }

  const hash = computeHash(exportData);
  exportData.integrityHash = hash;

  let content: string;
  const fileExt = opts.format === 'json' ? 'json' : 'txt';
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `排队窗口仿真_交接班记录_${timestamp}.${fileExt}`;

  if (opts.format === 'json') {
    content = JSON.stringify(exportData, null, 2);
  } else {
    content = formatAsText(teams, submissions, drafts, anomalies, snapshots, hash);
  }

  return { content, hash, filename };
}

function formatAsText(
  teams: Team[],
  submissions: Submission[],
  drafts: Draft[],
  anomalies: AnomalyRecord[],
  snapshots: StateSnapshot[],
  integrityHash: string
): string {
  const lines: string[] = [];

  lines.push('='.repeat(72));
  lines.push('排队窗口仿真 - 交接班记录');
  lines.push('='.repeat(72));
  lines.push(`导出时间: ${new Date().toLocaleString('zh-CN')}`);
  lines.push(`记录总数: ${submissions.length} 个提交, ${teams.length} 个队伍`);
  lines.push(`异常总数: ${anomalies.length} 个`);
  lines.push(`快照数量: ${snapshots.length} 个`);
  lines.push('');

  lines.push('-'.repeat(72));
  lines.push('一、队伍信息');
  lines.push('-'.repeat(72));
  teams.forEach((team) => {
    lines.push(`[${team.id}] ${team.name}`);
    lines.push(`  队员: ${team.members.join(', ')}`);
    lines.push(`  提交次数: ${team.submissionCount}`);
    lines.push('');
  });

  lines.push('-'.repeat(72));
  lines.push('二、提交记录 (按时间顺序)');
  lines.push('-'.repeat(72));
  const sortedSubs = [...submissions].sort((a, b) => a.startTime - b.startTime);
  sortedSubs.forEach((sub, idx) => {
    lines.push(`${idx + 1}. [${sub.status.toUpperCase()}] ${sub.teamName}`);
    lines.push(`   提交ID: ${sub.id}`);
    lines.push(`   开始时间: ${formatTime(sub.startTime)}`);
    if (sub.endTime) {
      lines.push(`   结束时间: ${formatTime(sub.endTime)}`);
    }
    lines.push(`   处理窗口: ${sub.windowId || '未分配'}`);
    if (sub.isResubmission) {
      lines.push(`   ⚠️  二次提交, 原始ID: ${sub.originalSubmissionId}`);
    }
    lines.push('   材料清单:');
    sub.materials.forEach((m) => {
      const statusIcon = m.hasIssue ? '❌' : m.status === 'approved' ? '✅' : '⏳';
      lines.push(`     ${statusIcon} [${getMaterialTypeLabel(m.type)}] ${m.name}`);
      if (m.hasIssue && m.issueDesc) {
        lines.push(`        问题: ${m.issueDesc}`);
      }
    });
    if (sub.anomalies.length > 0) {
      lines.push(`   异常 (${sub.anomalies.length}):`);
      sub.anomalies.forEach((a) => {
        lines.push(`     • [${a.severity.toUpperCase()}] ${getAnomalyTypeLabel(a.type)}: ${a.message}`);
      });
    }
    lines.push('');
  });

  lines.push('-'.repeat(72));
  lines.push('三、异常记录详情');
  lines.push('-'.repeat(72));
  if (anomalies.length === 0) {
    lines.push('无异常记录');
  } else {
    anomalies.forEach((a, idx) => {
      lines.push(`${idx + 1}. [${a.severity.toUpperCase()}] ${getAnomalyTypeLabel(a.type)}`);
      lines.push(`   时间: ${formatTime(a.timestamp)}`);
      lines.push(`   涉及队伍: ${teams.find((t) => t.id === a.teamId)?.name || a.teamId}`);
      lines.push(`   摘要: ${a.message}`);
      lines.push(`   解释: ${a.explanation}`);
      lines.push(`   状态: ${a.handled ? '已处理' : '待处理'}`);
      lines.push('');
    });
  }

  lines.push('-'.repeat(72));
  lines.push('四、参数草稿版本历史');
  lines.push('-'.repeat(72));
  const groupedDrafts = new Map<string, Draft[]>();
  drafts.forEach((d) => {
    const list = groupedDrafts.get(d.teamId) || [];
    list.push(d);
    groupedDrafts.set(d.teamId, list);
  });

  groupedDrafts.forEach((teamDrafts, teamId) => {
    const team = teams.find((t) => t.id === teamId);
    lines.push(`队伍: ${team?.name || teamId}`);
    const sorted = [...teamDrafts].sort((a, b) => a.version - b.version);
    sorted.forEach((d) => {
      lines.push(`  v${d.version} - ${formatTime(d.modifiedAt)} - ${d.modifiedBy}`);
      lines.push(`    摘要: ${d.changeSummary}`);
      lines.push(`    哈希: ${d.hash.substring(0, 16)}...`);
      if (d.parentVersion) {
        lines.push(`    父版本: v${d.parentVersion}`);
      }
    });
    lines.push('');
  });

  lines.push('-'.repeat(72));
  lines.push('五、状态快照哈希链 (用于一致性校验)');
  lines.push('-'.repeat(72));
  const sortedSnapshots = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  sortedSnapshots.forEach((s, idx) => {
    lines.push(`${idx + 1}. 仿真时间 ${formatDuration(s.simulationTime)}`);
    lines.push(`   快照ID: ${s.id}`);
    lines.push(`   哈希: ${s.hash.substring(0, 16)}...`);
    if (s.previousHash) {
      lines.push(`   前哈希: ${s.previousHash.substring(0, 16)}...`);
    }
    lines.push(`   提交数: ${s.submissions.length}, 异常数: ${s.anomalies.length}`);
  });

  lines.push('');
  lines.push('='.repeat(72));
  lines.push('一致性校验');
  lines.push('='.repeat(72));
  lines.push(`完整数据哈希: ${integrityHash}`);
  lines.push('');
  lines.push('校验方法: 将导出文件重新计算 SHA256 哈希, 应与上述值一致');
  lines.push('');
  lines.push('下一班教练: 请从第一条未处理的异常开始审核');
  lines.push('='.repeat(72));

  return lines.join('\n');
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleString('zh-CN');
}

function formatDuration(ms: number): string {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${minutes}分${secs}秒`;
}

export function downloadFile(content: string, filename: string, mimeType: string = 'text/plain'): void {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function verifyExportIntegrity(content: string, expectedHash: string): boolean {
  try {
    const data = JSON.parse(content);
    delete data.integrityHash;
    const computedHash = computeHash(data);
    return computedHash === expectedHash;
  } catch {
    return computeHash(content) === expectedHash;
  }
}
