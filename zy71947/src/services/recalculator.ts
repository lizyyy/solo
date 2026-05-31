import type { TaskSequence, Command, TimeWindow, Adjustment, RecalculateResult } from '../types';
import { TimeService } from './timeService';

interface HistoryEntry {
  sequence: TaskSequence;
  adjustment: Adjustment;
  timestamp: number;
}

export class SequenceRecalculator {
  private historyStack: HistoryEntry[] = [];
  private timeService: TimeService;
  private missionStartTime: Date;

  constructor(missionStartTime: Date) {
    this.missionStartTime = missionStartTime;
    this.timeService = new TimeService(missionStartTime);
  }

  canUndo(): boolean {
    return this.historyStack.length > 0;
  }

  getHistory(): HistoryEntry[] {
    return [...this.historyStack];
  }

  pushToHistory(sequence: TaskSequence, adjustment: Adjustment): void {
    this.historyStack.push({
      sequence: JSON.parse(JSON.stringify(sequence)),
      adjustment: JSON.parse(JSON.stringify(adjustment)),
      timestamp: Date.now(),
    });
  }

  undoLastAdjustment(currentSequence: TaskSequence): { sequence: TaskSequence; result: RecalculateResult } | null {
    if (this.historyStack.length === 0) {
      return null;
    }

    const lastEntry = this.historyStack.pop()!;
    const adjustment = lastEntry.adjustment;

    let newSequence = JSON.parse(JSON.stringify(currentSequence)) as TaskSequence;

    let timeOffset = 0;
    const affectedCommands: string[] = [];

    switch (adjustment.adjustType) {
      case 'INSERT':
        newSequence = this.handleInsertUndo(newSequence, adjustment);
        break;
      case 'MOVE':
        const moveResult = this.handleMoveUndo(newSequence, adjustment);
        newSequence = moveResult.sequence;
        timeOffset = moveResult.timeOffset;
        affectedCommands.push(...moveResult.affectedCommands);
        break;
      case 'DELETE':
        const deleteResult = this.handleDeleteUndo(newSequence, adjustment);
        newSequence = deleteResult.sequence;
        timeOffset = deleteResult.timeOffset;
        affectedCommands.push(...deleteResult.affectedCommands);
        break;
    }

    if (timeOffset !== 0) {
      const recalcResult = this.recalculateSubsequence(
        newSequence,
        adjustment.commandId,
        timeOffset
      );
      newSequence = recalcResult.sequence;
      affectedCommands.push(...recalcResult.affectedCommands);
    }

    newSequence.windows = this.recalculateWindows(newSequence);
    newSequence.adjustments = newSequence.adjustments.filter(a => a.id !== adjustment.id);

    const result: RecalculateResult = {
      affectedCommands: [...new Set(affectedCommands)],
      timeOffset,
      newWindows: newSequence.windows,
      report: this.generateReport(adjustment, affectedCommands, timeOffset),
    };

    return { sequence: newSequence, result };
  }

  private handleInsertUndo(sequence: TaskSequence, adjustment: Adjustment): TaskSequence {
    const cmdIndex = sequence.commands.findIndex(c => c.id === adjustment.commandId);
    if (cmdIndex === -1) return sequence;

    const removedCommand = sequence.commands[cmdIndex];
    const removedDuration = removedCommand.durationSeconds;

    sequence.commands = sequence.commands.filter(c => c.id !== adjustment.commandId);

    for (let i = cmdIndex; i < sequence.commands.length; i++) {
      const cmd = sequence.commands[i];
      const newRelativeSeconds = cmd.time.relativeSeconds - removedDuration;
      cmd.time = TimeService.createTimePoint(newRelativeSeconds, this.missionStartTime);
    }

    return sequence;
  }

  private handleMoveUndo(
    sequence: TaskSequence,
    adjustment: Adjustment
  ): { sequence: TaskSequence; timeOffset: number; affectedCommands: string[] } {
    const cmdIndex = sequence.commands.findIndex(c => c.id === adjustment.commandId);
    if (cmdIndex === -1 || !adjustment.originalTime) {
      return { sequence, timeOffset: 0, affectedCommands: [] };
    }

    const cmd = sequence.commands[cmdIndex];
    const oldTime = cmd.time.relativeSeconds;
    const newTime = adjustment.originalTime.relativeSeconds;
    const timeOffset = newTime - oldTime;

    cmd.time = adjustment.originalTime;
    cmd.adjustments = cmd.adjustments.filter(a => a.id !== adjustment.id);

    const affectedCommands: string[] = [adjustment.commandId];

    for (let i = cmdIndex + 1; i < sequence.commands.length; i++) {
      const nextCmd = sequence.commands[i];
      const newRelativeSeconds = nextCmd.time.relativeSeconds + timeOffset;
      nextCmd.time = TimeService.createTimePoint(newRelativeSeconds, this.missionStartTime);
      affectedCommands.push(nextCmd.id);
    }

    return { sequence, timeOffset, affectedCommands };
  }

