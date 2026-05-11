import { Router, Request, Response } from 'express';
import { batchService } from '../services/batchService';
import { transferService } from '../services/transferService';
import { freezeService } from '../services/freezeService';
import { inventoryService } from '../services/inventoryService';
import { alertService } from '../services/alertService';
import { dataStore } from '../data/store';

const router = Router();

router.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

router.post('/batches', (req: Request, res: Response) => {
  try {
    const { batchNumber, productId, warehouseId, quantity, inDate } = req.body;

    if (!batchNumber || !productId || !warehouseId || !quantity) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['batchNumber', 'productId', 'warehouseId', 'quantity']
      });
    }

    const batch = batchService.createBatch(
      batchNumber,
      productId,
      warehouseId,
      quantity,
      inDate ? new Date(inDate) : new Date()
    );

    res.status(201).json(batch);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/batches', (req: Request, res: Response) => {
  const batches = batchService.getAllBatches();
  res.json(batches);
});

router.get('/batches/:id', (req: Request, res: Response) => {
  const batch = batchService.getBatchById(req.params.id);
  if (!batch) {
    return res.status(404).json({ error: '批次不存在' });
  }
  res.json(batch);
});

router.post('/transfers', (req: Request, res: Response) => {
  try {
    const { batchId, toWarehouseId, quantity, operatorId } = req.body;

    if (!batchId || !toWarehouseId || !quantity || !operatorId) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['batchId', 'toWarehouseId', 'quantity', 'operatorId']
      });
    }

    const transfer = transferService.createTransfer(
      batchId,
      toWarehouseId,
      quantity,
      operatorId
    );

    res.status(201).json(transfer);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/freezes', (req: Request, res: Response) => {
  try {
    const { batchId, quantity, reason, operatorId } = req.body;

    if (!batchId || !quantity || !reason || !operatorId) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['batchId', 'quantity', 'reason', 'operatorId']
      });
    }

    const freeze = freezeService.createFreeze(
      batchId,
      quantity,
      reason,
      operatorId
    );

    res.status(201).json(freeze);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/unfreezes', (req: Request, res: Response) => {
  try {
    const { freezeId, quantity, operatorId } = req.body;

    if (!freezeId || !quantity || !operatorId) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['freezeId', 'quantity', 'operatorId']
      });
    }

    const unfreeze = freezeService.createUnfreeze(
      freezeId,
      quantity,
      operatorId
    );

    res.status(201).json(unfreeze);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/inventory-losses', (req: Request, res: Response) => {
  try {
    const { batchId, quantity, reason, operatorId } = req.body;

    if (!batchId || !quantity || !reason || !operatorId) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['batchId', 'quantity', 'reason', 'operatorId']
      });
    }

    const loss = inventoryService.createInventoryLoss(
      batchId,
      quantity,
      reason,
      operatorId
    );

    res.status(201).json(loss);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/disposals', (req: Request, res: Response) => {
  try {
    const { batchId, quantity, reason, operatorId } = req.body;

    if (!batchId || !quantity || !reason || !operatorId) {
      return res.status(400).json({
        error: '缺少必要参数',
        required: ['batchId', 'quantity', 'reason', 'operatorId']
      });
    }

    const disposal = inventoryService.createDisposal(
      batchId,
      quantity,
      reason,
      operatorId
    );

    res.status(201).json(disposal);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.post('/alerts/run', (req: Request, res: Response) => {
  try {
    const result = alertService.runAlertTask();
    res.json({
      success: true,
      newAlerts: result.alerts.length,
      skipped: result.skipped,
      alerts: result.alerts
    });
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/alerts/pending', (req: Request, res: Response) => {
  try {
    const result = alertService.queryPendingAlerts();
    res.json(result);
  } catch (error: any) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/alerts', (req: Request, res: Response) => {
  res.json(alertService.getAlerts());
});

router.get('/products', (req: Request, res: Response) => {
  res.json(dataStore.getProducts());
});

router.get('/warehouses', (req: Request, res: Response) => {
  res.json(dataStore.getWarehouses());
});

router.get('/samples', (req: Request, res: Response) => {
  const batches = dataStore.getBatches();
  const samples = batches.map(batch => {
    const info = alertService.getBatchAlertInfo(batch.id);
    return info;
  }).filter(Boolean);

  res.json({
    newBatches: samples.filter(b => b && b.batchAgeDays < 30),
    expiringBatches: samples.filter(b => b && b.alertLevel !== 'normal' && b.status === 'active'),
    frozenBatches: samples.filter(b => b && b.status === 'frozen'),
    disposedBatches: samples.filter(b => b && b.status === 'disposed')
  });
});

export default router;
