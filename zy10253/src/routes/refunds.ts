import { Router, Request, Response } from 'express';
import { calculateRefund, createRefundApplication, approveRefund, cancelRefund, getRefundDetail, getRefundsByContractId } from '../services/refundService';

const router = Router();

router.get('/calculate/:contractId', async (req: Request, res: Response, next) => {
  try {
    const calculation = await calculateRefund(req.params.contractId);
    res.json({
      success: true,
      data: calculation
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req: Request, res: Response, next) => {
  try {
    const { contract_id, reason, requested_date, created_by, created_by_name } = req.body;
    const result = await createRefundApplication(contract_id, reason, requested_date, created_by, created_by_name);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/approve', async (req: Request, res: Response, next) => {
  try {
    const { approver_id, approver_name, comment } = req.body;
    const result = await approveRefund(req.params.id, approver_id, approver_name, comment);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/cancel', async (req: Request, res: Response, next) => {
  try {
    const { operator_id, operator_name, comment } = req.body;
    const result = await cancelRefund(req.params.id, operator_id, operator_name, comment);
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req: Request, res: Response, next) => {
  try {
    const detail = await getRefundDetail(req.params.id);
    res.json({
      success: true,
      data: detail
    });
  } catch (err) {
    next(err);
  }
});

router.get('/contract/:contractId', async (req: Request, res: Response, next) => {
  try {
    const refunds = await getRefundsByContractId(req.params.contractId);
    res.json({
      success: true,
      data: refunds
    });
  } catch (err) {
    next(err);
  }
});

export default router;
