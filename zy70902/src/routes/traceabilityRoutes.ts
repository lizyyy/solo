import { Router, Request, Response } from 'express';
import { reconciliationService } from '../services/reconciliationService';
import { dataStore } from '../store/dataStore';

const router = Router();

router.get('/cable-car/:cableCarId/result/:resultId', async (req: Request, res: Response) => {
  try {
    const { cableCarId, resultId } = req.params;
    const chain = reconciliationService.getTraceabilityChain(cableCarId, resultId);

    if (!chain) {
      return res.status(404).json({
        success: false,
        message: '未找到追溯链路',
      });
    }

    res.json({
      success: true,
      data: chain,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取追溯链路失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/maintenance/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = dataStore.getMaintenanceRecord(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '检修记录不存在',
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取检修记录失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/sensor/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = dataStore.getSensorData(id);

    if (!data) {
      return res.status(404).json({
        success: false,
        message: '传感器数据不存在',
      });
    }

    res.json({
      success: true,
      data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取传感器数据失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/approval/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const record = dataStore.getApprovalRecord(id);

    if (!record) {
      return res.status(404).json({
        success: false,
        message: '审批记录不存在',
      });
    }

    res.json({
      success: true,
      data: record,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取审批记录失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/diff/:diffId/related-records', async (req: Request, res: Response) => {
  try {
    const { diffId } = req.params;
    const results = dataStore.getAllReconciliationResults();
    
    let diff = null;
    for (const result of results) {
      const found = result.diffs.find(d => d.id === diffId);
      if (found) {
        diff = found;
        break;
      }
    }

    if (!diff) {
      return res.status(404).json({
        success: false,
        message: '差异不存在',
      });
    }

    const relatedRecords: any[] = [];
    for (const related of diff.relatedRecords) {
      let record: any;
      if (related.type === 'maintenance') {
        record = dataStore.getMaintenanceRecord(related.id);
      } else if (related.type === 'sensor') {
        record = dataStore.getSensorData(related.id);
      } else if (related.type === 'approval') {
        record = dataStore.getApprovalRecord(related.id);
      }
      
      if (record) {
        relatedRecords.push({
          type: related.type,
          field: related.field,
          data: record,
        });
      }
    }

    res.json({
      success: true,
      data: {
        diff,
        relatedRecords,
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取关联记录失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
