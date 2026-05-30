import SetlistRepository from '../repositories/SetlistRepository';
import SongRepository from '../repositories/SongRepository';
import VersionControlService from './VersionControlService';
import DurationService from './DurationService';
import type { FieldTrace, FieldTraceHistory, Song, Setlist } from '../../shared/types';

export const TraceService = {
  traceField: (setlistId: string, field: string): FieldTrace | null => {
    const setlist = SetlistRepository.findByIdWithSongs(setlistId);
    if (!setlist) return null;

    const songs = setlist.songs || [];

    const calculatedFields: Record<string, () => FieldTrace> = {
      totalDuration: () => buildCalculatedFieldTrace(
        'totalDuration',
        DurationService.calculateTotalDuration(songs),
        '累计时长 = SUM(songs[*].duration)',
        songs.map(s => `songs[${s.order - 1}].duration`),
        songs,
        'duration'
      ),
      songCount: () => buildSimpleFieldTrace(
        'songCount',
        songs.length,
        '歌曲总数 = COUNT(songs)',
        songs,
        'id'
      ),
      maxDuration: () => buildSetlistFieldTrace(
        'maxDuration',
        setlist.maxDuration,
        setlist
      ),
      status: () => buildSetlistFieldTrace(
        'status',
        setlist.status,
        setlist
      ),
    };

    if (calculatedFields[field]) {
      return calculatedFields[field]();
    }

    if (field.startsWith('songs[')) {
      return buildSongFieldTrace(field, songs);
    }

    const setlistField = field as keyof Setlist;
    if (setlist[setlistField] !== undefined) {
      return buildSetlistFieldTrace(field, setlist[setlistField], setlist);
    }

    return {
      field,
      currentValue: null,
      history: [],
      changeHistory: [],
    };
  },

  traceSongField: (songId: string, field: string): FieldTrace | null => {
    const song = SongRepository.findById(songId);
    if (!song) return null;

    const versions = VersionControlService.getFieldChangeHistory(songId, field);
    const history: FieldTraceHistory[] = versions.map(v => ({
      version: v.version,
      value: v.newValue,
      updatedAt: v.updatedAt,
      updatedBy: v.updatedBy,
      reason: v.reason || '',
      diff: {
        old: v.oldValue,
        new: v.newValue,
      },
    }));

    const fieldMapping: Record<string, keyof Song> = {
      'name': 'name',
      'originalKey': 'originalKey',
      'currentKey': 'currentKey',
      'duration': 'duration',
      'order': 'order',
      'vocalNotes': 'vocalNotes',
      'vocalRange.min': 'vocalRange',
      'vocalRange.max': 'vocalRange',
      'instrumentTunings.guitar': 'instrumentTunings',
      'instrumentTunings.bass': 'instrumentTunings',
      'instrumentTunings.keys': 'instrumentTunings',
    };

    let currentValue: unknown = null;
    const songField = fieldMapping[field] || field as keyof Song;
    if (field.includes('.')) {
      const [parent, child] = field.split('.');
      const parentObj = (song as unknown as Record<string, unknown>)[parent];
      if (parentObj && typeof parentObj === 'object') {
        currentValue = (parentObj as Record<string, unknown>)[child];
      }
    } else {
      currentValue = song[songField];
    }

    const changeHistory = versions.map(v => ({
      version: v.version,
      oldValue: v.oldValue,
      newValue: v.newValue,
      timestamp: v.updatedAt,
      updatedBy: v.updatedBy,
      reason: v.reason,
    }));

    return {
      field,
      currentValue,
      history,
      changeHistory,
    };
  },

  getCalculationBreakdown: (setlistId: string, field: string): {
    rule: string;
    components: Array<{
      label: string;
      value: number;
      explanation: string;
    }>;
  } | null => {
    const setlist = SetlistRepository.findByIdWithSongs(setlistId);
    if (!setlist) return null;

    const songs = setlist.songs || [];

    if (field === 'totalDuration') {
      return {
        rule: '累计时长 = 所有歌曲时长累加',
        components: songs.sort((a, b) => a.order - b.order).map(s => ({
          label: s.name,
          value: s.duration,
          explanation: `第 ${s.order} 首《${s.name}》时长 ${s.duration} 秒`,
        })),
      };
    }

    return null;
  },
};

