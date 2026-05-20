import { Router, Request, Response } from 'express';
import multer from 'multer';
import { importService } from '../services/importService';

const router = Router();
const storage = multer.memoryStorage();
const upload = multer({ storage });

router.post(
  '/batch',
  upload.fields([
    { name: 'maintenance', maxCount: 1 },
    { name: 'sensor', maxCount: 1 },
    { name: 'approval', maxCount: 1 },
  ]),
  async (req: Request, res: Response) => {
    try {
      const files = req.files as {
        maintenance?: Express.Multer.File[];
        sensor?: Express.Multer.File[];
        approval?: Express.Multer.File[];
      };

      const result = await importService.batchImport(
        files.maintenance?.[0]?.buffer,
        files.sensor?.[0]?.buffer,
        files.approval?.[0]?.buffer
      );

      res.json({
        success: true,
        data: result,
        message: '批量导入成功',
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: '导入失败',
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
);

router.post('/maintenance', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未上传文件' });
    }

    const records = await importService.parseMaintenanceCsvBuffer(req.file.buffer);
    res.json({
      success: true,
      data: records,
      message: `成功导入 ${records.length} 条检修记录`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入检修记录失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/sensor', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未上传文件' });
    }

    const records = await importService.parseSensorJsonBuffer(req.file.buffer);
    res.json({
      success: true,
      data: records,
      message: `成功导入 ${records.length} 条传感器数据`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入传感器数据失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/approval', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未上传文件' });
    }

    const records = await importService.parseApprovalCsvBuffer(req.file.buffer);
    res.json({
      success: true,
      data: records,
      message: `成功导入 ${records.length} 条审批记录`,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '导入审批记录失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
