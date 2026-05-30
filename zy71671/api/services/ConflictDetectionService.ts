import KeyValidationService from './KeyValidationService';
import DurationService from './DurationService';
import VersionControlService from './VersionControlService';
import type { Song, Conflict, ConflictType, Severity, Setlist } from '../../shared/types';
import { isValidKey } from '../utils/musicTheory';

export const ConflictDetectionService = {
  detectKeyConflicts: (songs: Song[]): Conflict[] => {
    const conflicts: Conflict[] = [];

    for (const song of songs) {
      if (!isValidKey(song.currentKey)) {
        const keyCheck = KeyValidationService.validateKeyFormat(song.currentKey);
        const trace = buildFieldTrace(song, 'currentKey');

        conflicts.push({
          type: 'key_conflict',
          severity: 'error',
          songId: song.id,
          songName: song.name,
          message: keyCheck.message,
          suggestion: keyCheck.suggestion || '请检查并修正调号',
          trace,
        });
      }

      if (!isValidKey(song.originalKey)) {
        const keyCheck = KeyValidationService.validateKeyFormat(song.originalKey);
        const trace = buildFieldTrace(song, 'originalKey');

        conflicts.push({
          type: 'key_conflict',
          severity: 'error',
          songId: song.id,
          songName: song.name,
          message: `原调：${keyCheck.message}`,
          suggestion: keyCheck.suggestion || '请检查并修正原调',
          trace,
        });
      }
    }

    return conflicts;
  },

  detectVocalRangeConflicts: (songs: Song[]): Conflict[] => {
    const conflicts: Conflict[] = [];

    for (const song of songs) {
      const vocalCheck = KeyValidationService.validateVocalRange(song);
      if (!vocalCheck.passed && song.vocalRange) {
        const trace = buildFieldTrace(song, 'vocalRange');

        conflicts.push({
          type: 'vocal_range',
          severity: 'warning',
          songId: song.id,
          songName: song.name,
          message: vocalCheck.message,
          suggestion: '建议进一步降调或更换曲目顺序',
          trace,
        });
      }
    }

    return conflicts;
  },

  detectInstrumentConflicts: (songs: Song[]): Conflict[] => {
    const conflicts: Conflict[] = [];

    for (const song of songs) {
      const instrumentCheck = KeyValidationService.validateInstrumentTuning(song);
      if (!instrumentCheck.passed && song.instrumentTunings?.guitar) {
        const trace = buildFieldTrace(song, 'instrumentTunings.guitar');

        conflicts.push({
          type: 'instrument',
          severity: 'warning',
          songId: song.id,
          songName: song.name,
          message: instrumentCheck.message,
          suggestion: instrumentCheck.suggestion || '请检查调弦设置',
          trace,
        });
      }
    }

    return conflicts;
  },

  detectDurationConflicts: (songs: Song[], maxDuration: number): Conflict[] => {
    const conflicts: Conflict[] = [];
    const durationCheck = DurationService.checkDurationLimit(songs, maxDuration);

    if (durationCheck.isOver) {
      const cumulative = DurationService.calculateCumulativeDurations(songs);
      const overIndex = cumulative.findIndex(c => c.cumulative > maxDuration);

      if (overIndex !== -1) {
        const overSong = songs[overIndex];
        const trace = buildFieldTrace(overSong, 'duration');

        conflicts.push({
          type: 'duration_over',
          severity: 'error',
          songId: overSong.id,
          songName: overSong.name,
          message: `从第 ${overIndex + 1} 首《${overSong.name}》开始，累计时长 ${formatDuration(cumulative[overIndex].cumulative)} 超出限制`,
          suggestion: `建议删减《${overSong.name}》或缩短 ${formatDuration(durationCheck.overAmount)}`,
          trace,
        });
      }
    }

    return conflicts;
  },

  detectOldVersionConflicts: (songs: Song[]): Conflict[] => {
    const conflicts: Conflict[] = [];
    const maxVersions = new Map<string, number>();

    for (const song of songs) {
      const versions = VersionControlService.getSongChangeHistory(song.id);
      const maxVersion = versions.length > 0 ? Math.max(...versions.map(v => v.version), song.version) : song.version;
      maxVersions.set(song.id, maxVersion);
    }

    for (const song of songs) {
      const latestVersion = maxVersions.get(song.id) || song.version;
      if (song.version < latestVersion) {
        const trace = buildFieldTrace(song, 'version');

        conflicts.push({
          type: 'old_version',
          severity: 'warning',
          songId: song.id,
          songName: song.name,
          message: `当前使用的是版本 ${song.version}，但存在更新的版本 ${latestVersion}`,
          suggestion: '请确认是否使用最新版本的数据',
          trace,
        });
      }
    }

    return conflicts;
  },

  detectAllConflicts: (setlist: Setlist & { songs: Song[] }): Conflict[] => {
    const keyConflicts = ConflictDetectionService.detectKeyConflicts(setlist.songs);
    const vocalConflicts = ConflictDetectionService.detectVocalRangeConflicts(setlist.songs);
    const instrumentConflicts = ConflictDetectionService.detectInstrumentConflicts(setlist.songs);
    const durationConflicts = ConflictDetectionService.detectDurationConflicts(setlist.songs, setlist.maxDuration);
    const versionConflicts = ConflictDetectionService.detectOldVersionConflicts(setlist.songs);

    return [
      ...keyConflicts,
      ...vocalConflicts,
      ...instrumentConflicts,
      ...durationConflicts,
      ...versionConflicts,
    ];
  },

  categorizeConflicts: (conflicts: Conflict[]) => {
    const errors = conflicts.filter(c => c.severity === 'error');
    const warnings = conflicts.filter(c => c.severity === 'warning');

    return {
      errors,
      warnings,
      byType: {
        key_conflict: conflicts.filter(c => c.type === 'key_conflict'),
        vocal_range: conflicts.filter(c => c.type === 'vocal_range'),
        instrument: conflicts.filter(c => c.type === 'instrument'),
        duration_over: conflicts.filter(c => c.type === 'duration_over'),
        old_version: conflicts.filter(c => c.type === 'old_version'),
      } as Record<ConflictType, Conflict[]>,
    };
  },
};

const buildFieldTrace = (song: Song, fieldName: string) => {
  const versions = VersionControlService.getFieldChangeHistory(song.id, fieldName);

  return versions.slice(0, 5).map(v => ({
    field: fieldName,
    value: v.newValue,
    updatedAt: v.updatedAt,
    updatedBy: v.updatedBy,
  }));
};

const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export default ConflictDetectionService;
