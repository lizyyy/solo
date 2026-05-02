import {
  TrainingSession,
  TrainingPlan,
  ReportData,
  ScoreResult,
  ChartDataPoint,
  HandActionType,
} from './types';
import { ScoringEngine } from './ScoringEngine';
import { ACTION_TYPE_TO_LABEL, PAIN_LEVELS } from './constants';
import { formatTimestamp, formatDuration } from './utils';

export class ReportGenerator {
  private session: TrainingSession;
  private plan: TrainingPlan;
  private scoringEngine: ScoringEngine;

  constructor(session: TrainingSession, plan: TrainingPlan) {
    this.session = session;
    this.plan = plan;
    this.scoringEngine = new ScoringEngine(session, plan);
  }

  private getScoreGrade(score: number): string {
    if (score >= 90) return '优秀';
    if (score >= 80) return '良好';
    if (score >= 70) return '中等';
    if (score >= 60) return '及格';
    return '需加强';
  }

  private getScoreEmoji(score: number): string {
    if (score >= 90) return '🌟';
    if (score >= 80) return '😊';
    if (score >= 70) return '🙂';
    if (score >= 60) return '😐';
    return '💪';
  }

  private generateHeader(): string {
    return `# 手部康复训练报告

> 生成时间：${formatTimestamp(Date.now())}

---
`;
  }

  private generateBasicInfo(): string {
    const duration = formatDuration(this.session.startTime, this.session.endTime);
    
    return `## 训练基本信息

| 项目 | 内容 |
|------|------|
| 训练方案 | ${this.plan.name} |
| 训练开始时间 | ${formatTimestamp(this.session.startTime)} |
| 训练结束时间 | ${this.session.endTime ? formatTimestamp(this.session.endTime) : '未完成'} |
| 训练时长 | ${duration} |
| 节拍速度 | ${this.plan.bpm} BPM |
| 节拍数/小节 | ${this.plan.beatsPerMeasure} |
| 动作总数 | ${this.plan.steps.length} |

---
`;
  }

  private generateScoreSection(): string {
    const score = this.scoringEngine.getFullScore();
    const overallGrade = this.getScoreGrade(score.overallScore);
    const overallEmoji = this.getScoreEmoji(score.overallScore);

    return `## 综合评分 ${overallEmoji}

### 总体评分：**${score.overallScore.toFixed(1)} 分** (${overallGrade})

| 评分项 | 得分 | 权重 |
|--------|------|------|
| 动作准确率 | ${score.accuracyPercentage.toFixed(1)}% | 50% |
| 节奏稳定性 | ${score.rhythmScore.toFixed(1)} 分 | 20% |
| 时间精准度 | ${score.timingScore.toFixed(1)} 分 | 30% |

### 动作完成统计

- **正确动作**：${score.correctActions} 次
- **错误动作**：${this.session.totalIncorrect} 次
- **遗漏动作**：${score.missedActions} 次
- **总动作数**：${score.totalActions} 次

---
`;
  }

  private generateTimingSection(): string {
    const timingDist = this.scoringEngine.getTimingDistribution();
    const totalValid = timingDist.early + timingDist.onTime + timingDist.late;

    if (totalValid === 0) {
      return `## 时间精准度分析

暂无有效动作数据。

---
`;
    }

    const onTimePercent = totalValid > 0 ? (timingDist.onTime / totalValid) * 100 : 0;
    const earlyPercent = totalValid > 0 ? (timingDist.early / totalValid) * 100 : 0;
    const latePercent = totalValid > 0 ? (timingDist.late / totalValid) * 100 : 0;

    return `## 时间精准度分析

### 时间分布

| 时间状态 | 次数 | 占比 |
|----------|------|------|
| 准时 (+/-100ms) | ${timingDist.onTime} 次 | ${onTimePercent.toFixed(1)}% |
| 提前 | ${timingDist.early} 次 | ${earlyPercent.toFixed(1)}% |
| 滞后 | ${timingDist.late} 次 | ${latePercent.toFixed(1)}% |

### 平均时间偏差

平均偏差：**${this.session.avgTimingOffset.toFixed(0)} ms**

> 提示：偏差越小表示时间把控越精准。理想范围是 +/-100ms。

---
`;
  }

