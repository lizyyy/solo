import { Router, Request, Response } from 'express';
import multer from 'multer';
import csvParser from 'csv-parser';
import { Readable } from 'stream';
import { Batch, TemperatureCurve, Formula, ReviewRecord, RiskAssessment } from './types';
import { database } from './database';
import {
  calculateDeltaE,
  calculateTemperatureDeviation,
  detectMissingChemicals,
  performRiskAssessment
} from './utils/calculator';
import {
  generateReworkOrderMarkdown,
  generateRiskListCSV,
  generateAuditPackageJSON
} from './utils/exporter';

const router = Router();
const upload = multer();

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

router.get('/batches', async (req: Request, res: Response) => {
  try {
    const batches = database.getAllBatches();
    res.json(batches);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get batches' });
  }
});

router.get('/batches/:id', async (req: Request, res: Response) => {
  try {
    const batch = database.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const temperatureCurve = database.getTemperatureCurveByBatchId(batch.id);
    const formula = database.getFormulaByBatchId(batch.id);
    const reviewRecord = database.getReviewRecordByBatchId(batch.id);
    const riskAssessment = performRiskAssessment(batch, temperatureCurve, formula);

    res.json({
      batch,
      temperatureCurve,
      formula,
      reviewRecord,
      riskAssessment
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to get batch' });
  }
});

router.post('/import/batch', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const results: any[] = [];
    const stream = Readable.from(req.file.buffer);
    
    await new Promise((resolve, reject) => {
      stream
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', resolve)
        .on('error', reject);
    });

    if (results.length === 0) {
      return res.status(400).json({ error: 'No data in CSV file' });
    }

    const importedBatches: Batch[] = [];

    for (const row of results) {
      const existingBatch = database.getBatchByNumber(row.batchNumber || row['批次号']);
      
      if (existingBatch) {
        return res.status(400).json({ 
          error: `Batch number ${row.batchNumber || row['批次号']} already exists` 
        });
      }

      const now = Date.now();
      const batch: Batch = {
        id: generateId(),
        batchNumber: row.batchNumber || row['批次号'],
        fabricType: row.fabricType || row['面料类型'] || '未知',
        customerName: row.customerName || row['客户名称'] || '未知',
        targetColor: {
          L: parseFloat(row.targetColor_L || row['目标色_L'] || '0'),
          a: parseFloat(row.targetColor_a || row['目标色_a'] || '0'),
          b: parseFloat(row.targetColor_b || row['目标色_b'] || '0')
        },
        createdAt: now,
        updatedAt: now
      };

      if (row.measuredColor_L || row['测量色_L']) {
        batch.measuredColor = {
          L: parseFloat(row.measuredColor_L || row['测量色_L'] || '0'),
          a: parseFloat(row.measuredColor_a || row['测量色_a'] || '0'),
          b: parseFloat(row.measuredColor_b || row['测量色_b'] || '0')
        };
        batch.deltaE = calculateDeltaE(batch.targetColor, batch.measuredColor);
      }

      database.createBatch(batch);
      importedBatches.push(batch);
    }

    res.json({
      message: `Successfully imported ${importedBatches.length} batches`,
      batches: importedBatches
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import batch CSV' });
  }
});

router.post('/import/temperature-curve', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const data = JSON.parse(req.file.buffer.toString());
    const batchNumber = data.batchNumber || req.body.batchNumber;

    if (!batchNumber) {
      return res.status(400).json({ error: 'Batch number is required' });
    }

    const batch = database.getBatchByNumber(batchNumber);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const now = Date.now();
    const curve: TemperatureCurve = {
      id: generateId(),
      batchId: batch.id,
      targetCurve: data.targetCurve || [],
      actualCurve: data.actualCurve || [],
      createdAt: now
    };

    if (curve.targetCurve.length > 0 && curve.actualCurve.length > 0) {
      curve.temperatureDeviation = calculateTemperatureDeviation(
        curve.targetCurve,
        curve.actualCurve
      );
    }

    database.createTemperatureCurve(curve);

    res.json({
      message: 'Temperature curve imported successfully',
      curve
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import temperature curve JSON' });
  }
});

router.post('/import/formula', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const data = JSON.parse(req.file.buffer.toString());
    const batchNumber = data.batchNumber || req.body.batchNumber;

    if (!batchNumber) {
      return res.status(400).json({ error: 'Batch number is required' });
    }

    const batch = database.getBatchByNumber(batchNumber);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const now = Date.now();
    const formula: Formula = {
      id: generateId(),
      batchId: batch.id,
      targetFormula: data.targetFormula || [],
      actualFormula: data.actualFormula || [],
      missingChemicals: [],
      createdAt: now
    };

    formula.missingChemicals = detectMissingChemicals(
      formula.targetFormula,
      formula.actualFormula
    );

    database.createFormula(formula);

    res.json({
      message: 'Formula imported successfully',
      formula
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to import formula JSON' });
  }
});

router.post('/review', async (req: Request, res: Response) => {
  try {
    const { batchId, reviewer, judgement, notes, reworkReason } = req.body;

    if (!batchId || !reviewer || !judgement) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const batch = database.getBatchById(batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const now = Date.now();
    const existingRecord = database.getReviewRecordByBatchId(batchId);

    const temperatureCurve = database.getTemperatureCurveByBatchId(batchId);
    const formula = database.getFormulaByBatchId(batchId);
    const riskAssessment = performRiskAssessment(batch, temperatureCurve, formula);

    const reviewRecord: ReviewRecord = {
      id: existingRecord ? existingRecord.id : generateId(),
      batchId,
      reviewer,
      judgement,
      notes,
      reworkPriority: judgement === 'rework' ? riskAssessment.reworkPriority : undefined,
      reworkReason,
      createdAt: existingRecord ? existingRecord.createdAt : now,
      updatedAt: now
    };

    if (existingRecord) {
      database.updateReviewRecord(reviewRecord);
    } else {
      database.createReviewRecord(reviewRecord);
    }

    res.json({
      message: 'Review record saved successfully',
      reviewRecord,
      riskAssessment
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save review record' });
  }
});

router.get('/risk-assessments', async (req: Request, res: Response) => {
  try {
    const batches = database.getAllBatches();
    const riskAssessments: RiskAssessment[] = [];

    for (const batch of batches) {
      const temperatureCurve = database.getTemperatureCurveByBatchId(batch.id);
      const formula = database.getFormulaByBatchId(batch.id);
      const riskAssessment = performRiskAssessment(batch, temperatureCurve, formula);
      riskAssessments.push(riskAssessment);
    }

    riskAssessments.sort((a, b) => b.reworkPriority - a.reworkPriority);

    res.json(riskAssessments);
  } catch (error) {
    res.status(500).json({ error: 'Failed to get risk assessments' });
  }
});

router.get('/export/rework-order/:batchId', async (req: Request, res: Response) => {
  try {
    const batch = database.getBatchById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const temperatureCurve = database.getTemperatureCurveByBatchId(batch.id);
    const formula = database.getFormulaByBatchId(batch.id);
    const reviewRecord = database.getReviewRecordByBatchId(batch.id);
    const riskAssessment = performRiskAssessment(batch, temperatureCurve, formula);

    const markdown = generateReworkOrderMarkdown(
      batch,
      temperatureCurve,
      formula,
      reviewRecord,
      riskAssessment
    );

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="rework-order-${batch.batchNumber}.md"`);
    res.send(markdown);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export rework order' });
  }
});

router.get('/export/risk-list', async (req: Request, res: Response) => {
  try {
    const batches = database.getAllBatches();
    const riskAssessments: RiskAssessment[] = [];

    for (const batch of batches) {
      const temperatureCurve = database.getTemperatureCurveByBatchId(batch.id);
      const formula = database.getFormulaByBatchId(batch.id);
      const riskAssessment = performRiskAssessment(batch, temperatureCurve, formula);
      riskAssessments.push(riskAssessment);
    }

    riskAssessments.sort((a, b) => b.reworkPriority - a.reworkPriority);

    const csv = generateRiskListCSV(riskAssessments);

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="risk-list.csv"');
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export risk list' });
  }
});

router.get('/export/audit-package/:batchId', async (req: Request, res: Response) => {
  try {
    const batch = database.getBatchById(req.params.batchId);
    if (!batch) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    const temperatureCurve = database.getTemperatureCurveByBatchId(batch.id);
    const formula = database.getFormulaByBatchId(batch.id);
    const reviewRecord = database.getReviewRecordByBatchId(batch.id);
    const riskAssessment = performRiskAssessment(batch, temperatureCurve, formula);

    const json = generateAuditPackageJSON(
      batch,
      temperatureCurve,
      formula,
      reviewRecord,
      riskAssessment
    );

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', `attachment; filename="audit-package-${batch.batchNumber}.json"`);
    res.send(json);
  } catch (error) {
    res.status(500).json({ error: 'Failed to export audit package' });
  }
});

export default router;
