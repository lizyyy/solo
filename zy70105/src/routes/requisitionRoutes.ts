import { Router, Request, Response, NextFunction } from 'express';
import { ApiResponse, ApprovalStage, ApprovalAction } from '../types';
import {
  requisitionService,
  CreateRequisitionRequest,
  CreateRequisitionItemRequest
} from '../services/requisitionService';
import { approvalFlowService } from '../services/approvalFlowService';
import { inventoryService } from '../services/inventoryService';
import { ledgerService } from '../services/ledgerService';
import { ValidationError } from '../utils/errors';

const router = Router();

function successResponse<T>(req: Request, data: T): ApiResponse<T> {
  return {
    success: true,
    data,
    timestamp: new Date(),
    requestId: req.requestId
  };
}

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { applicantId, applicantName, department, intendedUseDate } = req.body;

    if (!intendedUseDate) {
      throw new ValidationError('预计使用日期不能为空');
    }

    const request: CreateRequisitionRequest = {
      applicantId,
      applicantName,
      department,
      intendedUseDate: new Date(intendedUseDate)
    };

    const requisition = await requisitionService.createRequisition(request);
    res.status(201).json(successResponse(req, requisition));
  } catch (error) {
    next(error);
  }
});

router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requisitions = await requisitionService.getAll();
    res.json(successResponse(req, requisitions));
  } catch (error) {
    next(error);
  }
});

router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requisition = await requisitionService.getById(req.params.id);
    res.json(successResponse(req, requisition));
  } catch (error) {
    next(error);
  }
});

router.get('/number/:number', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const requisition = await requisitionService.getByNumber(req.params.number);
    res.json(successResponse(req, requisition));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/items', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      pesticideId,
      quantity,
      unit,
      usagePurpose,
      dosagePerUnitArea,
      plotId,
      applicationMethod,
      expectedApplicationDate
    } = req.body;

    const request: CreateRequisitionItemRequest = {
      pesticideId,
      quantity: Number(quantity),
      unit,
      usagePurpose,
      dosagePerUnitArea,
      plotId,
      applicationMethod,
      expectedApplicationDate: new Date(expectedApplicationDate)
    };

    const item = await requisitionService.addItem(req.params.id, request);
    res.status(201).json(successResponse(req, item));
  } catch (error) {
    next(error);
  }
});

router.delete('/:id/items/:itemId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await requisitionService.removeItem(req.params.id, req.params.itemId);
    res.json(successResponse(req, { removed: true }));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/submit', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { processorId, processorName, comments } = req.body;

    if (!processorId || !processorName) {
      throw new ValidationError('处理人ID和姓名不能为空');
    }

    const requisition = await requisitionService.submit(req.params.id, {
      processorId,
      processorName,
      comments
    });

    res.json(successResponse(req, requisition));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/cancel', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { processorId, processorName, comments } = req.body;

    if (!processorId || !processorName) {
      throw new ValidationError('处理人ID和姓名不能为空');
    }

    const requisition = await requisitionService.cancel(req.params.id, {
      processorId,
      processorName,
      comments
    });

    res.json(successResponse(req, requisition));
  } catch (error) {
    next(error);
  }
});

router.get('/:id/progress', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const progress = await approvalFlowService.getFlowProgress(req.params.id);
    res.json(successResponse(req, progress));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/stages/:stage', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { action, processorId, processorName, comments } = req.body;
    const stage = req.params.stage as ApprovalStage;

    if (!action || !processorId || !processorName) {
      throw new ValidationError('操作类型、处理人ID和姓名不能为空');
    }

    const { requisition, record } = await approvalFlowService.processStage(
      req.params.id,
      stage,
      action as ApprovalAction,
      { processorId, processorName, comments }
    );

    res.json(successResponse(req, { requisition, record }));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/deduct-inventory', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { operatorId, operatorName } = req.body;

    if (!operatorId || !operatorName) {
      throw new ValidationError('操作人ID和姓名不能为空');
    }

    const result = await inventoryService.deductInventory({
      requisitionId: req.params.id,
      operatorId,
      operatorName
    });

    res.json(successResponse(req, result));
  } catch (error) {
    next(error);
  }
});

router.post('/:id/generate-ledger', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { operatorId, operatorName } = req.body;

    if (!operatorId || !operatorName) {
      throw new ValidationError('操作人ID和姓名不能为空');
    }

    const ledger = await ledgerService.generateLedger({
      requisitionId: req.params.id,
      operatorId,
      operatorName
    });

    res.json(successResponse(req, ledger));
  } catch (error) {
    next(error);
  }
});

export default router;
