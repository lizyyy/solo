import type { Track, Vote, Copyright, FilterCriteria } from '../../shared/types.js';

export function filterTracks(
  tracks: Track[],
  votes: Vote[],
  copyrights: Copyright[],
  filters: FilterCriteria
): Track[] {
  const copyrightMap = new Map<string, Copyright>();
  for (const cr of copyrights) {
    copyrightMap.set(cr.trackId, cr);
  }

  const voteCountMap = new Map<string, number>();
  for (const vote of votes) {
    if (!vote.isDuplicate) {
      voteCountMap.set(vote.trackId, (voteCountMap.get(vote.trackId) || 0) + 1);
    }
  }

  const allowedCopyrightStatuses: Array<Copyright['status']> = filters.copyrightStatus || ['active', 'pending'];

  return tracks.filter((track) => {
    const copyright = copyrightMap.get(track.id);

    if (copyright) {
      if (copyright.status === 'expired' && !allowedCopyrightStatuses.includes('expired')) {
        return false;
      }

      if (!allowedCopyrightStatuses.includes(copyright.status)) {
        return false;
      }
    }

    if (filters.minVotes !== undefined) {
      const voteCount = voteCountMap.get(track.id) || 0;
      if (voteCount < filters.minVotes) {
        return false;
      }
    }

    if (filters.maxDuration !== undefined) {
      if (track.duration > filters.maxDuration) {
        return false;
      }
    }

    if (filters.maxStamina !== undefined) {
      if (track.staminaLevel > filters.maxStamina) {
        return false;
      }
    }

    if (filters.searchKeyword && filters.searchKeyword.trim()) {
      const keyword = filters.searchKeyword.toLowerCase().trim();
      const trackName = track.name.toLowerCase();
      const artistName = track.artist.toLowerCase();
      const notes = track.notes?.toLowerCase() || '';

      if (!trackName.includes(keyword) && !artistName.includes(keyword) && !notes.includes(keyword)) {
        return false;
      }
    }

    return true;
  });
}
