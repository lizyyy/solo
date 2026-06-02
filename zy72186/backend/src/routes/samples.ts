import { Router } from 'express';
import { db } from '../data/database';
import type { ReviewDecision } from '../types';
import { determineNewStatus, generateReviewId } from '../utils/businessLogic';

const router = Router();

router.get('/', (req, res) => {
  const { status, includeDuplicates = 'true' } = req.query;
  let samples = db.getSamples();
  
  if (status) {
    samples = samples.filter(s => s.status === status);
  }
  
  if (includeDuplicates === 'false') {
    samples = samples.filter(s => !s.isDuplicate);
  }
  
  res.json({
    success: true,
    data: samples,
  });
});

router.get('/duplicates', (_req, res) => {
  const groups = db.getDuplicateGroups();
  const result = Array.from(groups.entries()).map(([groupId, samples]) => ({
    groupId,
    samples,
    originalSample: samples.find(s => !s.isDuplicate) || samples[0],
    duplicateCount: samples.length - 1,
  }));
  
  res.json({
    success: true,
    data: result,
  });
});

router.get('/:id', (req, res) => {
  const sample = db.getSampleById(req.params.id);
  
  if (!sample) {
    return res.status(404).json({
      success: false,
      error: 'Sample not found',
    });
  }
  
  res.json({
    success: true,
    data: sample,
  });
});

router.post('/:id/review', (req, res) => {
  const { id } = req.params;
  const { decision, evidence, comments, reviewer } = req.body;
  
  if (!decision || !evidence || !reviewer) {
    return res.status(400).json({
      success: false,
      error: 'Missing required fields: decision, evidence, reviewer',
    });
  }
  
  const sample = db.getSampleById(id);
  if (!sample) {
    return res.status(404).json({
      success: false,
      error: 'Sample not found',
    });
  }
  
  const previousStatus = sample.status;
  const newStatus = determineNewStatus(decision as ReviewDecision, previousStatus);
  
  const record = {
    id: generateReviewId(),
    sampleId: id,
    reviewer,
    decision: decision as ReviewDecision,
    evidence,
    timestamp: new Date().toISOString(),
    comments,
    previousStatus,
    newStatus,
  };
  
  db.addReviewRecord(record);
  
  const updatedSample = db.getSampleById(id);
  
  res.json({
    success: true,
    data: {
      reviewRecord: record,
      updatedSample,
    },
    message: `复核完成，状态已从"${previousStatus}"更新为"${newStatus}"`,
  });
});

router.post('/:id/resolve-duplicate', (req, res) => {
  const { id } = req.params;
  const { keepOriginal = true } = req.body;
  
  const sample = db.getSampleById(id);
  if (!sample) {
    return res.status(404).json({
      success: false,
      error: 'Sample not found',
    });
  }
  
  if (!sample.isDuplicate) {
    return res.status(400).json({
      success: false,
      error: 'This sample is not marked as duplicate',
    });
  }
  
  const success = db.resolveDuplicate(id, keepOriginal);
  
  if (success) {
    res.json({
      success: true,
      message: keepOriginal ? '已保留原始样本，删除重复样本' : '已保留当前样本，合并历史记录后删除原始样本',
    });
  } else {
    res.status(500).json({
      success: false,
      error: 'Failed to resolve duplicate',
    });
  }
});

router.get('/:id/history', (req, res) => {
  const { id } = req.params;
  const history = db.getReviewRecordsBySample(id);
  
  res.json({
    success: true,
    data: history,
  });
});

export default router;
