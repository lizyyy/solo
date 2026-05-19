import express from 'express';
import { StateMachineService } from '../services/StateMachineService';

const router = express.Router();
const stateMachineService = new StateMachineService();

router.post('/pool', async (req, res) => {
  try {
    const { poolName, initialQuantity = 0 } = req.body;
    if (!poolName) {
      return res.status(400).json({ error: 'poolName is required' });
    }
    if (typeof initialQuantity !== 'number' || initialQuantity < 0) {
      return res.status(400).json({ error: 'initialQuantity cannot be negative' });
    }
    if (!Number.isInteger(initialQuantity)) {
      return res.status(400).json({ error: 'initialQuantity must be an integer' });
    }
    const pool = await stateMachineService.createInventoryPool(poolName, initialQuantity);
    res.json(pool);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/pool', async (req, res) => {
  try {
    const pools = await stateMachineService.listInventoryPools();
    res.json(pools);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/pool/:poolId', async (req, res) => {
  try {
    const { poolId } = req.params;
    const pool = await stateMachineService.getInventoryPool(poolId);
    if (!pool) {
      return res.status(404).json({ error: 'Inventory pool not found' });
    }
    res.json(pool);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const { poolId, orderId, limit = 100 } = req.query;
    const logs = await stateMachineService.getInventoryLogs(
      poolId as string,
      orderId as string,
      Number(limit)
    );
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: error instanceof Error ? error.message : 'Unknown error' });
  }
});

export default router;