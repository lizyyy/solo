import { Router, Request, Response } from 'express';
import { Database } from '../database';
import { 
  registerMaterial, 
  reclassifyMaterial, 
  recalculateMaterial, 
  recalculateBatch,
  getMaterialsByBatch,
  getMaterialDetail 
} from '../services/materialService';
import { getMaterialTrail, getAuditLogs } from '../services/auditService';
import { checkDuplicateDeduction } from '../services/classificationService';
import { getEquipmentHistory } from '../services/equipmentService';
import { ExportFilter } from '../types';
import { exportMaterials, exportToCsv, getEquipmentTrackingReport, getOrderTrackingReport } from '../services/exportService';

export function createMaterialRouter(db: Database): Router {
  const router = Router();

  router.post('/', async (req: Request, res: Response) => {
    try {
      const { operator, ...materialData } = req.body;
      
      if (!operator) {
        return res.status(400).json({ error: '操作人不能为空' });
      }

      const result = await registerMaterial(db, materialData, operator);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/batch/:batchId', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const { status } = req.query;
      
      const materials = await getMaterialsByBatch(
        db, 
        batchId, 
        status as any
      );
      
      res.json(materials);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const material = await getMaterialDetail(db, id);
      
      if (!material) {
        return res.status(404).json({ error: '材料不存在' });
      }
      
      res.json(material);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/:id/trail', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const trail = await getMaterialTrail(db, id);
      
      if (!trail) {
        return res.status(404).json({ error: '材料不存在' });
      }
      
      res.json(trail);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/reclassify', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { newStatus, newReason, newDeduction, operator, changeReason } = req.body;
      
      if (!newStatus || !newReason || !operator || !changeReason) {
        return res.status(400).json({ error: '必填参数缺失' });
      }

      await reclassifyMaterial(db, {
        materialId: id,
        newStatus,
        newReason,
        newDeduction,
        operator,
        changeReason
      });
      
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/:id/recalculate', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;
      const { operator } = req.body;
      
      if (!operator) {
        return res.status(400).json({ error: '操作人不能为空' });
      }

      const result = await recalculateMaterial(db, id, operator);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.post('/batch/:batchId/recalculate', async (req: Request, res: Response) => {
    try {
      const { batchId } = req.params;
      const { operator } = req.body;
      
      if (!operator) {
        return res.status(400).json({ error: '操作人不能为空' });
      }

      const result = await recalculateBatch(db, batchId, operator);
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/check/duplicate', async (req: Request, res: Response) => {
    try {
      const { orderNo, equipmentSerial } = req.query;
      
      if (!orderNo || !equipmentSerial) {
        return res.status(400).json({ error: '订单号和设备序列号不能为空' });
      }

      const result = await checkDuplicateDeduction(
        db,
        orderNo as string,
        equipmentSerial as string
      );
      
      res.json(result);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/export/csv', async (req: Request, res: Response) => {
    try {
      const { batchId, status, startDate, endDate } = req.query;
      
      const filter: ExportFilter = {};
      if (batchId) filter.batchId = batchId as string;
      if (status) filter.status = status as any;
      if (startDate) filter.startDate = startDate as string;
      if (endDate) filter.endDate = endDate as string;

      const { csv, statistics } = await exportToCsv(db, filter);
      
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', `attachment; filename=deposit_export_${Date.now()}.csv`);
      res.send(csv);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/export/json', async (req: Request, res: Response) => {
    try {
      const { batchId, status, startDate, endDate } = req.query;
      
      const filter: ExportFilter = {};
      if (batchId) filter.batchId = batchId as string;
      if (status) filter.status = status as any;
      if (startDate) filter.startDate = startDate as string;
      if (endDate) filter.endDate = endDate as string;

      const records = await exportMaterials(db, filter);
      res.json(records);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/equipment/:serialNumber/tracking', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const report = await getEquipmentTrackingReport(db, serialNumber);
      
      if (!report) {
        return res.status(404).json({ error: '设备不存在' });
      }
      
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/equipment/:serialNumber/history', async (req: Request, res: Response) => {
    try {
      const { serialNumber } = req.params;
      const history = await getEquipmentHistory(db, serialNumber);
      res.json(history);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/order/:orderNo/tracking', async (req: Request, res: Response) => {
    try {
      const { orderNo } = req.params;
      const report = await getOrderTrackingReport(db, orderNo);
      
      if (!report) {
        return res.status(404).json({ error: '订单不存在' });
      }
      
      res.json(report);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  router.get('/audit/logs', async (req: Request, res: Response) => {
    try {
      const { entityType, entityId, operator, limit } = req.query;
      
      const logs = await getAuditLogs(
        db,
        entityType as string | undefined,
        entityId as string | undefined,
        operator as string | undefined,
        limit ? parseInt(limit as string) : 100
      );
      
      res.json(logs);
    } catch (error: any) {
      res.status(500).json({ error: error.message });
    }
  });

  return router;
}
