import { Request, Response } from 'express';
import TraceService from '../services/TraceService';
import type { ApiResponse, FieldTrace } from '../../shared/types';

export const TraceController = {
  traceField: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;
      const { field } = req.query;

      if (!field || typeof field !== 'string') {
        return res.status(400).json({
          success: false,
          error: '请提供要追溯的字段名 field',
        } as ApiResponse<null>);
      }

      const trace = TraceService.traceField(setlistId, field);
      if (!trace) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        data: trace,
      } as ApiResponse<FieldTrace>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `字段追溯失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  traceSongField: (req: Request, res: Response) => {
    try {
      const { songId } = req.params;
      const { field } = req.query;

      if (!field || typeof field !== 'string') {
        return res.status(400).json({
          success: false,
          error: '请提供要追溯的字段名 field',
        } as ApiResponse<null>);
      }

      const trace = TraceService.traceSongField(songId, field);
      if (!trace) {
        return res.status(404).json({
          success: false,
          error: '歌曲不存在',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        data: trace,
      } as ApiResponse<FieldTrace>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `字段追溯失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  getBreakdown: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;
      const { field } = req.query;

      if (!field || typeof field !== 'string') {
        return res.status(400).json({
          success: false,
          error: '请提供要分解的字段名 field',
        } as ApiResponse<null>);
      }

      const breakdown = TraceService.getCalculationBreakdown(setlistId, field);
      if (!breakdown) {
        return res.status(404).json({
          success: false,
          error: '无法分解该字段，请检查字段名是否正确',
        } as ApiResponse<null>);
      }

      res.json({
        success: true,
        data: breakdown,
      } as ApiResponse<typeof breakdown>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `获取计算分解失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },
};

export default TraceController;
