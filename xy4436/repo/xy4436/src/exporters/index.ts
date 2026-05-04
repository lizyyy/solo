import fs from 'fs-extra';
import path from 'path';
import type {
  Project,
  Fixture,
  Cue,
  Circuit,
  MediaFile,
  BannedDevice,
  Issue,
  ProjectSummary,
} from '../types';

function getSeverityIcon(severity: string): string {
  switch (severity) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
      return '🔵';
    default:
      return '⚪';
  }
}

function getIssueTypeLabel(type: string): string {
  switch (type) {
    case 'dmx_conflict':
      return 'DMX地址冲突';
    case 'power_overload':
      return '功率超载';
    case 'missing_media':
      return '素材缺失';
    case 'banned_device':
      return '禁用设备';
    default:
      return '其他';
  }
}

export function generateMarkdownHandover(
  project: Project,
  fixtures: Fixture[],
  cues: Cue[],
  circuits: Circuit[],
  mediaFiles: MediaFile[],
  issues: Issue[],
  bannedDevices: BannedDevice[]
): string {
  const unresolvedIssues = issues.filter(i => !i.resolved);
  const resolvedIssues = issues.filter(i => i.resolved);
  
  const now = new Date().toLocaleString('zh-CN', {
    timeZone: 'Asia/Shanghai',
  });
  
  let md = `# 灯光巡演预检交接单

> 项目名称: **${project.name}**
> 场地: **${project.venue || '未指定'}**
> 生成时间: **${now}**

---

## 📊 项目概览

| 项目 | 数量 |
|------|------|
| 灯具总数 | ${fixtures.length} |
| Cue 总数 | ${cues.length} |
| 电源回路 | ${circuits.length} |
| 素材文件 | ${mediaFiles.length} |
| **未解决问题** | **${unresolvedIssues.length}** |
| 已解决问题 | ${resolvedIssues.length} |

---

## ⚠️ 问题清单 (未解决)

`;

  if (unresolvedIssues.length === 0) {
    md += `✅ 没有未解决的问题！\n\n`;
  } else {
    for (const issue of unresolvedIssues) {
      md += `### ${getSeverityIcon(issue.severity)} [${getIssueTypeLabel(issue.type)}] ${issue.title}\n\n`;
      md += `**严重程度**: ${issue.severity === 'critical' ? '严重' : issue.severity === 'warning' ? '警告' : '提示'}\n\n`;
      md += `${issue.description}\n\n`;
      if (issue.affectedItems && issue.affectedItems.length > 0) {
        md += `**涉及项**: ${issue.affectedItems.join(', ')}\n\n`;
      }
      md += `---\n\n`;
    }
  }

  md += `## 💡 已解决问题

`;

  if (resolvedIssues.length === 0) {
    md += `暂无已解决的问题。\n\n`;
  } else {
    for (const issue of resolvedIssues) {
      md += `- [x] ${getSeverityIcon(issue.severity)} ${issue.title}`;
      if (issue.resolutionNote) {
        md += `\n  - 处理意见: ${issue.resolutionNote}`;
      }
      md += `\n`;
    }
    md += `\n`;
  }

  md += `---

## 🎯 灯具清单 (${fixtures.length} 台)

| # | 名称 | 类型 | DMX地址 | 通道数 | Universe | 功率(W) | 回路 |
|---|------|------|---------|--------|----------|---------|------|
`;

  const sortedFixtures = [...fixtures].sort(
    (a, b) => a.universe - b.universe || a.dmxStartAddress - b.dmxStartAddress
  );

  for (let i = 0; i < sortedFixtures.length; i++) {
    const f = sortedFixtures[i];
    md += `| ${i + 1} | ${f.name} | ${f.type || '-'} | ${f.dmxStartAddress} | ${f.dmxChannelCount} | ${f.universe} | ${f.power} | ${f.circuitId || '-'} |\n`;
  }

  md += `
---

## ⚡ 电源回路 (${circuits.length} 个)

| 回路名称 | 最大容量(W) | 已使用功率(W) | 余量(W) | 说明 |
|----------|-------------|---------------|---------|------|
`;

  const circuitPowerMap = new Map<string, number>();
  for (const fixture of fixtures) {
    if (fixture.circuitId) {
      circuitPowerMap.set(
        fixture.circuitId,
        (circuitPowerMap.get(fixture.circuitId) || 0) + fixture.power
      );
    }
  }

  for (const circuit of circuits) {
    const usedPower = circuitPowerMap.get(circuit.name) || 0;
    const margin = circuit.maxPower - usedPower;
    const marginStatus = margin < 0 ? `**${margin}**` : String(margin);
    md += `| ${circuit.name} | ${circuit.maxPower} | ${usedPower} | ${marginStatus} | ${circuit.description || '-'} |\n`;
  }

  md += `
---

## 🎬 Cue 清单 (${cues.length} 个)

| Cue号 | 名称 | 描述 | 引用素材 |
|-------|------|------|----------|
`;

  for (const cue of cues) {
    const mediaList = cue.mediaReferences.length > 0 
      ? cue.mediaReferences.join(', ') 
      : '-';
    md += `| ${cue.cueNumber} | ${cue.name || '-'} | ${cue.description || '-'} | ${mediaList} |\n`;
  }

  md += `
---

## 📁 素材文件 (${mediaFiles.length} 个)

| 文件名 | 类型 | 大小 |
|--------|------|------|
`;

  for (const media of mediaFiles) {
    const sizeStr = media.size < 1024 
      ? `${media.size} B`
      : media.size < 1024 * 1024
      ? `${(media.size / 1024).toFixed(1)} KB`
      : `${(media.size / (1024 * 1024)).toFixed(1)} MB`;
    md += `| ${media.name} | ${media.fileType || '-'} | ${sizeStr} |\n`;
  }

  if (bannedDevices.length > 0) {
    md += `
---

## 🚫 场地禁用设备 (${bannedDevices.length} 项)

| 设备名称 | 禁用原因 |
|----------|----------|
`;

    for (const device of bannedDevices) {
      md += `| ${device.name} | ${device.reason || '-'} |\n`;
    }
  }

  md += `
---

*此交接单由 light-checker 工具自动生成*
`;

  return md;
}

