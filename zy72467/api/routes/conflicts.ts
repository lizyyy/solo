import { Router } from 'express';
import type { ApiResponse, ConflictRecord } from '../../shared/types';
import { conflictService } from '../services/conflictService';

const router = Router();

router.get('/', (req, res) => {
  try {
    const conflicts = conflictService.getConflicts();
    const response: ApiResponse<ConflictRecord[]> = {
      success: true,
      data: conflicts,
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '获取冲突列表失败',
    };
    res.status(500).json(response);
  }
});

router.post('/:id/resolve', (req, res) => {
  try {
    const { id } = req.params;
    const { resolution, note, operator } = req.body as {
      resolution: 'keep_ramp' | 'keep_sampling' | 'merge';
      note: string;
      operator: string;
    };

    const success = conflictService.resolveConflict(
      id,
      resolution,
      note,
      operator || '社区书记周姐'
    );

    if (!success) {
      const response: ApiResponse<null> = {
        success: false,
        error: '冲突记录不存在',
      };
      return res.status(404).json(response);
    }

    const response: ApiResponse<null> = {
      success: true,
      message: '冲突复核完成',
    };
    res.json(response);
  } catch (error) {
    const response: ApiResponse<null> = {
      success: false,
      error: error instanceof Error ? error.message : '复核冲突失败',
    };
    res.status(500).json(response);
  }
});

export default router;
