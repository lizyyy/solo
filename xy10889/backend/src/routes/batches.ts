import express from 'express';
import { BatchService } from '../services/BatchService';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const batch = await BatchService.createBatch(req.body);
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status } = req.query;
    const batches = await BatchService.getAllBatches({
      status: status as string
    });
    res.json({ success: true, data: batches });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const batch = await BatchService.getBatchById(req.params.id);
    if (!batch) {
      return res.status(404).json({ success: false, error: '批次不存在' });
    }
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const batch = await BatchService.updateBatchStatus(req.params.id, status);
    res.json({ success: true, data: batch });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/samples', async (req, res) => {
  try {
    const { sampleId } = req.body;
    await BatchService.addSampleToBatch(req.params.id, sampleId);
    res.json({ success: true, message: '样本已添加到批次' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.delete('/:id/samples/:sampleId', async (req, res) => {
  try {
    await BatchService.removeSampleFromBatch(req.params.id, req.params.sampleId);
    res.json({ success: true, message: '样本已从批次移除' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/samples', async (req, res) => {
  try {
    const samples = await BatchService.getBatchSamples(req.params.id);
    res.json({ success: true, data: samples });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
