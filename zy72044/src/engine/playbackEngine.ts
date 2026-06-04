import type { GameEvent, GameRecord, PlaybackSpeed, PlaybackState } from '@/types/gameTypes';

export function createPlaybackState(record: GameRecord): PlaybackState {
  return {
    isPlaying: false,
    speed: 1,
    currentIndex: 0,
    totalEvents: record.eventLog.length,
  };
}

export function playbackPlay(state: PlaybackState): PlaybackState {
  return { ...state, isPlaying: true };
}

export function playbackPause(state: PlaybackState): PlaybackState {
  return { ...state, isPlaying: false };
}

export function playbackSetSpeed(state: PlaybackState, speed: PlaybackSpeed): PlaybackState {
  return { ...state, speed };
}

export function playbackSeek(state: PlaybackState, index: number): PlaybackState {
  return {
    ...state,
    currentIndex: Math.max(0, Math.min(index, state.totalEvents - 1)),
  };
}

export function playbackStepForward(state: PlaybackState): PlaybackState {
  if (state.currentIndex >= state.totalEvents - 1) {
    return { ...state, isPlaying: false, currentIndex: state.totalEvents - 1 };
  }
  return { ...state, currentIndex: state.currentIndex + 1 };
}

export function playbackStepBackward(state: PlaybackState): PlaybackState {
  if (state.currentIndex <= 0) return state;
  return { ...state, currentIndex: state.currentIndex - 1 };
}

export function getReplayEventsUpToIndex(
  events: GameEvent[],
  index: number
): GameEvent[] {
  return events.slice(0, index + 1);
}

export function findKeyEvents(events: GameEvent[]): number[] {
  const indices: number[] = [];
  events.forEach((event, i) => {
    const hasNegative = Object.values(event.resourceChanges).some(v => typeof v === 'number' && v < 0);
    if (hasNegative || event.type === 'traffic_light') {
      indices.push(i);
    }
  });
  return indices;
}

export function computeReplayResources(
  initialResources: Record<string, number>,
  events: GameEvent[],
  upToIndex: number
): Record<string, number> {
  const resources = { ...initialResources };
  for (let i = 0; i <= upToIndex && i < events.length; i++) {
    for (const [key, delta] of Object.entries(events[i].resourceChanges)) {
      if (typeof delta === 'number') {
        resources[key] = (resources[key] || 0) + delta;
      }
    }
  }
  return resources;
}
