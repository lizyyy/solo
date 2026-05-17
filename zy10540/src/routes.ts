import { Router, Request, Response } from 'express';
import Joi from 'joi';
import { Parser } from 'json2csv';
import { deviceRebindService } from './service';
import { RebindStatus } from './types';

const router = Router();

const createRebindSchema = Joi.object({
  device_code: Joi.string().required(),
  old_store_id: Joi.string().required(),
  old_store_name: Joi.string().optional(),
  new_store_id: Joi.string().required(),
  new_store_name: Joi.string().optional(),
  repair_order_id: Joi.string().optional(),
  rebind_reason: Joi.string().required(),
  rebind_report: Joi.string().optional(),
  created_by: Joi.string().optional()
});

const transitionStatusSchema = Joi.object({
  rebind_id: Joi.string().required(),
  target_status: Joi.string().valid(...Object.values(RebindStatus)).required(),
  operated_by: Joi.string().optional(),
  remark: Joi.string().optional(),
  processing_evidence: Joi.string().optional()
});

const handleExceptionSchema = Joi.object({
  rebind_id: Joi.string().required(),
  exception_reason: Joi.string().required(),
  operated_by: Joi.string().required()
});

const manualFixSchema = Joi.object({
  rebind_id: Joi.string().required(),
  device_code: Joi.string().optional(),
  old_store_id: Joi.string().optional(),
  old_store_name: Joi.string().optional(),
  new_store_id: Joi.string().optional(),
  new_store_name: Joi.string().optional(),
  repair_order_id: Joi.string().optional(),
  rebind_reason: Joi.string().optional(),
  rebind_report: Joi.string().optional(),
  operated_by: Joi.string().required(),
  fix_remark: Joi.string().required()
});

router.post('/create', async (req: Request, res: Response) => {
  try {
    const { error, value } = createRebindSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await deviceRebindService.createRebind(value);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await deviceRebindService.getRebindById(id);
    
    if (!result) {
      return res.status(404).json({ success: false, message: '换绑记录不存在' });
    }
    
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/query', async (req: Request, res: Response) => {
  try {
    const result = await deviceRebindService.queryRebinds(req.body);
    res.json({ success: true, data: result.list, total: result.total });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.post('/transition-status', async (req: Request, res: Response) => {
  try {
    const { error, value } = transitionStatusSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await deviceRebindService.transitionStatus(value);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/handle-exception', async (req: Request, res: Response) => {
  try {
    const { error, value } = handleExceptionSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await deviceRebindService.handleException(
      value.rebind_id,
      value.exception_reason,
      value.operated_by
    );
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/manual-fix', async (req: Request, res: Response) => {
  try {
    const { error, value } = manualFixSchema.validate(req.body);
    if (error) {
      return res.status(400).json({ success: false, message: error.details[0].message });
    }

    const result = await deviceRebindService.manualFix(value);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(400).json({ success: false, message: err.message });
  }
});

router.post('/export', async (req: Request, res: Response) => {
  try {
    const data = await deviceRebindService.exportRebinds(req.body);
    
    if (req.query.format === 'csv') {
      const fields = [
        'id', 'device_code', 'old_store_id', 'old_store_name',
        'new_store_id', 'new_store_name', 'repair_order_id',
        'rebind_reason', 'status', 'warranty_valid',
        'created_by', 'created_at', 'approved_at'
      ];
      const json2csvParser = new Parser({ fields });
      const csv = json2csvParser.parse(data);
      
      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename="device_rebind.csv"');
      res.send(csv);
    } else {
      res.json({ success: true, data });
    }
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/history/device/:deviceCode', async (req: Request, res: Response) => {
  try {
    const { deviceCode } = req.params;
    const result = await deviceRebindService.getDeviceHistory(deviceCode);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

router.get('/history/rebind/:rebindId', async (req: Request, res: Response) => {
  try {
    const { rebindId } = req.params;
    const result = await deviceRebindService.getRebindHistory(rebindId);
    res.json({ success: true, data: result });
  } catch (err: any) {
    res.status(500).json({ success: false, message: err.message });
  }
});

export default router;
