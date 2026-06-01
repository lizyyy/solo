import type { GameRound, Operation, ScoreNote, Conflict } from '@/types/game';
import type { TimelineEvent } from '@/types/audit';
import { buildTimeline } from '@/utils/audit';
import { formatTimestamp } from '@/utils/storage';

export interface ReplayState {
  stepIndex: number;
  resources: number;
  score: number;
  risk: number;
  currentEvent: TimelineEvent | null;
  isPlaying: boolean;
  playbackSpeed: number;
}

export class HistoryReplayer {
  private round: GameRound;
  private operations: Operation[];
  private notes: ScoreNote[];
  private conflicts: Conflict[];
  private timeline: TimelineEvent[];
  private state: ReplayState;
  private playInterval: ReturnType<typeof setInterval> | null = null;
  private listeners: Set<(state: ReplayState) => void> = new Set();

  constructor(
    round: GameRound,
    operations: Operation[],
    notes: ScoreNote[] = [],
    conflicts: Conflict[] = []
  ) {
    this.round = round;
    this.operations = operations;
    this.notes = notes;
    this.conflicts = conflicts;
    this.timeline = buildTimeline(round, operations, notes, conflicts);
    this.state = {
      stepIndex: -1,
      resources: round.initialResources,
      score: 0,
      risk: 0,
      currentEvent: null,
      isPlaying: false,
      playbackSpeed: 1000,
    };
  }

  getTimeline(): TimelineEvent[] {
    return this.timeline;
  }

  getState(): ReplayState {
    return { ...this.state };
  }

  getRound(): GameRound {
    return { ...this.round };
  }

  getOperations(): Operation[] {
    return [...this.operations];
  }

  subscribe(listener: (state: ReplayState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    this.listeners.forEach(listener => listener({ ...this.state }));
  }

  reset(): void {
    this.stop();
    this.state = {
      stepIndex: -1,
      resources: this.round.initialResources,
      score: 0,
      risk: 0,
      currentEvent: null,
      isPlaying: false,
      playbackSpeed: this.state.playbackSpeed,
    };
    this.notify();
  }

  goToStep(stepIndex: number): ReplayState {
    if (stepIndex < -1 || stepIndex >= this.timeline.length) {
      return this.state;
    }

    if (stepIndex === -1) {
      this.reset();
      return this.state;
    }

    this.stop();
    this.state.stepIndex = stepIndex;
    this.state.currentEvent = this.timeline[stepIndex];
    
    this.recalculateState(stepIndex);
    this.notify();
    
    return this.state;
  }

  nextStep(): ReplayState {
    if (this.state.stepIndex >= this.timeline.length - 1) {
      return this.state;
    }
    return this.goToStep(this.state.stepIndex + 1);
  }

  prevStep(): ReplayState {
    if (this.state.stepIndex <= -1) {
      return this.state;
    }
    return this.goToStep(this.state.stepIndex - 1);
  }

  play(speed: number = 1000): void {
    this.stop();
    this.state.isPlaying = true;
    this.state.playbackSpeed = speed;
    this.notify();

    this.playInterval = setInterval(() => {
      if (this.state.stepIndex >= this.timeline.length - 1) {
        this.stop();
        return;
      }
      this.nextStep();
    }, speed);
  }

  stop(): void {
    if (this.playInterval) {
      clearInterval(this.playInterval);
      this.playInterval = null;
    }
    this.state.isPlaying = false;
  }

  togglePlay(): void {
    if (this.state.isPlaying) {
      this.stop();
    } else {
      this.play(this.state.playbackSpeed);
    }
  }

  setPlaybackSpeed(speed: number): void {
    this.state.playbackSpeed = speed;
    if (this.state.isPlaying) {
      this.play(speed);
    }
    this.notify();
  }

  private recalculateState(upToStep: number): void {
    let resources = this.round.initialResources;
    let score = 0;
    let risk = 0;

    for (let i = 0; i <= upToStep; i++) {
      const event = this.timeline[i];
      if (event.type === 'operation' && event.metadata) {
        const metadata = event.metadata as Record<string, number>;
        if (typeof metadata.resourcesAfter === 'number') {
          resources = metadata.resourcesAfter;
        }
        if (typeof metadata.scoreAfter === 'number') {
          score = metadata.scoreAfter;
        }
        if (typeof metadata.riskAfter === 'number') {
          risk = metadata.riskAfter;
        }
      }
    }

    this.state.resources = resources;
    this.state.score = score;
    this.state.risk = risk;
  }

  getCurrentStepDescription(): string {
    if (this.state.stepIndex === -1) {
      return `比赛开始前 - 初始资源 ${this.round.initialResources}，目标分数 ${this.round.targetScore}`;
    }

    const event = this.state.currentEvent;
    if (!event) return '';

    return `${formatTimestamp(event.timestamp)} - ${event.title}: ${event.description}`;
  }

  getProgress(): number {
    if (this.timeline.length <= 1) return 0;
    return ((this.state.stepIndex + 1) / this.timeline.length) * 100;
  }

  exportAuditLog(): string {
    const lines: string[] = [];
    
    lines.push('=== 黑胶节拍修复赛 - 审计日志 ===');
    lines.push(`玩家：${this.round.playerName}`);
    lines.push(`关卡：${this.round.levelName}`);
    lines.push(`开始时间：${formatTimestamp(this.round.startTime)}`);
    lines.push(`结束时间：${this.round.endTime ? formatTimestamp(this.round.endTime) : '进行中'}`);
    lines.push('');
    lines.push('=== 操作时间线 ===');
    lines.push('');

    this.timeline.forEach((event, index) => {
      const icon = {
        operation: '[操作]',
        note: '[备注]',
        conflict: '[冲突]',
        status_change: '[状态]',
        judgement: '[裁决]',
      }[event.type];

      lines.push(`${String(index + 1).padStart(3, '0')}. ${formatTimestamp(event.timestamp)} ${icon} ${event.title}`);
      lines.push(`     操作人：${event.operator} | 来源：${event.source}`);
      lines.push(`     描述：${event.description}`);
      if (event.metadata) {
        lines.push(`     详情：${JSON.stringify(event.metadata)}`);
      }
      lines.push('');
    });

    lines.push('=== 最终状态 ===');
    lines.push(`最终分数：${this.round.finalScore} / 目标 ${this.round.targetScore}`);
    lines.push(`最终资源：${this.round.finalResources}`);
    lines.push(`最终风险：${this.round.finalRisk}`);
    lines.push('');
    lines.push('=== 数据冲突 ===');
    
    if (this.conflicts.length === 0) {
      lines.push('无数据冲突');
    } else {
      this.conflicts.forEach(conflict => {
        lines.push(`- 字段：${conflict.field}`);
        lines.push(`  课堂计分表：${conflict.classroomData.value} (${conflict.classroomData.note})`);
        lines.push(`  导入数据：${conflict.importedData.value} (${conflict.importedData.note})`);
        lines.push(`  状态：${conflict.status} | 裁决：${conflict.resolution}`);
        lines.push('');
      });
    }

    return lines.join('\n');
  }

  destroy(): void {
    this.stop();
    this.listeners.clear();
  }
}
