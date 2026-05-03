import {
  ReplayData,
  ReplayAction,
  ReviewReport,
  GameState,
  GameConfig
} from '../types';

export class ExportSystem {
  private gameId: string;
  private startTime: number;
  private actions: ReplayAction[];
  private initialConfig: GameConfig;

  constructor(config: GameConfig) {
    this.gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.startTime = Date.now();
    this.actions = [];
    this.initialConfig = JSON.parse(JSON.stringify(config));
  }

  addAction(action: ReplayAction): void {
    this.actions.push(action);
  }

  generateReplayData(finalState: GameState): ReplayData {
    return {
      gameId: this.gameId,
      startTime: this.startTime,
      endTime: Date.now(),
      initialConfig: JSON.parse(JSON.stringify(this.initialConfig)),
      actions: [...this.actions],
      finalState: JSON.parse(JSON.stringify(finalState))
    };
  }

  generateReviewReport(
    finalState: GameState,
    custodianStats: Array<{
      custodianId: string;
      name: string;
      movesMade: number;
      artifactsCollected: number;
      artifactsDeposited: number;
    }>,
    eventsEncountered: Array<{
      turn: number;
      eventName: string;
      eventType: string;
    }>,
    risksDetected: Array<{
      turn: number;
      riskType: string;
      severity: string;
      description: string;
    }>
  ): ReviewReport {
    const totalArtifacts = finalState.totalArtifactsToSecure;
    const securedArtifacts = finalState.securedArtifactsCount;
    const totalTurns = finalState.turn;
    const maxTurns = finalState.maxTurns;

    const performanceSummary = this.generatePerformanceSummary(
      finalState.result,
      securedArtifacts,
      totalArtifacts,
      totalTurns,
      maxTurns,
      risksDetected
    );

    const recommendations = this.generateRecommendations(
      finalState.result,
      securedArtifacts,
      totalArtifacts,
      risksDetected,
      eventsEncountered
    );

    return {
      gameId: this.gameId,
      date: new Date().toISOString().split('T')[0],
      result: finalState.result,
      totalTurns,
      securedArtifacts,
      totalArtifacts,
      custodianStats,
      eventsEncountered,
      risksDetected,
      performanceSummary,
      recommendations
    };
  }

  private generatePerformanceSummary(
    result: string,
    secured: number,
    total: number,
    turns: number,
    maxTurns: number,
    risks: Array<{ severity: string }>
  ): string {
    const successRate = total > 0 ? (secured / total) * 100 : 0;
    const efficiency = maxTurns > 0 ? (turns / maxTurns) * 100 : 0;
    const criticalRisks = risks.filter(r => r.severity === 'critical').length;

    let summary = `## 游戏总结\n\n`;

    if (result === 'victory') {
      summary += `🎉 **结果: 任务成功！\n\n`;
      summary += `✅ 成功转移了所有 ${total} 件文物，用时 ${turns} 回合。\n`;
    } else if (result === 'timeout') {
      summary += `⏰ **结果: 任务超时\n\n`;
      summary += `⚠️ 在 ${turns} 回合内仅转移了 ${secured}/${total} 件文物。\n`;
    } else if (result === 'defeat') {
      summary += `💀 **结果: 任务失败\n\n`;
      summary += `❌ 保管员被安保人员发现，任务终止。\n`;
    } else {
      summary += `🎮 **结果: 游戏进行中\n\n`;
    }

    summary += `\n### 数据统计:\n`;
    summary += `- 成功率: ${successRate.toFixed(1)}%\n`;
    summary += `- 回合效率: ${efficiency.toFixed(1)}%\n`;
    summary += `- 关键风险: ${criticalRisks} 次\n`;

    return summary;
  }

