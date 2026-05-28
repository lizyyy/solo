import { Router, type Request, type Response } from 'express';
import { importService } from '../services/importService.js';
import xlsx from 'xlsx';

const router = Router();

const mockUser = {
  id: 'u001',
  name: '张明',
};

router.post('/upload', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, dataType } = req.body;

    if (!file) {
      res.status(400).json({
        success: false,
        error: '请上传文件',
      });
      return;
    }

    if (!dataType) {
      res.status(400).json({
        success: false,
        error: '请指定数据类型',
      });
      return;
    }

    let rows;
    if (typeof file === 'string' && file.startsWith('data:')) {
      const base64Data = file.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (Buffer.isBuffer(file)) {
      const workbook = xlsx.read(file, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      rows = file;
    }

    const result = await importService.importData(
      dataType,
      rows,
      { id: mockUser.id, name: mockUser.name } as any,
    );

    res.json({
      success: result.success,
      data: result,
      error: result.errors.length > 0 ? result.errors.join('; ') : undefined,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '文件上传失败',
    });
  }
});

router.post('/preview', async (req: Request, res: Response): Promise<void> => {
  try {
    const { file, dataType } = req.body;

    if (!file) {
      res.status(400).json({
        success: false,
        error: '请上传文件',
      });
      return;
    }

    if (!dataType) {
      res.status(400).json({
        success: false,
        error: '请指定数据类型',
      });
      return;
    }

    let rows;
    if (typeof file === 'string' && file.startsWith('data:')) {
      const base64Data = file.split(',')[1];
      const buffer = Buffer.from(base64Data, 'base64');
      const workbook = xlsx.read(buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else if (Buffer.isBuffer(file)) {
      const workbook = xlsx.read(file, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      rows = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
    } else {
      rows = file;
    }

    const preview = await importService.previewData(dataType, { rows });

    res.json({
      success: preview.sampleValidation.valid,
      data: {
        previewData: preview.rows,
        columns: preview.columns,
        totalRows: rows.length,
      },
      error: preview.sampleValidation.errors.length > 0 ? preview.sampleValidation.errors.join('; ') : undefined,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message || '数据预览失败',
    });
  }
});

export default router;
