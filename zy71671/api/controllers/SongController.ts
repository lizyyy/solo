import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import SongRepository from '../repositories/SongRepository';
import SetlistRepository from '../repositories/SetlistRepository';
import IncrementalMergeService from '../services/IncrementalMergeService';
import type { ApiResponse, CreateSongRequest, UpdateSongRequest, Song } from '../../shared/types';

export const SongController = {
  create: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;
      const data = req.body as CreateSongRequest;

      const setlist = SetlistRepository.findById(setlistId);
      if (!setlist) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      const requiredFields: (keyof CreateSongRequest)[] = ['name', 'originalKey', 'currentKey', 'duration', 'updatedBy'];
      const missingFields = requiredFields.filter(f => data[f] === undefined);

      if (missingFields.length > 0) {
        return res.status(400).json({
          success: false,
          error: `缺少必填字段：${missingFields.join(', ')}`,
        } as ApiResponse<null>);
      }

      const id = `s-${uuidv4().slice(0, 8)}`;
      const order = data.order || SongRepository.getMaxOrder(setlistId) + 1;

      const song = SongRepository.create(id, setlistId, { ...data, order });

      res.status(201).json({
        success: true,
        data: song,
        message: '歌曲添加成功',
      } as ApiResponse<Song>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `添加歌曲失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  list: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;

      const setlist = SetlistRepository.findById(setlistId);
      if (!setlist) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      const songs = SongRepository.findBySetlistId(setlistId);

      res.json({
        success: true,
        data: songs,
      } as ApiResponse<Song[]>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取歌曲列表失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  get: (req: Request, res: Response) => {
    try {
      const { songId } = req.params;
      const song = SongRepository.findById(songId);

      if (!song) {
        return res.status(404).json({
          success: false,
          error: '歌曲不存在',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        data: song,
      } as ApiResponse<Song>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取歌曲详情失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  update: (req: Request, res: Response) => {
    try {
      const { songId } = req.params;
      const data = req.body as UpdateSongRequest;

      if (!data.updatedBy) {
        return res.status(400).json({
          success: false,
          error: '缺少必填字段：updatedBy',
        } as ApiResponse<null>);
      }

      const existing = SongRepository.findById(songId);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: '歌曲不存在',
        } as ApiResponse<null>);
      }

      const updatedSong = IncrementalMergeService.applySongUpdates(songId, data);

      if (!updatedSong) {
        return res.status(500).json({
          success: false,
          error: '更新歌曲失败',
        } as ApiResponse<null>);
      }

      const hasChanges = updatedSong.version > existing.version;

      res.json({
        success: true,
        data: updatedSong,
        message: hasChanges ? `歌曲更新成功，当前版本 v${updatedSong.version}` : '数据无变化，无需更新',
      } as ApiResponse<Song>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `更新歌曲失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  remove: (req: Request, res: Response) => {
    try {
      const { songId } = req.params;
      const deleted = SongRepository.delete(songId);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: '歌曲不存在',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        message: '歌曲删除成功',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `删除歌曲失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },
};

export default SongController;
