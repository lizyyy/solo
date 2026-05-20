import { Router, Request, Response } from 'express';
import multer from 'multer';
import { dataImportService } from '../services/dataImportService';
import moment from 'moment';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/meter', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传CSV文件' });
    }

    const result = await dataImportService.importMeterData(req.file.buffer, req.file.originalname);

    res.json({
      success: true,
      imported: result.imported,
      errors: result.errors
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/contract', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: '请上传JSON文件' });
    }

    const contract = await dataImportService.importContract(req.file.buffer);

    res.json({
      success: true,
      data: contract
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/zones', async (req: Request, res: Response) => {
  try {
    const zonesData = req.body;
    if (!Array.isArray(zonesData)) {
      return res.status(400).json({ success: false, error: '温区数据必须是数组' });
    }

    const zones = await dataImportService.importZones(zonesData);

    res.json({
      success: true,
      data: zones
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/multiplier-changes', async (req: Request, res: Response) => {
  try {
    const changesData = req.body;
    if (!Array.isArray(changesData)) {
      return res.status(400).json({ success: false, error: '倍率变更数据必须是数组' });
    }

    const changes = await dataImportService.importMultiplierChanges(changesData);

    res.json({
      success: true,
      data: changes
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/summary', async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd } = req.query;
    if (!periodStart || !periodEnd) {
      return res.status(400).json({ success: false, error: '请提供计费周期参数' });
    }

    const summary = await dataImportService.getImportSummary(
      moment(periodStart as string).toDate(),
      moment(periodEnd as string).toDate()
    );

    res.json({
      success: true,
      data: summary
    });
  } catch (error: any) {
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
