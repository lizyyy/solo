import { Router, Request, Response } from 'express';
import { db } from '../database.js';
import {
  Risk,
  TargetWindow,
  ObservingTarget,
  Device,
  ObservingSite,
  ObservationActivity,
  ReviewRecord,
} from '../types.js';

const router = Router();

router.get('/markdown/observing-list', (req: Request, res: Response) => {
  try {
    const activityId = req.query.activityId as string;
    const markdown = generateObservingListMarkdown(activityId);

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', 'attachment; filename="observing-list.md"');
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate observing list' });
  }
});

router.get('/json/audit-package', (req: Request, res: Response) => {
  try {
    const activityId = req.query.activityId as string;
    const auditPackage = generateAuditPackage(activityId);

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename="audit-package.json"');
    res.json(auditPackage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate audit package' });
  }
});

router.get('/preview/observing-list', (req: Request, res: Response) => {
  try {
    const activityId = req.query.activityId as string;
    const markdown = generateObservingListMarkdown(activityId);
    res.json({ markdown });
  } catch (error) {
    res.status(500).json({ error: 'Failed to preview observing list' });
  }
});

router.get('/preview/audit-package', (req: Request, res: Response) => {
  try {
    const activityId = req.query.activityId as string;
    const auditPackage = generateAuditPackage(activityId);
    res.json(auditPackage);
  } catch (error) {
    res.status(500).json({ error: 'Failed to preview audit package' });
  }
});

function generateObservingListMarkdown(activityId?: string): string {
  let activity: ObservationActivity | null = null;

  if (activityId) {
    activity = db
      .prepare('SELECT * FROM observation_activities WHERE id = ?')
      .get(activityId) as ObservationActivity | undefined || null;
  }

  const sites = db
    .prepare('SELECT * FROM observing_sites')
    .all() as ObservingSite[];

  const targets = db
    .prepare('SELECT * FROM observing_targets ORDER BY priority DESC')
    .all() as ObservingTarget[];

  const windowsRaw = db
    .prepare('SELECT * FROM target_windows ORDER BY start_time')
    .all() as any[];

  const windows: TargetWindow[] = windowsRaw.map((w) => ({
    id: w.id,
    targetId: w.target_id,
    startTime: w.start_time,
    endTime: w.end_time,
    duration: w.duration,
    deviceIds: JSON.parse(w.device_ids || '[]'),
    notes: w.notes,
  }));

  const devices = db
    .prepare('SELECT * FROM devices')
    .all() as Device[];

  const risks = db
    .prepare('SELECT * FROM risks ORDER BY window_id, severity DESC')
    .all() as Risk[];

  const targetsMap = new Map(targets.map(t => [t.id, t]));
  const devicesMap = new Map(devices.map(d => [d.id, d]));
  const risksByWindow = new Map<string, Risk[]>();

  for (const risk of risks) {
    if (!risksByWindow.has(risk.windowId)) {
      risksByWindow.set(risk.windowId, []);
    }
    risksByWindow.get(risk.windowId)!.push(risk);
  }

  let markdown = '# 观测夜预检清单\n\n';
  markdown += `生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;

  if (activity) {
    markdown += `## 观测活动\n\n`;
    markdown += `- **名称**: ${activity.name}\n`;
    markdown += `- **日期**: ${activity.date}\n`;
    markdown += `- **状态**: ${activity.status}\n\n`;
  }

  markdown += '## 观测地点\n\n';
  if (sites.length === 0) {
    markdown += '暂无观测地点数据。\n\n';
  } else {
    for (const site of sites) {
      markdown += `### ${site.name}\n`;
      markdown += `- 纬度: ${site.latitude}°\n`;
      markdown += `- 经度: ${site.longitude}°\n`;
      if (site.elevation) {
        markdown += `- 海拔: ${site.elevation}m\n`;
      }
      markdown += '\n';
    }
  }

  markdown += '## 设备清单\n\n';
  if (devices.length === 0) {
    markdown += '暂无设备数据。\n\n';
  } else {
    const deviceTypes = ['telescope', 'camera', 'mount', 'filter'] as const;
    const typeLabels: Record<string, string> = {
      telescope: '望远镜',
      camera: '相机',
      mount: '赤道仪',
      filter: '滤镜',
    };

    for (const type of deviceTypes) {
      const typeDevices = devices.filter(d => d.type === type);
      if (typeDevices.length === 0) continue;

      markdown += `### ${typeLabels[type]}\n\n`;
      for (const device of typeDevices) {
        const batteryIcon = device.batteryLevel < 30 ? '🔴' : device.batteryLevel < 60 ? '🟡' : '🟢';
        const availableIcon = device.isAvailable ? '✅' : '❌';
        markdown += `- **${device.name}** ${availableIcon}\n`;
        if (device.model) {
          markdown += `  - 型号: ${device.model}\n`;
        }
        markdown += `  - 电量: ${batteryIcon} ${device.batteryLevel}%\n`;
        if (device.description) {
          markdown += `  - 描述: ${device.description}\n`;
        }
        markdown += '\n';
      }
    }
  }

  markdown += '## 观测目标与窗口\n\n';
  if (windows.length === 0) {
    markdown += '暂无观测窗口数据。\n\n';
  } else {
    for (const window of windows) {
      const target = targetsMap.get(window.targetId);
      const windowRisks = risksByWindow.get(window.id) || [];
      const activeRisks = windowRisks.filter(r => !r.isOverridden);

      markdown += `### ${target?.name || '未知目标'}\n\n`;
      if (target) {
        markdown += `- 类型: ${target.type}\n`;
        markdown += `- 赤经: ${target.rightAscension}\n`;
        markdown += `- 赤纬: ${target.declination}\n`;
        markdown += `- 优先级: ${'★'.repeat(target.priority)}\n`;
      }

      const startTime = new Date(window.startTime);
      const endTime = new Date(window.endTime);
      markdown += `- 观测窗口: ${startTime.toLocaleString('zh-CN')} - ${endTime.toLocaleString('zh-CN')}\n`;
      markdown += `- 时长: ${window.duration}分钟\n`;

      if (window.deviceIds.length > 0) {
        const deviceNames = window.deviceIds
          .map(id => devicesMap.get(id)?.name || id)
          .join(', ');
        markdown += `- 使用设备: ${deviceNames}\n`;
      }

      if (window.notes) {
        markdown += `- 备注: ${window.notes}\n`;
      }

      markdown += '\n';

      if (activeRisks.length > 0) {
        markdown += `#### ⚠️ 风险检测 (${activeRisks.length}项)\n\n`;

        const criticalRisks = activeRisks.filter(r => r.severity === 'critical');
        const warningRisks = activeRisks.filter(r => r.severity === 'warning');

        for (const risk of [...criticalRisks, ...warningRisks]) {
          const severityIcon = risk.severity === 'critical' ? '🔴' : '🟡';
          markdown += `${severityIcon} **${getRiskTypeLabel(risk.type)}**\n`;
          markdown += `   ${risk.message}\n\n`;
        }
      }

      const overriddenRisks = windowRisks.filter(r => r.isOverridden);
      if (overriddenRisks.length > 0) {
        markdown += `#### ✅ 已手动驳回的风险 (${overriddenRisks.length}项)\n\n`;
        for (const risk of overriddenRisks) {
          markdown += `- ${getRiskTypeLabel(risk.type)}`;
          if (risk.overrideReason) {
            markdown += `\n  驳回理由: ${risk.overrideReason}`;
          }
          if (risk.overrideBy) {
            markdown += `\n  驳回人: ${risk.overrideBy}`;
          }
          markdown += '\n\n';
        }
      }

      markdown += '---\n\n';
    }
  }

  const summary = calculateRiskSummary();
  markdown += '## 风险统计摘要\n\n';
  markdown += `| 严重程度 | 总数 | 已驳回 | 待处理 |\n`;
  markdown += `|----------|------|--------|--------|\n`;
  markdown += `| 🔴 严重  | ${summary.critical.total} | ${summary.critical.overridden} | ${summary.critical.total - summary.critical.overridden} |\n`;
  markdown += `| 🟡 警告  | ${summary.warning.total} | ${summary.warning.overridden} | ${summary.warning.total - summary.warning.overridden} |\n`;
  markdown += `| ℹ️ 信息  | ${summary.info.total} | ${summary.info.overridden} | ${summary.info.total - summary.info.overridden} |\n\n`;

  if (Object.keys(summary.byType).length > 0) {
    markdown += '### 按风险类型统计\n\n';
    for (const [type, data] of Object.entries(summary.byType)) {
      markdown += `- **${getRiskTypeLabel(type)}**: ${data.total}项 (${data.total - data.overridden}项待处理)\n`;
    }
    markdown += '\n';
  }

  return markdown;
}

