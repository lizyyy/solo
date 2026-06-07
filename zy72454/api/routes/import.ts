import { Router, Request, Response } from 'express';
import {
  parseImportData,
  previewImport,
  executeImport,
  listImportBatches,
  getSampleCsvContent,
} from '../services/importService.js';

const router = Router();

router.get('/batches', (_req: Request, res: Response) => {
  const batches = listImportBatches();
  res.json({ data: batches });
});

router.get('/sample-csv', (_req: Request, res: Response) => {
  const content = getSampleCsvContent();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_bus_card_times.csv"');
  res.send(content);
});

router.post('/preview', (req: Request, res: Response) => {
  try {
    const { content, format } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'IMPORT_FILE_EMPTY',
          message: '导入的文件是空的',
          suggestion: '请检查文件内容，确保至少包含一条公交刷卡时段数据',
        },
      });
    }

    const items = parseImportData(content, format || 'csv');
    const preview = previewImport(items);

    res.json({ data: preview });
  } catch (err) {
    res.status(400).json({
      error: {
        code: 'IMPORT_FILE_FORMAT',
        message: '文件格式不对，我读不懂',
        suggestion: '请使用 CSV 或 JSON 格式，列名要包含断点名称、位置、时段、日期、客流量',
      },
    });
  }
});

router.post('/execute', (req: Request, res: Response) => {
  try {
    const { content, format, fileName, importedBy } = req.body;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({
        error: {
          code: 'IMPORT_FILE_EMPTY',
          message: '导入的文件是空的',
          suggestion: '请检查文件内容，确保至少包含一条公交刷卡时段数据',
        },
      });
    }

    const items = parseImportData(content, format || 'csv');
    const batch = executeImport(
      items,
      fileName || 'import.csv',
      importedBy || '市政巡检员-小付'
    );

    res.json({ data: batch });
  } catch (err) {
    res.status(400).json({
      error: {
        code: 'IMPORT_FAILED',
        message: '导入失败，请检查数据格式',
        suggestion: '请参考样例文件格式，确保每列数据填写正确',
      },
    });
  }
});

export default router;