  private handleDeleteUndo(
    sequence: TaskSequence,
    adjustment: Adjustment
  ): { sequence: TaskSequence; timeOffset: number; affectedCommands: string[] } {
    if (!adjustment.originalTime) {
      return { sequence, timeOffset: 0, affectedCommands: [] };
    }

    const restoredCommand: Command = {
      id: adjustment.commandId,
      sequenceId: sequence.id,
      payloadName: '已恢复指令',
      commandName: '已恢复指令',
      commandType: 'CONFIG',
      time: adjustment.originalTime,
      durationSeconds: 60,
      reason: `撤回删除操作，原调整原因：${adjustment.reason}`,
      prerequisites: [],
      status: 'SCHEDULED',
      isManualInsert: false,
      adjustments: [],
    };

    const insertIndex = sequence.commands.findIndex(
      c => c.time.relativeSeconds > adjustment.originalTime!.relativeSeconds
    );

    if (insertIndex === -1) {
      sequence.commands.push(restoredCommand);
    } else {
      sequence.commands.splice(insertIndex, 0, restoredCommand);
    }

    const restoredDuration = restoredCommand.durationSeconds;
    const affectedCommands: string[] = [adjustment.commandId];

    for (let i = insertIndex + 1; i < sequence.commands.length; i++) {
      const cmd = sequence.commands[i];
      const newRelativeSeconds = cmd.time.relativeSeconds + restoredDuration;
      cmd.time = TimeService.createTimePoint(newRelativeSeconds, this.missionStartTime);
      affectedCommands.push(cmd.id);
    }

    return { sequence, timeOffset: restoredDuration, affectedCommands };
  }

  private recalculateSubsequence(
    sequence: TaskSequence,
    triggerCommandId: string,
    timeOffset: number
  ): { sequence: TaskSequence; affectedCommands: string[] } {
    const triggerIndex = sequence.commands.findIndex(c => c.id === triggerCommandId);
    if (triggerIndex === -1) {
      return { sequence, affectedCommands: [] };
    }

    const affectedCommands: string[] = [];

    for (let i = triggerIndex + 1; i < sequence.commands.length; i++) {
      const cmd = sequence.commands[i];
      const newRelativeSeconds = cmd.time.relativeSeconds + timeOffset;
      cmd.time = TimeService.createTimePoint(newRelativeSeconds, this.missionStartTime);
      affectedCommands.push(cmd.id);
    }

    return { sequence, affectedCommands };
  }

  private recalculateWindows(sequence: TaskSequence): TimeWindow[] {
    return sequence.windows.map(window => {
      const windowCommands = sequence.commands.filter(c => window.commands.includes(c.id));
      if (windowCommands.length === 0) return window;

      const minTime = Math.min(...windowCommands.map(c => c.time.relativeSeconds));
      const maxTime = Math.max(...windowCommands.map(c => c.time.relativeSeconds + c.durationSeconds));

      return {
        ...window,
        startTime: TimeService.createTimePoint(minTime, this.missionStartTime),
        endTime: TimeService.createTimePoint(maxTime, this.missionStartTime),
      };
    });
  }

  private generateReport(adjustment: Adjustment, affectedCommands: string[], timeOffset: number): string {
    const adjustTypeLabels: Record<string, string> = {
      INSERT: '插入',
      MOVE: '移动',
      DELETE: '删除',
    };

    const direction = timeOffset > 0 ? '延后' : timeOffset < 0 ? '提前' : '无变化';
    const offsetStr = timeOffset !== 0 ? TimeService.formatDuration(Math.abs(timeOffset)) : '0秒';

    return `
撤回操作报告
==================
撤回的调整类型：${adjustTypeLabels[adjustment.adjustType]}
调整人：${adjustment.operator}
原调整原因：${adjustment.reason}

影响分析：
- 受影响指令数量：${affectedCommands.length}条
- 整体时间${direction}：${offsetStr}
- 受影响指令ID：${affectedCommands.join(', ')}

建议：
1. 检查受影响指令与窗口的匹配关系
2. 确认后续载荷开机顺序是否仍然合理
3. 如无问题，可继续当前序列执行
4. 如需恢复原调整，可重新应用该调整
    `.trim();
  }

  clearHistory(): void {
    this.historyStack = [];
  }
}
