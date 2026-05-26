import type { Hazard, InspectionReport, ScoreBreakdown, LevelConfig } from '../types';
import { ScoreSystem } from './ScoreSystem';

export class ReportSystem {
  private scoreSystem: ScoreSystem;
  private storageKey = 'warehouse_patrol_reports';

  constructor() {
    this.scoreSystem = new ScoreSystem();
  }

  generateReport(
    config: LevelConfig,
    hazards: Hazard[],
    timeRemaining: number,
    totalTime: number,
    scoreBreakdown: ScoreBreakdown
  ): InspectionReport {
    const findings = hazards.map(h => ({
      type: h.type,
      description: h.description,
      found: h.marked && h.markCorrect === true
    }));

    const totalHazards = hazards.filter(h => h.isHazard).length;
    const foundHazards = hazards.filter(h => h.isHazard && h.marked && h.markCorrect).length;
    const missedHazards = totalHazards - foundHazards;
    const wrongMarks = hazards.filter(h => h.marked && !h.markCorrect).length;

    return {
      levelId: config.id,
      levelName: config.name,
      timestamp: Date.now(),
      duration: totalTime - timeRemaining,
      totalHazards,
      foundHazards,
      missedHazards,
      wrongMarks,
      score: scoreBreakdown.totalScore,
      scoreBreakdown,
      findings,
      grade: this.scoreSystem.getGrade(scoreBreakdown.totalScore)
    };
  }

  exportToJSON(report: InspectionReport): string {
    return JSON.stringify(report, null, 2);
  }

  exportToText(report: InspectionReport): string {
    const lines = [
      '========================================',
      '       仓库消防安全巡检报告',
      '========================================',
      '',
      `巡检区域: ${report.levelName}`,
      `巡检时间: ${new Date(report.timestamp).toLocaleString('zh-CN')}`,
      `巡检时长: ${Math.floor(report.duration)}秒`,
      '',
      '----------------------------------------',
      '           巡检结果摘要',
      '----------------------------------------',
      '',
      `隐患总数: ${report.totalHazards}`,
      `已发现: ${report.foundHazards}`,
      `未发现: ${report.missedHazards}`,
      `误报次数: ${report.wrongMarks}`,
      '',
      '----------------------------------------',
      '           详细发现记录',
      '----------------------------------------',
      '',
      ...report.findings.map((f, i) => 
        `${i + 1}. ${f.description} - ${f.found ? '✅ 已发现' : '❌ 未发现'}`
      ),
      '',
      '----------------------------------------',
      '           分数明细',
      '----------------------------------------',
      '',
      `基础分数: ${report.scoreBreakdown.baseScore}`,
      `正确标记: +${report.scoreBreakdown.correctMarks}`,
      `错误标记: ${report.scoreBreakdown.wrongMarks}`,
      `未发现扣分: ${report.scoreBreakdown.missedHazards}`,
      `时间奖励: +${report.scoreBreakdown.timeBonus}`,
      `最终得分: ${report.scoreBreakdown.totalScore}`,
      '',
      `评级: ${report.grade}`,
      '',
      '========================================',
      '           报告生成完毕',
      '========================================'
    ];

    return lines.join('\n');
  }

  downloadReport(report: InspectionReport, format: 'json' | 'txt' = 'txt'): void {
    const content = format === 'json' 
      ? this.exportToJSON(report)
      : this.exportToText(report);
    
    const blob = new Blob([content], { type: format === 'json' ? 'application/json' : 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `inspection_report_${report.levelId}_${Date.now()}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  saveReport(report: InspectionReport): void {
    try {
      const existing = this.loadAllReports();
      existing.push(report);
      localStorage.setItem(this.storageKey, JSON.stringify(existing.slice(-50)));
    } catch {
      console.error('Failed to save report');
    }
  }

  loadAllReports(): InspectionReport[] {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  getReportStats(): { totalGames: number; averageScore: number; bestGrade: string } {
    const reports = this.loadAllReports();
    if (reports.length === 0) {
      return { totalGames: 0, averageScore: 0, bestGrade: '-' };
    }

    const gradeOrder = ['S', 'A', 'B', 'C', 'D', 'F'];
    const grades = reports.map(r => r.grade).sort((a, b) => gradeOrder.indexOf(a) - gradeOrder.indexOf(b));
    const averageScore = Math.round(reports.reduce((sum, r) => sum + r.score, 0) / reports.length);

    return {
      totalGames: reports.length,
      averageScore,
      bestGrade: grades[0]
    };
  }
}
