import * as fs from 'fs';
import * as path from 'path';
import {
  SimulationResult,
  RiskEvent,
  RiskType,
  PlanComparisonResult,
  SimulatedPotState,
} from '../types';
import { DateUtils, MathUtils } from '../utils';

const RISK_TYPE_LABELS: Record<RiskType, string> = {
  drought: '缺水',
  waterlogging: '积水',
  rootRot: '烂根',
  etiolation: '徒长',
  fertilizerBurn: '肥害',
};

const RISK_LEVEL_LABELS: Record<string, string> = {
  low: '低',
  medium: '中',
  high: '高',
  critical: '严重',
};

const RISK_LEVEL_COLORS: Record<string, string> = {
  low: '🟢',
  medium: '🟡',
  high: '🟠',
  critical: '🔴',
};

export class ReportGenerator {
  generateTerminalSummary(simulationResult: SimulationResult): string {
    const lines: string[] = [];
    
    lines.push('');
    lines.push('='.repeat(60));
    lines.push(`📊 浇水计划模拟报告: ${simulationResult.planName}`);
    lines.push('='.repeat(60));
    lines.push('');
    
    lines.push('📅 模拟概况:');
    lines.push(`   模拟天数: ${simulationResult.summary.totalDays} 天`);
    lines.push(`   花盆数量: ${simulationResult.summary.totalPots} 盆`);
    lines.push('');
    
    const totalRisks = simulationResult.risks.length;
    if (totalRisks > 0) {
      lines.push('⚠️ 风险统计:');
      
      const riskBreakdown = simulationResult.summary.riskBreakdown;
      for (const [riskType, count] of Object.entries(riskBreakdown)) {
        if (count > 0) {
          const label = RISK_TYPE_LABELS[riskType as RiskType] || riskType;
          lines.push(`   - ${label}: ${count} 次`);
        }
      }
      lines.push('');
      
      const criticalRisks = simulationResult.risks.filter(r => r.riskLevel === 'critical');
      const highRisks = simulationResult.risks.filter(r => r.riskLevel === 'high');
      
      if (criticalRisks.length > 0) {
        lines.push('🔴 严重风险 (需立即处理):');
        for (const risk of criticalRisks.slice(0, 5)) {
          lines.push(`   [${risk.date}] ${risk.potName} (${risk.plantName}): ${risk.description}`);
        }
        if (criticalRisks.length > 5) {
          lines.push(`   ... 还有 ${criticalRisks.length - 5} 个严重风险`);
        }
        lines.push('');
      }
      
      if (highRisks.length > 0) {
        lines.push('🟠 高风险 (需关注):');
        for (const risk of highRisks.slice(0, 5)) {
          lines.push(`   [${risk.date}] ${risk.potName} (${risk.plantName}): ${risk.description}`);
        }
        if (highRisks.length > 5) {
          lines.push(`   ... 还有 ${highRisks.length - 5} 个高风险`);
        }
        lines.push('');
      }
    } else {
      lines.push('✅ 无风险检测');
      lines.push('');
    }
    
    lines.push('🌱 每盆平均含水量:');
    for (const [potId, avgMoisture] of Object.entries(simulationResult.summary.averageMoisturePerPot)) {
      const potStates = simulationResult.potStates.filter(s => s.potId === potId);
      const potName = potStates.length > 0 ? potStates[0].potName : potId;
      const plantName = potStates.length > 0 ? potStates[0].plantName : '';
      lines.push(`   ${potName} (${plantName}): ${avgMoisture}%`);
    }
    lines.push('');
    
    return lines.join('\n');
  }

