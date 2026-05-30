import type { Track } from '../../shared/types.js';

export function calculateTotalDuration(trackIds: string[], allTracks: Track[]): number {
  const trackMap = new Map<string, Track>();
  for (const track of allTracks) {
    trackMap.set(track.id, track);
  }

  let total = 0;
  for (const trackId of trackIds) {
    const track = trackMap.get(trackId);
    if (track) {
      total += track.duration;
    }
  }

  return total;
}

export function formatDuration(seconds: number): string {
  const totalSeconds = Math.max(0, Math.floor(seconds));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const paddedMinutes = minutes.toString().padStart(hours > 0 ? 2 : 1, '0');
  const paddedSeconds = secs.toString().padStart(2, '0');

  if (hours > 0) {
    return `${hours}:${paddedMinutes}:${paddedSeconds}`;
  }

  return `${paddedMinutes}:${paddedSeconds}`;
}

export function checkDurationLimit(total: number, maxLimit: number): { overLimit: boolean; excess: number } {
  const excess = Math.max(0, total - maxLimit);
  return {
    overLimit: excess > 0,
    excess,
  };
}
