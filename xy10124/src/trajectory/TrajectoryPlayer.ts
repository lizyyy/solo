import { Trajectory, TrajectoryPoint, JointState } from '../types';

export type PlaybackState = 'idle' | 'playing' | 'paused';

export interface PlayerState {
  state: PlaybackState;
  currentPointIndex: number;
  currentTime: number;
  currentPoint: TrajectoryPoint | null;
  speed: number;
}

export class TrajectoryPlayer {
  private trajectory: Trajectory | null = null;
  private state: PlaybackState = 'idle';
  private currentPointIndex: number = 0;
  private currentTime: number = 0;
  private speed: number = 1;
  private lastTimestamp: number = 0;
  private animationFrameId: number = 0;
  private onUpdateCallbacks: Array<(state: PlayerState) => void> = [];

  setTrajectory(trajectory: Trajectory): void {
    this.trajectory = trajectory;
    this.reset();
  }

  clearTrajectory(): void {
    this.trajectory = null;
    this.reset();
  }

  play(): void {
    if (!this.trajectory || this.trajectory.points.length === 0) return;
    if (this.state === 'playing') return;

    if (this.currentPointIndex >= this.trajectory.points.length - 1) {
      this.currentPointIndex = 0;
      this.currentTime = 0;
    }

    this.state = 'playing';
    this.lastTimestamp = performance.now();
    this.animate();
  }

  pause(): void {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    cancelAnimationFrame(this.animationFrameId);
    this.notifyUpdate();
  }

  stop(): void {
    this.state = 'idle';
    cancelAnimationFrame(this.animationFrameId);
    this.reset();
    this.notifyUpdate();
  }

  stepForward(): void {
    if (!this.trajectory) return;
    if (this.currentPointIndex < this.trajectory.points.length - 1) {
      this.currentPointIndex++;
      this.currentTime = this.trajectory.points[this.currentPointIndex].timestamp;
      this.notifyUpdate();
    }
  }

  stepBackward(): void {
    if (!this.trajectory) return;
    if (this.currentPointIndex > 0) {
      this.currentPointIndex--;
      this.currentTime = this.trajectory.points[this.currentPointIndex].timestamp;
      this.notifyUpdate();
    }
  }

  goToIndex(index: number): void {
    if (!this.trajectory || index < 0 || index >= this.trajectory.points.length) return;
    this.currentPointIndex = index;
    this.currentTime = this.trajectory.points[index].timestamp;
    this.notifyUpdate();
  }

  goToTime(time: number): void {
    if (!this.trajectory) return;
    const clampedTime = Math.max(0, Math.min(time, this.trajectory.totalTime));
    
    let closestIndex = 0;
    let minDiff = Infinity;
    
    this.trajectory.points.forEach((point, index) => {
      const diff = Math.abs(point.timestamp - clampedTime);
      if (diff < minDiff) {
        minDiff = diff;
        closestIndex = index;
      }
    });

    this.currentPointIndex = closestIndex;
    this.currentTime = clampedTime;
    this.notifyUpdate();
  }

  setSpeed(speed: number): void {
    this.speed = Math.max(0.1, Math.min(speed, 10));
  }

  getSpeed(): number {
    return this.speed;
  }

  getState(): PlayerState {
    return {
      state: this.state,
      currentPointIndex: this.currentPointIndex,
      currentTime: this.currentTime,
      currentPoint: this.getCurrentPoint(),
      speed: this.speed
    };
  }

  getCurrentPoint(): TrajectoryPoint | null {
    if (!this.trajectory || this.trajectory.points.length === 0) return null;
    return this.trajectory.points[this.currentPointIndex] || null;
  }

  getCurrentJointState(): JointState | null {
    const point = this.getCurrentPoint();
    return point ? point.joints : null;
  }

  addUpdateCallback(callback: (state: PlayerState) => void): void {
    this.onUpdateCallbacks.push(callback);
  }

  removeUpdateCallback(callback: (state: PlayerState) => void): void {
    this.onUpdateCallbacks = this.onUpdateCallbacks.filter((cb) => cb !== callback);
  }

  private animate(): void {
    if (this.state !== 'playing') return;

    const now = performance.now();
    const deltaTime = (now - this.lastTimestamp) / 1000;
    this.lastTimestamp = now;

    if (this.trajectory) {
      this.currentTime += deltaTime * this.speed;

      if (this.currentTime >= this.trajectory.totalTime) {
        this.currentTime = this.trajectory.totalTime;
        this.currentPointIndex = this.trajectory.points.length - 1;
        this.state = 'idle';
        this.notifyUpdate();
        return;
      }

      while (
        this.currentPointIndex < this.trajectory.points.length - 1 &&
        this.trajectory.points[this.currentPointIndex + 1].timestamp <= this.currentTime
      ) {
        this.currentPointIndex++;
      }
    }

    this.notifyUpdate();
    this.animationFrameId = requestAnimationFrame(() => this.animate());
  }

  private reset(): void {
    this.currentPointIndex = 0;
    this.currentTime = 0;
    this.notifyUpdate();
  }

  private notifyUpdate(): void {
    const state = this.getState();
    this.onUpdateCallbacks.forEach((cb) => cb(state));
  }

  dispose(): void {
    cancelAnimationFrame(this.animationFrameId);
    this.onUpdateCallbacks = [];
  }
}
