import { Router, Request, Response } from 'express';
import multer from 'multer';
import { parse } from 'csv-parse/sync';
import * as XLSX from 'xlsx';
import {
  importBatchTransactions,
  getTransactions,
  getTransaction,
  getExplanations,
  reviewTransaction,
  rollbackTransaction,
  getVersionHistory,
  getStatistics,
  getAllTransactionsForExport,
} from '../services/transactionService';
import { ReviewRequest, TransactionData } from '../types';

const router = Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

function parseTransactionData(row: Record<string, any>): TransactionData {
  return {
    transaction_id: String(row.transaction_id || row['交易ID'] || row.id || ''),
    amount: Number(row.amount || row['金额'] || row['交易金额'] || 0),
    merchant: String(row.merchant || row['商户'] || row['交易商户'] || ''),
    category: String(row.category || row['品类'] || row['交易品类'] || ''),
    country: String(row.country || row['国家'] || row['交易国家'] || ''),
    device_id: String(row.device_id || row['设备ID'] || ''),
    user_id: String(row.user_id || row['用户ID'] || ''),
    transaction_time: String(row.transaction_time || row['交易时间'] || new Date().toISOString()),
    is_first_transaction: Number(row.is_first_transaction || row['首次交易'] || 0),
    is_weekend: Number(row.is_weekend || row['周末交易'] || 0),
    is_night: Number(row.is_night || row['夜间交易'] || 0),
    velocity_24h: Number(row.velocity_24h || row['24h频次'] || row['24h交易频次'] || 0),
    amount_deviation: Number(row.amount_deviation || row['金额偏离'] || row['金额偏离度'] || 0),
    risk_score: row.risk_score !== undefined ? Number(row.risk_score) : undefined,
  };
}

router.post('/import', upload.single('file'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: '请选择要上传的文件' });
    }

    const operator = req.body.operator || 'system';
    let data: Record<string, any>[] = [];

    if (req.file.originalname.endsWith('.csv')) {
      data = parse(req.file.buffer, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } else if (
      req.file.originalname.endsWith('.xlsx') ||
      req.file.originalname.endsWith('.xls')
    ) {
      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      data = XLSX.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      return res.status(400).json({ error: '不支持的文件格式，请上传 CSV 或 Excel 文件' });
    }

    if (!data || data.length === 0) {
      return res.status(400).json({ error: '文件中没有数据' });
    }

    const txDataList = data.map(parseTransactionData).filter((tx) => tx.transaction_id);

    if (txDataList.length === 0) {
      return res.status(400).json({ error: '数据格式错误，请确保包含 transaction_id 或交易ID 列' });
    }

    const result = importBatchTransactions(txDataList, operator);

    res.json({
      ok: true,
      total: data.length,
      ...result,
    });
  } catch (err) {
    console.error('Import error:', err);
    res.status(500).json({ error: '导入失败: ' + (err as Error).message });
  }
});

router.post('/import/json', (req: Request, res: Response) => {
  try {
    const { data, operator } = req.body;

    if (!data || !Array.isArray(data) || data.length === 0) {
      return res.status(400).json({ error: '请提供交易数据数组' });
    }

    const txDataList = data.map(parseTransactionData).filter((tx) => tx.transaction_id);
    const result = importBatchTransactions(txDataList, operator || 'system');

    res.json({
      ok: true,
      total: data.length,
      ...result,
    });
  } catch (err) {
    res.status(500).json({ error: '导入失败: ' + (err as Error).message });
  }
});

router.get('/', (req: Request, res: Response) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const pageSize = parseInt(req.query.pageSize as string) || 20;

    const filters = {
      is_anomaly: req.query.is_anomaly !== undefined ? req.query.is_anomaly === 'true' : undefined,
      reviewed: req.query.reviewed !== undefined ? req.query.reviewed === 'true' : undefined,
      review_decision: (req.query.review_decision as 'confirmed' | 'rejected') || undefined,
      min_score: req.query.min_score ? parseFloat(req.query.min_score as string) : undefined,
      max_score: req.query.max_score ? parseFloat(req.query.max_score as string) : undefined,
      search: (req.query.search as string) || undefined,
    };

    const result = getTransactions(page, pageSize, filters);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: '查询失败: ' + (err as Error).message });
  }
});