  generateMarkdownReport(simulationResult: SimulationResult): string {
    const lines: string[] = [];
    
    lines.push(`# 浇水计划模拟报告: ${simulationResult.planName}`);
    lines.push('');
    lines.push(`> 生成时间: ${new Date().toLocaleString('zh-CN')}`);
    lines.push('');
    
    lines.push('## 📋 模拟概况');
    lines.push('');
    lines.push('| 项目 | 值 |');
    lines.push('|------|-----|');
    lines.push(`| 模拟天数 | ${simulationResult.summary.totalDays} 天 |`);
    lines.push(`| 花盆数量 | ${simulationResult.summary.totalPots} 盆 |`);
    lines.push(`| 总风险数 | ${simulationResult.risks.length} |`);
    lines.push('');
    
    lines.push('## 📊 风险统计');
    lines.push('');
    
    const riskBreakdown = simulationResult.summary.riskBreakdown;
    const hasRisks = Object.values(riskBreakdown).some(v => v > 0);
    
    if (hasRisks) {
      lines.push('| 风险类型 | 次数 |');
      lines.push('|----------|------|');
      
      for (const [riskType, count] of Object.entries(riskBreakdown)) {
        if (count > 0) {
          const label = RISK_TYPE_LABELS[riskType as RiskType] || riskType;
          lines.push(`| ${label} | ${count} |`);
        }
      }
      lines.push('');
      
      const risksByDate = this.groupRisksByDate(simulationResult.risks);
      
      lines.push('## ⚠️ 风险详情');
      lines.push('');
      
      for (const [date, risks] of risksByDate) {
        lines.push(`### ${date}`);
        lines.push('');
        
        for (const risk of risks) {
          const levelColor = RISK_LEVEL_COLORS[risk.riskLevel];
          const levelLabel = RISK_LEVEL_LABELS[risk.riskLevel];
          const typeLabel = RISK_TYPE_LABELS[risk.riskType];
          
          lines.push(`**${levelColor} [${levelLabel}] ${typeLabel} - ${risk.potName} (${risk.plantName})**`);
          lines.push('');
          lines.push(`- **风险评分**: ${risk.score}/100`);
          lines.push(`- **描述**: ${risk.description}`);
          lines.push(`- **影响因素**: ${risk.contributingFactors.join(', ')}`);
          lines.push(`- **建议**: ${risk.suggestion}`);
          lines.push('');
        }
      }
    } else {
      lines.push('✅ **无风险检测** - 该浇水计划在模拟期间未检测到任何风险。');
      lines.push('');
    }
    
    lines.push('## 📈 含水量曲线');
    lines.push('');
    
    const moistureByPot = this.groupStatesByPot(simulationResult.potStates);
    
    for (const [potId, states] of moistureByPot) {
      const potName = states.length > 0 ? states[0].potName : potId;
      const plantName = states.length > 0 ? states[0].plantName : '';
      
      lines.push(`### ${potName} (${plantName})`);
      lines.push('');
      
      const dailyMoisture = this.getDailyAverageMoisture(states);
      
      lines.push('| 日期 | 平均含水量 (%) |');
      lines.push('|------|---------------|');
      
      for (const [date, moisture] of dailyMoisture) {
        lines.push(`| ${date} | ${moisture.toFixed(1)} |`);
      }
      lines.push('');
    }
    
    lines.push('## 💡 总体建议');
    lines.push('');
    
    const suggestions = this.generateOverallSuggestions(simulationResult);
    for (const suggestion of suggestions) {
      lines.push(`- ${suggestion}`);
    }
    lines.push('');
    
    return lines.join('\n');
  }