function generateAuditPackage(activityId?: string): object {
  const now = new Date().toISOString();

  const activity: ObservationActivity | null = activityId
    ? db
        .prepare('SELECT * FROM observation_activities WHERE id = ?')
        .get(activityId) as ObservationActivity | undefined || null
    : null;

  const sites = db
    .prepare('SELECT * FROM observing_sites')
    .all() as ObservingSite[];

  const targets = db
    .prepare('SELECT * FROM observing_targets')
    .all() as ObservingTarget[];

  const windowsRaw = db
    .prepare('SELECT * FROM target_windows')
    .all() as any[];

  const windows: TargetWindow[] = windowsRaw.map((w) => ({
    id: w.id,
    targetId: w.target_id,
    startTime: w.start_time,
    endTime: w.end_time,
    duration: w.duration,
    deviceIds: JSON.parse(w.device_ids || '[]'),
    notes: w.notes,
  }));

  const devices = db
    .prepare('SELECT * FROM devices')
    .all() as Device[];

  const risks = db
    .prepare('SELECT * FROM risks')
    .all() as Risk[];

  const reviewRecords = db
    .prepare(activityId
      ? 'SELECT * FROM review_records WHERE activity_id = ?'
      : 'SELECT * FROM review_records',
      activityId ? [activityId] : []
    )
    .all() as any[];

  const processedReviews: ReviewRecord[] = reviewRecords.map((r) => ({
    id: r.id,
    activityId: r.activity_id,
    windowId: r.window_id,
    targetName: r.target_name,
    reviewer: r.reviewer,
    reviewedAt: r.reviewed_at,
    status: r.status as ReviewRecord['status'],
    notes: r.notes,
    risks: JSON.parse(r.risks || '[]'),
  }));

  return {
    metadata: {
      generatedAt: now,
      activityId: activityId || null,
      activityName: activity?.name || null,
      version: '1.0.0',
    },
    observingActivity: activity,
    observingSites: sites,
    observingTargets: targets,
    targetWindows: windows,
    devices: devices,
    riskAssessments: {
      allRisks: risks,
      summary: calculateRiskSummary(),
    },
    reviewRecords: processedReviews,
    observingListMarkdown: generateObservingListMarkdown(activityId),
  };
}

