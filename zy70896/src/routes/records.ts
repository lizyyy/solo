import { Router, Request, Response } from 'express';
import { transferService } from '../services/TransferService';
import { QueryFilters, RecordStatus } from '../types';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const {
      cashBoxId,
      supervisorId,
      errorNumber,
      tellerId,
      status,
      batchId,
      startDate,
      endDate,
      page = '1',
      pageSize = '50'
    } = req.query;

    const filters: QueryFilters = {
      cashBoxId: cashBoxId as string,
      supervisorId: supervisorId as string,
      errorNumber: errorNumber as string,
      tellerId: tellerId as string,
      status: status as RecordStatus,
      batchId: batchId as string,
      startDate: startDate as string,
      endDate: endDate as string
    };

    const result = await transferService.queryRecords(
      filters,
      parseInt(page as string),
      parseInt(pageSize as string)
    );
    res.status(200).json(result);
  } catch (error) {
    res.status(500).json({ error: '查询记录失败' });
  }
});

router.get('/:recordId', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const record = await transferService.getRecordById(recordId);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ error: '获取记录失败' });
  }
});

router.post('/:recordId/process', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const { handledBy, comment } = req.body;
    const record = await transferService.markProcessed(recordId, handledBy, comment);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ error: '标记处理失败' });
  }
});

router.post('/:recordId/return', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const { handledBy, comment } = req.body;
    const record = await transferService.returnForCorrection(recordId, handledBy, comment);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ error: '退回修改失败' });
  }
});

router.post('/:recordId/approve', async (req: Request, res: Response) => {
  try {
    const { recordId } = req.params;
    const { handledBy, comment } = req.body;
    const record = await transferService.approveRecord(recordId, handledBy, comment);
    if (!record) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.status(200).json(record);
  } catch (error) {
    res.status(500).json({ error: '审批失败' });
  }
});

router.get('/export/download', async (req: Request, res: Response) => {
  try {
    const {
      cashBoxId,
      supervisorId,
      errorNumber,
      tellerId,
      status,
      batchId,
      startDate,
      endDate
    } = req.query;

    const filters: QueryFilters = {
      cashBoxId: cashBoxId as string,
      supervisorId: supervisorId as string,
      errorNumber: errorNumber as string,
      tellerId: tellerId as string,
      status: status as RecordStatus,
      batchId: batchId as string,
      startDate: startDate as string,
      endDate: endDate as string
    };

    const csvBuffer = await transferService.exportRecords(filters);
    const filename = `transfer_records_${Date.now()}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvBuffer);
  } catch (error) {
    res.status(500).json({ error: '导出失败' });
  }
});

export default router;
