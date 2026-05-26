import express, { Request, Response, Router } from 'express';
import {
  createReconciliation,
  getReconciliation,
  getReconciliations,
  startReconciliation,
  reviewSample,
  getSamplesWithStatus,
  getReviewRecords,
  recalculateReconciliation,
  deleteReconciliation,
} from '../services/reviewService';
import {
  getAllDiscrepanciesWithExplanation,
  getSampleDiscrepanciesWithExplanation,
  getDecisionSupport,
} from '../services/explanationService';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  try {
    const { batch_id, name, created_by, csv_import_id, json_import_id } = req.body;

    if (!batch_id || !name || !created_by) {
      return res.status(400).json({ error: '缺少必填字段: batch_id, name, created_by' });
    }

    const reconciliation = await createReconciliation(
      batch_id,
      name,
      created_by,
      csv_import_id,
      json_import_id
    );

    res.status(201).json({
      success: true,
      reconciliation_id: reconciliation.id,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/', async (_req: Request, res: Response) => {
  try {
    const reconciliations = await getReconciliations();
    res.json(reconciliations);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const reconciliation = await getReconciliation(req.params.id);
    if (!reconciliation) {
      return res.status(404).json({ error: '对账记录不存在' });
    }
    res.json(reconciliation);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/:id/start', async (req: Request, res: Response) => {
  try {
    const result = await startReconciliation(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '对账记录不存在' });
    }
    res.json({
      success: true,
      status: result.status,
      total_samples: result.total_samples,
      matched_samples: result.matched_samples,
      mismatched_samples: result.mismatched_samples,
      discrepancies_count: result.discrepancies_count,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/:id/recalculate', async (req: Request, res: Response) => {
  try {
    const result = await recalculateReconciliation(req.params.id);
    if (!result) {
      return res.status(404).json({ error: '对账记录不存在' });
    }
    res.json({
      success: true,
      status: result.status,
      total_samples: result.total_samples,
      matched_samples: result.matched_samples,
      discrepancies_count: result.discrepancies_count,
      resolved_discrepancies: result.resolved_discrepancies,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const success = await deleteReconciliation(req.params.id);
    if (!success) {
      return res.status(404).json({ error: '对账记录不存在' });
    }
    res.json({ success: true, message: '对账记录已删除' });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id/discrepancies', async (req: Request, res: Response) => {
  try {
    const discrepancies = await getAllDiscrepanciesWithExplanation(req.params.id);
    res.json(discrepancies);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id/discrepancies/sample/:sampleNo', async (req: Request, res: Response) => {
  try {
    const discrepancies = await getSampleDiscrepanciesWithExplanation(
      req.params.id,
      req.params.sampleNo
    );
    res.json(discrepancies);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id/samples', async (req: Request, res: Response) => {
  try {
    const { status } = req.query;
    const samples = await getSamplesWithStatus(req.params.id, status as any);
    res.json(samples);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id/decision-support/:sampleNo', async (req: Request, res: Response) => {
  try {
    const reconciliation = await getReconciliation(req.params.id);
    if (!reconciliation) {
      return res.status(404).json({ error: '对账记录不存在' });
    }
    const support = await getDecisionSupport(
      req.params.sampleNo,
      reconciliation.batch_id,
      req.params.id
    );
    res.json(support);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.post('/:id/review', async (req: Request, res: Response) => {
  try {
    const { sample_no, action, reviewer, comment, discrepancy_ids } = req.body;

    if (!sample_no || !action || !reviewer) {
      return res.status(400).json({ error: '缺少必填字段: sample_no, action, reviewer' });
    }

    const review = await reviewSample(
      req.params.id,
      sample_no,
      action,
      reviewer,
      comment || '',
      discrepancy_ids
    );

    if (!review) {
      return res.status(404).json({ error: '对账记录或样品不存在' });
    }

    res.json({
      success: true,
      review_id: review.id,
      new_status: review.new_status,
    });
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

router.get('/:id/reviews', async (req: Request, res: Response) => {
  try {
    const { sample_no } = req.query;
    const reviews = await getReviewRecords(req.params.id, sample_no as string | undefined);
    res.json(reviews);
  } catch (e) {
    res.status(500).json({ error: (e as Error).message });
  }
});

export default router;
