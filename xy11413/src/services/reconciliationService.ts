import { runQuery, runInsert } from '../database/connection';
import { TABLES } from '../database/schema';
import { createAnomaly } from './anomalyService';
import { v4 as uuidv4 } from 'uuid';

interface OrderSummary {
  franchisee_id: string;
  material_code: string;
  material_name: string;
  total_quantity: number;
  unit: string;
}

interface WasteSummary {
  franchisee_id: string;
  material_code: string;
  total_quantity: number;
}

interface SupplementSummary {
  franchisee_id: string;
  material_code: string;
  total_quantity: number;
}

interface PriceRecord {
  material_code: string;
  price: number;
}

interface ReconciliationParams {
  franchiseeId?: string;
  startDate?: string;
  endDate?: string;
}

export const performReconciliation = async (
  taskId: string,
  params: ReconciliationParams = {}
): Promise<{ resultId: string; count: number; anomalies: number }> => {
  const { franchiseeId, startDate, endDate } = params;
  
  let orderWhere = '1=1';
  let orderParams: string[] = [];
  
  if (franchiseeId) {
    orderWhere += ' AND franchisee_id = ?';
    orderParams.push(franchiseeId);
  }
  if (startDate) {
    orderWhere += ' AND order_date >= ?';
    orderParams.push(startDate);
  }
  if (endDate) {
    orderWhere += ' AND order_date <= ?';
    orderParams.push(endDate);
  }

  const orderSummary = await runQuery<OrderSummary>(
    `SELECT franchisee_id, material_code, material_name, SUM(quantity) as total_quantity, unit
     FROM ${TABLES.ORDER_ITEMS}
     WHERE ${orderWhere}
     GROUP BY franchisee_id, material_code`,
    orderParams
  );

  const wasteSummary = await runQuery<WasteSummary>(
    `SELECT franchisee_id, material_code, SUM(quantity) as total_quantity
     FROM ${TABLES.WASTE_RECORDS}
     WHERE ${orderWhere.replace('order_date', 'waste_date')}
     GROUP BY franchisee_id, material_code`,
    orderParams
  );

  const supplementSummary = await runQuery<SupplementSummary>(
    `SELECT franchisee_id, material_code, SUM(quantity) as total_quantity
     FROM ${TABLES.SUPPLEMENT_RECORDS}
     WHERE ${orderWhere.replace('order_date', 'supplement_date')}
     GROUP BY franchisee_id, material_code`,
    orderParams
  );

  const prices = await runQuery<PriceRecord>(
    `SELECT p.material_code, p.price
     FROM ${TABLES.HEADQUARTER_PRICES} p
     WHERE p.effective_date <= DATE('now')
     AND (p.expire_date IS NULL OR p.expire_date >= DATE('now'))`
  );

  const priceMap = new Map(prices.map(p => [p.material_code, p.price]));
  const wasteMap = new Map(wasteSummary.map(w => [`${w.franchisee_id}:${w.material_code}`, w.total_quantity]));
  const supplementMap = new Map(supplementSummary.map(s => [`${s.franchisee_id}:${s.material_code}`, s.total_quantity]));

  let resultCount = 0;
  let anomalyCount = 0;

  for (const order of orderSummary) {
    const key = `${order.franchisee_id}:${order.material_code}`;
    const wasteQty = wasteMap.get(key) || 0;
    const supplementQty = supplementMap.get(key) || 0;
    
    const expectedQuantity = order.total_quantity;
    const actualQuantity = order.total_quantity - wasteQty + supplementQty;
    const difference = actualQuantity - expectedQuantity;
    const unitPrice = priceMap.get(order.material_code) || 0;
    const differenceAmount = difference * unitPrice;

    const resultId = `result_${uuidv4().slice(0, 24)}`;
    const status = Math.abs(difference) > 0.001 ? 'mismatch' : 'matched';

    await runInsert(
      `INSERT INTO ${TABLES.RECONCILIATION_RESULTS} (
        result_id, task_id, franchisee_id, material_code,
        expected_quantity, actual_quantity, difference,
        unit_price, difference_amount, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        resultId, taskId, order.franchisee_id, order.material_code,
        expectedQuantity, actualQuantity, difference,
        unitPrice, differenceAmount, status
      ]
    );
    resultCount++;

    if (status === 'mismatch') {
      await createAnomaly(
        taskId,
        'quantity_mismatch',
        Math.abs(differenceAmount) > 100 ? 'high' : 'medium',
        `加盟商 ${order.franchisee_id} 物料 ${order.material_code} 数量差异: ${difference.toFixed(2)}`,
        [resultId]
      );
      anomalyCount++;
    }
  }

  return {
    resultId: taskId,
    count: resultCount,
    anomalies: anomalyCount
  };
};

export const getReconciliationResults = async (taskId: string) => {
  return await runQuery(
    `SELECT r.*, o.material_name
     FROM ${TABLES.RECONCILIATION_RESULTS} r
     LEFT JOIN ${TABLES.ORDER_ITEMS} o ON r.franchisee_id = o.franchisee_id AND r.material_code = o.material_code
     WHERE r.task_id = ?
     GROUP BY r.result_id`,
    [taskId]
  );
};

export const getReconciliationSummary = async (taskId: string) => {
  const results = await runQuery<{ status: string; count: number; total_amount: number }>(
    `SELECT status, COUNT(*) as count, SUM(ABS(difference_amount)) as total_amount
     FROM ${TABLES.RECONCILIATION_RESULTS}
     WHERE task_id = ?
     GROUP BY status`,
    [taskId]
  );
  
  return {
    taskId,
    summary: results
  };
};
