import { Request, Response } from 'express';
import { reconciliationEngine } from '../services/reconciliationEngine';
import { dataStore } from '../store/dataStore';

export const reconcileOrder = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const result = reconciliationEngine.reconcileOrder(orderNo);
    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const reconcileAllOrders = (_req: Request, res: Response) => {
  try {
    const results = reconciliationEngine.reconcileAllOrders();
    res.json({
      message: `已完成 ${results.length} 个订单的对账`,
      results,
    });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getReconciliationResult = (req: Request, res: Response) => {
  try {
    const { orderNo } = req.params;
    const result = dataStore.getReconciliationResult(orderNo);

    if (!result) {
      return res.status(404).json({ error: '对账结果不存在，请先执行对账' });
    }

    res.json(result);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getAllReconciliationResults = (_req: Request, res: Response) => {
  try {
    const results = dataStore.getAllReconciliationResults();
    res.json(results);
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};

export const getDiscrepancyExplanation = (req: Request, res: Response) => {
  try {
    const { type } = req.params;
    const explanation = reconciliationEngine.getDiscrepancyExplanation(type as any);
    res.json({ type, explanation });
  } catch (error: any) {
    res.status(500).json({ error: error.message });
  }
};
