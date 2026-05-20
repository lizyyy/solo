import { Router, Request, Response } from 'express';
import ExportService from '../services/ExportService';
import { ApplicationStatus } from '../models/Application';
import dayjs from 'dayjs';
import * as fs from 'fs';

const router = Router();

router.post('/applications', async (req: Request, res: Response) => {
  try {
    const { status, merchantName, stallLocation, certificateVersion, startDate, endDate, includeDetails } = req.body;

    const filters = {
      status: status as ApplicationStatus,
      merchantName,
      stallLocation,
      certificateVersion,
      startDate: startDate ? dayjs(startDate).toDate() : undefined,
      endDate: endDate ? dayjs(endDate).toDate() : undefined,
    };

    const result = await ExportService.exportApplications(filters, includeDetails);
    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/logs', async (req: Request, res: Response) => {
  try {
    const { applicationId, startDate, endDate } = req.body;

    const result = await ExportService.exportLogs(
      applicationId ? parseInt(applicationId) : undefined,
      startDate ? dayjs(startDate).toDate() : undefined,
      endDate ? dayjs(endDate).toDate() : undefined
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.post('/deposit-flows', async (req: Request, res: Response) => {
  try {
    const { applicationId, startDate, endDate } = req.body;

    const result = await ExportService.exportDepositFlows(
      applicationId ? parseInt(applicationId) : undefined,
      startDate ? dayjs(startDate).toDate() : undefined,
      endDate ? dayjs(endDate).toDate() : undefined
    );

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/download/:filename', async (req: Request, res: Response) => {
  try {
    const filePath = ExportService.getExportFilePath(req.params.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: '文件不存在' });
    }

    res.download(filePath);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
