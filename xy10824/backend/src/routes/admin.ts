import express from 'express';
import { StateMachineService } from '../services/StateMachineService';
import { CompensationStatus } from '../database/schema';

const router = express.Router();
const stateMachineService = new StateMachineService();

router.get('/stats', async (req, res) => {
  try {
    const stats = await stateMachineService.getStatistics();
    res.json(stats);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/failed-releases', async (req, res) => {
  try {
    const failedReleases = await stateMachineService.getFailedReleases();
    res.json(failedReleases);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/release-records', async (req, res) => {
  try {
    const { reservationId, limit = 100 } = req.query;
    const records = await stateMachineService.getReleaseRecords(
      reservationId as string,
      Number(limit)
    );
    res.json(records);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/compensation-actions', async (req, res) => {
  try {
    const { status, limit = 100 } = req.query;
    const actions = await stateMachineService.getCompensationActions(
      status as CompensationStatus,
      Number(limit)
    );
    res.json(actions);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.post('/process-timeouts', async (req, res) => {
  try {
    const processed = await stateMachineService.processTimeoutTasks();
    res.json({ processed });
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;