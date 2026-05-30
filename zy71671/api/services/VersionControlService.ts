import VersionHistoryRepository from '../repositories/VersionHistoryRepository';
import type { UpdateSongRequest, Song } from '../../shared/types';

export const VersionControlService = {
  recordSongChange: (
    song: Song,
    updates: UpdateSongRequest,
    fieldName: string,
    oldValue: string | undefined,
    newValue: string
  ): void => {
    VersionHistoryRepository.addSongVersion(
      song.id,
      song.version + 1,
      fieldName,
      oldValue,
      newValue,
      updates.updatedBy,
      updates.updateReason
    );
  },

  recordSetlistSnapshot: (
    setlistId: string,
    version: number,
    snapshot: object,
    createdBy: string,
    description?: string
  ): void => {
    VersionHistoryRepository.addSetlistVersion(
      setlistId,
      version,
      JSON.stringify(snapshot),
      createdBy,
      description
    );
  },

  getSongChangeHistory: (songId: string) => {
    return VersionHistoryRepository.getSongVersions(songId);
  },

  getSetlistChangeHistory: (setlistId: string) => {
    return VersionHistoryRepository.getSetlistVersions(setlistId);
  },

  getFieldChangeHistory: (songId: string, fieldName: string) => {
    return VersionHistoryRepository.getSongFieldVersions(songId, fieldName);
  },

  getAllSetlistChanges: (setlistId: string) => {
    return VersionHistoryRepository.getSetlistSongVersions(setlistId);
  },
};

export default VersionControlService;
