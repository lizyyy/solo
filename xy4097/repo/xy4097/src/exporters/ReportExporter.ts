import {
  ExhibitionConfig,
  TimeSlot,
  SimulationResult,
  RiskSummary,
  HeatZone,
  RiskLevel,
  RiskType,
  ExhibitionElement,
  ScreenshotOptions,
  ReportOptions,
} from '../types';

export class ReportExporter {
  private config: ExhibitionConfig | null = null;
  private timeSlot: TimeSlot | null = null;
  private simulationResult: SimulationResult | null = null;

  setConfig(config: ExhibitionConfig): void {
    this.config = config;
  }

  setTimeSlot(timeSlot: TimeSlot): void {
    this.timeSlot = timeSlot;
  }

  setSimulationResult(result: SimulationResult): void {
    this.simulationResult = result;
  }

  exportPng(dataUrl: string, filename?: string): void {
    const link = document.createElement('a');
    link.download = filename || `screenshot_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }

  exportMarkdown(
    options: ReportOptions = {
      includeScreenshot: false,
      includeRiskAnalysis: true,
      includeRecommendations: true,
    },
    screenshotDataUrl?: string
  ): string {
    if (!this.config || !this.timeSlot || !this.simulationResult) {
      throw new Error('Missing required data for report export');
    }

    const lines: string[] = [];
    const riskSummary = this.simulationResult.riskSummary;

    lines.push(`# 展厅人流热区风险分析报告`);
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');

    lines.push('## 基本信息');
    lines.push('');
    lines.push(`| 项目 | 内容 |`);
    lines.push(`|------|------|`);
    lines.push(`| 展览名称 | ${this.config.exhibitionName} |`);
    lines.push(`| 展馆地点 | ${this.config.venue} |`);
    lines.push(`| 展览日期 | ${this.config.exhibitionDate} |`);
    lines.push(`| 时段 | ${this.timeSlot.startTime} - ${this.timeSlot.endTime} |`);
    lines.push(`| 预计访客数 | ${this.timeSlot.visitorCount} 人 |`);
    lines.push('');

    if (options.includeScreenshot && screenshotDataUrl) {
      lines.push('## 场景预览');
      lines.push('');
      lines.push(`![场景预览](${screenshotDataUrl})`);
      lines.push('');
    }

    lines.push('## 展厅配置');
    lines.push('');
    lines.push(`### 展厅尺寸`);
    lines.push(`- 宽度: ${this.config.floor.width}m`);
    lines.push(`- 深度: ${this.config.floor.depth}m`);
    lines.push(`- 面积: ${(this.config.floor.width * this.config.floor.depth).toFixed(1)} ㎡`);
    lines.push('');

    lines.push('### 展柜列表');
    lines.push('');
    lines.push(`| ID | 名称 | 类型 | 位置 (x, z) | 尺寸 (宽×深×高) |`);
    lines.push(`|----|------|------|-------------|-----------------|`);
    
    for (const element of this.config.elements) {
      const typeName = this.getElementTypeName(element.type);
      lines.push(
        `| ${element.id} | ${element.name} | ${typeName} | ` +
        `(${element.position.x}, ${element.position.z}) | ` +
        `${element.dimensions.width}m × ${element.dimensions.depth}m × ${element.dimensions.height}m |`
      );
    }
    lines.push('');

    lines.push('## 风险汇总');
    lines.push('');
    lines.push('### 整体评估');
    lines.push('');
    
    const overallRisk = this.getOverallRiskLevel(riskSummary);
    const riskEmoji = this.getRiskEmoji(overallRisk);
    const riskColor = this.getRiskColorName(overallRisk);
    
    lines.push(`**整体风险等级: ${riskEmoji} ${riskColor.toUpperCase()}**`);
    lines.push('');

    lines.push('### 统计数据');
    lines.push('');
    lines.push(`| 指标 | 数值 |`);
    lines.push(`|------|------|`);
    lines.push(`| 模拟访客数 | ${riskSummary.totalVisitors} 人 |`);
    lines.push(`| 平均密度 | ${riskSummary.averageDensity.toFixed(2)} 人/㎡ |`);
    lines.push(`| 最大密度 | ${riskSummary.maxDensity.toFixed(2)} 人/㎡ |`);
    lines.push('');

    lines.push('### 风险区域分布');
    lines.push('');
    lines.push(`| 风险等级 | 区域数量 | 占比 |`);
    lines.push(`|----------|----------|------|`);
    
    const totalZones = riskSummary.criticalZones + riskSummary.highZones + 
                       riskSummary.mediumZones + riskSummary.lowZones;
    
    const zoneData = [
      { level: 'critical', label: '严重风险', count: riskSummary.criticalZones, emoji: '🔴' },
      { level: 'high', label: '高风险', count: riskSummary.highZones, emoji: '🟠' },
      { level: 'medium', label: '中风险', count: riskSummary.mediumZones, emoji: '🟡' },
      { level: 'low', label: '低风险', count: riskSummary.lowZones, emoji: '🟢' },
    ];

    for (const zone of zoneData) {
      const percentage = totalZones > 0 ? ((zone.count / totalZones) * 100).toFixed(1) : '0';
      lines.push(`| ${zone.emoji} ${zone.label} | ${zone.count} 个 | ${percentage}% |`);
    }
    lines.push('');

    lines.push('### 风险类型统计');
    lines.push('');
    lines.push(`| 风险类型 | 描述 | 出现次数 |`);
    lines.push(`|----------|------|----------|`);
    lines.push(`| 🚶‍‍‍🚶‍‍‍ 拥挤 | 区域内人员密度过高 | ${riskSummary.congestionCount} |`);
    lines.push(`| ⏸️ 滞留 | 人员在区域内停留时间过长 | ${riskSummary.stagnationCount} |`);
    lines.push(`| ↔️ 逆行 | 人员方向相反可能导致冲突 | ${riskSummary.retrogradeCount} |`);
    lines.push(`| 🚧 瓶颈 | 通道狭窄可能导致堵塞 | ${riskSummary.bottleneckCount} |`);
    lines.push('');

    if (options.includeRiskAnalysis) {
      lines.push('## 详细风险分析');
      lines.push('');

      const highRiskZones = this.simulationResult.heatZones.filter(
        z => z.riskLevel === 'critical' || z.riskLevel === 'high'
      );

      if (highRiskZones.length > 0) {
        lines.push('### 高风险区域详情');
        lines.push('');
        lines.push('| 位置 (x, z) | 风险等级 | 密度 (人/㎡) | 人数 | 风险类型 |');
        lines.push('|--------------|----------|--------------|------|----------|');
        
        for (const zone of highRiskZones.sort((a, b) => b.density - a.density)) {
          const riskTypes = zone.riskType.map(t => this.getRiskTypeName(t)).join(', ');
          const emoji = this.getRiskEmoji(zone.riskLevel);
          lines.push(
            `| (${zone.x}, ${zone.z}) | ${emoji} ${this.getRiskColorName(zone.riskLevel)} | ` +
            `${zone.density.toFixed(2)} | ${zone.visitorCount} | ${riskTypes || '-'} |`
          );
        }
        lines.push('');

        lines.push('### 风险位置图');
        lines.push('');
        
        const minX = -this.config.floor.width / 2;
        const maxX = this.config.floor.width / 2;
        const minZ = -this.config.floor.depth / 2;
        const maxZ = this.config.floor.depth / 2;
        const gridSize = 1;
        
        lines.push('```');
        for (let z = maxZ; z >= minZ; z -= gridSize * 2) {
          let line = '';
          for (let x = minX; x <= maxX; x += gridSize) {
            const zone = this.simulationResult.heatZones.find(
              h => Math.abs(h.x - x) < 0.5 && Math.abs(h.z - z) < 0.5
            );
            if (zone) {
              if (zone.riskLevel === 'critical') line += '🔴';
              else if (zone.riskLevel === 'high') line += '🟠';
              else if (zone.riskLevel === 'medium') line += '🟡';
              else line += '🟢';
            } else {
              line += '⬜';
            }
          }
          lines.push(line);
        }
        lines.push('```');
        lines.push('');
      } else {
        lines.push('✅ 当前配置下没有发现高风险区域。');
        lines.push('');
      }
    }

    if (options.includeRecommendations) {
      lines.push('## 优化建议');
      lines.push('');

      const recommendations = this.generateRecommendations(
        riskSummary,
        this.simulationResult.heatZones,
        this.config
      );

      if (recommendations.length > 0) {
        for (const rec of recommendations) {
          lines.push(`### ${rec.priority} ${rec.title}`);
          lines.push('');
          lines.push(rec.description);
          lines.push('');
          if (rec.suggestions.length > 0) {
            lines.push('**建议措施:**');
            lines.push('');
            for (const suggestion of rec.suggestions) {
              lines.push(`- ${suggestion}`);
            }
            lines.push('');
          }
        }
      } else {
        lines.push('✅ 当前展厅布局合理，人流分布均衡，没有发现明显的风险点。');
        lines.push('');
      }
    }

    lines.push('---');
    lines.push('');
    lines.push('*此报告由「展厅人流热区推演器」自动生成。*');

    return lines.join('\n');
  }

