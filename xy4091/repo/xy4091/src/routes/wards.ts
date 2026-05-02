import { Router, Request, Response } from 'express';
import {
  createWard,
  getWardById,
  getWardByCode,
  getAllWards,
  updateWard,
  deleteWard,
} from '../storage';
import { Ward, CreateWardInput, UpdateWardInput, ApiResponse } from '../types';

const router = Router();

router.get('/', (req: Request, res: Response<ApiResponse<Ward[]>>) => {
  try {
    const includeInactive = req.query.includeInactive === 'true';
    const wards = getAllWards(includeInactive);
    res.json({
      success: true,
      data: wards,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取病区列表失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/:id', (req: Request, res: Response<ApiResponse<Ward | null>>) => {
  try {
    const ward = getWardById(req.params.id);
    if (!ward) {
      res.status(404).json({
        success: false,
        error: '病区不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      data: ward,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取病区信息失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/', (req: Request, res: Response<ApiResponse<Ward>>) => {
  try {
    const input: CreateWardInput = req.body;

    if (!input.name || !input.code || !input.department) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: name, code, department',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const existing = getWardByCode(input.code);
    if (existing) {
      res.status(409).json({
        success: false,
        error: '病区代码已存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const ward = createWard(input);
    res.status(201).json({
      success: true,
      data: ward,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建病区失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.put('/:id', (req: Request, res: Response<ApiResponse<Ward | null>>) => {
  try {
    const input: UpdateWardInput = req.body;
    const updated = updateWard(req.params.id, input);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: '病区不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: updated,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '更新病区失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.delete('/:id', (req: Request, res: Response<ApiResponse>) => {
  try {
    const success = deleteWard(req.params.id);
    if (!success) {
      res.status(404).json({
        success: false,
        error: '病区不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '删除病区失败',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
