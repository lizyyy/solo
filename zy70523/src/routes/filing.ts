import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { FilingStatus, CreateFilingRequest, AdvanceStatusRequest, HandleExceptionRequest, ManualCorrectionRequest } from '../types';
import { filingService } from '../services/FilingService';

const router = Router();

const createFilingSchema = Joi.object({
  serviceName: Joi.string().required(),
  egressAddress: Joi.string().required(),
  openWindow: Joi.object({
    startTime: Joi.string().isoDate().required(),
    endTime: Joi.string().isoDate().required(),
    timezone: Joi.string().optional()
  }).required(),
  purpose: Joi.string().required(),
  closeCondition: Joi.object({
    type: Joi.string().valid('manual', 'auto', 'timeout').required(),
    trigger: Joi.string().optional(),
    reason: Joi.string().optional()
  }).required(),
  creator: Joi.string().required()
});

const advanceStatusSchema = Joi.object({
  targetStatus: Joi.string().valid(...Object.values(FilingStatus)).required(),
  operator: Joi.string().optional(),
  reason: Joi.string().required()
});

const exceptionSchema = Joi.object({
  step: Joi.string().required(),
  originalInput: Joi.object().required(),
  processingBasis: Joi.string().required(),
  conclusion: Joi.string().required(),
  errorCode: Joi.string().optional(),
  errorMessage: Joi.string().optional(),
  operator: Joi.string().optional()
});

const manualCorrectionSchema = Joi.object({
  field: Joi.string().required(),
  oldValue: Joi.any().required(),
  newValue: Joi.any().required(),
  operator: Joi.string().required(),
  reason: Joi.string().required()
});

const approvalSchema = Joi.object({
  approver: Joi.string().required(),
  reason: Joi.string().optional()
});

const closeSchema = Joi.object({
  closer: Joi.string().required(),
  reason: Joi.string().required()
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { error, value } = createFilingSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await filingService.createFiling(value as CreateFilingRequest);
    res.status(201).json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { status, serviceName } = req.query;
    const filters: any = {};
    if (status) filters.status = status as FilingStatus;
    if (serviceName) filters.serviceName = serviceName as string;

    const result = await filingService.listFilings(filters);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const result = await filingService.getFiling(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '备案记录不存在' });
    }
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/advance-status', async (req: Request, res: Response) => {
  try {
    const { error, value } = advanceStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await filingService.advanceStatus(
      req.params.id,
      value.targetStatus,
      value.operator,
      value.reason
    );
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/approve', async (req: Request, res: Response) => {
  try {
    const { error, value } = approvalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await filingService.approveFiling(req.params.id, value.approver);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/reject', async (req: Request, res: Response) => {
  try {
    const { error, value } = approvalSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    const result = await filingService.rejectFiling(req.params.id, value.approver, value.reason || '审批拒绝');
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/exceptions', async (req: Request, res: Response) => {
  try {
    const { error, value } = exceptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await filingService.handleException(req.params.id, value as HandleExceptionRequest);
    res.status(201).json({ message: '异常记录已保存' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/exceptions', async (req: Request, res: Response) => {
  try {
    const result = await filingService.getExceptions(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/:id/manual-correction', async (req: Request, res: Response) => {
  try {
    const { error, value } = manualCorrectionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await filingService.manualCorrection(req.params.id, value as ManualCorrectionRequest);
    res.status(200).json({ message: '人工修正已记录' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/:id/close', async (req: Request, res: Response) => {
  try {
    const { error, value } = closeSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ error: error.details[0].message });
    }

    await filingService.closeFiling(req.params.id, value.closer, value.reason);
    res.json({ message: '备案已关闭' });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/report', async (req: Request, res: Response) => {
  try {
    const result = await filingService.generateReport(req.params.id);
    res.json(result);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const csv = await filingService.exportToCSV(req.params.id);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="filing-${req.params.id}.csv`);
    res.send(csv);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

router.post('/check-expired', async (req: Request, res: Response) => {
  try {
    const expiredIds = await filingService.checkExpiredWindows();
    res.json({ expiredIds, count: expiredIds.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
