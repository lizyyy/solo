import SongRepository from '../repositories/SongRepository';
import VersionControlService from './VersionControlService';
import type { UpdateSongRequest, Song, UpdateSetlistRequest, Setlist } from '../../shared/types';

export const IncrementalMergeService = {
  mergeSongUpdates: (existing: Song, updates: UpdateSongRequest): UpdateSongRequest => {
    const merged: UpdateSongRequest = {
      updatedBy: updates.updatedBy,
      updateReason: updates.updateReason,
    };

    const shouldUpdate = (existingValue: unknown, newValue: unknown): boolean => {
      if (newValue === undefined) return false;
      if (existingValue === null || existingValue === undefined) return true;
      if (typeof existingValue === 'object' && existingValue !== null && typeof newValue === 'object' && newValue !== null) {
        return JSON.stringify(existingValue) !== JSON.stringify(newValue);
      }
      return existingValue !== newValue;
    };

    if (shouldUpdate(existing.name, updates.name)) {
      merged.name = updates.name;
    }
    if (shouldUpdate(existing.originalKey, updates.originalKey)) {
      merged.originalKey = updates.originalKey;
    }
    if (shouldUpdate(existing.currentKey, updates.currentKey)) {
      merged.currentKey = updates.currentKey;
    }
    if (shouldUpdate(existing.duration, updates.duration)) {
      merged.duration = updates.duration;
    }
    if (shouldUpdate(existing.order, updates.order)) {
      merged.order = updates.order;
    }
    if (shouldUpdate(existing.vocalNotes, updates.vocalNotes)) {
      merged.vocalNotes = updates.vocalNotes;
    }
    if (updates.vocalRange) {
      const existingRange = existing.vocalRange;
      if (!existingRange ||
          existingRange.min !== updates.vocalRange.min ||
          existingRange.max !== updates.vocalRange.max) {
        merged.vocalRange = updates.vocalRange;
      }
    }
    if (updates.instrumentTunings) {
      const existingTunings = existing.instrumentTunings || {};
      const newTunings = updates.instrumentTunings;
      const mergedTunings: typeof newTunings = {};
      let hasChanges = false;

      if (newTunings.guitar !== undefined && newTunings.guitar !== existingTunings.guitar) {
        mergedTunings.guitar = newTunings.guitar;
        hasChanges = true;
      }
      if (newTunings.bass !== undefined && newTunings.bass !== existingTunings.bass) {
        mergedTunings.bass = newTunings.bass;
        hasChanges = true;
      }
      if (newTunings.keys !== undefined && newTunings.keys !== existingTunings.keys) {
        mergedTunings.keys = newTunings.keys;
        hasChanges = true;
      }

      if (hasChanges) {
        merged.instrumentTunings = {
          ...existingTunings,
          ...mergedTunings,
        };
      }
    }

    return merged;
  },

  applySongUpdates: (songId: string, updates: UpdateSongRequest): Song | null => {
    const existing = SongRepository.findById(songId);
    if (!existing) return null;

    const mergedUpdates = IncrementalMergeService.mergeSongUpdates(existing, updates);
    const hasChanges = Object.keys(mergedUpdates).some(k => k !== 'updatedBy' && k !== 'updateReason');

    if (!hasChanges) {
      return existing;
    }

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

    for (const [updateField, songField] of Object.entries(fieldMapping)) {
      if (updateField.includes('.')) {
        const [parent, child] = updateField.split('.');
        const parentObj = (mergedUpdates as unknown as Record<string, unknown>)[parent];
        if (parentObj && typeof parentObj === 'object') {
          const childValue = (parentObj as Record<string, unknown>)[child];
          if (childValue !== undefined) {
            const existingValue = (existing as unknown as Record<string, unknown>)[songField];
            const existingStr = existingValue && typeof existingValue === 'object'
              ? JSON.stringify(existingValue)
              : String(existingValue ?? '');
            const newValue = parentObj && typeof parentObj === 'object'
              ? JSON.stringify({ ...(existingValue as object || {}), [child]: childValue })
              : String(childValue);

            VersionControlService.recordSongChange(
              existing,
              updates,
              updateField,
              existingStr,
              newValue
            );
          }
        }
      } else {
        const value = (mergedUpdates as unknown as Record<string, unknown>)[updateField];
        if (value !== undefined) {
          const existingValue = (existing as unknown as Record<string, unknown>)[songField];
          const existingStr = existingValue !== null && existingValue !== undefined
            ? String(existingValue)
            : undefined;
          const newStr = String(value);

          VersionControlService.recordSongChange(
            existing,
            updates,
            updateField,
            existingStr,
            newStr
          );
        }
      }
    }

    return SongRepository.update(songId, mergedUpdates);
  },

  mergeSetlistUpdates: (existing: Setlist, updates: UpdateSetlistRequest): UpdateSetlistRequest => {
    const merged: UpdateSetlistRequest = {
      updatedBy: updates.updatedBy,
      updateReason: updates.updateReason,
    };

    if (updates.tourName !== undefined && existing.tourName !== updates.tourName) {
      merged.tourName = updates.tourName;
    }
    if (updates.venue !== undefined && existing.venue !== updates.venue) {
      merged.venue = updates.venue;
    }
    if (updates.date !== undefined && existing.date !== updates.date) {
      merged.date = updates.date;
    }
    if (updates.maxDuration !== undefined && existing.maxDuration !== updates.maxDuration) {
      merged.maxDuration = updates.maxDuration;
    }

    return merged;
  },
};

export default IncrementalMergeService;