  private generateRecommendations(
    result: string,
    secured: number,
    total: number,
    risks: Array<{ riskType: string; severity: string }>,
    events: Array<{ eventType: string }>
  ): string[] {
    const recommendations: string[] = [];

    const detections = risks.filter(r => r.riskType === 'guardDetection').length;
    const timeouts = risks.filter(r => r.riskType === 'timeout').length;
    const powerFailures = events.filter(e => e.eventType === 'power_outage').length;

    if (result === 'victory') {
      recommendations.push('✅ 任务完成！你的策略规划非常出色。');
      recommendations.push(`🏆 成功转移了 ${secured}/${total} 件文物`);
      if (detections === 0) {
        recommendations.push('🎯 完美规避了所有安保人员的视野，路线规划极佳。');
      }
    }

    if (result === 'timeout') {
      recommendations.push('⏰ 时间管理需要改进。建议：');
      recommendations.push(`  - 仅转移了 ${secured}/${total} 件文物，需要提高效率`);
      recommendations.push('  - 优先规划最短路径');
      recommendations.push('  - 考虑多个保管员同时行动');
      recommendations.push('  - 提前解锁展柜减少等待时间');
    }

    if (result === 'defeat') {
      recommendations.push('🚨 被安保人员发现是主要问题。建议：');
      recommendations.push('  - 仔细观察安保人员的巡逻路线');
      recommendations.push('  - 利用障碍物遮挡视野');
      recommendations.push('  - 在安保人员转向时快速通过');
    }

    if (detections > 0) {
      recommendations.push(`⚠️ 你有 ${detections} 次被安保人员发现的记录。注意观察安保人员的视野范围。`);
    }

    if (timeouts > 0) {
      recommendations.push(`⏳ 时间压力较大。建议在规划时估算每个文物所需的回合数。`);
    }

    if (powerFailures > 0) {
      recommendations.push(`💡 利用停电事件可能改变了游戏策略。停电时安保人员视野减半，这可能是移动的好时机。`);
    }

    if (recommendations.length === 0) {
      recommendations.push('💪 继续练习，提升策略会越来越好！');
    }

    return recommendations;
  }

  downloadReplayJson(replayData: ReplayData): void {
    const dataStr = JSON.stringify(replayData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const fileName = `replay_${this.gameId}.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    linkElement.click();
  }

  downloadReviewReport(report: ReviewReport): void {
    const markdown = this.convertReportToMarkdown(report);
    const dataUri = 'data:text/markdown;charset=utf-8,' + encodeURIComponent(markdown);
    const fileName = `review_report_${this.gameId}.md`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', fileName);
    linkElement.click();
  }

  private convertReportToMarkdown(report: ReviewReport): string {
    let md = `# 博物馆撤展任务评估报告\n\n`;
    md += `---\n\n`;
    
    md += `## 基本信息\n\n`;
    md += `- **游戏ID**: ${report.gameId}\n`;
    md += `- **日期**: ${report.date}\n`;
    md += `- **结果**: ${this.getResultEmoji(report.result)} ${this.getResultText(report.result)}\n`;
    md += `- **总回合数**: ${report.totalTurns}\n`;
    md += `- **已转移文物**: ${report.securedArtifacts}/${report.totalArtifacts}\n\n`;

    md += `## 保管员表现\n\n`;
    md += `| 保管员 | 移动次数 | 收集文物 | 存放文物 |\n`;
    md += `|--------|----------|------------|----------|\n`;
    for (const stat of report.custodianStats) {
      md += `| ${stat.name} | ${stat.movesMade} | ${stat.artifactsCollected} | ${stat.artifactsDeposited} |\n`;
    }
    md += `\n`;

    if (report.eventsEncountered.length > 0) {
      md += `## 遇到的事件\n\n`;
      for (const event of report.eventsEncountered) {
        md += `- **回合 ${event.turn}**: ${event.eventName} (${event.eventType})\n`;
      }
      md += `\n`;
    }

    if (report.risksDetected.length > 0) {
      md += `## 检测到的风险\n\n`;
      for (const risk of report.risksDetected) {
        md += `### 回合 ${risk.turn}\n`;
        md += `- **类型**: ${risk.riskType}\n`;
        md += `- **严重程度**: ${risk.severity}\n`;
        md += `- **描述**: ${risk.description}\n\n`;
      }
    }

    md += `## 表现总结\n\n`;
    md += report.performanceSummary;
    md += `\n\n`;

    md += `## 建议\n\n`;
    for (let i = 0; i < report.recommendations.length; i++) {
      md += `${i + 1}. ${report.recommendations[i]}\n`;
    }

    md += `\n---\n`;
    md += `*报告生成时间: ${new Date().toLocaleString()}\n`;

    return md;
  }

  private getResultEmoji(result: string): string {
    switch (result) {
      case 'victory': return '🎉';
      case 'defeat': return '💀';
      case 'timeout': return '⏰';
      default: return '🎮';
    }
  }

  private getResultText(result: string): string {
    switch (result) {
      case 'victory': return '胜利 - 所有文物已安全转移';
      case 'defeat': return '失败 - 保管员被发现';
      case 'timeout': return '超时 - 时间耗尽';
      default: return '进行中';
    }
  }

  getGameId(): string {
    return this.gameId;
  }

  getActions(): ReplayAction[] {
    return [...this.actions];
  }

  reset(): void {
    this.gameId = `game_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.startTime = Date.now();
    this.actions = [];
  }
}
