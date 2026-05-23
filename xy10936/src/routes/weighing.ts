import { Router, Request, Response } from 'express';
import * as weighingService from '../services/weighingService';
import * as weighingDao from '../dao/weighingDao';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, category_id, gross_weight, tare_weight, operator } = req.body;
    if (!customer_id || !category_id || gross_weight === undefined || tare_weight === undefined) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    const result = await weighingService.createWeighingRecord({
      customer_id,
      category_id,
      gross_weight,
      tare_weight,
      operator
    });
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const { customer_id, status } = req.query;
    if (customer_id) {
      const records = await weighingDao.getWeighingRecordsByCustomer(parseInt(customer_id as string));
      return res.json(records);
    }
    if (status) {
      const records = await weighingDao.getWeighingRecordsByStatus(status as string);
      return res.json(records);
    }
    const records = await weighingDao.getAllWeighingRecords();
    res.json(records);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    const record = await weighingDao.getWeighingRecordById(id);
    if (!record) {
      return res.status(404).json({ error: '称重记录不存在' });
    }
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/:id/verify', async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.id);
    const { gross_weight, tare_weight, verifier, remark } = req.body;
    if (!gross_weight || !tare_weight || !verifier) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    await weighingService.verifyWeight(recordId, {
      weighing_record_id: recordId,
      gross_weight,
      tare_weight,
      verifier,
      remark
    });
    res.json({ success: true, message: '重量复核通过' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/apply-price', async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.id);
    await weighingService.applyPrice(recordId);
    res.json({ success: true, message: '价格录入成功' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/amount', async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.id);
    const result = await weighingService.calculateSettlementAmount(recordId);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/:id/correct', async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.id);
    const { field_name, new_value, reason, operator } = req.body;
    if (!field_name || !reason || !operator) {
      return res.status(400).json({ error: '缺少必要参数' });
    }
    await weighingService.applyManualCorrection(recordId, {
      field_name,
      new_value,
      reason,
      operator
    });
    res.json({ success: true, message: '人工修正已记录' });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/:id/verifications', async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.id);
    const verifications = await weighingDao.getVerificationsByRecordId(recordId);
    res.json(verifications);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/corrections', async (req: Request, res: Response) => {
  try {
    const recordId = parseInt(req.params.id);
    const corrections = await weighingDao.getCorrectionsByRecordId(recordId);
    res.json(corrections);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
