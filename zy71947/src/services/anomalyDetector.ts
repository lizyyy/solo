import type { TaskSequence, Command, TimeWindow, Anomaly, TimePoint } from '../types';
import { TimeService } from './timeService';

export interface DetectionResult {
  anomalies: Anomaly[];
  summary: {
    windowOverlap: number;
    telemetryMissing: number;
    manualInsert: number;
  };
}

export class AnomalyDetector {
  private timeService: TimeService;
  private missionStartTime: Date;

  constructor(missionStartTime: Date) {
    this.missionStartTime = missionStartTime;
    this.timeService = new TimeService(missionStartTime);
  }

  detect(sequence: TaskSequence): DetectionResult {
    const anomalies: Anomaly[] = [];

    const windowOverlaps = this.detectWindowOverlaps(sequence.windows, sequence.commands);
    const telemetryMissing = this.detectTelemetryGaps(sequence.commands);
    const manualInserts = this.detectManualInserts(sequence.commands);

    anomalies.push(...windowOverlaps, ...telemetryMissing, ...manualInserts);

    const commandsWithAnomalies = sequence.commands.map(cmd => {
      const cmdAnomalies = anomalies.filter(a => a.commandId === cmd.id);
      return {
        ...cmd,
        anomaly: cmdAnomalies.length > 0 ? cmdAnomalies[0] : undefined,
      };
    });

    return {
      anomalies,
      summary: {
        windowOverlap: windowOverlaps.length,
        telemetryMissing: telemetryMissing.length,
        manualInsert: manualInserts.length,
      },
    };
  }

