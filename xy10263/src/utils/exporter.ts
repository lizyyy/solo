import type { Workspace, ExportData, ExportMeta } from '../types';
import { hashData, calculateChecksum } from './hash';
import { calculateStatistics } from './analyzer';

export function prepareExportData(workspace: Workspace): ExportData {
  const statistics = calculateStatistics(
    workspace.clues,
    workspace.players,
    workspace.conflicts,
    workspace.gaps
  );

  const meta: ExportMeta = {
    version: '1.0',
    generatedAt: Date.now(),
    dataHash: hashData({
      players: workspace.players,
      clues: workspace.clues.map(c => ({
        ...c,
        createdAt: c.createdAt,
        updatedAt: c.updatedAt,
      })),
      conflicts: workspace.conflicts,
      gaps: workspace.gaps,
    }),
    checksum: calculateChecksum(
      workspace.players,
      workspace.clues,
      workspace.conflicts,
      workspace.gaps
    ),
  };

  return {
    meta,
    players: workspace.players,
    clues: workspace.clues,
    conflicts: workspace.conflicts,
    gaps: workspace.gaps,
    statistics,
  };
}

export function generateFileName(workspace: Workspace, extension: string = 'json'): string {
  const timestamp = new Date().toISOString().slice(0, 10);
  const safeName = workspace.name.replace(/[^a-zA-Z0-9\u4e00-\u9fa5]/g, '_');
  return `${safeName}_复盘报告_${timestamp}.${extension}`;
}

export function downloadJson(data: ExportData, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: 'application/json',
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function generateMarkdownReport(data: ExportData): string {
  const lines: string[] = [];
  
  lines.push(`# ${data.players.length > 0 ? data.clues[0]?.playerId : ''} 复盘报告`);
  lines.push('');
  lines.push(`- **生成时间**: ${new Date(data.meta.generatedAt).toLocaleString()}`);
  lines.push(`- **数据哈希**: ${data.meta.dataHash}`);
  lines.push('');
  
  lines.push('## 统计概览');
  lines.push('');
  lines.push(`- **总线索数**: ${data.statistics.totalClues}`);
  lines.push(`- **时间线覆盖**: ${data.statistics.timelineCoverage}%`);
  lines.push(`- **冲突总数**: ${data.statistics.conflictsTotal}`);
  lines.push(`  - 已解决: ${data.statistics.conflictsResolved}`);
  lines.push(`  - 未解决: ${data.statistics.conflictsTotal - data.statistics.conflictsResolved}`);
  lines.push(`- **遗漏问题**: ${data.statistics.gapsTotal}`);
  lines.push('');
  
  lines.push('## 玩家与线索分布');
  lines.push('');
  for (const player of data.players) {
    const clueCount = data.statistics.cluesByPlayer[player.id] || 0;
    lines.push(`- **${player.name}（${player.role}）**: ${clueCount} 条线索`);
  }
  lines.push('');
  
  lines.push('## 线索状态分布');
  lines.push('');
  lines.push(`- 发现: ${data.statistics.cluesByStatus.found}`);
  lines.push(`- 已分析: ${data.statistics.cluesByStatus.analyzed}`);
  lines.push(`- 未解决: ${data.statistics.cluesByStatus.unresolved}`);
  lines.push(`- 已解决: ${data.statistics.cluesByStatus.resolved}`);
  lines.push('');
  
  lines.push('## 冲突详情');
  lines.push('');
  if (data.conflicts.length === 0) {
    lines.push('无检测到的冲突。');
  } else {
    for (const conflict of data.conflicts) {
      const status = conflict.resolved ? '✓ 已解决' : '⚠️ 未解决';
      lines.push(`### ${status}`);
      lines.push(`- **类型**: ${conflict.type}`);
      lines.push(`- **描述**: ${conflict.description}`);
      lines.push(`- **涉及线索数**: ${conflict.involvedClueIds.length}`);
      if (conflict.resolvedNotes) {
        lines.push(`- **解决说明**: ${conflict.resolvedNotes}`);
      }
      lines.push('');
    }
  }
  lines.push('');
  
  lines.push('## 遗漏与缺失');
  lines.push('');
  if (data.gaps.length === 0) {
    lines.push('无检测到的遗漏。');
  } else {
    for (const gap of data.gaps) {
      lines.push(`- ${gap.description}`);
    }
  }
  lines.push('');
  
  lines.push('---');
  lines.push(`*数据校验码: ${data.meta.checksum}*`);
  
  return lines.join('\n');
}

export function downloadMarkdown(data: ExportData, filename: string): void {
  const md = generateMarkdownReport(data);
  const blob = new Blob([md], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
