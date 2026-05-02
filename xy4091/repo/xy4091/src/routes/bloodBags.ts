import { Router, Request, Response } from 'express';
import {
  createBloodBag,
  getBloodBagById,
  getBloodBags,
  updateBloodBag,
  addTemperatureRecord,
  checkTemperatureAnomaly,
} from '../storage';
import {
  BloodBag,
  CreateBloodBagInput,
  UpdateBloodBagInput,
  AddTemperatureRecordInput,
  BloodBagFilter,
  ApiResponse,
} from '../types';
import { transitionBloodBag } from '../services';

const router = Router();

router.get('/', (req: Request, res: Response<ApiResponse<BloodBag[]>>) => {
  try {
    const filter: BloodBagFilter = {};

    if (req.query.bloodType) {
      filter.bloodType = req.query.bloodType as any;
    }
    if (req.query.componentType) {
      filter.componentType = req.query.componentType as any;
    }
    if (req.query.status) {
      filter.status = req.query.status as any;
    }
    if (req.query.crossMatchStatus) {
      filter.crossMatchStatus = req.query.crossMatchStatus as any;
    }
    if (req.query.isExpiringSoon === 'true') {
      filter.isExpiringSoon = true;
      if (req.query.expiringWithinHours) {
        filter.expiringWithinHours = parseInt(req.query.expiringWithinHours as string, 10);
      }
    }
    if (req.query.hasTemperatureAnomaly === 'true') {
      filter.hasTemperatureAnomaly = true;
    }

    const bloodBags = getBloodBags(filter);
    res.json({
      success: true,
      data: bloodBags,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取血袋列表失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/:id', (req: Request, res: Response<ApiResponse<BloodBag | null>>) => {
  try {
    const bloodBag = getBloodBagById(req.params.id);
    if (!bloodBag) {
      res.status(404).json({
        success: false,
        error: '血袋不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      data: bloodBag,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取血袋信息失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/', (req: Request, res: Response<ApiResponse<BloodBag>>) => {
  try {
    const input: CreateBloodBagInput = req.body;

    if (!input.bloodType || !input.componentType || !input.volume || !input.donorId) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: bloodType, componentType, volume, donorId',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (!input.collectionDate || !input.expiryDate) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: collectionDate, expiryDate',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const bloodBag = createBloodBag(input);
    res.status(201).json({
      success: true,
      data: bloodBag,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建血袋失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.put('/:id', (req: Request, res: Response<ApiResponse<BloodBag | null>>) => {
  try {
    const input: UpdateBloodBagInput = req.body;
    const updated = updateBloodBag(req.params.id, input);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: '血袋不存在',
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
      error: error instanceof Error ? error.message : '更新血袋失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/temperature', (req: Request, res: Response<ApiResponse<BloodBag | null>>) => {
  try {
    const input: AddTemperatureRecordInput = {
      bloodBagId: req.params.id,
      temperature: req.body.temperature,
      location: req.body.location || '血库',
    };

    if (input.temperature === undefined) {
      res.status(400).json({
        success: false,
        error: '缺少必填字段: temperature',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const updated = addTemperatureRecord(input);

    if (!updated) {
      res.status(404).json({
        success: false,
        error: '血袋不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const hasAnomaly = checkTemperatureAnomaly(updated);
    if (hasAnomaly) {
      res.json({
        success: true,
        data: updated,
        error: '警告: 检测到温控异常',
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
      error: error instanceof Error ? error.message : '添加温控记录失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/reserve', (req: Request, res: Response<ApiResponse<BloodBag | null>>) => {
  try {
    const operator = req.body.operator || 'system';
    const result = transitionBloodBag(req.params.id, 'RESERVE', operator, {
      applicationId: req.body.applicationId,
      notes: req.body.notes,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: result.bloodBag,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '预留血袋失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/release', (req: Request, res: Response<ApiResponse<BloodBag | null>>) => {
  try {
    const operator = req.body.operator || 'system';
    const result = transitionBloodBag(req.params.id, 'RELEASE', operator, {
      notes: req.body.notes,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: result.bloodBag,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '释放血袋失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/issue', (req: Request, res: Response<ApiResponse<BloodBag | null>>) => {
  try {
    const operator = req.body.operator || 'system';
    const result = transitionBloodBag(req.params.id, 'ISSUE', operator, {
      wardId: req.body.wardId,
      notes: req.body.notes,
    });

    if (!result.success) {
      res.status(400).json({
        success: false,
        error: result.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: result.bloodBag,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '出库血袋失败',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
