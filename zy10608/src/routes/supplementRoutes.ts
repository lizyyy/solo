import express from 'express';
import { Parser } from 'json2csv';
import { supplementService } from '../services/supplementService';
import { SupplementStatus } from '../models/types';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const { operator, ...record } = req.body;
    if (!record.waybill_no || !record.carrier || !record.node_time || !record.supplement_source) {
      return res.status(400).json({
        error: '缺少必填字段: waybill_no, carrier, node_time, supplement_source'
      });
    }
    record.status = record.status || SupplementStatus.PENDING;
    const result = await supplementService.create(record, operator);
    res.status(201).json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/batch', async (req, res) => {
  try {
    const { records, operator } = req.body;
    if (!Array.isArray(records)) {
      return res.status(400).json({ error: 'records 必须是数组' });
    }
    const result = await supplementService.batchCreate(records, operator);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const filter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as SupplementStatus,
      handler: req.query.handler as string,
      business_object: req.query.business_object as string,
      waybill_no: req.query.waybill_no as string,
      carrier: req.query.carrier as string,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      pageSize: req.query.pageSize ? parseInt(req.query.pageSize as string) : undefined
    };
    const result = await supplementService.query(filter);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = await supplementService.getById(id);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(record);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/:id/history', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const history = await supplementService.getHistory(id);
    res.json(history);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/:id/status', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { status, operator, remark } = req.body;
    if (!status) {
      return res.status(400).json({ error: '缺少 status 字段' });
    }
    const result = await supplementService.updateStatus(id, status, operator, remark);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator, ...updates } = req.body;
    const result = await supplementService.update(id, updates, operator);
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const filter = {
      startDate: req.query.startDate as string,
      endDate: req.query.endDate as string,
      status: req.query.status as SupplementStatus,
      handler: req.query.handler as string,
      business_object: req.query.business_object as string,
      waybill_no: req.query.waybill_no as string,
      carrier: req.query.carrier as string
    };
    const records = await supplementService.getAllForExport(filter);
    
    const fields = [
      { label: 'ID', value: 'id' },
      { label: '运单号', value: 'waybill_no' },
      { label: '承运商', value: 'carrier' },
      { label: '节点时间', value: 'node_time' },
      { label: '节点类型', value: 'node_type' },
      { label: '补传来源', value: 'supplement_source' },
      { label: '状态', value: 'status' },
      { label: '处理人', value: 'handler' },
      { label: '业务对象', value: 'business_object' },
      { label: '备注', value: 'remark' },
      { label: '创建时间', value: 'created_at' },
      { label: '更新时间', value: 'updated_at' }
    ];
    
    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(records);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=supplement_records.csv');
    res.send('\uFEFF' + csv);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
});

export default router;
