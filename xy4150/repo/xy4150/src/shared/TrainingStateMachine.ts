import {
  TrainingPhase,
  TrainingPlan,
  TrainingSession,
  HandActionType,
  ActionResult,
  PainRecord,
  PauseRecord,
  MetronomeBeat,
  InputEvent,
} from './types';
import {
  DEFAULT_BPM,
  DEFAULT_BEATS_PER_MEASURE,
  COUNTDOWN_SECONDS,
  HAND_ACTIONS,
} from './constants';
import { generateId, now, bpmToMs } from './utils';

export interface TrainingStateMachineConfig {
  onBeat?: (beat: MetronomeBeat) => void;
  onActionExpected?: (actionType: HandActionType, stepIndex: number) => void;
  onActionResult?: (result: ActionResult) => void;
  onPhaseChange?: (oldPhase: TrainingPhase, newPhase: TrainingPhase) => void;
  onPainRecorded?: (record: PainRecord) => void;
  onPause?: (record: PauseRecord) => void;
  onResume?: () => void;
  onComplete?: (session: TrainingSession) => void;
  onCountdown?: (remaining: number) => void;
}

export class TrainingStateMachine {
  private plan: TrainingPlan;
  private session: TrainingSession;
  private config: TrainingStateMachineConfig;
  
  private beatInterval: NodeJS.Timeout | null = null;
  private countdownInterval: NodeJS.Timeout | null = null;
  private currentRepeat: number = 0;
  private expectedActionTime: number = 0;
  private actionWindowStart: number = 0;
  private actionWindowEnd: number = 0;
  private hasActionInWindow: boolean = false;
  private pendingPause: PauseRecord | null = null;

  constructor(plan: TrainingPlan, config: TrainingStateMachineConfig = {}) {
    this.plan = plan;
    this.config = config;
    this.session = this.createNewSession();
  }

  private createNewSession(): TrainingSession {
    return {
      id: generateId(),
      planId: this.plan.id,
      planName: this.plan.name,
      startTime: now(),
      endTime: null,
      phase: 'idle',
      currentStepIndex: 0,
      currentBeat: 0,
      actionResults: [],
      painRecords: [],
      pauseRecords: [],
      totalCorrect: 0,
      totalIncorrect: 0,
      totalMissed: 0,
      avgTimingOffset: 0,
    };
  }

  private setPhase(newPhase: TrainingPhase): void {
    const oldPhase = this.session.phase;
    if (oldPhase === newPhase) return;
    
    this.session.phase = newPhase;
    this.config.onPhaseChange?.(oldPhase, newPhase);
  }

  private getActionTypeById(actionId: string): HandActionType {
    const action = HAND_ACTIONS.find((a) => a.id === actionId);
    return action?.type || 'fist';
  }

  private emitBeat(beatNumber: number, isStrongBeat: boolean): void {
    const beat: MetronomeBeat = {
      beatNumber,
      isStrongBeat,
      timestamp: now(),
    };
    this.config.onBeat?.(beat);
  }

  private calculateActionWindow(stepIndex: number): { start: number; end: number } {
    const bpm = this.plan.bpm;
    const beatMs = bpmToMs(bpm);
    const expectedTime = this.expectedActionTime;
    const toleranceMs = Math.min(beatMs * 0.5, 500);
    
    return {
      start: expectedTime - toleranceMs,
      end: expectedTime + toleranceMs,
    };
  }

  private checkForMissedAction(): void {
    if (!this.hasActionInWindow && this.session.phase === 'active') {
      const stepIndex = this.session.currentStepIndex;
      const step = this.plan.steps[stepIndex];
      if (!step) return;

      const expectedAction = this.getActionTypeById(step.actionId);
      const result: ActionResult = {
        stepIndex,
        expectedAction,
        actualAction: null,
        timestamp: now(),
        isCorrect: false,
        timingOffsetMs: 0,
        isMissed: true,
      };

      this.session.actionResults.push(result);
      this.session.totalMissed++;
      this.config.onActionResult?.(result);
    }
  }

  private advanceStep(): void {
    this.checkForMissedAction();
    
    this.session.currentStepIndex++;
    this.currentRepeat = 0;
    this.hasActionInWindow = false;

    if (this.session.currentStepIndex >= this.plan.steps.length) {
      this.completeSession();
    } else {
      this.startNewStep();
    }
  }

  private startNewStep(): void {
    const stepIndex = this.session.currentStepIndex;
    const step = this.plan.steps[stepIndex];
    if (!step) return;

    const actionType = this.getActionTypeById(step.actionId);
    this.config.onActionExpected?.(actionType, stepIndex);
    
    this.expectedActionTime = now() + bpmToMs(this.plan.bpm);
    const window = this.calculateActionWindow(stepIndex);
    this.actionWindowStart = window.start;
    this.actionWindowEnd = window.end;
    this.hasActionInWindow = false;
  }

