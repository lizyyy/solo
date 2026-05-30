import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import SetlistRepository from '../repositories/SetlistRepository';
import IncrementalMergeService from '../services/IncrementalMergeService';
import type { ApiResponse, CreateSetlistRequest, UpdateSetlistRequest, Setlist } from '../../shared/types';

export const SetlistController = {
  create: (req: Request, res: Response) => {
    try {
      const data = req.body as CreateSetlistRequest;

      if (!data.tourName || !data.venue || !data.date || !data.maxDuration) {
        return res.status(400).json({
          success: false,
          error: '缺少必填字段：tourName, venue, date, maxDuration',
        } as ApiResponse<null>);
      }

      const id = `sl-${uuidv4().slice(0, 8)}`;
      const setlist = SetlistRepository.create(id, data);

      res.status(201).json({
        success: true,
        data: setlist,
        message: '歌单创建成功',
      } as ApiResponse<Setlist>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `创建歌单失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  list: (_req: Request, res: Response) => {
    try {
      const setlists = SetlistRepository.findAll();

      res.json({
        success: true,
        data: setlists,
      } as ApiResponse<Setlist[]>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取歌单列表失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  get: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const includeSongs = req.query.includeSongs === 'true';

      const setlist = includeSongs
        ? SetlistRepository.findByIdWithSongs(id)
        : SetlistRepository.findById(id);

      if (!setlist) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        data: setlist,
      } as ApiResponse<typeof setlist>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取歌单详情失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  update: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const data = req.body as UpdateSetlistRequest;

      if (!data.updatedBy) {
        return res.status(400).json({
          success: false,
          error: '缺少必填字段：updatedBy',
        } as ApiResponse<null>);
      }

      const existing = SetlistRepository.findById(id);
      if (!existing) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      const mergedData = IncrementalMergeService.mergeSetlistUpdates(existing, data);
      const hasChanges = Object.keys(mergedData).some(k => k !== 'updatedBy' && k !== 'updateReason');

      let setlist: Setlist | null = existing;
      if (hasChanges) {
        setlist = SetlistRepository.update(id, mergedData);
      }

      res.json({
        success: true,
        data: setlist,
        message: hasChanges ? '歌单更新成功' : '数据无变化，无需更新',
      } as ApiResponse<Setlist | null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `更新歌单失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  remove: (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const deleted = SetlistRepository.delete(id);

      if (!deleted) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        message: '歌单删除成功',
      } as ApiResponse<null>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `删除歌单失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },
};

export default SetlistController;