  private detectWindowOverlaps(windows: TimeWindow[], commands: Command[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const sortedWindows = [...windows].sort(
      (a, b) => a.startTime.relativeSeconds - b.startTime.relativeSeconds
    );

    for (let i = 0; i < sortedWindows.length - 1; i++) {
      for (let j = i + 1; j < sortedWindows.length; j++) {
        const win1 = sortedWindows[i];
        const win2 = sortedWindows[j];

        if (
          this.timeService.isOverlap(win1.startTime, win1.endTime, win2.startTime, win2.endTime)
        ) {
          const overlapDuration = this.timeService.getOverlapDuration(
            win1.startTime, win1.endTime, win2.startTime, win2.endTime
          );

          const affectedCommands = [...new Set([...win1.commands, ...win2.commands])];
          const firstCmdId = affectedCommands.length > 0 ? affectedCommands[0] : win1.commands[0];

          anomalies.push({
            id: `anomaly-overlap-${win1.id}-${win2.id}`,
            commandId: firstCmdId,
            anomalyType: 'WINDOW_OVERLAP',
            severity: overlapDuration > 120 ? 'CRITICAL' : 'WARNING',
            title: '时间窗口重叠',
            description: `窗口「${win1.name}」与「${win2.name}」发生时间重叠，重叠时长${TimeService.formatDuration(overlapDuration)}`,
            suggestion: this.generateOverlapSuggestion(win1, win2, overlapDuration),
            relatedCommands: [...win1.commands, ...win2.commands],
            relativeTimeSeconds: win1.startTime.relativeSeconds,
          });
        }
      }
    }

    return anomalies;
  }

  private detectTelemetryGaps(commands: Command[]): Anomaly[] {
    const anomalies: Anomaly[] = [];
    const sortedCommands = [...commands].sort(
      (a, b) => a.time.relativeSeconds - b.time.relativeSeconds
    );

    const NORMAL_GAP_THRESHOLD = 600;

    for (let i = 0; i < sortedCommands.length - 1; i++) {
      const cmd1 = sortedCommands[i];
      const cmd2 = sortedCommands[i + 1];
      const gap = cmd2.time.relativeSeconds - (cmd1.time.relativeSeconds + cmd1.durationSeconds);

      if (gap > NORMAL_GAP_THRESHOLD) {
        anomalies.push({
          id: `anomaly-gap-${cmd1.id}-${cmd2.id}`,
          commandId: cmd2.id,
          anomalyType: 'TELEMETRY_MISSING',
          severity: gap > 1800 ? 'CRITICAL' : 'WARNING',
          title: '遥测数据缺帧',
          description: `指令「${cmd1.commandName}」与「${cmd2.commandName}」之间存在${TimeService.formatDuration(gap)}的空白期，疑似遥测数据中断`,
          suggestion: this.generateGapSuggestion(cmd1, cmd2, gap),
          relatedCommands: [cmd1.id, cmd2.id],
          relativeTimeSeconds: cmd2.time.relativeSeconds,
        });
      }
    }

    return anomalies;
  }

  private detectManualInserts(commands: Command[]): Anomaly[] {
    const anomalies: Anomaly[] = [];

    for (const cmd of commands) {
      if (cmd.isManualInsert && cmd.adjustments.length > 0) {
        const adjustment = cmd.adjustments[0];
        anomalies.push({
          id: `anomaly-manual-${cmd.id}`,
          commandId: cmd.id,
          anomalyType: 'MANUAL_INSERT',
          severity: 'INFO',
          title: '人工插入指令',
          description: `指令「${cmd.commandName}」为人工调整插入，调整人：${adjustment.operator}，原因：${adjustment.reason}`,
          suggestion: this.generateManualSuggestion(cmd),
          relatedCommands: [cmd.id],
          relativeTimeSeconds: cmd.time.relativeSeconds,
        });
      }

      if (cmd.adjustments.some(adj => adj.adjustType === 'MOVE')) {
        const moveAdj = cmd.adjustments.find(adj => adj.adjustType === 'MOVE');
        if (moveAdj && moveAdj.originalTime) {
          const timeDiff = moveAdj.newTime.relativeSeconds - moveAdj.originalTime.relativeSeconds;
          const direction = timeDiff > 0 ? '延后' : '提前';
          anomalies.push({
            id: `anomaly-manual-move-${cmd.id}`,
            commandId: cmd.id,
            anomalyType: 'MANUAL_INSERT',
            severity: 'INFO',
            title: '人工调整指令时间',
            description: `指令「${cmd.commandName}」时间被${direction}${TimeService.formatDuration(Math.abs(timeDiff))}，调整人：${moveAdj.operator}，原因：${moveAdj.reason}`,
            suggestion: this.generateManualSuggestion(cmd),
            relatedCommands: [cmd.id],
            relativeTimeSeconds: cmd.time.relativeSeconds,
          });
        }
      }
    }

    return anomalies;
  }

  private generateOverlapSuggestion(win1: TimeWindow, win2: TimeWindow, duration: number): string {
    if (duration < 60) {
      return `建议：两个窗口仅重叠${TimeService.formatDuration(duration)}，影响较小，可维持现状或微调其中一个窗口的开始时间`;
    } else if (duration < 300) {
      return `建议：考虑合并两个窗口重叠${TimeService.formatDuration(duration)}，建议将「${win2.name}」延后${TimeService.formatDuration(duration + 60)}开始，避免冲突`;
    } else {
      return `严重建议：两个窗口重叠达${TimeService.formatDuration(duration)}，严重影响载荷工作。建议重新规划窗口顺序，优先保障重要载荷的时间安排`;
    }
  }

  private generateGapSuggestion(cmd1: Command, cmd2: Command, gap: number): string {
    if (gap < 1800) {
      return `提示：两个指令间隔${TimeService.formatDuration(gap)}，属于正常任务间隙，建议检查是否有遗漏的遥测下传计划`;
    } else {
      return `警告：两个指令间隔${TimeService.formatDuration(gap)}，时间过长可能导致地面失去对卫星状态的连续监控。建议在此期间插入健康状态检查指令`;
    }
  }

  private generateManualSuggestion(cmd: Command): string {
    return `建议：评估此次人工调整为「${cmd.commandName}」，请确认：
1. 调整是否符合任务优先级要求
2. 对后续指令序列的影响是否已评估
3. 是否需要通知相关载荷主管确认
4. 撤回此次调整可右键点击指令块选择"撤回调整"进行推演`;
  }

  static getAnomaliesByType(anomalies: Anomaly[], type: string): Anomaly[] {
    return anomalies.filter(a => a.anomalyType === type);
  }

  static getAnomaliesBySeverity(anomalies: Anomaly[], severity: string): Anomaly[] {
    return anomalies.filter(a => a.severity === severity);
  }

  static getAnomalyColor(type: string): string {
    switch (type) {
      case 'WINDOW_OVERLAP':
        return '#ff6b6b';
      case 'TELEMETRY_MISSING':
        return '#ffd93d';
      case 'MANUAL_INSERT':
        return '#a855f7';
      default:
        return '#64ffda';
    }
  }

  static getAnomalyLabel(type: string): string {
    switch (type) {
      case 'WINDOW_OVERLAP':
        return '窗口重叠';
      case 'TELEMETRY_MISSING':
        return '遥测缺帧';
      case 'MANUAL_INSERT':
        return '人工调整';
      default:
        return '未知异常';
    }
  }
}
