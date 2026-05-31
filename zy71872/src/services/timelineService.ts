import type { StateSnapshot, Window, Submission, Draft, AnomalyRecord } from '../types';
import { computeHash, generateId } from '../utils/hash';
import { appendToStorage, loadFromStorage } from '../utils/storage';

export function createSnapshot(
  simulationTime: number,
  windows: Window[],
  submissions: Submission[],
  drafts: Draft[],
  anomalies: AnomalyRecord[],
  previousHash: string = ''
): StateSnapshot {
  const snapshotData = {
    simulationTime,
    windows,
    submissions,
    drafts,
    anomalies,
    previousHash,
    timestamp: Date.now(),
  };

  const snapshot: StateSnapshot = {
    id: generateId('snapshot'),
    timestamp: snapshotData.timestamp,
    simulationTime,
    windows: JSON.parse(JSON.stringify(windows)),
    submissions: JSON.parse(JSON.stringify(submissions)),
    drafts: JSON.parse(JSON.stringify(drafts)),
    anomalies: JSON.parse(JSON.stringify(anomalies)),
    previousHash,
    hash: computeHash(snapshotData),
  };

  appendToStorage('snapshots', snapshot);
  return snapshot;
}

export function getSnapshotAtTime(
  targetTime: number,
  snapshots: StateSnapshot[]
): StateSnapshot | undefined {
  const sorted = [...snapshots].sort((a, b) => a.simulationTime - b.simulationTime);
  return sorted.findLast((s) => s.simulationTime <= targetTime);
}

export function getSnapshotById(id: string, snapshots: StateSnapshot[]): StateSnapshot | undefined {
  return snapshots.find((s) => s.id === id);
}

export function validateSnapshotChain(snapshots: StateSnapshot[]): boolean {
  const sorted = [...snapshots].sort((a, b) => a.timestamp - b.timestamp);
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i].previousHash !== sorted[i - 1].hash) {
      return false;
    }
    const snapshotData = {
      simulationTime: sorted[i].simulationTime,
      windows: sorted[i].windows,
      submissions: sorted[i].submissions,
      drafts: sorted[i].drafts,
      anomalies: sorted[i].anomalies,
      previousHash: sorted[i].previousHash,
      timestamp: sorted[i].timestamp,
    };
    if (sorted[i].hash !== computeHash(snapshotData)) {
      return false;
    }
  }
  return true;
}

export function compareSnapshots(
  snapshot1: StateSnapshot,
  snapshot2: StateSnapshot
): {
  timeDiff: number;
  submissionChanges: { added: string[]; removed: string[]; statusChanged: string[] };
  windowChanges: { id: string; statusChanged: boolean; queueChanged: boolean }[];
  anomalyCount: number;
} {
  const subIds1 = new Set(snapshot1.submissions.map((s) => s.id));
  const subIds2 = new Set(snapshot2.submissions.map((s) => s.id));

  const added = snapshot2.submissions.filter((s) => !subIds1.has(s.id)).map((s) => s.id);
  const removed = snapshot1.submissions.filter((s) => !subIds2.has(s.id)).map((s) => s.id);

  const statusChanged: string[] = [];
  snapshot1.submissions.forEach((s1) => {
    const s2 = snapshot2.submissions.find((s) => s.id === s1.id);
    if (s2 && s1.status !== s2.status) {
      statusChanged.push(`${s1.teamName}: ${s1.status} → ${s2.status}`);
    }
  });

  const windowChanges = snapshot2.windows.map((w2) => {
    const w1 = snapshot1.windows.find((w) => w.id === w2.id);
    return {
      id: w2.id,
      statusChanged: w1 ? w1.status !== w2.status : true,
      queueChanged: w1 ? JSON.stringify(w1.queue) !== JSON.stringify(w2.queue) : true,
    };
  });

  return {
    timeDiff: snapshot2.simulationTime - snapshot1.simulationTime,
    submissionChanges: { added, removed, statusChanged },
    windowChanges,
    anomalyCount: snapshot2.anomalies.length - snapshot1.anomalies.length,
  };
}

export function getTimelineEvents(snapshots: StateSnapshot[]): Array<{
  time: number;
  type: 'submission' | 'anomaly' | 'window' | 'snapshot';
  description: string;
  snapshotId: string;
}> {
  const events: Array<{
    time: number;
    type: 'submission' | 'anomaly' | 'window' | 'snapshot';
    description: string;
    snapshotId: string;
  }> = [];

  const sorted = [...snapshots].sort((a, b) => a.simulationTime - b.simulationTime);

  sorted.forEach((snapshot, index) => {
    if (index === 0) {
      events.push({
        time: snapshot.simulationTime,
        type: 'snapshot',
        description: `仿真开始，共 ${snapshot.submissions.length} 个提交`,
        snapshotId: snapshot.id,
      });
    } else {
      const prev = sorted[index - 1];
      const diff = compareSnapshots(prev, snapshot);

      diff.submissionChanges.added.forEach((id) => {
        const sub = snapshot.submissions.find((s) => s.id === id);
        if (sub) {
          events.push({
            time: snapshot.simulationTime,
            type: 'submission',
            description: `${sub.teamName} 进入排队`,
            snapshotId: snapshot.id,
          });
        }
      });

      diff.submissionChanges.statusChanged.forEach((change) => {
        events.push({
          time: snapshot.simulationTime,
          type: 'submission',
          description: `状态变更: ${change}`,
          snapshotId: snapshot.id,
        });
      });

      if (diff.anomalyCount > 0) {
        events.push({
          time: snapshot.simulationTime,
          type: 'anomaly',
          description: `检测到 ${diff.anomalyCount} 个异常`,
          snapshotId: snapshot.id,
        });
      }
    }
  });

  return events.sort((a, b) => a.time - b.time);
}
