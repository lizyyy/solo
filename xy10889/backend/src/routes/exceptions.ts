import express from 'express';
import { ExceptionService } from '../services/ExceptionService';

const router = express.Router();

router.get('/', async (req, res) => {
  try {
    const { sampleId, batchId, resolved } = req.query;
    const exceptions = await ExceptionService.getExceptions({
      sampleId: sampleId as string,
      batchId: batchId as string,
      resolved: resolved !== undefined ? resolved === 'true' : undefined
    });
    res.json({ success: true, data: exceptions });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/:id/resolve', async (req, res) => {
  try {
    const { resolvedBy, resolution } = req.body;
    const exception = await ExceptionService.resolveException(req.params.id, resolvedBy, resolution);
    res.json({ success: true, data: exception });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