router.get('/statistics', (_req: Request, res: Response) => {
  try {
    const stats = getStatistics();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: '获取统计数据失败: ' + (err as Error).message });
  }
});

router.get('/:transactionId', (req: Request, res: Response) => {
  try {
    const tx = getTransaction(req.params.transactionId);
    if (!tx) {
      return res.status(404).json({ error: '交易不存在' });
    }

    const explanations = getExplanations(req.params.transactionId);
    const versionHistory = getVersionHistory(req.params.transactionId);

    res.json({
      transaction: tx,
      explanations,
      version_history: versionHistory,
    });
  } catch (err) {
    res.status(500).json({ error: '查询失败: ' + (err as Error).message });
  }
});

router.post('/review', (req: Request, res: Response) => {
  try {
    const body = req.body as ReviewRequest;

    if (!body.transaction_id || !body.decision || !body.reviewer) {
      return res.status(400).json({ error: '缺少必要参数: transaction_id, decision, reviewer' });
    }

    reviewTransaction(body);
    res.json({ success: true, message: '复核完成' });
  } catch (err) {
    res.status(500).json({ error: '复核失败: ' + (err as Error).message });
  }
});

router.post('/rollback/:transactionId', (req: Request, res: Response) => {
  try {
    const { operator } = req.body;
    rollbackTransaction(req.params.transactionId, operator || 'system');
    res.json({ success: true, message: '已回滚' });
  } catch (err) {
    res.status(500).json({ error: '回滚失败: ' + (err as Error).message });
  }
});

router.get('/history/:transactionId', (req: Request, res: Response) => {
  try {
    const history = getVersionHistory(req.params.transactionId);
    res.json(history);
  } catch (err) {
    res.status(500).json({ error: '查询历史记录失败: ' + (err as Error).message });
  }
});

router.get('/export', (req: Request, res: Response) => {
  try {
    const filters = {
      start_date: (req.query.start_date as string) || undefined,
      end_date: (req.query.end_date as string) || undefined,
      status: (req.query.status as string) || undefined,
    };

    const format = (req.query.format as string) || 'json';
    const data = getAllTransactionsForExport(filters);

    if (format === 'csv') {
      const headers = [
        '交易ID', '金额', '商户', '品类', '国家', '用户ID', '交易时间',
        '风险评分', '是否异常', '是否已复核', '复核结论', '复核意见', '复核人', '复核时间', '导入时间'
      ];

      const csvRows = [
        headers.join(','),
        ...data.map((row: any) => [
          `"${row.transaction_id || ''}"`,
          row.amount || 0,
          `"${(row.merchant || '').replace(/"/g, '""')}"`,
          `"${(row.category || '').replace(/"/g, '""')}"`,
          `"${(row.country || '').replace(/"/g, '""')}"`,
          `"${row.user_id || ''}"`,
          `"${row.transaction_time || ''}"`,
          (row.risk_score || 0).toFixed(1),
          row.is_anomaly ? '是' : '否',
          row.reviewed ? '是' : '否',
          row.review_decision === 'confirmed' ? '确认异常' : row.review_decision === 'rejected' ? '误判' : '',
          `"${(row.review_comment || '').replace(/"/g, '""')}"`,
          `"${row.reviewer || ''}"`,
          `"${row.reviewed_at || ''}"`,
          `"${row.created_at || ''}"`,
        ].join(','))
      ];

      const csv = '\ufeff' + csvRows.join('\n');
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="异常交易报告_${Date.now()}.csv"`);
      res.send(csv);
    } else {
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename="异常交易报告_${Date.now()}.json"`);
      res.json(data);
    }
  } catch (err) {
    res.status(500).json({ error: '导出失败: ' + (err as Error).message });
  }
});

export default router;
