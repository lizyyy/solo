import { v4 as uuidv4 } from 'uuid';
import type { ProtectionReport, Risk, Exhibition, Artwork, Gallery, LightSource, SamplingData, RiskSeverity } from '../../src/types/index.js';

interface ReportGenerationContext {
  exhibition: Exhibition;
  risks: Risk[];
  artworks: Artwork[];
  gallery: Gallery;
  lightSources: LightSource[];
  samplings: SamplingData[];
  generatedBy: string;
  screenshots?: Array<{ dataUrl: string; caption: string; timestamp: string }>;
}

export class ReportGenerator {
  async generateReport(context: ReportGenerationContext): Promise<ProtectionReport> {
    const { exhibition, risks, artworks, gallery, lightSources, samplings, generatedBy, screenshots = [] } = context;

    const riskSummary = this.calculateRiskSummary(risks);
    const recommendations = this.generateRecommendations(risks, artworks);
    const dataSources = this.compileDataSources(gallery, lightSources, artworks, samplings, risks);

    const report: ProtectionReport = {
      id: uuidv4(),
      exhibitionId: exhibition.id,
      reportNo: this.generateReportNo(exhibition),
      generatedAt: new Date().toISOString(),
      riskSummary,
      recommendations,
      screenshots,
      dataSources,
      generatedBy,
    };

    return report;
  }

  private calculateRiskSummary(risks: Risk[]) {
    const totalRisks = risks.length;
    const overIllumination = risks.filter(r => r.type === 'over_illumination').length;
    const cumulativeLeak = risks.filter(r => r.type === 'cumulative_leak').length;
    const lightPenetration = risks.filter(r => r.type === 'light_penetration').length;

    const bySeverity: Record<RiskSeverity, number> = {
      low: risks.filter(r => r.severity === 'low').length,
      medium: risks.filter(r => r.severity === 'medium').length,
      high: risks.filter(r => r.severity === 'high').length,
      critical: risks.filter(r => r.severity === 'critical').length,
    };

    return {
      totalRisks,
      overIllumination,
      cumulativeLeak,
      lightPenetration,
      bySeverity,
    };
  }

  private generateRecommendations(risks: Risk[], artworks: Artwork[]) {
    const recommendations: ProtectionReport['recommendations'] = [];

    const criticalRisks = risks.filter(r => r.severity === 'critical');
    for (const risk of criticalRisks) {
      const artwork = artworks.find(a => a.id === risk.artworkId);
      recommendations.push({
        artworkId: risk.artworkId,
        artworkName: artwork?.name,
        suggestion: this.getSuggestionForRisk(risk, 'critical'),
        priority: 'high',
      });
    }

    const highRisks = risks.filter(r => r.severity === 'high');
    for (const risk of highRisks) {
      const artwork = artworks.find(a => a.id === risk.artworkId);
      recommendations.push({
        artworkId: risk.artworkId,
        artworkName: artwork?.name,
        suggestion: this.getSuggestionForRisk(risk, 'high'),
        priority: 'high',
      });
    }

    const mediumRisks = risks.filter(r => r.severity === 'medium');
    for (const risk of mediumRisks) {
      const artwork = artworks.find(a => a.id === risk.artworkId);
      recommendations.push({
        artworkId: risk.artworkId,
        artworkName: artwork?.name,
        suggestion: this.getSuggestionForRisk(risk, 'medium'),
        priority: 'medium',
      });
    }

    const lowRisks = risks.filter(r => r.severity === 'low');
    for (const risk of lowRisks) {
      const artwork = artworks.find(a => a.id === risk.artworkId);
      recommendations.push({
        artworkId: risk.artworkId,
        artworkName: artwork?.name,
        suggestion: this.getSuggestionForRisk(risk, 'low'),
        priority: 'low',
      });
    }

    return recommendations;
  }

  private getSuggestionForRisk(risk: Risk, severity: RiskSeverity): string {
    const baseSuggestions: Record<string, Record<RiskSeverity, string>> = {
      over_illumination: {
        low: '建议适当降低光源强度，持续监测照度变化',
        medium: '需要调整光源位置或降低功率，确保照度在标准范围内',
        high: '立即降低照度，考虑更换光源或增加漫射装置',
        critical: '紧急处理！立即关闭相关光源，重新评估展陈方案',
      },
      cumulative_leak: {
        low: '建议完善采样计划，确保每日照度数据完整',
        medium: '需要补充缺失的采样数据，调整展期开放时间',
        high: '立即缩短每日开放时长，制定完整的曝光控制计划',
        critical: '紧急处理！暂停该作品展出，重新规划展期安排',
      },
      light_penetration: {
        low: '建议检查墙体遮挡情况，必要时调整光源角度',
        medium: '需要调整光源位置或角度，避免光线直接穿透墙体',
        high: '立即调整光源布局，考虑增加遮光措施',
        critical: '紧急处理！关闭穿墙光源，重新评估空间布局',
      },
    };

    return baseSuggestions[risk.type]?.[severity] || '请根据具体情况采取相应措施';
  }