function calculateRiskSummary(): {
  critical: { total: number; overridden: number };
  warning: { total: number; overridden: number };
  info: { total: number; overridden: number };
  byType: Record<string, { total: number; overridden: number }>;
} {
  const risks = db
    .prepare('SELECT severity, type, is_overridden FROM risks')
    .all() as { severity: string; type: string; is_overridden: number }[];

  const summary = {
    critical: { total: 0, overridden: 0 },
    warning: { total: 0, overridden: 0 },
    info: { total: 0, overridden: 0 },
    byType: {} as Record<string, { total: number; overridden: number }>,
  };

  for (const risk of risks) {
    const severity = risk.severity as 'critical' | 'warning' | 'info';
    summary[severity].total++;
    if (risk.is_overridden) summary[severity].overridden++;

    if (!summary.byType[risk.type]) {
      summary.byType[risk.type] = { total: 0, overridden: 0 };
    }
    summary.byType[risk.type].total++;
    if (risk.is_overridden) summary.byType[risk.type].overridden++;
  }

  return summary;
}

function getRiskTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    altitude_too_low: '地平高度不足',
    moon_interference: '月光干扰',
    battery_low: '设备电量不足',
    device_conflict: '设备冲突',
    window_conflict: '观测窗口冲突',
  };
  return labels[type] || type;
}

export default router;
