import { Router, Request, Response } from 'express';
import { getTraceLogs } from '../services/trace';
import { getDatabase } from '../database';
import { TraceQueryResponse, TrainingMaterial } from '../types';
import { getCertificateById } from '../services/certificate';

const router = Router();

router.get('/batch/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const { trainingId, employeeId } = req.query;

    const db = getDatabase();

    const traceLogs = await getTraceLogs(
      batchId,
      trainingId as string | undefined,
      employeeId as string | undefined
    );

    const rawMaterialRow = await db.get(
      'SELECT raw_data FROM raw_materials WHERE batch_id = ? AND training_id = ? LIMIT 1',
      batchId,
      trainingId
    );

    let rawMaterial: TrainingMaterial | null = null;
    if (rawMaterialRow) {
      rawMaterial = JSON.parse(rawMaterialRow.raw_data);
    }

    let certificate = null;
    if (traceLogs.length > 0) {
      const certLog = traceLogs.find(log => log.source === 'certificate');
      if (certLog) {
        certificate = await getCertificateById(certLog.value);
      }
    }

    const response: TraceQueryResponse = {
      batchId,
      trainingId: trainingId as string | undefined,
      employeeId: employeeId as string | undefined,
      traceChain: traceLogs,
      rawMaterial,
      certificate,
    };

    res.status(200).json(response);
  } catch (error) {
    console.error('溯源查询失败:', error);
    res.status(500).json({
      error: '服务器内部错误',
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