  exportMarkdownFile(
    options?: ReportOptions,
    screenshotDataUrl?: string,
    filename?: string
  ): void {
    const markdown = this.exportMarkdown(options, screenshotDataUrl);
    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = filename || `risk_report_${Date.now()}.md`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
  }

  private getElementTypeName(type: string): string {
    const typeMap: Record<string, string> = {
      exhibit: '展柜',
      entrance: '入口',
      exit: '出口',
      restricted: '禁行区',
      obstacle: '障碍物',
    };
    return typeMap[type] || type;
  }

  private getRiskTypeName(type: RiskType): string {
    const typeMap: Record<RiskType, string> = {
      congestion: '拥挤',
      stagnation: '滞留',
      retrograde: '逆行',
      bottleneck: '瓶颈',
    };
    return typeMap[type] || type;
  }

  private getOverallRiskLevel(summary: RiskSummary): RiskLevel {
    if (summary.criticalZones > 0) return 'critical';
    if (summary.highZones > 0) return 'high';
    if (summary.mediumZones > 0) return 'medium';
    return 'low';
  }

  private getRiskEmoji(level: RiskLevel): string {
    const emojiMap: Record<RiskLevel, string> = {
      critical: '🔴',
      high: '🟠',
      medium: '🟡',
      low: '🟢',
    };
    return emojiMap[level];
  }