  generateHTMLReport(simulationResult: SimulationResult): string {
    const moistureByPot = this.groupStatesByPot(simulationResult.potStates);
    const risksByDate = this.groupRisksByDate(simulationResult.risks);
    
    const potChartData: Record<string, { labels: string[]; data: number[] }> = {};
    
    for (const [potId, states] of moistureByPot) {
      const dailyMoisture = this.getDailyAverageMoisture(states);
      const labels = Array.from(dailyMoisture.keys());
      const data = Array.from(dailyMoisture.values());
      potChartData[potId] = { labels, data };
    }
    
    const riskBreakdown = simulationResult.summary.riskBreakdown;
    const chartLabels = Object.keys(riskBreakdown).map(k => RISK_TYPE_LABELS[k as RiskType] || k);
    const chartData = Object.values(riskBreakdown);
    
    return `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>浇水计划模拟报告 - ${simulationResult.planName}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #333;
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
      background: #f5f5f5;
    }
    .container { background: white; padding: 40px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
    h1 { color: #2c3e50; margin-bottom: 10px; }
    .subtitle { color: #7f8c8d; margin-bottom: 30px; }
    .summary-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin: 30px 0; }
    .summary-card { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
    .summary-card .value { font-size: 2em; font-weight: bold; color: #3498db; }
    .summary-card .label { color: #7f8c8d; margin-top: 5px; }
    .section { margin: 40px 0; }
    .section h2 { color: #2c3e50; border-bottom: 2px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }
    .risk-table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    .risk-table th, .risk-table td { padding: 12px; text-align: left; border-bottom: 1px solid #ddd; }
    .risk-table th { background: #f8f9fa; font-weight: bold; }
    .risk-badge { padding: 4px 12px; border-radius: 20px; font-size: 0.9em; font-weight: bold; }
    .risk-low { background: #d4edda; color: #155724; }
    .risk-medium { background: #fff3cd; color: #856404; }
    .risk-high { background: #f8d7da; color: #721c24; }
    .risk-critical { background: #dc3545; color: white; }
    .chart-container { height: 300px; margin: 20px 0; background: #f8f9fa; border-radius: 8px; display: flex; align-items: center; justify-content: center; color: #7f8c8d; }
    .suggestion-box { background: #e3f2fd; border-left: 4px solid #2196f3; padding: 20px; margin: 20px 0; border-radius: 4px; }
    .suggestion-box h3 { color: #1976d2; margin-bottom: 10px; }
    .moisture-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }
    .pot-card { background: #f8f9fa; padding: 20px; border-radius: 8px; }
    .pot-card h3 { color: #2c3e50; margin-bottom: 15px; }
    .mini-chart { height: 100px; background: white; border-radius: 4px; margin-bottom: 10px; }
    @media (max-width: 768px) {
      body { padding: 10px; }
      .container { padding: 20px; }
      .summary-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>🌱 浇水计划模拟报告</h1>
    <p class="subtitle">计划: ${simulationResult.planName} | 生成时间: ${new Date().toLocaleString('zh-CN')}</p>
    
    <div class="summary-grid">
      <div class="summary-card">
        <div class="value">${simulationResult.summary.totalDays}</div>
        <div class="label">模拟天数</div>
      </div>
      <div class="summary-card">
        <div class="value">${simulationResult.summary.totalPots}</div>
        <div class="label">花盆数量</div>
      </div>
      <div class="summary-card">
        <div class="value">${simulationResult.risks.length}</div>
        <div class="label">总风险数</div>
      </div>
      <div class="summary-card">
        <div class="value">${Object.values(simulationResult.summary.riskBreakdown).filter(v => v > 0).length}</div>
        <div class="label">风险类型</div>
      </div>
    </div>
    
    <div class="section">
      <h2>📊 风险统计</h2>
      <table class="risk-table">
        <thead>
          <tr>
            <th>风险类型</th>
            <th>次数</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(riskBreakdown).map(([type, count]) => {
            const label = RISK_TYPE_LABELS[type as RiskType] || type;
            return `<tr><td>${label}</td><td>${count}</td></tr>`;
          }).join('')}
        </tbody>
      </table>
    </div>
    
    ${risksByDate.size > 0 ? `
    <div class="section">
      <h2>⚠️ 风险详情</h2>
      ${Array.from(risksByDate.entries()).map(([date, risks]) => `
        <div style="margin: 20px 0; padding: 15px; background: #f8f9fa; border-radius: 8px;">
          <h3 style="color: #2c3e50; margin-bottom: 15px;">📅 ${date}</h3>
          ${risks.map(risk => `
            <div style="background: white; padding: 15px; margin: 10px 0; border-radius: 4px; border-left: 4px solid ${this.getRiskColor(risk.riskLevel)};">
              <div style="display: flex; align-items: center; margin-bottom: 10px;">
                <span class="risk-badge risk-${risk.riskLevel}">${RISK_LEVEL_LABELS[risk.riskLevel]}</span>
                <span style="margin-left: 10px; font-weight: bold;">${RISK_TYPE_LABELS[risk.riskType]} - ${risk.potName} (${risk.plantName})</span>
              </div>
              <p style="margin: 5px 0;"><strong>风险评分:</strong> ${risk.score}/100</p>
              <p style="margin: 5px 0;"><strong>描述:</strong> ${risk.description}</p>
              <p style="margin: 5px 0;"><strong>影响因素:</strong> ${risk.contributingFactors.join(', ')}</p>
              <p style="margin: 5px 0;"><strong>建议:</strong> ${risk.suggestion}</p>
            </div>
          `).join('')}
        </div>
      `).join('')}
    </div>
    ` : `
    <div class="suggestion-box">
      <h3>✅ 无风险检测</h3>
      <p>该浇水计划在模拟期间未检测到任何风险，表现良好。</p>
    </div>
    `}
    
    <div class="section">
      <h2>📈 含水量曲线</h2>
      <div class="moisture-grid">
        ${Array.from(moistureByPot.entries()).map(([potId, states]) => {
          const potName = states.length > 0 ? states[0].potName : potId;
          const plantName = states.length > 0 ? states[0].plantName : '';
          const dailyMoisture = this.getDailyAverageMoisture(states);
          const avgMoisture = MathUtils.average(Array.from(dailyMoisture.values()));
          
          return `
            <div class="pot-card">
              <h3>${potName} (${plantName})</h3>
              <div class="mini-chart" style="position: relative;">
                <div style="position: absolute; bottom: 5px; left: 10px; right: 10px; display: flex; align-items: end; height: 80px;">
                  ${Array.from(dailyMoisture.values()).slice(-14).map((m, i) => {
                    const height = Math.max(10, (m / 100) * 80);
                    return `<div style="flex: 1; margin: 0 1px; background: #3498db; border-radius: 2px 2px 0 0; height: ${height}px;" title="${Array.from(dailyMoisture.keys())[i]}: ${m.toFixed(1)}%"></div>`;
                  }).join('')}
                </div>
              </div>
              <p style="text-align: center; color: #7f8c8d;">平均含水量: ${avgMoisture.toFixed(1)}%</p>
            </div>
          `;
        }).join('')}
      </div>
    </div>
    
    <div class="section">
      <h2>💡 总体建议</h2>
      <div class="suggestion-box">
        <ul style="margin: 0; padding-left: 20px;">
          ${this.generateOverallSuggestions(simulationResult).map(s => `<li>${s}</li>`).join('')}
        </ul>
      </div>
    </div>
  </div>
</body>
</html>
`;
  }

