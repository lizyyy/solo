import { Router, Request, Response } from 'express';
import { reconciliationService } from '../services/reconciliationService';
import { dataStore } from '../store/dataStore';

const router = Router();

router.post('/:batchId', async (req: Request, res: Response) => {
  try {
    const { batchId } = req.params;
    const result = await reconciliationService.performReconciliation(batchId);

    res.json({
      success: true,
      data: result,
      message: '对账完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '对账失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:resultId', async (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;
    const result = dataStore.getReconciliationResult(resultId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: '对账结果不存在',
      });
    }

    res.json({
      success: true,
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取对账结果失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/', async (req: Request, res: Response) => {
  try {
    const results = dataStore.getAllReconciliationResults();

    res.json({
      success: true,
      data: results,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取对账结果列表失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.post('/:resultId/recalculate', async (req: Request, res: Response) => {
  try {
    const { resultId } = req.params;
    const result = await reconciliationService.recalculateSummary(resultId);

    if (!result) {
      return res.status(404).json({
        success: false,
        message: '对账结果不存在',
      });
    }

    res.json({
      success: true,
      data: result,
      message: '重新计算完成',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '重新计算失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

router.get('/:resultId/cable-car/:cableCarId', async (req: Request, res: Response) => {
  try {
    const { resultId, cableCarId } = req.params;
    const diffs = reconciliationService.getDiffsByCableCar(cableCarId, resultId);

    if (!diffs) {
      return res.status(404).json({
        success: false,
        message: '对账结果不存在',
      });
    }

    res.json({
      success: true,
      data: diffs,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: '获取缆车差异失败',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

export default router;