const buildSimpleFieldTrace = (
  field: string,
  currentValue: unknown,
  calculationRule: string,
  songs: Song[],
  valueField: string
): FieldTrace => {
  const history: FieldTraceHistory[] = songs.flatMap(song => {
    const versions = VersionControlService.getFieldChangeHistory(song.id, valueField);
    return versions.map(v => ({
      version: v.version,
      value: v.newValue,
      updatedAt: v.updatedAt,
      updatedBy: v.updatedBy,
      reason: `${song.name}: ${v.reason || '更新'}`,
      diff: {
        song: song.name,
        field: valueField,
        old: v.oldValue,
        new: v.newValue,
      },
    }));
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 20);

  const changeHistory = history.map(h => ({
    version: h.version,
    oldValue: h.diff && typeof h.diff === 'object' ? (h.diff as Record<string, unknown>).old : undefined,
    newValue: h.value,
    timestamp: h.updatedAt,
    updatedBy: h.updatedBy,
    reason: h.reason,
  }));

  return {
    field,
    currentValue,
    calculationRule,
    sourceFields: songs.map((_, i) => `songs[${i}].${valueField}`),
    history,
    changeHistory,
  };
};

const buildCalculatedFieldTrace = (
  field: string,
  currentValue: unknown,
  calculationRule: string,
  sourceFields: string[],
  songs: Song[],
  valueField: string
): FieldTrace => {
  const history: FieldTraceHistory[] = songs.flatMap(song => {
    const versions = VersionControlService.getFieldChangeHistory(song.id, valueField);
    return versions.map(v => ({
      version: v.version,
      value: v.newValue,
      updatedAt: v.updatedAt,
      updatedBy: v.updatedBy,
      reason: `${song.name}: ${v.reason || '更新'}`,
      diff: {
        song: song.name,
        field: valueField,
        old: v.oldValue,
        new: v.newValue,
      },
    }));
  }).sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()).slice(0, 20);

  const changeHistory = history.map(h => ({
    version: h.version,
    oldValue: h.diff && typeof h.diff === 'object' ? (h.diff as Record<string, unknown>).old : undefined,
    newValue: h.value,
    timestamp: h.updatedAt,
    updatedBy: h.updatedBy,
    reason: h.reason,
  }));

  return {
    field,
    currentValue,
    calculationRule,
    sourceFields,
    history,
    changeHistory,
  };
};

const buildSetlistFieldTrace = (
  field: string,
  currentValue: unknown,
  setlist: Setlist
): FieldTrace => {
  const versions = VersionControlService.getSetlistChangeHistory(setlist.id);
  const history: FieldTraceHistory[] = versions.map(v => {
    const snapshot = JSON.parse(v.snapshot);
    return {
      version: v.version,
      value: snapshot[field] || null,
      updatedAt: v.createdAt,
      updatedBy: v.createdBy,
      reason: v.description || '',
      diff: snapshot,
    };
  });

  const changeHistory = history.map(h => ({
    version: h.version,
    newValue: h.value,
    timestamp: h.updatedAt,
    updatedBy: h.updatedBy,
    reason: h.reason,
  }));

  return {
    field,
    currentValue,
    history,
    changeHistory,
  };
};

const buildSongFieldTrace = (field: string, songs: Song[]): FieldTrace | null => {
  const match = field.match(/^songs\[(\d+)\]\.(\w+)$/);
  if (!match) return null;

  const index = parseInt(match[1]);
  const songField = match[2];
  const song = songs.sort((a, b) => a.order - b.order)[index];

  if (!song) return null;

  return TraceService.traceSongField(song.id, songField);
};

export default TraceService;
