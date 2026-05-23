import { Router, Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { StateMachineService } from '../services/stateMachine';
import { BatchDAO, AttachmentDAO, DeductionDAO, AuditLogDAO, FailedRecordDAO, SummaryDAO } from '../database/dao';
import { ExportService } from '../services/exportService';
import { ReturnStatus, ApiResponse, PaginatedResponse } from '../types';

const router = Router();

function getOperatorInfo(req: Request): { operatorId: string; operatorName: string } {
  return {
    operatorId: req.headers['x-operator-id'] as string || 'system',
    operatorName: req.headers['x-operator-name'] as string || '系统管理员'
  };
}

router.post('/', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName } = getOperatorInfo(req);
    const { batchData, equipmentItems } = req.body;

    const batch = await StateMachineService.createBatch(
      batchData,
      equipmentItems.map((item: any) => ({
        ...item,
        expectedReturnDate: new Date(item.expectedReturnDate),
        actualReturnDate: item.actualReturnDate ? new Date(item.actualReturnDate) : undefined
      })),
      operatorId,
      operatorName
    );

    res.json({
      success: true,
      data: batch,
      message: '批次创建成功'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message,
      traceId: uuidv4()
    } as ApiResponse);
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;
    const status = req.query.status as ReturnStatus;
    const customerId = req.query.customerId as string;
    const isArchived = req.query.isArchived === 'true';

    const { data, total } = await BatchDAO.findAll(
      { status, customerId, isArchived },
      page,
      pageSize
    );

    res.json({
      success: true,
      data: {
        data,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize)
      }
    } as ApiResponse<PaginatedResponse<any>>);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const batch = await StateMachineService.getBatchDetail(req.params.id);
    
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      } as ApiResponse);
    }

    const consistency = StateMachineService.validateDataConsistency(batch);

    res.json({
      success: true,
      data: {
        ...batch,
        dataConsistency: consistency
      }
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/:id/transition', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName } = getOperatorInfo(req);
    const { transitionKey, reason, context } = req.body;

    const batch = await StateMachineService.transition(
      req.params.id,
      transitionKey,
      reason,
      operatorId,
      operatorName,
      context
    );

    res.json({
      success: true,
      data: batch,
      message: `状态变更成功: ${transitionKey}`
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/:id/attachments', async (req: Request, res: Response) => {
  try {
    const { operatorId, operatorName } = getOperatorInfo(req);
    const { type, fileName, fileUrl, fileSize } = req.body;

    const attachment = await AttachmentDAO.create({
      batchId: req.params.id,
      type,
      fileName,
      fileUrl,
      fileSize,
      uploadedBy: operatorId
    });

    const batch = await BatchDAO.findById(req.params.id);
    if (batch && batch.status === ReturnStatus.BATCH_CREATED) {
      await StateMachineService.transition(
        req.params.id,
        'UPLOAD_ATTACHMENTS',
        '上传附件',
        operatorId,
        operatorName
      );
    }

    res.json({
      success: true,
      data: attachment,
      message: '附件上传成功'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/:id/attachments/:attachmentId/verify', async (req: Request, res: Response) => {
  try {
    const { operatorId } = getOperatorInfo(req);
    const { notes } = req.body;

    await AttachmentDAO.verify(req.params.attachmentId, operatorId, notes);

    res.json({
      success: true,
      message: '附件审核成功'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/:id/deductions', async (req: Request, res: Response) => {
  try {
    const { operatorId } = getOperatorInfo(req);
    const { equipmentId, deductionType, amount, reason, evidenceAttachmentIds } = req.body;

    const deduction = await DeductionDAO.create({
      batchId: req.params.id,
      equipmentId,
      deductionType,
      amount,
      reason,
      evidenceAttachmentIds,
      createdBy: operatorId
    });

    res.json({
      success: true,
      data: deduction,
      message: '扣款记录创建成功'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/:id/deductions/:deductionId/approve', async (req: Request, res: Response) => {
  try {
    const { operatorId } = getOperatorInfo(req);

    await DeductionDAO.approve(req.params.deductionId, operatorId);

    res.json({
      success: true,
      message: '扣款记录批准成功'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const logs = await AuditLogDAO.findByBatchId(req.params.id);

    res.json({
      success: true,
      data: logs
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.get('/:id/transitions/available', async (req: Request, res: Response) => {
  try {
    const batch = await BatchDAO.findById(req.params.id);
    if (!batch) {
      return res.status(404).json({
        success: false,
        error: '批次不存在'
      } as ApiResponse);
    }

    const transitions = await StateMachineService.getAvailableTransitions(batch.status);
    const transitionsWithDesc = transitions.map(key => ({
      key,
      description: StateMachineService.getTransitionDescription(key)
    }));

    res.json({
      success: true,
      data: transitionsWithDesc
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const { startDate, endDate, status, includeArchived } = req.body;
    
    const filePath = await ExportService.exportBatchesToCSV({
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      status: status as ReturnStatus[],
      includeArchived
    });

    res.json({
      success: true,
      data: { filePath },
      message: '导出成功'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

router.post('/:id/export', async (req: Request, res: Response) => {
  try {
    const filePath = await ExportService.exportBatchDetailToCSV(req.params.id);

    res.json({
      success: true,
      data: { filePath },
      message: '导出成功'
    } as ApiResponse);
  } catch (error: any) {
    res.status(400).json({
      success: false,
      error: error.message
    } as ApiResponse);
  }
});

export default router;
