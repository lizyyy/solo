import { v4 as uuidv4 } from 'uuid';
import { dataStore } from '../data/store';
import { batchService } from './batchService';
import {
  Alert,
  AlertLevel,
  BatchAlertInfo,
  AlertQueryResult,
  OwnerTodoSummary
} from '../types';

export class AlertService {
  runAlertTask(): { alerts: Alert[]; skipped: number } {
    const today = new Date();
    const lastRun = dataStore.getLastAlertRunDate();

    if (lastRun) {
      const lastRunStart = new Date(lastRun);
      lastRunStart.setHours(0, 0, 0, 0);
      const todayStart = new Date(today);
      todayStart.setHours(0, 0, 0, 0);

      if (lastRunStart.getTime() === todayStart.getTime()) {
        return { alerts: [], skipped: dataStore.getBatches().length };
      }
    }

    const batches = dataStore.getBatches();
    const newAlerts: Alert[] = [];

    for (const batch of batches) {
      if (batch.status === 'disposed') {
        continue;
      }

      if (dataStore.hasAlertForBatchToday(batch.id, today)) {
        continue;
      }

      const alertLevel = batchService.calculateAlertLevel(batch);

      if (alertLevel === 'normal') {
        continue;
      }

      const alert: Alert = {
        id: uuidv4(),
        batchId: batch.id,
        level: alertLevel,
        batchAgeDays: batchService.getBatchAgeDays(batch),
        alertDate: today,
        isResolved: false,
        createdAt: new Date()
      };

      dataStore.addAlert(alert);
      newAlerts.push(alert);

      dataStore.updateBatch({
        ...batch,
        lastAlertDate: today
      });
    }

    dataStore.setLastAlertRunDate(today);

    return {
      alerts: newAlerts,
      skipped: batches.length - newAlerts.length
    };
  }

  getBatchAlertInfo(batchId: string): BatchAlertInfo | null {
    const batch = dataStore.getBatchById(batchId);
    if (!batch) {
      return null;
    }

    const product = dataStore.getProductById(batch.productId);
    if (!product) {
      return null;
    }

    const warehouse = dataStore.getWarehouseById(batch.warehouseId);
    if (!warehouse) {
      return null;
    }

    return {
      batchId: batch.id,
      batchNumber: batch.batchNumber,
      productId: batch.productId,
      productName: product.name,
      sku: product.sku,
      warehouseId: batch.warehouseId,
      warehouseName: warehouse.name,
      quantity: batch.quantity,
      availableQuantity: batch.availableQuantity,
      frozenQuantity: batch.frozenQuantity,
      inDate: batch.inDate,
      batchAgeDays: batchService.getBatchAgeDays(batch),
      alertLevel: batchService.calculateAlertLevel(batch),
      status: batch.status,
      ownerId: product.ownerId,
      ownerName: product.ownerName,
      lastAlertDate: batch.lastAlertDate
    };
  }

  queryPendingAlerts(): AlertQueryResult {
    const batches = dataStore.getBatches();
    const pendingAlerts: BatchAlertInfo[] = [];

    for (const batch of batches) {
      if (batch.status === 'disposed') {
        continue;
      }

      const alertLevel = batchService.calculateAlertLevel(batch);

      if (alertLevel === 'normal') {
        continue;
      }

      const info = this.getBatchAlertInfo(batch.id);
      if (info) {
        pendingAlerts.push(info);
      }
    }

    pendingAlerts.sort((a, b) => {
      const levelOrder: Record<AlertLevel, number> = {
        critical: 0,
        high: 1,
        medium: 2,
        low: 3,
        normal: 4
      };
      if (levelOrder[a.alertLevel] !== levelOrder[b.alertLevel]) {
        return levelOrder[a.alertLevel] - levelOrder[b.alertLevel];
      }
      return b.batchAgeDays - a.batchAgeDays;
    });

    const ownerMap = new Map<string, OwnerTodoSummary>();

    for (const alert of pendingAlerts) {
      const ownerId = alert.ownerId;
      if (!ownerMap.has(ownerId)) {
        ownerMap.set(ownerId, {
          ownerId,
          ownerName: alert.ownerName,
          totalPending: 0,
          criticalCount: 0,
          highCount: 0,
          mediumCount: 0,
          lowCount: 0,
          batches: []
        });
      }

      const summary = ownerMap.get(ownerId)!;
      summary.totalPending++;
      summary.batches.push(alert);

      switch (alert.alertLevel) {
        case 'critical':
          summary.criticalCount++;
          break;
        case 'high':
          summary.highCount++;
          break;
        case 'medium':
          summary.mediumCount++;
          break;
        case 'low':
          summary.lowCount++;
          break;
      }
    }

    for (const summary of ownerMap.values()) {
      summary.batches.sort((a, b) => {
        const levelOrder: Record<AlertLevel, number> = {
          critical: 0,
          high: 1,
          medium: 2,
          low: 3,
          normal: 4
        };
        if (levelOrder[a.alertLevel] !== levelOrder[b.alertLevel]) {
          return levelOrder[a.alertLevel] - levelOrder[b.alertLevel];
        }
        return b.batchAgeDays - a.batchAgeDays;
      });
    }

    return {
      pendingAlerts,
      ownerSummaries: Array.from(ownerMap.values()).sort(
        (a, b) => b.totalPending - a.totalPending
      ),
      totalPending: pendingAlerts.length
    };
  }

  getAlerts(): Alert[] {
    return dataStore.getAlerts();
  }
}

export const alertService = new AlertService();
