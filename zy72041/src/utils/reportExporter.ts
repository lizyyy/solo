import type { GameState, Level, ExportReport, KeyChoice, DeductionSummary } from '@/types';
import { GameEngine } from './gameEngine';

export class ReportExporter {
  static generateReport(state: GameState, level: Level, playerName?: string): ExportReport {
    const correctCount = state.playerChoices.filter(c => c.isCorrect).length;
    const pauseCount = this.countPauses(state);
    const restartCount = state.historyGameIds.length;

    const keyChoices: KeyChoice[] = state.playerChoices.map((choice) => {
      const round = level.rounds[choice.roundId - 1];
      const selectedChoice = round?.choices.find(c => c.id === choice.choiceId);
      const evidence = round?.evidence.find(e => e.highlight) || round?.evidence[0];
      
      return {
        round: choice.roundId,
        roundTitle: round?.title || `第${choice.roundId}回合`,
        choice: selectedChoice?.text || '未知选择',
        isCorrect: choice.isCorrect,
        score: choice.score,
        reason: choice.reason,
        evidence: evidence ? `${evidence.source}: ${evidence.content} = ${evidence.value}` : '无证据',
      };
    });

    const deductionReasons = GameEngine.getDeductionReasons(state, level);
    const deductionSummary: DeductionSummary[] = deductionReasons.map(d => ({
      reason: d.reason,
      evidence: d.evidence,
      deduction: d.deduction,
      round: d.round,
    }));

    return {
      gameId: state.gameId,
      levelTitle: level.title,
      playerName,
      finalScore: state.score,
      maxScore: state.maxScore,
      totalRounds: state.totalRounds,
      correctCount,
      startTime: new Date(state.startTime).toLocaleString('zh-CN'),
      endTime: state.endTime ? new Date(state.endTime).toLocaleString('zh-CN') : new Date().toLocaleString('zh-CN'),
      totalPauseTime: state.totalPauseTime,
      pauseCount,
      restartCount,
      keyChoices,
      deductionSummary,
      teacherNote: level.teacherNote,
      exportedAt: new Date().toLocaleString('zh-CN'),
      source: '地铁客流解谜局',
    };
  }

  private static countPauses(state: GameState): number {
    return state.pausedAt ? 1 : 0;
  }

  static exportAsText(report: ExportReport): string {
    const lines: string[] = [];
    
    lines.push('========================================');
    lines.push('        地铁客流解谜局 - 结算报告');
    lines.push('========================================');
    lines.push('');
    lines.push(`来源：${report.source}`);
    lines.push(`游戏ID：${report.gameId}`);
    lines.push(`关卡：${report.levelTitle}`);
    if (report.playerName) {
      lines.push(`玩家：${report.playerName}`);
    }
    lines.push(`开始时间：${report.startTime}`);
    lines.push(`结束时间：${report.endTime}`);
    lines.push(`导出时间：${report.exportedAt}`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('                  成绩');
    lines.push('----------------------------------------');
    lines.push(`最终得分：${report.finalScore} / ${report.maxScore}`);
    lines.push(`正确率：${report.correctCount} / ${report.totalRounds} (${((report.correctCount / report.totalRounds) * 100).toFixed(1)}%)`);
    lines.push(`暂停次数：${report.pauseCount}`);
    lines.push(`重开次数：${report.restartCount}`);
    lines.push(`总暂停时间：${(report.totalPauseTime / 1000).toFixed(1)} 秒`);
    lines.push('');
    lines.push('----------------------------------------');
    lines.push('              关键选择回顾');
    lines.push('----------------------------------------');
    lines.push('');

    report.keyChoices.forEach((choice) => {
      const status = choice.isCorrect ? '✓ 正确' : '✗ 错误';
      const scoreText = choice.isCorrect ? `+${choice.score}分` : `${choice.score}分`;
      lines.push(`【第${choice.round}回合】${choice.roundTitle}`);
      lines.push(`  状态：${status} (${scoreText})`);
      lines.push(`  选择：${choice.choice}`);
      lines.push(`  原因：${choice.reason}`);
      lines.push(`  证据：${choice.evidence}`);
      lines.push('');
    });

    if (report.deductionSummary.length > 0) {
      lines.push('----------------------------------------');
      lines.push('              扣分原因汇总');
      lines.push('----------------------------------------');
      lines.push('');

      report.deductionSummary.forEach((deduction, index) => {
        lines.push(`${index + 1}. 第${deduction.round}回合：-${deduction.deduction}分`);
        lines.push(`   原因：${deduction.reason}`);
        lines.push(`   证据：${deduction.evidence}`);
        lines.push('');
      });
    }

    if (report.teacherNote) {
      lines.push('----------------------------------------');
      lines.push('              教师评分备注');
      lines.push('----------------------------------------');
      lines.push('');
      lines.push(report.teacherNote);
      lines.push('');
    }

    lines.push('========================================');
    lines.push('        报告结束 - 地铁客流解谜局');
    lines.push('========================================');

    return lines.join('\n');
  }

  static exportAsJSON(report: ExportReport): string {
    return JSON.stringify(report, null, 2);
  }

  static downloadFile(content: string, filename: string, type: string): void {
    try {
      const blob = new Blob([content], { type });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('下载文件失败:', e);
      throw new Error('文件下载失败，请检查浏览器权限');
    }
  }

  static exportReport(state: GameState, level: Level, format: 'txt' | 'json', playerName?: string): void {
    const report = this.generateReport(state, level, playerName);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filename = `地铁客流解谜局-${level.title}-${timestamp}.${format}`;
    
    if (format === 'txt') {
      const content = this.exportAsText(report);
      this.downloadFile(content, filename, 'text/plain;charset=utf-8');
    } else {
      const content = this.exportAsJSON(report);
      this.downloadFile(content, filename, 'application/json;charset=utf-8');
    }
  }

  static getReportPreview(state: GameState, level: Level, playerName?: string): string {
    const report = this.generateReport(state, level, playerName);
    return this.exportAsText(report);
  }
}
