import express from 'express';
import { SampleService } from '../services/SampleService';
import { ExceptionService } from '../services/ExceptionService';
import { ExportService } from '../services/ExportService';
import { SampleStatus } from '../types';
import fs from 'fs';

const router = express.Router();

router.post('/', async (req, res) => {
  try {
    const sample = await SampleService.createSample(req.body);
    res.json({ success: true, data: sample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, batchId } = req.query;
    const samples = await SampleService.getAllSamples({
      status: status as SampleStatus,
      batchId: batchId as string
    });
    res.json({ success: true, data: samples });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/statistics', async (req, res) => {
  try {
    const stats = await SampleService.getStatistics();
    res.json({ success: true, data: stats });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/barcode/:barcode', async (req, res) => {
  try {
    const sample = await SampleService.getSampleByBarcode(req.params.barcode);
    if (!sample) {
      return res.status(404).json({ success: false, error: '样本不存在' });
    }
    res.json({ success: true, data: sample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const sample = await SampleService.getSampleById(req.params.id);
    if (!sample) {
      return res.status(404).json({ success: false, error: '样本不存在' });
    }
    res.json({ success: true, data: sample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.patch('/:id/status', async (req, res) => {
  try {
    const { newStatus, handler, notes } = req.body;
    const sample = await SampleService.updateSampleStatus(req.params.id, newStatus, handler, notes);
    res.json({ success: true, data: sample });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/transfer', async (req, res) => {
  try {
    const transfer = await SampleService.transferSample({
      ...req.body,
      sampleId: req.params.id
    });
    res.json({ success: true, data: transfer });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/transfers', async (req, res) => {
  try {
    const transfers = await SampleService.getTransferHistory(req.params.id);
    res.json({ success: true, data: transfers });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/responsibility', async (req, res) => {
  try {
    const chain = await SampleService.getResponsibilityChain(req.params.id);
    res.json({ success: true, data: chain });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/exceptions', async (req, res) => {
  try {
    const exception = await ExceptionService.reportException({
      ...req.body,
      sampleId: req.params.id
    });
    res.json({ success: true, data: exception });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/exceptions', async (req, res) => {
  try {
    const exceptions = await ExceptionService.getExceptions({ sampleId: req.params.id });
    res.json({ success: true, data: exceptions });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.post('/:id/compensate', async (req, res) => {
  try {
    const { newStatus, handler, notes } = req.body;
    await ExceptionService.manualCompensate(req.params.id, newStatus, handler, notes);
    const sample = await SampleService.getSampleById(req.params.id);
    res.json({ success: true, data: sample, message: '手动补偿成功' });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

router.get('/:id/export', async (req, res) => {
  try {
    const filename = await ExportService.exportSampleChain(req.params.id);
    const filepath = ExportService.getExportFilePath(filename);
    
    res.download(filepath, filename, (err) => {
      if (err) {
        res.status(500).json({ success: false, error: '导出失败' });
      }
    });
  } catch (error: any) {
    res.status(400).json({ success: false, error: error.message });
  }
});

export default router;
