import type { Track, AnomalyType } from '../types';
import { timecodeToSeconds } from './formatters';

export function detectAnomalies(tracks: Track[]): Map<string, AnomalyType[]> {
  const anomalies = new Map<string, AnomalyType[]>();
  const seenIsrc = new Map<string, string>();
  const seenTitleArtist = new Map<string, string>();

  tracks.forEach((track, index) => {
    const trackAnomalies: AnomalyType[] = [];

    if (track.licenseStatus === 'expired') {
      trackAnomalies.push('expired_license');
    }

    if (track.isrc) {
      if (seenIsrc.has(track.isrc)) {
        trackAnomalies.push('duplicate_track');
        const prevTrackId = seenIsrc.get(track.isrc)!;
        if (!anomalies.get(prevTrackId)?.includes('duplicate_track')) {
          const prevAnomalies = anomalies.get(prevTrackId) || [];
          anomalies.set(prevTrackId, [...prevAnomalies, 'duplicate_track']);
        }
      } else {
        seenIsrc.set(track.isrc, track.id);
      }
    }

    const titleArtistKey = `${track.title}|${track.artist}`;
    if (track.title && track.artist) {
      if (seenTitleArtist.has(titleArtistKey) && !trackAnomalies.includes('duplicate_track')) {
        trackAnomalies.push('duplicate_track');
        const prevTrackId = seenTitleArtist.get(titleArtistKey)!;
        if (!anomalies.get(prevTrackId)?.includes('duplicate_track')) {
          const prevAnomalies = anomalies.get(prevTrackId) || [];
          anomalies.set(prevTrackId, [...prevAnomalies, 'duplicate_track']);
        }
      } else {
        seenTitleArtist.set(titleArtistKey, track.id);
      }
    }

    if (index > 0 && track.timecode) {
      const prevTrack = tracks[index - 1];
      const prevEndTime = timecodeToSeconds(prevTrack.timecode) + prevTrack.duration;
      const currentStartTime = timecodeToSeconds(track.timecode);
      if (currentStartTime < prevEndTime && track.timecode && prevTrack.timecode) {
        trackAnomalies.push('timecode_mismatch');
      }
    }

    if (trackAnomalies.length > 0) {
      anomalies.set(track.id, trackAnomalies);
    }
  });

  return anomalies;
}

export function getAnomalyCounts(tracks: Track[]): Record<AnomalyType, number> {
  const counts: Record<AnomalyType, number> = {
    expired_license: 0,
    timecode_mismatch: 0,
    duplicate_track: 0,
  };

  tracks.forEach((track) => {
    track.anomalyTypes.forEach((type) => {
      counts[type]++;
    });
  });

  return counts;
}
