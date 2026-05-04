import * as fs from 'fs';
import * as path from 'path';
import { DatabaseService } from './database';
import { RiskDetectionService } from './risk-detection';
import { RiskReport, Route, Hold, WallZone, Feedback, Review } from '../types';

export class ExportService {
  private db: DatabaseService;
  private riskService: RiskDetectionService;

  constructor(db: DatabaseService, riskService: RiskDetectionService) {
    this.db = db;
    this.riskService = riskService;
  }

  exportMarkdownReview(): { content: string; filename: string } {
    const report = this.riskService.detectAllRisks();
    const zones = this.db.getWallZones();
    const routes = this.db.getAllRoutes();
    const holds = this.db.getAllHolds();
    const feedbacks = this.db.getAllFeedback();
    const reviews = this.db.getUnresolvedReviews();

    const now = new Date().toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });

    let markdown = `# 室内攀岩馆线路定线复盘报告

**生成时间**: ${now}

---

## 风险概览

| 风险级别 | 数量 |
|---------|------|
| 🔴 严重 | ${report.bySeverity.critical} |
| 🟠 高 | ${report.bySeverity.high} |
| 🟡 中 | ${report.bySeverity.medium} |
| 🟢 低 | ${report.bySeverity.low} |
| **总计** | **${report.totalRisks}** |

### 风险类型分布

| 类型 | 数量 | 说明 |
|-----|------|------|
| 难度断层 | ${report.byType.difficulty_gap} | 同一区域内难度跨度超过阈值 |
| 抓点过期 | ${report.byType.hold_expired} | 抓点使用次数接近或超过最大值 |
| 儿童冲突 | ${report.byType.children_conflict} | 儿童线路落点过近 |

---

## 详细风险分析

`;

    const criticalRisks = report.risks.filter(r => r.severity === 'critical');
    const highRisks = report.risks.filter(r => r.severity === 'high');
    const mediumRisks = report.risks.filter(r => r.severity === 'medium');
    const lowRisks = report.risks.filter(r => r.severity === 'low');

    const renderRiskSection = (risks: typeof report.risks, title: string, emoji: string) => {
      if (risks.length === 0) return '';
      
      let section = `### ${emoji} ${title} (${risks.length})

`;
      risks.forEach((risk, idx) => {
        const typeLabel = risk.type === 'difficulty_gap' ? '难度断层' :
                         risk.type === 'hold_expired' ? '抓点过期' : '儿童冲突';
        
        section += `#### ${idx + 1}. ${risk.title}

- **类型**: ${typeLabel}
- **位置**: ${risk.location}
- **描述**: ${risk.description}

**受影响项目**:
${risk.affectedItems.map(item => `  - ${item}`).join('\n')}

**建议措施**:
${risk.recommendations.map((rec, i) => `  ${i + 1}. ${rec}`).join('\n')}

`;
      });
      return section;
    };

    markdown += renderRiskSection(criticalRisks, '严重风险', '🔴');
    markdown += renderRiskSection(highRisks, '高优先级风险', '🟠');
    markdown += renderRiskSection(mediumRisks, '中优先级风险', '🟡');
    markdown += renderRiskSection(lowRisks, '低优先级风险', '🟢');

    markdown += `---

## 墙面区域分析

共 ${zones.length} 个区域，${routes.length} 条线路

`;

    for (const zone of zones) {
      const zoneRoutes = routes.filter(r => r.zoneCode === zone.code);
      const difficulties = zoneRoutes.map(r => r.difficulty).sort((a, b) => a - b);
      const childrenRoutes = zoneRoutes.filter(r => r.isChildrenRoute);

      markdown += `### ${zone.name} (${zone.code})

- **难度范围**: ${zone.difficultyRangeMin} - ${zone.difficultyRangeMax}
- **线路数量**: ${zoneRoutes.length} 条
- **儿童线路**: ${childrenRoutes.length} 条
`;

      if (difficulties.length > 0) {
        markdown += `- **实际难度分布**: ${difficulties.join(', ')}
`;
      }

      markdown += `
`;
    }

    markdown += `---

## 抓点状态分析

共 ${holds.length} 个抓点

### 抓点使用统计

| 状态 | 数量 |
|-----|------|
| 正常使用 | ${holds.filter(h => h.currentUseCount / h.maxUseCount < 0.8).length} |
| 需要关注 (80%+) | ${holds.filter(h => { const r = h.currentUseCount / h.maxUseCount; return r >= 0.8 && r < 0.9; }).length} |
| 建议更换 (90%+) | ${holds.filter(h => { const r = h.currentUseCount / h.maxUseCount; return r >= 0.9 && r < 0.95; }).length} |
| 立即更换 (95%+) | ${holds.filter(h => h.currentUseCount / h.maxUseCount >= 0.95).length} |
| 维护中 | ${holds.filter(h => h.status === 'maintenance').length} |

---

## 会员反馈

共收到 ${feedbacks.length} 条反馈

### 满意度统计

`;

    if (feedbacks.length > 0) {
      const avgDifficulty = (feedbacks.reduce((sum, f) => sum + f.difficultyRating, 0) / feedbacks.length).toFixed(1);
      const avgEnjoyment = (feedbacks.reduce((sum, f) => sum + f.enjoymentRating, 0) / feedbacks.length).toFixed(1);
      
      markdown += `- **平均难度评分**: ${avgDifficulty}/5
- **平均满意度评分**: ${avgEnjoyment}/5
- **有问题反馈**: ${feedbacks.filter(f => f.hasIssues).length} 条

`;
    }

    markdown += `---

## 待处理复核意见

共 ${reviews.length} 条待处理

`;

    if (reviews.length > 0) {
      reviews.forEach((review, idx) => {
        const priorityEmoji = review.priority === 'critical' ? '🔴' :
                             review.priority === 'high' ? '🟠' : '🟡';
        markdown += `### ${idx + 1}. ${priorityEmoji} [${review.priority === 'critical' ? '严重' : review.priority === 'high' ? '高' : '中'}] ${review.reviewType || '复核'}

- **日期**: ${review.reviewDate}
- **复核人**: ${review.reviewer || '未指定'}
- **涉及线路**: ${review.routeCode || '无'}
- **涉及抓点**: ${review.holdCode || '无'}
- **发现**: ${review.findings || '无'}
- **建议**: ${review.recommendations || '无'}

`;
      });
    } else {
      markdown += `*暂无待处理的复核意见*

`;
    }

    markdown += `---

*本报告由线路定线复盘器自动生成*
`;

    const filename = `线路定线复盘报告_${new Date().toISOString().split('T')[0]}.md`;

    return { content: markdown, filename };
  }

  exportMaintenanceList(): { content: string; filename: string } {
    const holds = this.db.getAllHolds();
    const report = this.riskService.detectAllRisks();
    const holdRisks = report.risks.filter(r => r.type === 'hold_expired');

    let csv = `抓点代码,抓点名称,类型,位置,当前使用次数,最大使用次数,使用比例,状态,最后检查日期,风险等级,建议行动\n`;

    const maintenanceHolds = holds.filter(h => {
      const ratio = h.currentUseCount / h.maxUseCount;
      return ratio >= 0.8 || h.status === 'maintenance';
    }).sort((a, b) => {
      const ratioA = a.currentUseCount / a.maxUseCount;
      const ratioB = b.currentUseCount / b.maxUseCount;
      return ratioB - ratioA;
    });

    for (const hold of maintenanceHolds) {
      const ratio = hold.currentUseCount / hold.maxUseCount;
      const ratioPercent = (ratio * 100).toFixed(1) + '%';
      
      let riskLevel = '正常';
      let action = '继续监控';
      
      if (hold.status === 'maintenance') {
        riskLevel = '维护中';
        action = '完成维护';
      } else if (ratio >= 0.95) {
        riskLevel = '严重';
        action = '立即更换';
      } else if (ratio >= 0.9) {
        riskLevel = '高';
        action = '近期更换';
      } else if (ratio >= 0.8) {
        riskLevel = '中';
        action = '纳入计划';
      }

      const row = [
        hold.code,
        hold.name,
        hold.type,
        hold.position,
        hold.currentUseCount,
        hold.maxUseCount,
        ratioPercent,
        hold.status,
        hold.lastInspectionDate || '',
        riskLevel,
        action
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');

      csv += row + '\n';
    }

    const filename = `抓点维护清单_${new Date().toISOString().split('T')[0]}.csv`;

    return { content: csv, filename };
  }

  exportAuditPackage(): { content: string; filename: string } {
    const zones = this.db.getWallZones();
    const routes = this.db.getAllRoutes();
    const holds = this.db.getAllHolds();
    const feedbacks = this.db.getAllFeedback();
    const reviews = this.db.getAllReviews();
    const riskReport = this.riskService.detectAllRisks();

    const auditPackage = {
      version: '1.0',
      generatedAt: new Date().toISOString(),
      summary: {
        totalZones: zones.length,
        totalRoutes: routes.length,
        totalHolds: holds.length,
        totalFeedback: feedbacks.length,
        totalReviews: reviews.length,
        riskSummary: riskReport.bySeverity
      },
      wallZones: zones,
      routes: routes.map(r => ({
        ...r,
        holdPositionsParsed: this.safeParseJSON(r.holdPositions)
      })),
      holds: holds.map(h => ({
        ...h,
        useRatio: (h.currentUseCount / h.maxUseCount).toFixed(3)
      })),
      feedback: feedbacks,
      reviews: reviews,
      riskReport: riskReport,
      statistics: {
        routesByZone: this.countByKey(routes, 'zoneCode'),
        routesByDifficulty: this.countByKey(routes, 'difficulty'),
        routesByColor: this.countByKey(routes, 'color'),
        childrenRoutes: routes.filter(r => r.isChildrenRoute).length,
        holdsByStatus: this.countByKey(holds, 'status'),
        holdsByType: this.countByKey(holds, 'type')
      }
    };

    const filename = `审计数据包_${new Date().toISOString().split('T')[0]}.json`;

    return { 
      content: JSON.stringify(auditPackage, null, 2), 
      filename 
    };
  }

  private safeParseJSON(str: string): any {
    try {
      return JSON.parse(str);
    } catch {
      return str;
    }
  }

  private countByKey<T>(items: T[], key: keyof T): Record<string, number> {
    const result: Record<string, number> = {};
    for (const item of items) {
      const k = String(item[key] || '未知');
      result[k] = (result[k] || 0) + 1;
    }
    return result;
  }
}
