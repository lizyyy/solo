import { Request, Response } from 'express';
import SetlistRepository from '../repositories/SetlistRepository';
import VersionControlService from '../services/VersionControlService';
import type { ApiResponse, SongVersion, SetlistVersion } from '../../shared/types';

export const VersionController = {
  getSetlistVersions: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;

      const setlist = SetlistRepository.findById(setlistId);
      if (!setlist) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      const versions = VersionControlService.getSetlistChangeHistory(setlistId);
      const songVersions = VersionControlService.getAllSetlistChanges(setlistId);

      res.json({
        success: true,
        data: {
          setlistVersions: versions,
          songVersions,
          currentVersion: setlist.currentVersion,
        },
      } as ApiResponse<{
        setlistVersions: SetlistVersion[];
        songVersions: SongVersion[];
        currentVersion: number;
      }>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取版本历史失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  getSongVersions: (req: Request, res: Response) => {
    try {
      const { songId } = req.params;
      const versions = VersionControlService.getSongChangeHistory(songId);

      res.json({
        success: true,
        data: versions,
      } as ApiResponse<SongVersion[]>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取歌曲版本历史失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  getSongFieldVersions: (req: Request, res: Response) => {
    try {
      const { songId, field } = req.params;
      const versions = VersionControlService.getFieldChangeHistory(songId, field);

      res.json({
        success: true,
        data: versions,
      } as ApiResponse<SongVersion[]>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取字段版本历史失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },
};

export default VersionController;