  private getRiskColorName(level: RiskLevel): string {
    const colorMap: Record<RiskLevel, string> = {
      critical: '严重',
      high: '高',
      medium: '中',
      low: '低',
    };
    return colorMap[level];
  }

  private generateRecommendations(
    summary: RiskSummary,
    heatZones: HeatZone[],
    config: ExhibitionConfig
  ): Array<{
    priority: string;
    title: string;
    description: string;
    suggestions: string[];
  }> {
    const recommendations: Array<{
      priority: string;
      title: string;
      description: string;
      suggestions: string[];
    }> = [];

    if (summary.criticalZones > 0) {
      const criticalZones = heatZones.filter(z => z.riskLevel === 'critical');
      const positions = criticalZones.map(z => `(${z.x}, ${z.z})`).join(', ');
      
      recommendations.push({
        priority: '【紧急】',
        title: '严重风险区域',
        description: `在位置 ${positions} 发现严重风险区域，密度达到 ${criticalZones[0]?.density.toFixed(2)} 人/㎡，` +
          `远超安全阈值。这可能导致严重的安全事故。`,
        suggestions: [
          '立即调整展柜布局，扩大通道宽度',
          '考虑在该区域设置临时护栏引导人流',
          '增派安全员在该时段值守',
          '考虑分流措施，减少该时段预约人数',
        ],
      });
    }

    if (summary.highZones > 0) {
      const highZones = heatZones.filter(z => z.riskLevel === 'high');
      
      recommendations.push({
        priority: '【重要】',
        title: '高风险区域',
        description: `发现 ${summary.highZones} 个高风险区域，需要引起重视。`,
        suggestions: [
          '分析这些区域是否是展柜排列过密导致',
          '检查入口/出口附近是否是瓶颈',
          '考虑调整观展路线引导',
        ],
      });
    }

    if (summary.bottleneckCount > 0) {
      recommendations.push({
        priority: '【建议】',
        title: '瓶颈通道优化',
        description: `检测到 ${summary.bottleneckCount} 处可能的瓶颈点。瓶颈是最容易导致堵塞的位置。`,
        suggestions: [
          '检查通道宽度是否小于 1.5 米',
          '避免在通道转角处设置展柜',
          '考虑拓宽主要通行通道',
          '入口和出口处避免聚集过多展柜',
        ],
      });
    }

    if (summary.congestionCount > 0) {
      recommendations.push({
        priority: '【建议】',
        title: '人流疏导建议',
        description: `存在 ${summary.congestionCount} 个拥挤区域，需要优化人流动线。`,
        suggestions: [
          '设置单向通行标识，避免逆行',
          '在热门展柜前设置排队区域',
          '考虑增加入口/出口数量',
          '热门展柜分散布置，避免集中',
        ],
      });
    }

    if (summary.stagnationCount > 0) {
      recommendations.push({
        priority: '【提醒】',
        title: '滞留区域调整',
        description: `存在 ${summary.stagnationCount} 个人员滞留区域，可能影响整体观展体验。`,
        suggestions: [
          '检查是否是展柜信息牌位置不佳',
          '考虑设置交互式展项分散人流',
          '在热门展柜前设置观看时间提示',
        ],
      });
    }

    return recommendations;
  }
}
