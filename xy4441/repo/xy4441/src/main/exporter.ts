import * as fs from 'fs';
import * as path from 'path';
import {
  SceneSchedule,
  CostumeItem,
  WashRecord,
  AlterationRecord,
  ReferencePhoto,
  RiskItem,
  Project,
  ExportOptions,
} from '../shared/types';

interface ExportData {
  project: Project;
  scenes: SceneSchedule[];
  costumes: CostumeItem[];
  washRecords: WashRecord[];
  alterationRecords: AlterationRecord[];
  photos: ReferencePhoto[];
  risks: RiskItem[];
  exportedAt: string;
  version: string;
}

export class Exporter {
  exportToMarkdown(
    project: Project,
    scenes: SceneSchedule[],
    costumes: CostumeItem[],
    risks: RiskItem[],
    options: ExportOptions
  ): string {
    const now = new Date().toLocaleString('zh-CN');
    const filteredRisks = options.includeResolved 
      ? risks 
      : risks.filter((r) => !r.isResolved);

    // 按场次排序
    const sortedScenes = [...scenes].sort((a, b) => 
      a.shootDate.localeCompare(b.shootDate) || a.sceneNumber.localeCompare(b.sceneNumber)
    );

    // 按角色分组服装
    const costumesByCharacter = new Map<string, CostumeItem[]>();
    costumes.forEach((c) => {
      const existing = costumesByCharacter.get(c.character) || [];
      existing.push(c);
      costumesByCharacter.set(c.character, existing);
    });

    // 按类型分组风险
    const risksByType = new Map<string, RiskItem[]>();
    filteredRisks.forEach((r) => {
      const existing = risksByType.get(r.type) || [];
      existing.push(r);
      risksByType.set(r.type, existing);
    });

    let md = `# ${project.name} - 服装交接单

> 导出时间: ${now}
> 项目创建时间: ${new Date(project.createdAt).toLocaleString('zh-CN')}

---

## 目录
1. [场次概览](#场次概览)
2. [服装清单](#服装清单)
3. [风险预警](#风险预警)

---

## 场次概览

| 场次号 | 场次名称 | 拍摄日期 | 地点 | 涉及角色 | 日夜 | 天气 |
|--------|----------|----------|------|----------|------|------|
`;

    for (const scene of sortedScenes) {
      md += `| ${scene.sceneNumber} | ${scene.sceneName || '-'} | ${scene.shootDate} | ${scene.location || '-'} | ${scene.characters.join(', ')} | ${scene.dayNight || '-'} | ${scene.weather || '-'} |\n`;
    }

    md += `
---

## 服装清单

`;

    for (const [character, charCostumes] of costumesByCharacter.entries()) {
      md += `### ${character}

| 条码 | 服装名称 | 尺码 | 颜色 | 适用场次 | 状态 | 备注 |
|------|----------|------|------|----------|------|------|
`;

      for (const costume of charCostumes) {
        const statusLabel = this.getStatusLabel(costume.status);
        md += `| ${costume.barcode} | ${costume.itemName} | ${costume.size || '-'} | ${costume.color || '-'} | ${costume.scenes.join(', ')} | ${statusLabel} | ${options.includeNotes ? (costume.notes || '-') : '-'} |\n`;
      }

      md += '\n';
    }

    md += `---

## 风险预警

`;

    if (filteredRisks.length === 0) {
      md += `**暂无风险预警。**\n`;
    } else {
      const highRisks = filteredRisks.filter((r) => r.severity === 'high');
      const mediumRisks = filteredRisks.filter((r) => r.severity === 'medium');
      const lowRisks = filteredRisks.filter((r) => r.severity === 'low');

      md += `### 风险统计

- **高风险**: ${highRisks.length} 项
- **中风险**: ${mediumRisks.length} 项
- **低风险**: ${lowRisks.length} 项

---

### 风险详情

`;

      const riskTypeLabels: Record<string, string> = {
        missing_item: '缺件',
        wash_conflict: '清洗冲突',
        size_unconfirmed: '尺码未确认',
        photo_mismatch: '照片不匹配',
        alteration_delay: '改衣延迟',
      };

      const sortedBySeverity = [...filteredRisks].sort((a, b) => {
        const severityOrder = { high: 0, medium: 1, low: 2 };
        return severityOrder[a.severity] - severityOrder[b.severity];
      });

      for (const risk of sortedBySeverity) {
        const severityBadge = risk.severity === 'high' 
          ? '🔴 高' 
          : risk.severity === 'medium' 
            ? '🟡 中' 
            : '🟢 低';
        
        const typeLabel = riskTypeLabels[risk.type] || risk.type;
        const statusText = risk.isResolved ? '✅ 已解决' : '⚠️ 未解决';

        md += `#### ${severityBadge} - ${risk.title}

- **类型**: ${typeLabel}
- **状态**: ${statusText}
- **描述**: ${risk.description}
- **涉及场次**: ${risk.sceneNumber || '-'}
- **涉及角色**: ${risk.character || '-'}
- **涉及条码**: ${risk.barcode || '-'}
- **影响日期**: ${risk.affectedDate || '-'}
`;

        if (options.includeNotes && (risk.userNotes || risk.resolutionNotes)) {
          if (risk.userNotes) {
            md += `- **用户备注**: ${risk.userNotes}\n`;
          }
          if (risk.resolutionNotes) {
            md += `- **解决备注**: ${risk.resolutionNotes}\n`;
          }
        }

        if (risk.userOverride) {
          const overrideLabels: Record<string, string> = {
            ignore: '忽略此风险',
            pending: '待处理',
            resolved: '标记为已解决',
          };
          md += `- **用户标记**: ${overrideLabels[risk.userOverride] || risk.userOverride}\n`;
        }

        md += '\n---\n\n';
      }
    }

    md += `
---

*此交接单由服装连续性管理工具自动生成。*
`;

    return md;
  }

  exportToJson(
    project: Project,
    scenes: SceneSchedule[],
    costumes: CostumeItem[],
    washRecords: WashRecord[],
    alterationRecords: AlterationRecord[],
    photos: ReferencePhoto[],
    risks: RiskItem[],
    options: ExportOptions
  ): string {
    const data: ExportData = {
      project,
      scenes,
      costumes,
      washRecords,
      alterationRecords,
      photos,
      risks: options.includeResolved ? risks : risks.filter((r) => !r.isResolved),
      exportedAt: new Date().toISOString(),
      version: '1.0.0',
    };

    if (!options.includeNotes) {
      // 移除敏感备注信息
      data.costumes = data.costumes.map((c) => ({ ...c, notes: undefined }));
      data.risks = data.risks.map((r) => ({ 
        ...r, 
        userNotes: undefined,
        resolutionNotes: undefined,
      }));
    }

    return JSON.stringify(data, null, 2);
  }

  async saveToFile(
    filePath: string,
    content: string
  ): Promise<void> {
    return new Promise((resolve, reject) => {
      fs.writeFile(filePath, content, 'utf-8', (err) => {
        if (err) reject(err);
        else resolve();
      });
    });
  }

  private getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      available: '可用',
      in_wash: '清洗中',
      in_alteration: '改衣中',
      checked_out: '已借出',
      lost: '丢失',
    };
    return labels[status] || status;
  }
}

export const exporter = new Exporter();