  private onBeatTick(): void {
    this.session.currentBeat++;
    
    const isStrongBeat = this.session.currentBeat === 1;
    this.emitBeat(this.session.currentBeat, isStrongBeat);

    const step = this.plan.steps[this.session.currentStepIndex];
    if (!step) return;

    this.currentRepeat++;

    if (this.currentRepeat >= step.beatCount) {
      this.advanceStep();
    } else {
      this.expectedActionTime = now() + bpmToMs(this.plan.bpm);
      const window = this.calculateActionWindow(this.session.currentStepIndex);
      this.actionWindowStart = window.start;
      this.actionWindowEnd = window.end;
      
      if (!step.holdBeats || this.currentRepeat < step.beatCount - step.holdBeats) {
        this.hasActionInWindow = false;
      }
    }
  }

  private startBeatLoop(): void {
    const beatMs = bpmToMs(this.plan.bpm);
    this.beatInterval = setInterval(() => {
      this.onBeatTick();
    }, beatMs);
  }

  private stopBeatLoop(): void {
    if (this.beatInterval) {
      clearInterval(this.beatInterval);
      this.beatInterval = null;
    }
  }

  private startCountdown(): void {
    let remaining = COUNTDOWN_SECONDS;
    this.setPhase('countdown');
    
    this.config.onCountdown?.(remaining);
    
    this.countdownInterval = setInterval(() => {
      remaining--;
      this.config.onCountdown?.(remaining);
      
      if (remaining <= 0) {
        this.stopCountdown();
        this.startActivePhase();
      }
    }, 1000);
  }

  private stopCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private startActivePhase(): void {
    this.session.currentStepIndex = 0;
    this.session.currentBeat = 0;
    this.currentRepeat = 0;
    this.setPhase('active');
    this.startNewStep();
    this.startBeatLoop();
  }

  start(): void {
    if (this.session.phase !== 'idle') {
      throw new Error('Training session already started');
    }
    
    this.session.startTime = now();
    this.startCountdown();
  }

  pause(reason?: string): void {
    if (this.session.phase !== 'active') return;

    this.stopBeatLoop();
    this.pendingPause = {
      startTime: now(),
      endTime: 0,
      reason,
      stepIndex: this.session.currentStepIndex,
    };
    this.setPhase('paused');
  }

  resume(): void {
    if (this.session.phase !== 'paused' || !this.pendingPause) return;

    this.pendingPause.endTime = now();
    this.session.pauseRecords.push(this.pendingPause);
    this.config.onPause?.(this.pendingPause);
    this.pendingPause = null;
    
    this.setPhase('active');
    this.config.onResume?.();
    this.startBeatLoop();
  }

  recordPain(intensity: number, note?: string): void {
    const record: PainRecord = {
      timestamp: now(),
      stepIndex: this.session.currentStepIndex,
      intensity,
      note,
    };
    this.session.painRecords.push(record);
    this.config.onPainRecorded?.(record);
  }

  handleInputEvent(event: InputEvent): void {
    if (this.session.phase !== 'active') return;
    if (this.hasActionInWindow) return;

    const currentTime = event.timestamp;
    if (currentTime < this.actionWindowStart || currentTime > this.actionWindowEnd) {
      return;
    }

    const stepIndex = this.session.currentStepIndex;
    const step = this.plan.steps[stepIndex];
    if (!step) return;

    const expectedAction = this.getActionTypeById(step.actionId);
    const isCorrect = event.type === expectedAction;
    const timingOffsetMs = currentTime - this.expectedActionTime;

    const result: ActionResult = {
      stepIndex,
      expectedAction,
      actualAction: event.type,
      timestamp: event.timestamp,
      isCorrect,
      timingOffsetMs,
      isMissed: false,
    };

    this.session.actionResults.push(result);
    
    if (isCorrect) {
      this.session.totalCorrect++;
    } else {
      this.session.totalIncorrect++;
    }

    const validOffsets = this.session.actionResults
      .filter((r) => !r.isMissed && r.isCorrect)
      .map((r) => Math.abs(r.timingOffsetMs));
    this.session.avgTimingOffset = 
      validOffsets.length > 0 
        ? validOffsets.reduce((a, b) => a + b, 0) / validOffsets.length 
        : 0;

    this.hasActionInWindow = true;
    this.config.onActionResult?.(result);
  }

  private completeSession(): void {
    this.stopBeatLoop();
    this.session.endTime = now();
    this.setPhase('completed');
    this.config.onComplete?.(this.session);
  }

  stop(): TrainingSession {
    this.stopBeatLoop();
    this.stopCountdown();
    
    if (this.session.phase === 'paused' && this.pendingPause) {
      this.pendingPause.endTime = now();
      this.session.pauseRecords.push(this.pendingPause);
      this.pendingPause = null;
    }
    
    if (this.session.phase !== 'completed' && this.session.phase !== 'idle') {
      this.session.endTime = now();
    }
    
    this.setPhase('idle');
    return this.getSession();
  }

  getSession(): TrainingSession {
    return { ...this.session };
  }

  getPlan(): TrainingPlan {
    return { ...this.plan };
  }

  isRunning(): boolean {
    return this.session.phase === 'active' || this.session.phase === 'countdown';
  }

  isPaused(): boolean {
    return this.session.phase === 'paused';
  }

  isCompleted(): boolean {
    return this.session.phase === 'completed';
  }
}
