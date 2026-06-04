import { Router, Request, Response } from 'express';
import {
  getReviewTasks,
  resolveReviewTask,
  createReview,
  getReviewByCalculationId,
  getAllReviews,
  generateHumanizedReport,
} from '../services/reviewService.js';
import { getCalculationById } from '../services/cavitationService.js';
import { db } from '../data/db.js';

const router = Router();

router.get('/tasks', async (req: Request, res: Response) => {
  try {
    const { assignee, status } = req.query;
    const tasks = await getReviewTasks(
      assignee as string | undefined,
      status as any
    );
    res.json(tasks);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch review tasks' });
  }
});

router.put('/tasks/:id/resolve', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { resolution, resolvedBy, markAsNormal } = req.body;
    const task = await resolveReviewTask(
      id,
      resolution,
      resolvedBy || 'user-2',
      markAsNormal
    );
    if (!task) {
      res.status(404).json({ error: 'Review task not found' });
      return;
    }
    res.json(task);
  } catch (error) {
    res.status(500).json({ error: 'Failed to resolve review task' });
  }
});

router.get('/reviews', async (req: Request, res: Response) => {
  try {
    const reviews = await getAllReviews();
    res.json(reviews);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

router.get('/reviews/calculation/:calculationId', async (req: Request, res: Response) => {
  try {
    const review = await getReviewByCalculationId(req.params.calculationId);
    if (!review) {
      res.status(404).json({ error: 'Review not found' });
      return;
    }
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch review' });
  }
});

router.post('/reviews', async (req: Request, res: Response) => {
  try {
    const { calculationId, decisions, createdBy } = req.body;
    
    const calc = await getCalculationById(calculationId);
    if (!calc) {
      res.status(404).json({ error: 'Calculation not found' });
      return;
    }

    await db.read();
    const reportContent = generateHumanizedReport(
      calc,
      decisions,
      db.data.users
    );

    const review = await createReview(
      calculationId,
      decisions,
      reportContent,
      createdBy || 'user-1'
    );
    res.json(review);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create review' });
  }
});

router.get('/reports/:calculationId', async (req: Request, res: Response) => {
  try {
    const { calculationId } = req.params;
    const calc = await getCalculationById(calculationId);
    if (!calc) {
      res.status(404).json({ error: 'Calculation not found' });
      return;
    }

    const review = await getReviewByCalculationId(calculationId);
    await db.read();

    const decisions = review?.decisions || [];
    const reportContent = generateHumanizedReport(
      calc,
      decisions,
      db.data.users
    );

    res.json({
      report: reportContent,
      calculation: calc,
      review,
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate report' });
  }
});

export default router;
