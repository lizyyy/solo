import express from 'express';
import Papa from 'papaparse';
import * as recordService from '../services/recordService';
import * as exportService from '../services/exportService';
import type { QueryFilters } from '../services/recordService';

const router = express.Router();

const DEFAULT_OPERATOR = '当前用户';

router.get('/', (req, res) => {
  try {
    const {
      status, source, isDuplicate, customerName, guaranteeNo,
      startDate, endDate, currentOperator, page = '1', pageSize = '50'
    } = req.query;

    const filters: QueryFilters = {};
    if (status) filters.status = status as any;
    if (source) filters.source = source as any;
    if (isDuplicate !== undefined) filters.isDuplicate = isDuplicate === 'true';
    if (customerName) filters.customerName = customerName as string;
    if (guaranteeNo) filters.guaranteeNo = guaranteeNo as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (currentOperator) filters.currentOperator = currentOperator as string;

    const result = recordService.queryRecords(
      filters,
      parseInt(page as string),
      parseInt(pageSize as string)
    );

    res.json({
      success: true,
      data: {
        records: result.records,
        total: result.total,
        page: parseInt(page as string),
        pageSize: parseInt(pageSize as string)
      }
    });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/stats', (req, res) => {
  try {
    const { records } = recordService.queryRecords({}, 1, 10000);
    const stats = exportService.getStatistics(records);
    res.json({ success: true, data: stats });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const record = recordService.getRecordById(id);
    
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    const logs = recordService.getOperationLogs(id);
    
    res.json({ success: true, data: { record, logs } });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/:id/logs', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const logs = recordService.getOperationLogs(id);
    res.json({ success: true, data: logs });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/', (req, res) => {
  try {
    const { operator, ...data } = req.body;
    const result = recordService.createRecord(data, operator || DEFAULT_OPERATOR);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.put('/:id', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator, reason, ...updates } = req.body;
    
    const record = recordService.updateRecord(
      id,
      updates,
      operator || DEFAULT_OPERATOR,
      reason
    );
    
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.json({ success: true, data: record });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/withdraw', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator, reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ success: false, error: '撤回必须提供原因' });
    }
    
    const record = recordService.withdrawRecord(
      id,
      operator || DEFAULT_OPERATOR,
      reason
    );
    
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.json({ success: true, data: record });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/approve', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator, reason } = req.body;
    
    const record = recordService.approveRecord(
      id,
      operator || DEFAULT_OPERATOR,
      reason
    );
    
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.json({ success: true, data: record });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/reject', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator, reason } = req.body;
    
    if (!reason) {
      return res.status(400).json({ success: false, error: '驳回必须提供原因' });
    }
    
    const record = recordService.rejectRecord(
      id,
      operator || DEFAULT_OPERATOR,
      reason
    );
    
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.json({ success: true, data: record });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/:id/resolve-dispute', (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { operator, isDuplicate, mergeWithId, reason } = req.body;
    
    const record = recordService.resolveDispute(
      id,
      operator || DEFAULT_OPERATOR,
      isDuplicate,
      mergeWithId,
      reason
    );
    
    if (!record) {
      return res.status(404).json({ success: false, error: '记录不存在' });
    }
    
    res.json({ success: true, data: record });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/import', (req, res) => {
  try {
    const { operator, records } = req.body;
    
    if (!Array.isArray(records)) {
      return res.status(400).json({ success: false, error: 'records 必须是数组' });
    }
    
    const result = recordService.batchImport(records, operator || DEFAULT_OPERATOR);
    res.json({ success: true, data: result });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.post('/import/csv', async (req, res) => {
  try {
    const { operator, csvContent } = req.body;
    
    if (!csvContent) {
      return res.status(400).json({ success: false, error: '缺少CSV内容' });
    }
    
    const result = Papa.parse<any>(csvContent, {
      header: true,
      skipEmptyLines: true
    });
    
    const records = (result.data as any[]).map((row: any) => ({
      guaranteeNo: row['保证函编号'] || row['guaranteeNo'],
      customerName: row['客户名称'] || row['customerName'],
      amount: parseFloat(row['金额'] || row['amount']),
      currency: row['币种'] || row['currency'] || 'CNY',
      source: row['来源'] || row['source'] || 'batch_import',
      sourceRef: row['来源参考'] || row['sourceRef'],
      status: row['状态'] || row['status'] || 'pending',
      pendingReason: row['待处理原因'] || row['pendingReason'],
      reviewReason: row['复核原因'] || row['reviewReason'],
      currentOperator: row['处理人'] || row['currentOperator'] || operator || DEFAULT_OPERATOR,
      createdBy: operator || DEFAULT_OPERATOR,
      remark: row['备注'] || row['remark']
    }));
    
    const importResult = recordService.batchImport(records, operator || DEFAULT_OPERATOR);
    res.json({ success: true, data: importResult });
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/export/csv', async (req, res) => {
  try {
    const {
      status, source, isDuplicate, customerName, guaranteeNo,
      startDate, endDate, currentOperator, includeHistory = 'true'
    } = req.query;

    const filters: QueryFilters = {};
    if (status) filters.status = status as any;
    if (source) filters.source = source as any;
    if (isDuplicate !== undefined) filters.isDuplicate = isDuplicate === 'true';
    if (customerName) filters.customerName = customerName as string;
    if (guaranteeNo) filters.guaranteeNo = guaranteeNo as string;
    if (startDate) filters.startDate = startDate as string;
    if (endDate) filters.endDate = endDate as string;
    if (currentOperator) filters.currentOperator = currentOperator as string;

    const csv = await exportService.exportToCSV(filters, includeHistory === 'true');
    
    const filename = `保证函额度排队_${new Date().toISOString().split('T')[0]}.csv`;
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(csv);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

router.get('/export/review-list', (req, res) => {
  try {
    const { status = 'pending,disputed' } = req.query;
    const statusList = (status as string).split(',');
    
    const allRecords: any[] = [];
    
    for (const s of statusList) {
      const { records } = recordService.queryRecords({ status: s as any }, 1, 10000);
      allRecords.push(...records);
    }
    
    allRecords.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    
    const content = exportService.generateReviewList(allRecords);
    
    const filename = `复核清单_${new Date().toISOString().split('T')[0]}.txt`;
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    res.send(content);
  } catch (e: any) {
    res.status(500).json({ success: false, error: e.message });
  }
});

export default router;
