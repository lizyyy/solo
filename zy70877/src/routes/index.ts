import { Router, Request, Response } from 'express';
import multer from 'multer';
import { processingService } from '../services/ProcessingService';
import { fileParserService } from '../services/FileParserService';
import { dataStore } from '../store/DataStore';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', message: '研究生院招生数据处理API运行正常' });
});

router.post('/import/batch', upload.fields([
  { name: 'mentors', maxCount: 1 },
  { name: 'applications', maxCount: 1 },
  { name: 'transfers', maxCount: 1 }
]), async (req: Request, res: Response) => {
  try {
    const batchId = req.body.batchId || `batch_${Date.now()}`;
    
    if (dataStore.isBatchProcessed(batchId)) {
      return res.status(400).json({
        error: '批次重复',
        message: `批次 ${batchId} 已处理过，不能重复导入`
      });
    }

    let mentors, applications, transfers;

    const files = req.files as { [fieldname: string]: Express.Multer.File[] };
    
    if (files.mentors && files.mentors[0]) {
      mentors = await fileParserService.parseMentorCSV(files.mentors[0].buffer);
    }
    
    if (files.applications && files.applications[0]) {
      applications = fileParserService.parseApplicationsJSON(files.applications[0].buffer.toString('utf-8'));
    }
    
    if (files.transfers && files.transfers[0]) {
      transfers = fileParserService.parseTransfersJSON(files.transfers[0].buffer.toString('utf-8'));
    }

    if (req.body.mentorsJson) {
      mentors = fileParserService.parseApplicationsJSON(req.body.mentorsJson);
    }
    if (req.body.applicationsJson) {
      applications = fileParserService.parseApplicationsJSON(req.body.applicationsJson);
    }
    if (req.body.transfersJson) {
      transfers = fileParserService.parseTransfersJSON(req.body.transfersJson);
    }

    const result = processingService.processBatch(batchId, mentors, applications, transfers);
    
    res.json({
      success: true,
      data: result
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/mentors', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: dataStore.getAllMentors()
  });
});

router.get('/applications', (req: Request, res: Response) => {
  const { status, studentId } = req.query;
  let apps = dataStore.getAllApplications();
  
  if (status) {
    apps = apps.filter(a => a.status === status);
  }
  if (studentId) {
    apps = dataStore.getApplicationsByStudent(studentId as string);
  }
  
  res.json({
    success: true,
    data: apps
  });
});

router.get('/transfers', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: dataStore.getAllTransfers()
  });
});

router.post('/applications/:id/confirm', (req: Request, res: Response) => {
  try {
    const app = processingService.confirmApplication(req.params.id);
    res.json({
      success: true,
      data: app
    });
  } catch (error: any) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/statistics', (req: Request, res: Response) => {
  res.json({
    success: true,
    data: processingService.getStatistics()
  });
});

router.get('/export/mentors', (req: Request, res: Response) => {
  const csv = fileParserService.formatMentorCSV();
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=mentors.csv');
  res.send(csv);
});

router.post('/reset', (req: Request, res: Response) => {
  dataStore.reset();
  res.json({
    success: true,
    message: '所有数据已重置'
  });
});

export default router;
