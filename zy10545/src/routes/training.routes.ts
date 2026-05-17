import { Router, Request, Response } from 'express';
import { store } from '../models/store';

const router = Router();

router.post('/', (req: Request, res: Response) => {
  try {
    const { trainingCode, name, description, maxSlots, qualificationConditions, startDate, endDate } = req.body;

    if (!trainingCode || !name || !maxSlots) {
      return res.status(400).json({ error: '培训编号、名称和名额为必填项' });
    }

    const existing = store.getTrainingByCode(trainingCode);
    if (existing) {
      return res.status(400).json({ error: '培训编号已存在' });
    }

    const training = store.createTraining({
      trainingCode,
      name,
      description: description || '',
      maxSlots: Number(maxSlots),
      qualificationConditions: qualificationConditions || [],
      startDate: new Date(startDate),
      endDate: new Date(endDate)
    });

    res.status(201).json(training);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/', (_req: Request, res: Response) => {
  try {
    const trainings = store.getAllTrainings();
    res.json(trainings);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/:id', (req: Request, res: Response) => {
  try {
    const training = store.getTraining(req.params.id);
    if (!training) {
      return res.status(404).json({ error: '培训不存在' });
    }
    res.json(training);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

router.get('/code/:code', (req: Request, res: Response) => {
  try {
    const training = store.getTrainingByCode(req.params.code);
    if (!training) {
      return res.status(404).json({ error: '培训不存在' });
    }
    res.json(training);
  } catch (error) {
    res.status(500).json({ error: (error as Error).message });
  }
});

export default router;
