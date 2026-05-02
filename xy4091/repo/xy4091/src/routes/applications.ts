import { Router, Request, Response } from 'express';
import {
  createApplication,
  getApplicationById,
  getApplications,
} from '../storage';
import {
  Application,
  CreateApplicationInput,
  ApplicationStatus,
  ApiResponse,
  MatchResult,
} from '../types';
import {
  findMatchingBloodBags,
  validateBloodBagForReservation,
  transitionApplication,
  transitionBloodBag,
} from '../services';

const router = Router();

router.get('/', (req: Request, res: Response<ApiResponse<Application[]>>) => {
  try {
    const filters: {
      wardId?: string;
      status?: ApplicationStatus;
      bloodType?: any;
      componentType?: any;
      urgency?: 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    } = {};

    if (req.query.wardId) {
      filters.wardId = req.query.wardId as string;
    }
    if (req.query.status) {
      filters.status = req.query.status as ApplicationStatus;
    }
    if (req.query.bloodType) {
      filters.bloodType = req.query.bloodType;
    }
    if (req.query.componentType) {
      filters.componentType = req.query.componentType;
    }
    if (req.query.urgency) {
      filters.urgency = req.query.urgency as 'ROUTINE' | 'URGENT' | 'EMERGENCY';
    }

    const applications = getApplications(filters);
    res.json({
      success: true,
      data: applications,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取申请单列表失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/:id', (req: Request, res: Response<ApiResponse<Application | null>>) => {
  try {
    const application = getApplicationById(req.params.id);
    if (!application) {
      res.status(404).json({
        success: false,
        error: '申请单不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }
    res.json({
      success: true,
      data: application,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '获取申请单信息失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/', (req: Request, res: Response<ApiResponse<Application>>) => {
  try {
    const input: CreateApplicationInput = req.body;

    const requiredFields = [
      'wardId', 'patientName', 'patientId', 'bloodType',
      'componentType', 'quantity', 'urgency', 'clinicalDiagnosis',
      'crossMatchRequired', 'requestedBy'
    ];

    for (const field of requiredFields) {
      if ((input as any)[field] === undefined) {
        res.status(400).json({
          success: false,
          error: `缺少必填字段: ${field}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    if (input.quantity <= 0) {
      res.status(400).json({
        success: false,
        error: '申请数量必须大于0',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const application = createApplication(input);
    res.status(201).json({
      success: true,
      data: application,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '创建申请单失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.get('/:id/match', (req: Request, res: Response<ApiResponse<MatchResult>>) => {
  try {
    const application = getApplicationById(req.params.id);
    if (!application) {
      res.status(404).json({
        success: false,
        error: '申请单不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const result = findMatchingBloodBags(application);
    res.json({
      success: true,
      data: result,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '匹配血袋失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/match', (req: Request, res: Response<ApiResponse<Application | null>>) => {
  try {
    const application = getApplicationById(req.params.id);
    if (!application) {
      res.status(404).json({
        success: false,
        error: '申请单不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const matchResult = findMatchingBloodBags(application);
    const matchedBagIds = matchResult.matchedBags.map((b) => b.bloodBagId);

    const operator = req.body.operator || 'system';
    const result = transitionApplication(req.params.id, 'MATCH', operator, {
      matchedBloodBagIds: matchedBagIds,
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

    if (result.warning) {
      res.json({
        success: true,
        data: result.application,
        error: result.warning,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: result.application,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '匹配申请单失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/reserve', (req: Request, res: Response<ApiResponse<Application | null>>) => {
  try {
    const application = getApplicationById(req.params.id);
    if (!application) {
      res.status(404).json({
        success: false,
        error: '申请单不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    let bagIdsToReserve: string[];

    if (req.body.bloodBagIds && Array.isArray(req.body.bloodBagIds)) {
      for (const bagId of req.body.bloodBagIds) {
        const validation = validateBloodBagForReservation(bagId, application);
        if (!validation.valid) {
          res.status(400).json({
            success: false,
            error: `血袋 ${bagId} 不可用: ${validation.reason}`,
            timestamp: new Date().toISOString(),
          });
          return;
        }
      }
      bagIdsToReserve = req.body.bloodBagIds;
    } else {
      const matchResult = findMatchingBloodBags(application);
      if (!matchResult.canFulfill) {
        res.status(400).json({
          success: false,
          error: `库存不足，需要 ${application.quantity} 袋，仅找到 ${matchResult.matchedBags.length} 袋可用`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
      bagIdsToReserve = matchResult.matchedBags.slice(0, application.quantity).map((b) => b.bloodBagId);
    }

    const operator = req.body.operator || 'system';

    for (const bagId of bagIdsToReserve) {
      const result = transitionBloodBag(bagId, 'RESERVE', operator, {
        applicationId: application.id,
      });
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: `预留血袋 ${bagId} 失败: ${result.error}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    const appResult = transitionApplication(req.params.id, 'RESERVE', operator, {
      reservedBloodBagIds: bagIdsToReserve,
      notes: req.body.notes,
    });

    if (!appResult.success) {
      res.status(400).json({
        success: false,
        error: appResult.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: appResult.application,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '预留申请单失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/issue', (req: Request, res: Response<ApiResponse<Application | null>>) => {
  try {
    const application = getApplicationById(req.params.id);
    if (!application) {
      res.status(404).json({
        success: false,
        error: '申请单不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    if (application.reservedBloodBagIds.length === 0) {
      res.status(400).json({
        success: false,
        error: '申请单没有预留血袋，请先执行预留操作',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const operator = req.body.operator || 'system';

    for (const bagId of application.reservedBloodBagIds) {
      const result = transitionBloodBag(bagId, 'ISSUE', operator, {
        wardId: application.wardId,
      });
      if (!result.success) {
        res.status(400).json({
          success: false,
          error: `出库血袋 ${bagId} 失败: ${result.error}`,
          timestamp: new Date().toISOString(),
        });
        return;
      }
    }

    const appResult = transitionApplication(req.params.id, 'ISSUE', operator, {
      issuedBloodBagIds: application.reservedBloodBagIds,
      notes: req.body.notes,
    });

    if (!appResult.success) {
      res.status(400).json({
        success: false,
        error: appResult.error,
        timestamp: new Date().toISOString(),
      });
      return;
    }

    res.json({
      success: true,
      data: appResult.application,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '出库申请单失败',
      timestamp: new Date().toISOString(),
    });
  }
});

router.post('/:id/cancel', (req: Request, res: Response<ApiResponse<Application | null>>) => {
  try {
    const application = getApplicationById(req.params.id);
    if (!application) {
      res.status(404).json({
        success: false,
        error: '申请单不存在',
        timestamp: new Date().toISOString(),
      });
      return;
    }

    const operator = req.body.operator || 'system';

    for (const bagId of application.reservedBloodBagIds) {
      transitionBloodBag(bagId, 'RELEASE', operator);
    }

    const result = transitionApplication(req.params.id, 'CANCEL', operator, {
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
      data: result.application,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : '取消申请单失败',
      timestamp: new Date().toISOString(),
    });
  }
});

export default router;
