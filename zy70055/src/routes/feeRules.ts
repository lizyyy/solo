import { Router, Request, Response } from 'express';
import { asyncHandler } from '../middleware';
import { feeRuleService } from '../services';
import { ValidationError } from '../utils/error';

const router = Router();

router.post('/', asyncHandler(async (req: Request, res: Response) => {
  const { name, feeType, value, minFee, maxFee, tierConfig, effectiveFrom, effectiveTo } = req.body;

  if (!name || !feeType || value === undefined || minFee === undefined || !effectiveFrom) {
    throw new ValidationError('缺少必要参数: name, feeType, value, minFee, effectiveFrom');
  }

  const rule = await feeRuleService.createRule({
    name,
    feeType,
    value: Number(value),
    minFee: Number(minFee),
    maxFee: maxFee !== undefined ? Number(maxFee) : undefined,
    tierConfig,
    effectiveFrom: new Date(effectiveFrom),
    effectiveTo: effectiveTo ? new Date(effectiveTo) : undefined,
  });

  res.status(201).json({
    success: true,
    data: rule,
  });
}));

router.get('/', asyncHandler(async (_req: Request, res: Response) => {
  const rules = await feeRuleService.getActiveRules();

  res.json({
    success: true,
    data: rules,
  });
}));

router.post('/assign', asyncHandler(async (req: Request, res: Response) => {
  const { merchantId, ruleId, operator } = req.body;

  if (!merchantId || !ruleId || !operator) {
    throw new ValidationError('缺少必要参数: merchantId, ruleId, operator');
  }

  const result = await feeRuleService.assignRuleToMerchant(merchantId, ruleId, operator);

  res.json({
    success: true,
    data: result,
  });
}));

router.post('/calculate', asyncHandler(async (req: Request, res: Response) => {
  const { amount, merchantId } = req.body;

  if (!amount || !merchantId) {
    throw new ValidationError('缺少必要参数: amount, merchantId');
  }

  const result = await feeRuleService.calculateFee(Number(amount), merchantId);

  res.json({
    success: true,
    data: result,
  });
}));

router.post('/validate/:batchId', asyncHandler(async (req: Request, res: Response) => {
  const result = await feeRuleService.validateBatchFees(req.params.batchId);

  res.json({
    success: true,
    data: result,
  });
}));

export { router as feeRulesRouter };
