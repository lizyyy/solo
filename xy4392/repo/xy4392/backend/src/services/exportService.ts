import {
  LightingPlan,
  PlacedLight,
  Actor,
  Camera,
  ScheduleItem,
  RiskItem,
  ExportPackage
} from '../types';

export function generateMarkdownHandover(options: {
  plan: LightingPlan;
  lights: PlacedLight[];
  actors: Actor[];
  cameras: Camera[];
  schedule: ScheduleItem[];
  risks: RiskItem[];
}): string {
  const { plan, lights, actors, cameras, schedule, risks } = options;
  const now = new Date().toISOString().replace('T', ' ').substring(0, 19);

  let md = `# 布光方案交接单\n\n`;
  md += `> 生成时间: ${now}\n\n`;

  md += `## 方案基本信息\n\n`;
  md += `| 项目 | 内容 |\n`;
  md += `|------|------|\n`;
  md += `| 方案名称 | ${plan.name} |\n`;
  md += `| 描述 | ${plan.description || '-'} |\n`;
  md += `| 影棚尺寸 | ${plan.studioDimensions.width}m (宽) × ${plan.studioDimensions.depth}m (深) × ${plan.studioDimensions.height}m (高) |\n`;
  md += `| 总功率 | ${plan.totalPower}W / ${plan.maxPowerLimit}W |\n`;
  md += `| 创建时间 | ${plan.createdAt} |\n`;
  md += `| 更新时间 | ${plan.updatedAt} |\n\n`;

  md += `---\n\n`;

  md += `## 灯具清单 (${lights.length} 个)\n\n`;
  if (lights.length > 0) {
    md += `| 名称 | 类型 | 功率 | 色温 | DMX | 高温 | 位置 (X,Y,Z) | 备注 |\n`;
    md += `|------|------|------|------|-----|------|---------------|------|\n`;
    for (const light of lights) {
      const pos = `(${light.position.x.toFixed(2)}, ${light.position.y.toFixed(2)}, ${light.position.z.toFixed(2)})`;
      md += `| ${light.name} | ${light.type || '-'} | ${light.power}W | ${light.colorTemp}K | ${light.dmxChannel || '-'} | ${light.isHighTemp ? '是' : '否'} | ${pos} | ${light.notes || '-'} |\n`;
    }
  } else {
    md += `暂无灯具数据\n\n`;
  }

  md += `\n---\n\n`;

  md += `## 机位设置 (${cameras.length} 个)\n\n`;
  if (cameras.length > 0) {
    md += `| 名称 | 镜头 | 视角 | 位置 (X,Y,Z) |\n`;
    md += `|------|------|------|---------------|\n`;
    for (const cam of cameras) {
      const pos = `(${cam.position.x.toFixed(2)}, ${cam.position.y.toFixed(2)}, ${cam.position.z.toFixed(2)})`;
      md += `| ${cam.name} | ${cam.lens} | ${cam.fov}° | ${pos} |\n`;
    }
  } else {
    md += `暂无机位数据\n\n`;
  }

  md += `\n---\n\n`;

  md += `## 演员位置 (${actors.length} 人)\n\n`;
  if (actors.length > 0) {
    md += `| 名称 | 位置 (X,Y,Z) | 有走位路径 |\n`;
    md += `|------|---------------|------------|\n`;
    for (const actor of actors) {
      const pos = `(${actor.position.x.toFixed(2)}, ${actor.position.y.toFixed(2)}, ${actor.position.z.toFixed(2)})`;
      md += `| ${actor.name} | ${pos} | ${actor.walkPath && actor.walkPath.length > 0 ? '是' : '否'} |\n`;
    }
  } else {
    md += `暂无演员数据\n\n`;
  }

  md += `\n---\n\n`;

  md += `## 拍摄日程 (${schedule.length} 场)\n\n`;
  if (schedule.length > 0) {
    const sortedSchedule = [...schedule].sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return a.startTime.localeCompare(b.startTime);
    });

    md += `| 日期 | 场次 | 时间 | 灯具 | 机位 | 演员 | 备注 |\n`;
    md += `|------|------|------|------|------|------|------|\n`;
    for (const item of sortedSchedule) {
      const lightNames = item.lightIds.length > 0 ? item.lightIds.length + '个' : '-';
      const camNames = item.cameraIds.length > 0 ? item.cameraIds.length + '个' : '-';
      const actorNames = item.actorIds.length > 0 ? item.actorIds.length + '人' : '-';
      md += `| ${item.date} | ${item.sceneName} | ${item.startTime}-${item.endTime} | ${lightNames} | ${camNames} | ${actorNames} | ${item.notes || '-'} |\n`;
    }
  } else {
    md += `暂无日程数据\n\n`;
  }

  md += `\n---\n\n`;

  const activeRisks = risks.filter(r => !r.isOverridden);
  md += `## 风险提示 (${activeRisks.length} 个未处理)\n\n`;
  
  if (activeRisks.length > 0) {
    const severityMap: Record<string, string> = {
      critical: '🔴 严重',
      high: '🟠 高',
      medium: '🟡 中',
      low: '🟢 低'
    };

    const typeMap: Record<string, string> = {
      power_overload: '功率超载',
      light_stand_blocking: '灯架遮挡',
      actor_near_high_temp: '高温风险',
      light_schedule_conflict: '场次冲突',
      other: '其他'
    };

    md += `| 级别 | 类型 | 标题 | 描述 |\n`;
    md += `|------|------|------|------|\n`;
    for (const risk of activeRisks) {
      md += `| ${severityMap[risk.severity] || risk.severity} | ${typeMap[risk.type] || risk.type} | ${risk.title} | ${risk.description} |\n`;
    }
  } else {
    md += `✅ 未检测到风险项\n\n`;
  }

  const overriddenRisks = risks.filter(r => r.isOverridden);
  if (overriddenRisks.length > 0) {
    md += `\n### 已人工改判的风险 (${overriddenRisks.length} 个)\n\n`;
    for (const risk of overriddenRisks) {
      md += `- **${risk.title}**: ${risk.description}\n`;
      md += `  - 改判原因: ${risk.overrideReason || '未说明'}\n`;
      md += `  - 改判人: ${risk.overrideBy || '未知'}\n\n`;
    }
  }

  md += `\n---\n\n`;
  md += `## 附录\n\n`;
  md += `- 方案ID: ${plan.id}\n`;
  md += `- 坐标系: 右手坐标系，Y轴向上\n`;
  md += `- 单位: 米(m)、瓦(W)、开尔文(K)\n`;

  return md;
}

export function generateExportPackage(options: {
  plan: LightingPlan;
  lights: PlacedLight[];
  actors: Actor[];
  cameras: Camera[];
  schedule: ScheduleItem[];
  risks: RiskItem[];
}): ExportPackage {
  return {
    plan: options.plan,
    lights: options.lights,
    actors: options.actors,
    cameras: options.cameras,
    schedule: options.schedule,
    risks: options.risks,
    exportedAt: new Date().toISOString(),
    version: '1.0.0'
  };
}

export default {
  generateMarkdownHandover,
  generateExportPackage
};
