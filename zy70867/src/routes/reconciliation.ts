import express, { Request, Response } from 'express';
import { createObjectCsvStringifier } from 'csv-writer';
import {
  submitReconciliation,
  findById,
  findAll,
  calculateStatistics,
  generateExportData
} from '../services/reconciliation';
import { ReconciliationSubmitRequest, ProcessingStatus } from '../types';

const router = express.Router();

router.post('/submit', async (req: Request, res: Response) => {
  try {
    const data: ReconciliationSubmitRequest = req.body;
    const result = await submitReconciliation(data);
    res.json(result);
  } catch (error) {
    console.error('提交对账失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误',
      error: error instanceof Error ? error.message : String(error)
    });
  }
});

router.get('/list', async (req: Request, res: Response) => {
  try {
    const { hotelId, status, startDate, endDate } = req.query;
    const records = await findAll({
      hotelId: hotelId as string,
      status: status as ProcessingStatus,
      startDate: startDate as string,
      endDate: endDate as string
    });
    res.json({ success: true, data: records });
  } catch (error) {
    console.error('查询列表失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = await findById(id);
    
    if (!record) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    res.json({ success: true, data: record });
  } catch (error) {
    console.error('查询记录失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

router.get('/:id/statistics', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const statistics = await calculateStatistics(id);
    
    if (!statistics) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }
    
    res.json({ success: true, data: statistics });
  } catch (error) {
    console.error('查询统计失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

router.get('/:id/export', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const exportData = await generateExportData(id);
    
    if (!exportData) {
      return res.status(404).json({
        success: false,
        message: '记录不存在'
      });
    }

    const csvStringifier = createObjectCsvStringifier({
      header: [
        { id: 'batchId', title: '批次号' },
        { id: 'hotelName', title: '酒店名称' },
        { id: 'submitDate', title: '提交日期' },
        { id: 'handler', title: '处理人' },
        { id: 'linenType', title: '布草类型' },
        { id: 'roomType', title: '房型' },
        { id: 'sendQuantity', title: '送洗数量' },
        { id: 'returnQuantity', title: '回收数量' },
        { id: 'damagedQuantity', title: '破损数量' },
        { id: 'damageCompensation', title: '破损赔付' },
        { id: 'billedQuantity', title: '账单数量' },
        { id: 'billedAmount', title: '账单金额' },
        { id: 'discrepancy', title: '数量差异' },
        { id: 'processingStatus', title: '处理状态' },
        { id: 'statusReason', title: '状态说明' }
      ]
    });

    const csvContent = csvStringifier.getHeaderString() + 
      csvStringifier.stringifyRecords(exportData);

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="reconciliation-${id}.csv"`);
    res.send('\uFEFF' + csvContent);
  } catch (error) {
    console.error('导出失败:', error);
    res.status(500).json({
      success: false,
      message: '服务器内部错误'
    });
  }
});

export default router;