  generateJSONReport(simulationResult: SimulationResult): string {
    const report = {
      planId: simulationResult.planId,
      planName: simulationResult.planName,
      generatedAt: new Date().toISOString(),
      summary: {
        totalDays: simulationResult.summary.totalDays,
        totalPots: simulationResult.summary.totalPots,
        riskBreakdown: simulationResult.summary.riskBreakdown,
        averageMoisturePerPot: simulationResult.summary.averageMoisturePerPot,
      },
      risks: simulationResult.risks.map(risk => ({
        potId: risk.potId,
        potName: risk.potName,
        plantName: risk.plantName,
        date: risk.date,
        riskType: risk.riskType,
        riskTypeLabel: RISK_TYPE_LABELS[risk.riskType],
        riskLevel: risk.riskLevel,
        riskLevelLabel: RISK_LEVEL_LABELS[risk.riskLevel],
        score: risk.score,
        description: risk.description,
        contributingFactors: risk.contributingFactors,
        suggestion: risk.suggestion,
      })),
      moistureData: this.extractMoistureData(simulationResult.potStates),
    };
    
    return JSON.stringify(report, null, 2);
  }

  generateComparisonReport(results: SimulationResult[]): string {
    if (results.length === 0) return '没有可比较的模拟结果';
    
    const lines: string[] = [];
    
    lines.push('='.repeat(80));
    lines.push('📊 浇水计划对比报告');
    lines.push('='.repeat(80));
    lines.push('');
    
    lines.push('📋 计划概览:');
    lines.push('');
    
    const comparisonResults = this.calculateComparisonMetrics(results);
    
    lines.push('| 计划名称 | 总风险数 | 稳定性指数 | 综合评分 |');
    lines.push('|----------|----------|------------|----------|');
    
    for (const result of comparisonResults) {
      lines.push(`| ${result.planName} | ${result.totalRisks} | ${(result.stabilityIndex * 100).toFixed(1)}% | ${(result.overallScore * 100).toFixed(1)} |`);
    }
    lines.push('');
    
    const sortedResults = [...comparisonResults].sort((a, b) => b.overallScore - a.overallScore);
    
    lines.push('🏆 计划排名:');
    lines.push('');
    
    for (let i = 0; i < sortedResults.length; i++) {
      const result = sortedResults[i];
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `  ${i + 1}.`;
      lines.push(`${medal} ${result.planName}`);
      lines.push(`   综合评分: ${(result.overallScore * 100).toFixed(1)} 分`);
      lines.push(`   总风险数: ${result.totalRisks} 个`);
      lines.push(`   稳定性指数: ${(result.stabilityIndex * 100).toFixed(1)}%`);
      lines.push('');
    }
    
    const bestPlan = sortedResults[0];
    const worstPlan = sortedResults[sortedResults.length - 1];
    
    lines.push('💡 分析结论:');
    lines.push('');
    
    if (sortedResults.length > 1) {
      lines.push(`最稳定的计划: **${bestPlan.planName}**`);
      lines.push(`   - 综合评分: ${(bestPlan.overallScore * 100).toFixed(1)} 分`);
      lines.push(`   - 风险数: ${bestPlan.totalRisks} 个 (比最差计划少 ${worstPlan.totalRisks - bestPlan.totalRisks} 个)`);
      lines.push('');
      
      lines.push('各计划风险分布:');
      lines.push('');
      
      for (const result of comparisonResults) {
        lines.push(`**${result.planName}:**`);
        for (const [riskType, count] of Object.entries(result.riskBreakdown)) {
          if (count > 0) {
            const label = RISK_TYPE_LABELS[riskType as RiskType] || riskType;
            lines.push(`   - ${label}: ${count} 次`);
          }
        }
        lines.push('');
      }
    }
    
    return lines.join('\n');
  }

