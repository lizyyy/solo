import { Router, Request, Response } from 'express';
import { benefitService } from '../services/benefitService';
import { v4 as uuidv4 } from 'uuid';
import { FreezeReason, BenefitStatus } from '../types';

const router = Router();

router.post('/grant', (req: Request, res: Response) => {
  const { memberId, benefitType, benefitName, totalDays } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  if (!memberId || !benefitType || !benefitName || !totalDays) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: memberId, benefitType, benefitName, totalDays',
      requestId
    });
  }

  const result = benefitService.grantBenefit({
    requestId,
    memberId,
    benefitType,
    benefitName,
    totalDays: Number(totalDays)
  });

  res.json(result);
});

router.get('/:benefitId', (req: Request, res: Response) => {
  const { benefitId } = req.params;
  const result = benefitService.queryBenefit({ benefitId });
  res.json(result);
});

router.post('/:benefitId/freeze', (req: Request, res: Response) => {
  const { benefitId } = req.params;
  const { reason, detail, operator } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  if (!reason || !detail) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: reason, detail',
      requestId
    });
  }

  const validReasons = Object.values(FreezeReason);
  if (!validReasons.includes(reason)) {
    return res.status(400).json({
      success: false,
      message: `无效的冻结原因，有效值: ${validReasons.join(', ')}`,
      requestId
    });
  }

  const result = benefitService.freezeBenefit({
    requestId,
    benefitId,
    reason,
    detail,
    operator
  });

  res.json(result);
});

router.post('/:benefitId/unfreeze', (req: Request, res: Response) => {
  const { benefitId } = req.params;
  const { reason, operator } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  if (!reason) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: reason',
      requestId
    });
  }

  const result = benefitService.unfreezeBenefit({
    requestId,
    benefitId,
    reason,
    operator
  });

  res.json(result);
});

router.post('/:benefitId/refund', (req: Request, res: Response) => {
  const { benefitId } = req.params;
  const { detail, operator } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  if (!detail) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: detail',
      requestId
    });
  }

  const result = benefitService.processRefund({
    requestId,
    benefitId,
    detail,
    operator
  });

  res.json(result);
});

router.post('/:benefitId/compensate', (req: Request, res: Response) => {
  const { benefitId } = req.params;
  const { days, reason, operator } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  if (!days || !reason) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: days, reason',
      requestId
    });
  }

  const result = benefitService.compensateBenefit({
    requestId,
    benefitId,
    days: Number(days),
    reason,
    operator
  });

  res.json(result);
});

router.post('/:benefitId/correct', (req: Request, res: Response) => {
  const { benefitId } = req.params;
  const { changes, operator, reason } = req.body;
  const requestId = req.headers['x-request-id'] as string || uuidv4();

  if (!changes || !operator || !reason) {
    return res.status(400).json({
      success: false,
      message: '缺少必要参数: changes, operator, reason',
      requestId
    });
  }

  if (changes.status) {
    const validStatuses = Object.values(BenefitStatus);
    if (!validStatuses.includes(changes.status)) {
      return res.status(400).json({
        success: false,
        message: `无效的状态值，有效值: ${validStatuses.join(', ')}`,
        requestId
      });
    }
  }

  const result = benefitService.manualCorrect({
    requestId,
    benefitId,
    changes,
    operator,
    reason
  });

  res.json(result);
});

export { router as benefitRouter };