  private generateActionAnalysis(): string {
    const typeStats = this.scoringEngine.getActionTypeStats();
    const lines: string[] = [];

    lines.push('## 各动作分析\n');

    typeStats.forEach((stats, actionType) => {
      const label = ACTION_TYPE_TO_LABEL[actionType] || actionType;
      const emoji = actionType === 'fist' ? '✊' : actionType === 'palm' ? '🖐️' : '🤏';
      
      lines.push(`### ${emoji} ${label}`);
      
      if (stats.total === 0) {
        lines.push('> 暂无该动作数据\n');
      } else {
        lines.push(`- 完成次数：${stats.total} 次`);
        lines.push(`- 正确次数：${stats.correct} 次`);
        lines.push(`- 准确率：**${stats.accuracy.toFixed(1)}%**\n`);
      }
    });

    lines.push('---');
    return lines.join('\n');
  }

  private generatePainSection(): string {
    const painSummary = this.scoringEngine.getPainSummary();

    if (painSummary.totalRecords === 0) {
      return `## 疼痛记录

训练期间无疼痛记录。

---
`;
    }

    const lines: string[] = [];
    lines.push('## 疼痛记录 📝');
    lines.push('');
    lines.push(`- **疼痛记录次数**：${painSummary.totalRecords} 次`);
    lines.push(`- **最大疼痛强度**：${painSummary.maxIntensity} 级 (${PAIN_LEVELS[painSummary.maxIntensity]?.label || '未知'})`);
    lines.push(`- **平均疼痛强度**：${painSummary.avgIntensity.toFixed(1)} 级`);
    lines.push('');

    if (painSummary.byStep.size > 0) {
      lines.push('### 按步骤分布');
      lines.push('');
      lines.push('| 步骤 | 疼痛强度 |');
      lines.push('|------|----------|');
      
      painSummary.byStep.forEach((intensities, stepIndex) => {
        const step = this.plan.steps[stepIndex];
        const stepLabel = step ? `步骤 ${stepIndex + 1}` : `未知步骤`;
        const avgIntensity = intensities.reduce((a, b) => a + b, 0) / intensities.length;
        lines.push(`| ${stepLabel} | ${avgIntensity.toFixed(1)} 级 |`);
      });
    }

    lines.push('');
    lines.push('> 疼痛强度分级：0=无疼痛, 1=轻微, 2=轻度, 3=中度, 4=较重, 5=严重');
    lines.push('');
    lines.push('---');

    return lines.join('\n');
  }

  private generatePauseSection(): string {
    const pauseSummary = this.scoringEngine.getPauseSummary();

    if (pauseSummary.totalPauses === 0) {
      return `## 暂停记录

训练期间无暂停记录。

---
`;
    }

    const formatDurationMs = (ms: number): string => {
      const seconds = Math.floor(ms / 1000);
      const minutes = Math.floor(seconds / 60);
      const remainingSeconds = seconds % 60;
      
      if (minutes > 0) {
        return `${minutes}分${remainingSeconds}秒`;
      }
      return `${remainingSeconds}秒`;
    };

    const lines: string[] = [];
    lines.push('## 暂停记录 ⏸️');
    lines.push('');
    lines.push(`- **暂停次数**：${pauseSummary.totalPauses} 次`);
    lines.push(`- **总暂停时长**：${formatDurationMs(pauseSummary.totalPauseDuration)}`);
    lines.push(`- **平均暂停时长**：${formatDurationMs(pauseSummary.avgPauseDuration)}`);
    lines.push('');

    if (pauseSummary.byStep.size > 0) {
      lines.push('### 按步骤分布');
      lines.push('');
      lines.push('| 步骤 | 暂停时长 |');
      lines.push('|------|----------|');
      
      pauseSummary.byStep.forEach((duration, stepIndex) => {
        const step = this.plan.steps[stepIndex];
        const stepLabel = step ? `步骤 ${stepIndex + 1}` : `未知步骤`;
        lines.push(`| ${stepLabel} | ${formatDurationMs(duration)} |`);
      });
    }

    lines.push('');
    lines.push('---');

    return lines.join('\n');
  }

