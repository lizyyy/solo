import type { StageProject, Risk, ProjectAdjustment, RiskLevel } from '@/types';
import { evaluateAllRisks, getTotalDuration } from '@/risk';
import { formatTime } from '@/utils/math';

interface RiskStats {
  total: number;
  byType: {
    collision: number;
    occlusion: number;
    illumination: number;
    height: number;
  };
  byLevel: {
    critical: number;
    warning: number;
    info: number;
  };
}

function calculateRiskStats(risks: Map<number, Risk[]>): RiskStats {
  const stats: RiskStats = {
    total: 0,
    byType: { collision: 0, occlusion: 0, illumination: 0, height: 0 },
    byLevel: { critical: 0, warning: 0, info: 0 },
  };

  risks.forEach((riskList) => {
    riskList.forEach((risk) => {
      stats.total++;
      stats.byType[risk.type]++;
      stats.byLevel[risk.level]++;
    });
  });

  return stats;
}

function getRiskLevelEmoji(level: RiskLevel): string {
  switch (level) {
    case 'critical':
      return '🔴';
    case 'warning':
      return '🟡';
    case 'info':
      return '🔵';
  }
}

function getRiskTypeLabel(type: Risk['type']): string {
  switch (type) {
    case 'collision':
      return '碰撞风险';
    case 'occlusion':
      return '遮挡风险';
    case 'illumination':
      return '照度不足';
    case 'height':
      return '超高风险';
  }
}

