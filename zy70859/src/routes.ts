import { Router, Request, Response } from 'express';
import { DocumentService } from './services';
import { MaterialStatus } from './types';

export function createRoutes(service: DocumentService): Router {
  const router = Router();

  router.post('/batches', async (req: Request, res: Response) => {
    try {
      const { createdBy, description } = req.body;
      if (!createdBy) {
        return res.status(400).json({ error: 'createdBy 是必填字段' });
      }
      const batch = await service.createBatch(createdBy, description);
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/batches', async (_req: Request, res: Response) => {
    try {
      const batches = await service.getAllBatches();
      res.json(batches);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/batches/:batchId', async (req: Request, res: Response) => {
    try {
      const batch = await service.getBatch(req.params.batchId);
      if (!batch) {
        return res.status(404).json({ error: '批次不存在' });
      }
      res.json(batch);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/batches/:batchId/materials', async (req: Request, res: Response) => {
    try {
      const materials = await service.getMaterialsByBatch(req.params.batchId);
      res.json(materials);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/batches/:batchId/materials', async (req: Request, res: Response) => {
    try {
      const { materialData, processedBy } = req.body;
      if (!processedBy) {
        return res.status(400).json({ error: 'processedBy 是必填字段' });
      }
      const result = await service.registerMaterial(req.params.batchId, materialData, processedBy);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.post('/batches/:batchId/recalculate', async (req: Request, res: Response) => {
    try {
      const { processedBy } = req.body;
      if (!processedBy) {
        return res.status(400).json({ error: 'processedBy 是必填字段' });
      }
      const result = await service.recalculateBatch(req.params.batchId, processedBy);
      res.json(result);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/materials/:materialId', async (req: Request, res: Response) => {
    try {
      const material = await service.getMaterial(req.params.materialId);
      if (!material) {
        return res.status(404).json({ error: '材料不存在' });
      }
      res.json(material);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/materials/:materialId/trail', async (req: Request, res: Response) => {
    try {
      const trail = await service.getMaterialTrail(req.params.materialId);
      res.json(trail);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/materials/:materialId/processing-trails', async (req: Request, res: Response) => {
    try {
      const trails = await service.getProcessingTrails(req.params.materialId);
      res.json(trails);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/materials/:materialId/audit-logs', async (req: Request, res: Response) => {
    try {
      const logs = await service.getAuditLogs(req.params.materialId);
      res.json(logs);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.patch('/materials/:materialId/status', async (req: Request, res: Response) => {
    try {
      const { newStatus, statusReason, modifiedBy, changeReason } = req.body;
      if (!newStatus || !statusReason || !modifiedBy || !changeReason) {
        return res.status(400).json({ 
          error: 'newStatus, statusReason, modifiedBy, changeReason 都是必填字段' 
        });
      }
      const material = await service.updateMaterialStatus(
        req.params.materialId,
        newStatus as MaterialStatus,
        statusReason,
        modifiedBy,
        changeReason
      );
      res.json(material);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  router.get('/statistics', async (_req: Request, res: Response) => {
    try {
      const stats = await service.getStatistics();
      res.json(stats);
    } catch (error) {
      res.status(500).json({ error: (error as Error).message });
    }
  });

  return router;
}
