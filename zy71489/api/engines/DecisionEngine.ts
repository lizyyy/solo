import type { Track, Vote, Copyright } from '../../shared/types.js';
import { calculateTotalDuration } from './DurationEngine.js';

export function evaluateDecision(
  selectedTrackIds: string[],
  tracks: Track[],
  votes: Vote[],
  copyrights: Copyright[]
): {
  totalDuration: number;
  totalVotes: number;
  avgStamina: number;
  copyrightRisk: 'none' | 'low' | 'medium' | 'high';
} {
  const selectedTracks = tracks.filter((t) => selectedTrackIds.includes(t.id));

  const totalDuration = calculateTotalDuration(selectedTrackIds, tracks);

  const nonDuplicateVotes = votes.filter((v) => !v.isDuplicate);
  const totalVotes = nonDuplicateVotes.filter((v) => selectedTrackIds.includes(v.trackId)).length;

  let avgStamina = 0;
  if (selectedTracks.length > 0) {
    const totalStamina = selectedTracks.reduce((sum, track) => sum + track.staminaLevel, 0);
    avgStamina = totalStamina / selectedTracks.length;
  }

  const selectedCopyrights = copyrights.filter((c) => selectedTrackIds.includes(c.trackId));

  let copyrightRisk: 'none' | 'low' | 'medium' | 'high' = 'none';

  if (selectedCopyrights.length > 0) {
    const hasExpired = selectedCopyrights.some((c) => c.status === 'expired');
    const hasPending = selectedCopyrights.some((c) => c.status === 'pending');
    const hasRestricted = selectedCopyrights.some((c) => c.status === 'restricted');

    if (hasExpired || hasRestricted) {
      copyrightRisk = 'high';
    } else if (hasPending) {
      copyrightRisk = 'medium';
    } else {
      copyrightRisk = 'low';
    }
  }

  return {
    totalDuration,
    totalVotes,
    avgStamina,
    copyrightRisk,
  };
}
