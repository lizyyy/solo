import { Router } from 'express';
import { resultService } from '../services/resultService';
import { workflowService } from '../services/workflowService';
import { selfCheckService } from '../services/selfCheckService';

const router = Router();

router.get('/', (req, res) => {
  const records = resultService.getAllUnifiedResults();
  res.json(records);
});

router.get('/:id', (req, res) => {
  const record = resultService.getUnifiedResult(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }
  res.json(record);
});

router.get('/export/details', (req, res) => {
  const details = resultService.generateExportDetails();
  res.json(details);
});

router.post('/export', (req, res) => {
  const exportId = resultService.generateExportSnapshot();
  res.json({ exportId });
});

router.get('/export/:exportId', (req, res) => {
  const details = resultService.getExportDetails(req.params.exportId);
  if (!details) {
    return res.status(404).json({ error: 'Export not found' });
  }
  res.json(details);
});

router.get('/consistency/verify', (req, res) => {
  const result = resultService.verifyDataConsistency();
  res.json(result);
});

router.post('/import', (req, res) => {
  const { sampleId, sampleName, imageUrl, caption, knowledgeRef, operator } = req.body;
  
  if (!sampleId || !sampleName || !imageUrl || !caption || !knowledgeRef || !operator) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const record = workflowService.step1_importKnowledgeReference(
    sampleId,
    sampleName,
    imageUrl,
    caption,
    knowledgeRef,
    operator
  );

  res.status(201).json(record);
});

router.post('/:id/link-ticket', (req, res) => {
  const { ticket, operator } = req.body;
  
  if (!ticket || !operator) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const record = workflowService.step2_linkFeedbackTicket(
    req.params.id,
    ticket,
    operator
  );

  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.json(record);
});

router.post('/:id/resolve-conflict', (req, res) => {
  const { conflictId, resolution, comment, operator } = req.body;
  
  if (!conflictId || !resolution || !operator) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const record = workflowService.resolveConflict(
    req.params.id,
    conflictId,
    resolution,
    comment,
    operator
  );

  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.json(record);
});

router.post('/:id/update-review', (req, res) => {
  const { content, operator } = req.body;
  
  if (!content || !operator) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const result = workflowService.step3_updateProductReview(
    req.params.id,
    content,
    operator
  );

  if (!result) {
    return res.status(404).json({ error: 'Record not found' });
  }

  if ('error' in result) {
    return res.status(400).json({ error: result.error, blocked: true });
  }

  res.json(result);
});

router.post('/:id/request-recheck', (req, res) => {
  const { operator } = req.body;
  
  if (!operator) {
    return res.status(400).json({ error: 'Missing operator' });
  }

  const record = workflowService.requestRecheck(req.params.id, operator);

  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.json(record);
});

router.post('/:id/complete-recheck', (req, res) => {
  const { operator } = req.body;
  
  if (!operator) {
    return res.status(400).json({ error: 'Missing operator' });
  }

  const record = workflowService.completeRecheck(req.params.id, operator);

  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  res.json(record);
});

router.get('/:id/selfcheck/summary', (req, res) => {
  const record = resultService.getUnifiedResult(req.params.id);
  if (!record) {
    return res.status(404).json({ error: 'Record not found' });
  }

  const summary = selfCheckService.getSelfCheckSummary(record.selfCheckResults);
  res.json(summary);
});

export default router;
