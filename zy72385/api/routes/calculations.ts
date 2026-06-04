import { Router, Request, Response } from 'express';
import {
  getAllCalculations,
  getCalculationById,
  createCalculation,
  updateCalculation,
  recalculateRisk,
} from '../services/cavitationService.js';
import { getChangeHistory } from '../services/auditService.js';

const router = Router();

router.get('/', async (req: Request, res: Response) => {
  try {
    const calculations = await getAllCalculations();
    res.json(calculations);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch calculations' });
  }
});

router.get('/:id', async (req: Request, res: Response) => {
  try {
    const calculation = await getCalculationById(req.params.id);
    if (!calculation) {
      res.status(404).json({ error: 'Calculation not found' });
      return;
    }
    res.json(calculation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch calculation' });
  }
});

router.get('/:id/history', async (req: Request, res: Response) => {
  try {
    const history = await getChangeHistory('calculation', req.params.id);
    res.json(history);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch change history' });
  }
});

router.post('/', async (req: Request, res: Response) => {
  try {
    const { name, pumpId, screenshotIds, samplingIntervalIds, parameters, status, remark, createdBy } = req.body;
    const calculation = await createCalculation(
      {
        name,
        pumpId,
        screenshotIds,
        samplingIntervalIds,
        parameters,
        status: status || 'draft',
        remark: remark || '',
        createdBy: createdBy || 'user-1',
        updatedBy: createdBy || 'user-1',
      },
      createdBy || 'user-1'
    );
    res.json(calculation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to create calculation' });
  }
});

router.put('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { updates, updatedBy, changeReason } = req.body;
    const calculation = await updateCalculation(
      id,
      updates,
      updatedBy || 'user-1',
      changeReason || '更新计算数据'
    );
    if (!calculation) {
      res.status(404).json({ error: 'Calculation not found' });
      return;
    }
    res.json(calculation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to update calculation' });
  }
});

router.post('/:id/recalculate', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const calculation = await recalculateRisk(id);
    if (!calculation) {
      res.status(404).json({ error: 'Calculation not found' });
      return;
    }
    res.json(calculation);
  } catch (error) {
    res.status(500).json({ error: 'Failed to recalculate risk' });
  }
});

export default router;