export function generateRiskReport(
  project: StageProject,
  adjustments: ProjectAdjustment[],
  timeStep: number = 1.0
): string {
  const allRisks = evaluateAllRisks(project, timeStep);
  const stats = calculateRiskStats(allRisks);
  const totalDuration = getTotalDuration(project);
  const now = new Date();

  let report = `# 灯位安全风险评估报告

## 项目信息
- **项目名称**: ${project.name || '未命名项目'}
- **报告生成时间**: ${now.toLocaleString('zh-CN')}
- **总时长**: ${formatTime(totalDuration)}
- **采样步长**: ${timeStep.toFixed(1)}s
- **目标照度**: ${project.targetMinLux} lux

---

## 风险统计概览

### 总体统计
- **总风险数**: ${stats.total} 项
- **严重风险 (🔴)**: ${stats.byLevel.critical} 项
- **警告风险 (🟡)**: ${stats.byLevel.warning} 项
- **信息提示 (🔵)**: ${stats.byLevel.info} 项

### 按类型分布
| 类型 | 数量 | 占比 |
|------|------|------|
| 碰撞风险 | ${stats.byType.collision} | ${stats.total > 0 ? ((stats.byType.collision / stats.total) * 100).toFixed(1) : 0}% |
| 遮挡风险 | ${stats.byType.occlusion} | ${stats.total > 0 ? ((stats.byType.occlusion / stats.total) * 100).toFixed(1) : 0}% |
| 照度不足 | ${stats.byType.illumination} | ${stats.total > 0 ? ((stats.byType.illumination / stats.total) * 100).toFixed(1) : 0}% |
| 超高风险 | ${stats.byType.height} | ${stats.total > 0 ? ((stats.byType.height / stats.total) * 100).toFixed(1) : 0}% |

---

## 详细风险列表
`;

  if (stats.total === 0) {
    report += `

✅ **所有时刻均未检测到风险！**

`;
  } else {
    const sortedTimes = Array.from(allRisks.keys()).sort((a, b) => a - b);

    for (const time of sortedTimes) {
      const risks = allRisks.get(time)!;
      const criticalRisks = risks.filter((r) => r.level === 'critical');
      const warningRisks = risks.filter((r) => r.level === 'warning');
      const infoRisks = risks.filter((r) => r.level === 'info');

      report += `

### 时刻 ${formatTime(time)}

`;

      const allSorted = [...criticalRisks, ...warningRisks, ...infoRisks];

      for (let i = 0; i < allSorted.length; i++) {
        const risk = allSorted[i];
        report += `
${getRiskLevelEmoji(risk.level)} **${getRiskTypeLabel(risk.type)}**
   - 描述: ${risk.description}
   - 涉及对象: ${risk.involvedObjects.join(', ')}
   - 位置: (${risk.location.x.toFixed(2)}, ${risk.location.y.toFixed(2)}, ${risk.location.z.toFixed(2)})
${risk.suggestedFix ? `   - 建议修复: ${risk.suggestedFix}` : ''}
`;
      }
    }
  }

  if (adjustments.length > 0) {
    report += `

---

## 已应用的调整记录

共进行了 ${adjustments.length} 项调整:

| # | 类型 | 目标 | 调整内容 | 原因 | 时间 |
|---|------|------|----------|------|------|
`;

    adjustments.forEach((adj, idx) => {
      const typeLabel = adj.type === 'lightAngle' ? '灯具角度' : adj.type === 'rigHeight' ? '吊杆高度' : '灯具强度';
      let changeStr = '';
      if (typeof adj.oldValue === 'number') {
        changeStr = `${adj.oldValue.toFixed(2)} → ${(adj.newValue as number).toFixed(2)}`;
      } else {
        const old = adj.oldValue as { pan: number; tilt: number };
        const newVal = adj.newValue as { pan: number; tilt: number };
        changeStr = `Pan: ${old.pan.toFixed(1)}°→${newVal.pan.toFixed(1)}°, Tilt: ${old.tilt.toFixed(1)}°→${newVal.tilt.toFixed(1)}°`;
      }
      const timeStr = new Date(adj.timestamp).toLocaleTimeString('zh-CN');

      report += `| ${idx + 1} | ${typeLabel} | ${adj.targetId} | ${changeStr} | ${adj.reason} | ${timeStr} |\n`;
    });
  }

  report += `

---

## 项目配置摘要

### 舞台信息
- 尺寸: ${project.stage.width.toFixed(1)}m × ${project.stage.depth.toFixed(1)}m × ${project.stage.height.toFixed(1)}m
- 台口: ${project.stage.prosceniumWidth.toFixed(1)}m × ${project.stage.prosceniumHeight.toFixed(1)}m
- 类型: ${project.stage.stageType}

### 设备清单
- 吊杆/桁架数量: ${project.rigs.length}
- 灯具类型数量: ${project.lightTypes.length}
- 灯具数量: ${project.lights.length}
- 演员数量: ${project.actors.length}

### 场景列表
`;

  if (project.scenes.length === 0) {
    report += '- 未定义场景\n';
  } else {
    project.scenes.forEach((scene) => {
      report += `- **${scene.name}**: ${formatTime(scene.startTime)} - ${formatTime(scene.endTime)}\n`;
      if (scene.description) {
        report += `  - ${scene.description}\n`;
      }
    });
  }

  report += `

---

## 建议

`;

  if (stats.byLevel.critical > 0) {
    report += `⚠️ **有 ${stats.byLevel.critical} 项严重风险需要优先处理**\n`;
    report += `- 请检查演员走位路线与灯具光束是否重叠\n`;
    report += `- 确认禁入区设置和高度限制\n`;
  }

  if (stats.byLevel.warning > 0) {
    report += `📋 **有 ${stats.byLevel.warning} 项警告需要关注**\n`;
    report += `- 检查吊杆高度设置，避免互相遮挡\n`;
    report += `- 评估重点区域照度是否达标\n`;
  }

  if (stats.total === 0) {
    report += `🎉 **当前配置未检测到风险，可以进行彩排**\n`;
  }

  report += `

---

*此报告由"灯位安全预演台"自动生成*
`;

  return report;
}

export function exportRiskReportToMarkdown(
  project: StageProject,
  adjustments: ProjectAdjustment[],
  timeStep: number = 1.0
): void {
  const markdown = generateRiskReport(project, adjustments, timeStep);
  const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${project.name || 'risk_report'}.md`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
