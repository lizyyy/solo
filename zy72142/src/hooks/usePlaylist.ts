import { useCallback, useMemo } from 'react';
import type { Playlist, Track, FilterOptions, AnomalyType } from '../types';
import { mockPlaylist } from '../data/mockData';
import { useLocalStorage } from './useLocalStorage';

const STORAGE_KEY = 'music-playlist-cold-start';

export function usePlaylist() {
  const [playlist, setPlaylist] = useLocalStorage<Playlist>(STORAGE_KEY, mockPlaylist);

  const filterTracks = useCallback(
    (tracks: Track[], filters: FilterOptions): Track[] => {
      return tracks.filter((track) => {
        if (filters.search) {
          const searchLower = filters.search.toLowerCase();
          const matchesSearch =
            track.title.toLowerCase().includes(searchLower) ||
            track.artist.toLowerCase().includes(searchLower) ||
            track.isrc.toLowerCase().includes(searchLower) ||
            track.remark.toLowerCase().includes(searchLower);
          if (!matchesSearch) return false;
        }

        if (filters.status === 'anomaly' && track.anomalyTypes.length === 0) {
          return false;
        }
        if (filters.status === 'normal' && track.anomalyTypes.length > 0) {
          return false;
        }

        if (filters.anomalyType !== 'all') {
          if (!track.anomalyTypes.includes(filters.anomalyType)) {
            return false;
          }
        }

        return true;
      });
    },
    []
  );

  const updateTrackRemark = useCallback(
    (trackId: string, remark: string) => {
      setPlaylist((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        tracks: prev.tracks.map((t) =>
          t.id === trackId
            ? { ...t, remark, updatedAt: new Date().toISOString() }
            : t
        ),
      }));
    },
    [setPlaylist]
  );

  const updateTrackAnomaly = useCallback(
    (trackId: string, anomalyTypes: AnomalyType[]) => {
      setPlaylist((prev) => ({
        ...prev,
        updatedAt: new Date().toISOString(),
        tracks: prev.tracks.map((t) =>
          t.id === trackId
            ? { ...t, anomalyTypes, updatedAt: new Date().toISOString() }
            : t
        ),
      }));
    },
    [setPlaylist]
  );

  const updateVersion = useCallback(
    (version: string) => {
      setPlaylist((prev) => ({
        ...prev,
        version,
        updatedAt: new Date().toISOString(),
      }));
    },
    [setPlaylist]
  );

  const resetToMock = useCallback(() => {
    setPlaylist(mockPlaylist);
  }, [setPlaylist]);

  const anomalyStats = useMemo(() => {
    const stats = {
      total: playlist.tracks.length,
      normal: 0,
      anomaly: 0,
      expired_license: 0,
      timecode_mismatch: 0,
      duplicate_track: 0,
    };

    playlist.tracks.forEach((track) => {
      if (track.anomalyTypes.length > 0) {
        stats.anomaly++;
      } else {
        stats.normal++;
      }
      track.anomalyTypes.forEach((type) => {
        stats[type]++;
      });
    });

    return stats;
  }, [playlist.tracks]);

  return {
    playlist,
    setPlaylist,
    filterTracks,
    updateTrackRemark,
    updateTrackAnomaly,
    updateVersion,
    resetToMock,
    anomalyStats,
  };
}