  private generateStepByStep(): string {
    const chartData = this.scoringEngine.generateChartData();
    
    if (chartData.length === 0) {
      return `## 步骤详情

暂无步骤数据。

---
`;
    }

    const lines: string[] = [];
    lines.push('## 步骤详情');
    lines.push('');
    lines.push('| 步骤 | 动作 | 准确率 | 平均偏差 | 疼痛 |');
    lines.push('|------|------|--------|----------|------|');

    chartData.forEach((data) => {
      const accuracyLabel = data.accuracy > 0 ? `${data.accuracy.toFixed(1)}%` : '-';
      const timingLabel = data.timing > 0 ? `${data.timing.toFixed(0)}ms` : '-';
      const painLabel = data.pain !== null ? `${data.pain} 级` : '-';
      
      lines.push(`| ${data.step} | ${data.action} | ${accuracyLabel} | ${timingLabel} | ${painLabel} |`);
    });

    lines.push('');
    lines.push('---');

    return lines.join('\n');
  }

  private generateSuggestions(): string {
    const score = this.scoringEngine.getFullScore();
    const suggestions: string[] = [];

    if (score.accuracyPercentage < 70) {
      suggestions.push('### 🎯 动作准确性建议');
      suggestions.push('');
      suggestions.push('- 建议先放慢速度，确保每个动作都做对');
      suggestions.push('- 可以先不跟节拍，先熟悉每个动作的要领');
      suggestions.push('- 动作做错时，停下来确认一下动作要求');
      suggestions.push('');
    }

    if (score.timingScore < 70) {
      suggestions.push('### ⏱️ 时间精准度建议');
      suggestions.push('');
      suggestions.push('- 可以先从较慢的节拍开始练习（如 40-50 BPM）');
      suggestions.push('- 尝试在心里数节拍，让动作与节拍同步');
      suggestions.push('- 注意听节拍器的声音，动作要与节拍同时发生');
      suggestions.push('');
    }

    if (score.rhythmScore < 70) {
      suggestions.push('### 🎵 节奏稳定性建议');
      suggestions.push('');
      suggestions.push('- 保持呼吸平稳，避免忽快忽慢');
      suggestions.push('- 可以用脚轻轻打节拍，帮助保持稳定的节奏');
      suggestions.push('- 如果节奏忽快忽慢，建议先降低 BPM 再练习');
      suggestions.push('');
    }

    const painSummary = this.scoringEngine.getPainSummary();
    if (painSummary.totalRecords > 0) {
      suggestions.push('### ⚠️ 疼痛注意事项');
      suggestions.push('');
      
      if (painSummary.maxIntensity >= 3) {
        suggestions.push('- **注意**：训练期间出现中度或以上疼痛，建议咨询治疗师');
      }
      suggestions.push('- 如果某个动作持续引起疼痛，可以考虑减少该动作的次数');
      suggestions.push('- 疼痛时可以暂停休息，不要勉强坚持');
      suggestions.push('');
    }

    if (suggestions.length === 0) {
      suggestions.push('## 训练建议');
      suggestions.push('');
      suggestions.push('### 👍 表现优秀！');
      suggestions.push('');
      suggestions.push('您的训练表现非常出色：');
      suggestions.push('- 动作准确率高');
      suggestions.push('- 时间把控精准');
      suggestions.push('- 节奏稳定');
      suggestions.push('');
      suggestions.push('建议：');
      suggestions.push('- 可以尝试提高节拍速度（增加 BPM）');
      suggestions.push('- 或者尝试更复杂的训练方案');
      suggestions.push('');
    } else {
      suggestions.unshift('## 训练建议');
      suggestions.unshift('');
    }

    suggestions.push('---');
    return suggestions.join('\n');
  }

  private generateFooter(): string {
    return `
## 备注

> 本报告由「手部康复节拍教练」系统自动生成。
> 
> 报告数据仅供参考，如有不适请及时咨询专业治疗师。

---

*报告生成时间：${formatTimestamp(Date.now())}*
`;
  }

  generateReport(): string {
    const sections = [
      this.generateHeader(),
      this.generateBasicInfo(),
      this.generateScoreSection(),
      this.generateTimingSection(),
      this.generateActionAnalysis(),
      this.generateStepByStep(),
      this.generatePainSection(),
      this.generatePauseSection(),
      this.generateSuggestions(),
      this.generateFooter(),
    ];

    return sections.join('\n');
  }

  generateReportData(): ReportData {
    return {
      session: { ...this.session },
      plan: { ...this.plan },
      score: this.scoringEngine.getFullScore(),
      chartData: this.scoringEngine.generateChartData(),
    };
  }

  downloadReport(): void {
    const content = this.generateReport();
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `手部康复报告_${this.session.id.slice(0, 8)}.md`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }
}