  private compileDataSources(
    gallery: Gallery,
    lightSources: LightSource[],
    artworks: Artwork[],
    samplings: SamplingData[],
    risks: Risk[]
  ): ProtectionReport['dataSources'] {
    const dataSources: ProtectionReport['dataSources'] = [];

    dataSources.push({
      type: '展厅数据',
      count: 1,
      lastUpdated: gallery.lastModifiedAt || gallery.createdAt,
    });

    dataSources.push({
      type: '光源数据',
      count: lightSources.length,
      lastUpdated: this.getLatestUpdate(lightSources.map(l => l.createdAt)),
    });

    dataSources.push({
      type: '作品数据',
      count: artworks.length,
      lastUpdated: this.getLatestUpdate(artworks.map(a => a.lastModifiedAt || a.createdAt)),
    });

    dataSources.push({
      type: '采样数据',
      count: samplings.length,
      lastUpdated: this.getLatestUpdate(samplings.map(s => s.measuredAt)),
    });

    dataSources.push({
      type: '风险检测',
      count: risks.length,
      lastUpdated: this.getLatestUpdate(risks.map(r => r.detectedAt)),
    });

    return dataSources;
  }

  private getLatestUpdate(dates: string[]): string {
    if (dates.length === 0) return new Date().toISOString();
    return dates.reduce((latest, date) => 
      new Date(date) > new Date(latest) ? date : latest
    );
  }

  private generateReportNo(exhibition: Exhibition): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PR-${year}${month}${day}-${exhibition.id.substring(0, 4).toUpperCase()}-${random}`;
  }

  async generateReportMarkdown(report: ProtectionReport, context: ReportGenerationContext): Promise<string> {
    const { exhibition, gallery, risks } = context;

    let md = `# 光照保护报告\n\n`;
    md += `**报告编号**: ${report.reportNo}\n`;
    md += `**生成时间**: ${new Date(report.generatedAt).toLocaleString('zh-CN')}\n`;
    md += `**生成人**: ${report.generatedBy}\n\n`;

    md += `## 展期信息\n\n`;
    md += `- **展期名称**: ${exhibition.name}\n`;
    md += `- **展厅**: ${gallery.name}\n`;
    md += `- **开始日期**: ${new Date(exhibition.startDate).toLocaleDateString('zh-CN')}\n`;
    md += `- **结束日期**: ${new Date(exhibition.endDate).toLocaleDateString('zh-CN')}\n`;
    md += `- **每日开放时长**: ${exhibition.dailyOpenHours}小时\n`;
    md += `- **状态**: ${this.getExhibitionStatusLabel(exhibition.status)}\n\n`;

    md += `## 风险摘要\n\n`;
    md += `| 风险类型 | 数量 |\n`;
    md += `|---------|------|\n`;
    md += `| 总计 | ${report.riskSummary.totalRisks} |\n`;
    md += `| 照度超限 | ${report.riskSummary.overIllumination} |\n`;
    md += `| 累计漏算 | ${report.riskSummary.cumulativeLeak} |\n`;
    md += `| 光线穿墙 | ${report.riskSummary.lightPenetration} |\n\n`;

    md += `### 按严重程度分布\n\n`;
    md += `| 严重程度 | 数量 |\n`;
    md += `|---------|------|\n`;
    md += `| 严重 | ${report.riskSummary.bySeverity.critical} |\n`;
    md += `| 高 | ${report.riskSummary.bySeverity.high} |\n`;
    md += `| 中 | ${report.riskSummary.bySeverity.medium} |\n`;
    md += `| 低 | ${report.riskSummary.bySeverity.low} |\n\n`;

    if (risks.length > 0) {
      md += `## 风险详情\n\n`;
      for (const risk of risks) {
        const artwork = context.artworks.find(a => a.id === risk.artworkId);
        md += `### ${this.getRiskTypeLabel(risk.type)} - ${this.getSeverityLabel(risk.severity)}\n\n`;
        md += `- **描述**: ${risk.description}\n`;
        if (artwork) md += `- **关联作品**: ${artwork.name}\n`;
        md += `- **测量值**: ${risk.measuredValue.toFixed(2)}\n`;
        md += `- **阈值**: ${risk.threshold}\n`;
        md += `- **超限比例**: ${(risk.exceedRatio * 100).toFixed(1)}%\n`;
        md += `- **检测时间**: ${new Date(risk.detectedAt).toLocaleString('zh-CN')}\n\n`;
      }
    }

    if (report.recommendations.length > 0) {
      md += `## 保护建议\n\n`;
      for (let i = 0; i < report.recommendations.length; i++) {
        const rec = report.recommendations[i];
        const priorityLabel = this.getPriorityLabel(rec.priority);
        md += `${i + 1}. **[${priorityLabel}]** ${rec.suggestion}`;
        if (rec.artworkName) md += ` (作品: ${rec.artworkName})`;
        md += `\n\n`;
      }
    }

    md += `## 数据源\n\n`;
    md += `| 数据类型 | 数量 | 最后更新 |\n`;
    md += `|---------|------|----------|\n`;
    for (const ds of report.dataSources) {
      md += `| ${ds.type} | ${ds.count} | ${new Date(ds.lastUpdated).toLocaleString('zh-CN')} |\n`;
    }

    return md;
  }

  private getExhibitionStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      planning: '规划中',
      ongoing: '进行中',
      ended: '已结束',
    };
    return labels[status] || status;
  }

  private getRiskTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      over_illumination: '照度超限',
      cumulative_leak: '累计漏算',
      light_penetration: '光线穿墙',
    };
    return labels[type] || type;
  }

  private getSeverityLabel(severity: string): string {
    const labels: Record<string, string> = {
      low: '低',
      medium: '中',
      high: '高',
      critical: '严重',
    };
    return labels[severity] || severity;
  }

  private getPriorityLabel(priority: string): string {
    const labels: Record<string, string> = {
      high: '高优先级',
      medium: '中优先级',
      low: '低优先级',
    };
    return labels[priority] || priority;
  }
}

export const reportGenerator = new ReportGenerator();
