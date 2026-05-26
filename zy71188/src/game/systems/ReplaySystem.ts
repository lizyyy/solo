import type { Player, MarkRecord, ReplayFrame } from '../types';

export class ReplaySystem {
  private frames: ReplayFrame[] = [];
  private storageKey = 'warehouse_patrol_replays';

  recordFrame(player: Player, markedRecords: MarkRecord[], timestamp: number): void {
    this.frames.push({
      timestamp,
      player: { ...player },
      markedHazards: [...markedRecords]
    });
  }

  getFrames(): ReplayFrame[] {
    return [...this.frames];
  }

  getFrameAtTime(timestamp: number): ReplayFrame | null {
    if (this.frames.length === 0) return null;
    
    let left = 0;
    let right = this.frames.length - 1;
    
    while (left <= right) {
      const mid = Math.floor((left + right) / 2);
      if (this.frames[mid].timestamp === timestamp) {
        return this.frames[mid];
      } else if (this.frames[mid].timestamp < timestamp) {
        left = mid + 1;
      } else {
        right = mid - 1;
      }
    }
    
    return this.frames[Math.max(0, right)];
  }

  getDuration(): number {
    if (this.frames.length === 0) return 0;
    return this.frames[this.frames.length - 1].timestamp;
  }

  saveToStorage(levelId: number): string {
    const replayId = `replay_${levelId}_${Date.now()}`;
    const replayData = {
      id: replayId,
      levelId,
      timestamp: Date.now(),
      frames: this.frames
    };

    try {
      const existing = this.loadAllFromStorage();
      existing.push(replayData);
      localStorage.setItem(this.storageKey, JSON.stringify(existing.slice(-20)));
      return replayId;
    } catch {
      return '';
    }
  }

  loadAllFromStorage(): Array<{ id: string; levelId: number; timestamp: number; frames: ReplayFrame[] }> {
    try {
      const data = localStorage.getItem(this.storageKey);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  loadFromStorage(replayId: string): ReplayFrame[] | null {
    const replays = this.loadAllFromStorage();
    const replay = replays.find(r => r.id === replayId);
    return replay ? replay.frames : null;
  }

  clear(): void {
    this.frames = [];
  }

  getReplayList(): Array<{ id: string; levelId: number; timestamp: number; frameCount: number }> {
    return this.loadAllFromStorage().map(r => ({
      id: r.id,
      levelId: r.levelId,
      timestamp: r.timestamp,
      frameCount: r.frames.length
    }));
  }
}
