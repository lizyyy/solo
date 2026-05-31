import type { Window, WindowStatus, Submission, Team, AnomalyRecord, SimulationConfig } from '../types';
import { generateId } from '../utils/hash';
import { detectAnomalies, validateMaterials } from '../services/anomalyService';

export interface TickResult {
  updatedWindows: Window[];
  updatedSubmissions: Submission[];
  newAnomalies: AnomalyRecord[];
  completedCount: number;
  shouldCreateSnapshot: boolean;
}

export function initializeWindows(count: number): Window[] {
  const windows: Window[] = [];
  for (let i = 0; i < count; i++) {
    windows.push({
      id: `window_${i + 1}`,
      name: `窗口 ${i + 1}`,
      status: 'idle',
      currentSubmissionId: null,
      queue: [],
    });
  }
  return windows;
}

export function assignToWindow(
  submission: Submission,
  windows: Window[],
  strategy: 'shortest_queue' | 'round_robin' | 'first_available' = 'shortest_queue'
): { windows: Window[]; submission: Submission; assignedWindowId: string | null } {
  let targetWindow: Window | null = null;

  switch (strategy) {
    case 'shortest_queue':
      targetWindow = [...windows].sort((a, b) => a.queue.length - b.queue.length)[0];
      break;
    case 'round_robin':
      const totalQueueLength = windows.reduce((sum, w) => sum + w.queue.length, 0);
      const idx = totalQueueLength % windows.length;
      targetWindow = windows[idx];
      break;
    case 'first_available':
      targetWindow = windows.find((w) => w.status === 'idle') || [...windows].sort((a, b) => a.queue.length - b.queue.length)[0];
      break;
  }

  if (!targetWindow) {
    return { windows, submission, assignedWindowId: null };
  }

  const updatedWindows = windows.map((w) => {
    if (w.id === targetWindow!.id) {
      const newQueue = [...w.queue, submission.id];
      return {
        ...w,
        queue: newQueue,
        status: (w.currentSubmissionId ? 'busy' : 'idle') as WindowStatus,
      };
    }
    return w;
  });

  const updatedSubmission = {
    ...submission,
    windowId: targetWindow.id,
    status: 'queued' as const,
  };

  return {
    windows: updatedWindows,
    submission: updatedSubmission,
    assignedWindowId: targetWindow.id,
  };
}

export function processTick(
  windows: Window[],
  submissions: Submission[],
  teams: Team[],
  config: SimulationConfig,
  currentSimulationTime: number,
  windowCloseTime: number
): TickResult {
  const updatedWindows = JSON.parse(JSON.stringify(windows)) as Window[];
  const updatedSubmissions = JSON.parse(JSON.stringify(submissions)) as Submission[];
  const newAnomalies: AnomalyRecord[] = [];
  let completedCount = 0;
  let shouldCreateSnapshot = false;

  updatedWindows.forEach((window) => {
    if (window.currentSubmissionId) {
      const currentSub = updatedSubmissions.find((s) => s.id === window.currentSubmissionId);
      if (currentSub && currentSub.status === 'processing') {
        const elapsed = currentSimulationTime - currentSub.startTime;
        if (elapsed >= config.processingTimeMs) {
          currentSub.status = 'success';
          currentSub.endTime = currentSimulationTime;
          window.status = 'idle';
          window.currentSubmissionId = null;
          completedCount++;
          shouldCreateSnapshot = true;
        }
      }
    }

    if (!window.currentSubmissionId && window.queue.length > 0) {
      const nextSubId = window.queue.shift()!;
      const nextSub = updatedSubmissions.find((s) => s.id === nextSubId);
      if (nextSub) {
        window.currentSubmissionId = nextSubId;
        window.status = 'busy';
        nextSub.status = 'processing';
        nextSub.startTime = currentSimulationTime;

        const team = teams.find((t) => t.id === nextSub.teamId);
        if (team && config.autoDetectAnomalies) {
          const anomalies = detectAnomalies(
            nextSub,
            team,
            updatedSubmissions,
            windowCloseTime,
            currentSimulationTime
          );
          newAnomalies.push(...anomalies);
          nextSub.anomalies = [...nextSub.anomalies, ...anomalies];
        }

        const validation = validateMaterials(nextSub.materials);
        if (!validation.valid) {
          nextSub.materials = nextSub.materials.map((m) => {
            if (!m.hasIssue && validation.issues.some((i) => i.includes(m.name))) {
              return { ...m, hasIssue: true, issueDesc: validation.issues.find((i) => i.includes(m.name)) };
            }
            return m;
          });
        }

        shouldCreateSnapshot = true;
      }
    }
  });

  return {
    updatedWindows,
    updatedSubmissions,
    newAnomalies,
    completedCount,
    shouldCreateSnapshot,
  };
}

export function addSubmissionToQueue(
  submission: Submission,
  windows: Window[],
  submissions: Submission[],
  teams: Team[],
  preserveHistory: boolean = true
): {
  windows: Window[];
  submissions: Submission[];
  isResubmission: boolean;
  originalSubmissionId?: string;
} {
  const team = teams.find((t) => t.id === submission.teamId);
  const previousSuccess = submissions.find(
    (s) => s.teamId === submission.teamId && s.status === 'success'
  );

  let isResubmission = false;
  let originalSubmissionId: string | undefined;

  if (previousSuccess && preserveHistory) {
    isResubmission = true;
    originalSubmissionId = previousSuccess.id;
    submission.isResubmission = true;
    submission.originalSubmissionId = originalSubmissionId;
    submission.id = generateId('sub');
  }

  const assignment = assignToWindow(submission, windows);
  const updatedSubmissions = [...submissions, assignment.submission];

  if (team) {
    team.submissionCount++;
  }

  return {
    windows: assignment.windows,
    submissions: updatedSubmissions,
    isResubmission,
    originalSubmissionId,
  };
}

export function getQueueStats(windows: Window[], submissions: Submission[]): {
  totalQueued: number;
  totalProcessing: number;
  totalCompleted: number;
  totalFailed: number;
  avgQueueLength: number;
} {
  const totalQueued = submissions.filter((s) => s.status === 'queued').length;
  const totalProcessing = submissions.filter((s) => s.status === 'processing').length;
  const totalCompleted = submissions.filter((s) => s.status === 'success').length;
  const totalFailed = submissions.filter((s) => s.status === 'failed').length;
  const avgQueueLength = windows.reduce((sum, w) => sum + w.queue.length, 0) / windows.length;

  return {
    totalQueued,
    totalProcessing,
    totalCompleted,
    totalFailed,
    avgQueueLength,
  };
}
