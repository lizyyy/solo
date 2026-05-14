import express, { Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { ValidationService } from '../services/validation.service';
import { OutputService } from '../services/output.service';
import { RiskLevel, OutputFormat } from '../types';

const router = express.Router();

const uploadDir = path.join(process.cwd(), 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({ storage });

router.post('/batches', async (req: Request, res: Response) => {
  try {
    const { batchName, department, createdBy } = req.body;
    const batchId = await ValidationService.createBatch(batchName, department, createdBy);
    res.json({ success: true, batchId });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/batches', async (req: Request, res: Response) => {
  try {
    const batches = await ValidationService.getAllBatches();
    res.json({ success: true, batches });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/batches/:batchId', async (req: Request, res: Response) => {
  try {
    const batch = await ValidationService.getBatch(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ success: false, error: 'Batch not found' });
    }
    res.json({ success: true, batch });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/upload', upload.single('file'), async (req: Request, res: Response) => {
  try {
    const { batchId, supplierCode, supplierName, department, uploader } = req.body;
    
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No file uploaded' });
    }

    const fileId = await ValidationService.addFileRecord(batchId, {
      fileName: req.file.originalname,
      filePath: req.file.path,
      fileSize: req.file.size,
      fileType: req.file.mimetype,
      supplierCode,
      supplierName,
      department,
      uploader
    });

    const validationResults = await ValidationService.validateFile(fileId, batchId);

    res.json({ 
      success: true, 
      fileId, 
      validationResults 
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/batch-upload', upload.array('files', 50), async (req: Request, res: Response) => {
  try {
    const { batchId, supplierCode, supplierName, department, uploader } = req.body;
    const files = req.files as Express.Multer.File[];
    
    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const results = [];
    for (const file of files) {
      const fileId = await ValidationService.addFileRecord(batchId, {
        fileName: file.originalname,
        filePath: file.path,
        fileSize: file.size,
        fileType: file.mimetype,
        supplierCode,
        supplierName,
        department,
        uploader
      });

      const validationResults = await ValidationService.validateFile(fileId, batchId);
      results.push({ fileId, fileName: file.originalname, validationResults });
    }

    res.json({ success: true, results });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/failed-items', async (req: Request, res: Response) => {
  try {
    const { batchId, riskLevel, resolved } = req.query;
    const items = await OutputService.getFailedItems(
      batchId as string,
      riskLevel as RiskLevel,
      resolved === 'true'
    );
    res.json({ success: true, items });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/failed-items/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { resolver } = req.body;
    await OutputService.markFailedItemResolved(req.params.id, resolver);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/correct', async (req: Request, res: Response) => {
  try {
    const { fileRecordId, batchId, fieldName, oldValue, newValue, correctedBy, correctionReason, riskLevel } = req.body;
    const correction = await OutputService.correctField(
      fileRecordId, batchId, fieldName, oldValue, newValue, correctedBy, correctionReason, riskLevel
    );
    res.json({ success: true, correction });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/corrections', async (req: Request, res: Response) => {
  try {
    const { batchId, fileRecordId } = req.query;
    const records = await OutputService.getCorrectionRecords(
      batchId as string,
      fileRecordId as string
    );
    res.json({ success: true, records });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.post('/rollback-candidates', async (req: Request, res: Response) => {
  try {
    const { batchId, reason, createdBy } = req.body;
    const candidates = await OutputService.generateRollbackCandidates(batchId, reason, createdBy);
    res.json({ success: true, candidates });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.put('/rollback-candidates/:id/approve', async (req: Request, res: Response) => {
  try {
    const { approved, approver, approvalNote } = req.body;
    await OutputService.approveRollbackCandidate(req.params.id, approved, approver, approvalNote);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/rollback-candidates', async (req: Request, res: Response) => {
  try {
    const { batchId, approved } = req.query;
    const candidates = await OutputService.getRollbackCandidates(
      batchId as string,
      approved === 'true'
    );
    res.json({ success: true, candidates });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/export/:batchId', async (req: Request, res: Response) => {
  try {
    const { format } = req.query;
    const outputFormat = (format as OutputFormat) || 'json';
    const result = await OutputService.exportBatchResults(req.params.batchId, outputFormat);

    if (outputFormat === 'download') {
      res.setHeader('Content-Disposition', `attachment; filename="validation-report-${req.params.batchId}.json"`);
      res.setHeader('Content-Type', 'application/json');
      return res.send(result);
    }

    if (outputFormat === 'markdown') {
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    }

    res.send(result);
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

router.get('/risk-level/:batchId/:riskLevel', async (req: Request, res: Response) => {
  try {
    const result = await OutputService.queryByRiskLevel(
      req.params.batchId,
      req.params.riskLevel as RiskLevel
    );
    res.json({ success: true, data: result });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

export default router;
