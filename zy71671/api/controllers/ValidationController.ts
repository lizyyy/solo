import { Request, Response } from 'express';
import SetlistRepository from '../repositories/SetlistRepository';
import KeyValidationService from '../services/KeyValidationService';
import ConflictDetectionService from '../services/ConflictDetectionService';
import type { ApiResponse, ValidationResult, Conflict } from '../../shared/types';

export const ValidationController = {
  validate: (req: Request, res: Response) => {
    try {
      const { setlistId } = req.params;
      const { generatedBy = 'system' } = req.body;

      const setlist = SetlistRepository.findByIdWithSongs(setlistId);
      if (!setlist) {
        return res.status(404).json({
          success: false,
          error: '歌单不存在',
        } as ApiResponse<null>);
      }

      const songs = setlist.songs || [];
      const validations: ValidationResult[] = [];
      let currentTotal = 0;

      for (const song of songs) {
        const validation = KeyValidationService.validateSong(song, setlist.maxDuration, currentTotal);
        validations.push(validation);
        currentTotal += song.duration;
      }

      const conflicts = ConflictDetectionService.detectAllConflicts(setlist as typeof setlist & { songs: typeof songs });
      const categorized = ConflictDetectionService.categorizeConflicts(conflicts);

      res.json({
        success: true,
        data: {
          validations,
          conflicts,
          summary: {
            total: validations.length,
            passed: validations.filter(v =>
              v.checks.keyFormat.passed &&
              v.checks.vocalRange.passed &&
              v.checks.instrumentTuning.passed &&
              v.checks.duration.passed
            ).length,
            errors: categorized.errors.length,
            warnings: categorized.warnings.length,
            byType: {
              key_conflict: categorized.byType.key_conflict.length,
              vocal_range: categorized.byType.vocal_range.length,
              instrument: categorized.byType.instrument.length,
              duration_over: categorized.byType.duration_over.length,
              old_version: categorized.byType.old_version.length,
            },
          },
        },
        message: `校验完成：${validations.length} 首歌曲，${categorized.errors.length} 个错误，${categorized.warnings.length} 个警告`,
      } as ApiResponse<{
        validations: ValidationResult[];
        conflicts: Conflict[];
        summary: {
          total: number;
          passed: number;
          errors: number;
          warnings: number;
          byType: Record<string, number>;
        };
      }>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `校验失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },

  validateKey: (req: Request, res: Response) => {
    try {
      const { key } = req.query;

      if (!key || typeof key !== 'string') {
        return res.status(400).json({
          success: false,
          error: '请提供调号参数 key',
        } as ApiResponse<null>);
      }

      const result = KeyValidationService.validateKeyFormat(key);

      res.json({
        success: true,
        data: result,
      } as ApiResponse<typeof result>);
    } catch (error) {
      res.status(500).json({
        success: false,
        error: `调号校验失败：${error instanceof Error ? error.message : String(error)}`,
      } as ApiResponse<null>);
    }
  },
};

export default ValidationController;