  private getRiskColor(level: string): string {
    switch (level) {
      case 'low': return '#28a745';
      case 'medium': return '#ffc107';
      case 'high': return '#fd7e14';
      case 'critical': return '#dc3545';
      default: return '#6c757d';
    }
  }

  private groupRisksByDate(risks: RiskEvent[]): Map<string, RiskEvent[]> {
    const result = new Map<string, RiskEvent[]>();
    
    for (const risk of risks) {
      if (!result.has(risk.date)) {
        result.set(risk.date, []);
      }
      result.get(risk.date)!.push(risk);
    }
    
    return result;
  }

  private groupStatesByPot(states: SimulatedPotState[]): Map<string, SimulatedPotState[]> {
    const result = new Map<string, SimulatedPotState[]>();
    
    for (const state of states) {
      if (!result.has(state.potId)) {
        result.set(state.potId, []);
      }
      result.get(state.potId)!.push(state);
    }
    
    return result;
  }

  private getDailyAverageMoisture(states: SimulatedPotState[]): Map<string, number> {
    const byDate = new Map<string, number[]>();
    
    for (const state of states) {
      if (!byDate.has(state.date)) {
        byDate.set(state.date, []);
      }
      byDate.get(state.date)!.push(state.soilMoisturePercent);
    }
    
    const result = new Map<string, number>();
    for (const [date, moistures] of byDate) {
      result.set(date, MathUtils.average(moistures));
    }
    
    return result;
  }