export interface AuditPackage {
  version: string;
  generatedAt: string;
  project: Project;
  summary: {
    fixtureCount: number;
    cueCount: number;
    circuitCount: number;
    mediaCount: number;
    issueSummary: {
      total: number;
      critical: number;
      warning: number;
      info: number;
      unresolved: number;
    };
  };
  data: {
    fixtures: Fixture[];
    cues: Cue[];
    circuits: Circuit[];
    mediaFiles: MediaFile[];
    bannedDevices: BannedDevice[];
  };
  issues: {
    unresolved: Issue[];
    resolved: Issue[];
  };
}

export function generateJsonAuditPackage(
  project: Project,
  fixtures: Fixture[],
  cues: Cue[],
  circuits: Circuit[],
  mediaFiles: MediaFile[],
  bannedDevices: BannedDevice[],
  issues: Issue[]
): AuditPackage {
  const unresolvedIssues = issues.filter(i => !i.resolved);
  const resolvedIssues = issues.filter(i => i.resolved);
  
  return {
    version: '1.0.0',
    generatedAt: new Date().toISOString(),
    project,
    summary: {
      fixtureCount: fixtures.length,
      cueCount: cues.length,
      circuitCount: circuits.length,
      mediaCount: mediaFiles.length,
      issueSummary: {
        total: issues.length,
        critical: issues.filter(i => i.severity === 'critical').length,
        warning: issues.filter(i => i.severity === 'warning').length,
        info: issues.filter(i => i.severity === 'info').length,
        unresolved: unresolvedIssues.length,
      },
    },
    data: {
      fixtures,
      cues,
      circuits,
      mediaFiles,
      bannedDevices,
    },
    issues: {
      unresolved: unresolvedIssues,
      resolved: resolvedIssues,
    },
  };
}

export async function exportMarkdown(
  outputPath: string,
  project: Project,
  fixtures: Fixture[],
  cues: Cue[],
  circuits: Circuit[],
  mediaFiles: MediaFile[],
  issues: Issue[],
  bannedDevices: BannedDevice[]
): Promise<string> {
  const content = generateMarkdownHandover(
    project,
    fixtures,
    cues,
    circuits,
    mediaFiles,
    issues,
    bannedDevices
  );
  
  const fullPath = path.resolve(outputPath);
  await fs.ensureDir(path.dirname(fullPath));
  await fs.writeFile(fullPath, content, 'utf-8');
  
  return fullPath;
}

export async function exportJsonAudit(
  outputPath: string,
  project: Project,
  fixtures: Fixture[],
  cues: Cue[],
  circuits: Circuit[],
  mediaFiles: MediaFile[],
  bannedDevices: BannedDevice[],
  issues: Issue[]
): Promise<string> {
  const pkg = generateJsonAuditPackage(
    project,
    fixtures,
    cues,
    circuits,
    mediaFiles,
    bannedDevices,
    issues
  );
  
  const fullPath = path.resolve(outputPath);
  await fs.ensureDir(path.dirname(fullPath));
  await fs.writeJson(fullPath, pkg, { spaces: 2 });
  
  return fullPath;
}
