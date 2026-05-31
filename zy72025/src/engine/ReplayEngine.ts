import type { GameSession, GameStep, Resources, ReplayState } from '@/types';
import { deepClone } from '@/utils/helpers';
import { LocalStorage } from '@/storage/LocalStorage';

export class ReplayEngine {
  private state: ReplayState = {
    isPlaying: false,
    currentStepIndex: -1,
    playbackSpeed: 1,
    sessionId: null,
    session: null,
  };

  private intervalId: NodeJS.Timeout | null = null;
  private onStateChange: ((state: ReplayState) => void) | null = null;

  constructor(onStateChange?: (state: ReplayState) => void) {
    if (onStateChange) {
      this.onStateChange = onStateChange;
    }
  }

  setStateChangeListener(listener: (state: ReplayState) => void): void {
    this.onStateChange = listener;
  }

  loadSession(sessionId: string): ReplayState {
    const session = LocalStorage.getSession(sessionId);
    if (!session) {
      throw new Error(`Session ${sessionId} not found`);
    }

    this.stop();
    this.state = {
      isPlaying: false,
      currentStepIndex: -1,
      playbackSpeed: this.state.playbackSpeed,
      sessionId,
      session: deepClone(session),
    };

    this.notifyChange();
    return this.getState();
  }

  unloadSession(): void {
    this.stop();
    this.state = {
      isPlaying: false,
      currentStepIndex: -1,
      playbackSpeed: 1,
      sessionId: null,
      session: null,
    };
    this.notifyChange();
  }

  play(): ReplayState {
    if (!this.state.session) {
      throw new Error('No session loaded');
    }

    if (this.state.isPlaying) {
      return this.getState();
    }

    const totalSteps = this.state.session.stepHistory.length;
    
    if (this.state.currentStepIndex >= totalSteps - 1) {
      this.state.currentStepIndex = -1;
    }

    this.state.isPlaying = true;
    this.startPlayback();
    this.notifyChange();
    return this.getState();
  }

  pause(): ReplayState {
    this.state.isPlaying = false;
    this.stopPlayback();
    this.notifyChange();
    return this.getState();
  }

  toggle(): ReplayState {
    if (this.state.isPlaying) {
      return this.pause();
    }
    return this.play();
  }

  stop(): ReplayState {
    this.state.isPlaying = false;
    this.state.currentStepIndex = -1;
    this.stopPlayback();
    this.notifyChange();
    return this.getState();
  }

  nextStep(): ReplayState {
    if (!this.state.session) {
      throw new Error('No session loaded');
    }

    const totalSteps = this.state.session.stepHistory.length;
    
    if (this.state.currentStepIndex < totalSteps - 1) {
      this.state.currentStepIndex++;
      this.notifyChange();
    }

    return this.getState();
  }

  prevStep(): ReplayState {
    if (!this.state.session) {
      throw new Error('No session loaded');
    }

    if (this.state.currentStepIndex > -1) {
      this.state.currentStepIndex--;
      this.notifyChange();
    }

    return this.getState();
  }

  seekTo(stepIndex: number): ReplayState {
    if (!this.state.session) {
      throw new Error('No session loaded');
    }

    const totalSteps = this.state.session.stepHistory.length;
    const clampedIndex = Math.max(-1, Math.min(stepIndex, totalSteps - 1));
    
    this.state.currentStepIndex = clampedIndex;
    this.notifyChange();
    return this.getState();
  }

  setPlaybackSpeed(speed: number): ReplayState {
    this.state.playbackSpeed = Math.max(0.25, Math.min(speed, 4));
    
    if (this.state.isPlaying) {
      this.stopPlayback();
      this.startPlayback();
    }
    
    this.notifyChange();
    return this.getState();
  }

  getState(): ReplayState {
    return deepClone(this.state);
  }

  getCurrentStep(): GameStep | null {
    if (!this.state.session || this.state.currentStepIndex < 0) {
      return null;
    }
    return this.state.session.stepHistory[this.state.currentStepIndex] || null;
  }

  getCurrentResources(): Resources | null {
    if (!this.state.session) return null;

    if (this.state.currentStepIndex < 0) {
      return this.state.session.currentResources;
    }

    const step = this.getCurrentStep();
    return step ? step.resourcesAfter : null;
  }

  getVisitedNodesUpToCurrent(): string[] {
    if (!this.state.session || !this.state.session) return [];

    const session = this.state.session;
    const visited = new Set<string>();

    const level = LocalStorage.getLevel(session.levelId);
    const startNode = level?.nodes.find((n) => n.type === 'start');
    if (startNode) {
      visited.add(startNode.id);
    }

    for (let i = 0; i <= this.state.currentStepIndex; i++) {
      const step = session.stepHistory[i];
      if (step) {
        visited.add(step.nodeId);
      }
    }

    return Array.from(visited);
  }

  getCurrentNodeId(): string | null {
    if (!this.state.session) return null;

    if (this.state.currentStepIndex < 0) {
      const level = LocalStorage.getLevel(this.state.session.levelId);
      return level?.nodes.find((n) => n.type === 'start')?.id || null;
    }

    const step = this.getCurrentStep();
    return step?.nodeId || null;
  }

  getSession(): GameSession | null {
    return this.state.session ? deepClone(this.state.session) : null;
  }

  getProgress(): number {
    if (!this.state.session) return 0;
    const totalSteps = this.state.session.stepHistory.length;
    if (totalSteps === 0) return 0;
    return (this.state.currentStepIndex + 1) / totalSteps;
  }

  isAtEnd(): boolean {
    if (!this.state.session) return true;
    return this.state.currentStepIndex >= this.state.session.stepHistory.length - 1;
  }

  private startPlayback(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
    }

    const baseInterval = 1500;
    const interval = baseInterval / this.state.playbackSpeed;

    this.intervalId = setInterval(() => {
      if (!this.state.session) return;

      const totalSteps = this.state.session.stepHistory.length;

      if (this.state.currentStepIndex >= totalSteps - 1) {
        this.pause();
        return;
      }

      this.state.currentStepIndex++;
      this.notifyChange();
    }, interval);
  }

  private stopPlayback(): void {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private notifyChange(): void {
    if (this.onStateChange) {
      this.onStateChange(this.getState());
    }
  }

  destroy(): void {
    this.stopPlayback();
    this.onStateChange = null;
  }
}