  private extractMoistureData(states: SimulatedPotState[]): Record<string, Record<string, number>> {
    const byPot = this.groupStatesByPot(states);
    const result: Record<string, Record<string, number>> = {};
    
    for (const [potId, potStates] of byPot) {
      const dailyMoisture = this.getDailyAverageMoisture(potStates);
      result[potId] = Object.fromEntries(dailyMoisture);
    }
    
    return result;
  }

  private generateOverallSuggestions(simulationResult: SimulationResult): string[] {
    const suggestions: string[] = [];
    const risks = simulationResult.risks;
    
    const droughtCount = risks.filter(r => r.riskType === 'drought').length;
    const waterloggingCount = risks.filter(r => r.riskType === 'waterlogging').length;
    const rootRotCount = risks.filter(r => r.riskType === 'rootRot').length;
    const etiolationCount = risks.filter(r => r.riskType === 'etiolation').length;
    const fertilizerCount = risks.filter(r => r.riskType === 'fertilizerBurn').length;
    
    if (droughtCount > 0) {
      suggestions.push(`检测到 ${droughtCount} 次缺水风险，建议增加浇水频率或每次浇水量`);
    }
    
    if (waterloggingCount > 0) {
      suggestions.push(`检测到 ${waterloggingCount} 次积水风险，建议减少浇水量或检查排水系统`);
    }
    
    if (rootRotCount > 0) {
      suggestions.push(`检测到 ${rootRotCount} 次烂根风险，这是严重问题！请立即减少浇水并改善排水`);
    }
    
    if (etiolationCount > 0) {
      suggestions.push(`检测到 ${etiolationCount} 次徒长风险，建议控制浇水并增加光照`);
    }
    
    if (fertilizerCount > 0) {
      suggestions.push(`检测到 ${fertilizerCount} 次肥害风险，建议减少施肥量或增加浇水稀释`);
    }
    
    if (risks.length === 0) {
      suggestions.push('当前浇水计划表现良好，建议继续保持');
      suggestions.push('定期检查土壤湿度，根据实际情况微调');
    }
    
    return suggestions;
  }

  private calculateComparisonMetrics(results: SimulationResult[]): Array<{
    planId: string;
    planName: string;
    totalRisks: number;
    stabilityIndex: number;
    overallScore: number;
    riskBreakdown: Record<string, number>;
  }> {
    return results.map(result => {
      const totalRisks = result.risks.length;
      const criticalRisks = result.risks.filter(r => r.riskLevel === 'critical').length;
      const highRisks = result.risks.filter(r => r.riskLevel === 'high').length;
      
      const riskPenalty = totalRisks * 5 + criticalRisks * 20 + highRisks * 10;
      const stabilityIndex = Math.max(0, 1 - riskPenalty / 200);
      
      const avgMoistures = Object.values(result.summary.averageMoisturePerPot);
      const moistureVariance = MathUtils.variance(avgMoistures);
      const moistureStability = Math.max(0, 1 - moistureVariance / 1000);
      
      const overallScore = (stabilityIndex * 0.7 + moistureStability * 0.3);
      
      return {
        planId: result.planId,
        planName: result.planName,
        totalRisks,
        stabilityIndex,
        overallScore,
        riskBreakdown: result.summary.riskBreakdown as any,
      };
    });
  }

  writeToFile(content: string, filePath: string): void {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, content, 'utf-8');
  }
}
