import {
  PassengerRecord,
  DriverRecord,
  WarehouseRecord,
  MatchResult,
  MatchStatus,
  FailedRecord,
  FailReason,
  RecordSource,
  ProcessResult
} from '../types';
import {
  calculateStringSimilarity,
  isSameNameItem,
  isOverdue,
  getOverdueDays,
  hideSensitiveInfo,
  generateMatchId,
  generateBatchId
} from '../utils/matchUtils';

export class MatchService {
  private passengers: PassengerRecord[] = [];
  private drivers: DriverRecord[] = [];
  private warehouses: WarehouseRecord[] = [];
  private failedRecords: FailedRecord[] = [];
  private matchedIds: Set<string> = new Set();

  setData(passengers: PassengerRecord[], drivers: DriverRecord[], warehouses: WarehouseRecord[]) {
    this.passengers = passengers;
    this.drivers = drivers;
    this.warehouses = warehouses;
    this.failedRecords = [];
    this.matchedIds.clear();
  }

  process(): ProcessResult {
    const normalItems: MatchResult[] = [];
    const pendingItems: MatchResult[] = [];

    this.validateRecords();
    this.checkOverdueItems();

    for (const passenger of this.passengers) {
      if (this.matchedIds.has(passenger.id)) continue;

      const matchResult = this.matchPassengerToDriver(passenger);
      
      if (matchResult) {
        if (matchResult.status === MatchStatus.NORMAL) {
          normalItems.push(matchResult);
        } else {
          pendingItems.push(matchResult);
        }
      }
    }

    this.matchDriverToWarehouse(normalItems, pendingItems);

    const unmatched = this.handleUnmatchedItems();
    pendingItems.push(...unmatched);

    return {
      batchId: generateBatchId(),
      processDate: new Date().toISOString(),
      normalItems,
      pendingItems,
      failedItems: this.failedRecords,
      statistics: {
        total: this.passengers.length + this.drivers.length + this.warehouses.length,
        normal: normalItems.length,
        pending: pendingItems.length,
        failed: this.failedRecords.length
      }
    };
  }

  private validateRecords() {
    const allRecords = [...this.passengers, ...this.drivers, ...this.warehouses];
    
    for (const record of allRecords) {
      if (!record.itemName || !record.date) {
        this.failedRecords.push({
          originalData: hideSensitiveInfo(record),
          failReason: FailReason.INCOMPLETE_INFO,
          failDescription: '记录缺少必要信息',
          suggestion: '请补充物品名称和日期信息后重新提交',
          source: record.source
        });
        this.matchedIds.add(record.id);
      }
    }
  }

  private checkOverdueItems() {
    for (const passenger of this.passengers) {
      if (this.matchedIds.has(passenger.id)) continue;
      
      if (isOverdue(passenger.date, 90)) {
        const days = getOverdueDays(passenger.date);
        this.failedRecords.push({
          originalData: hideSensitiveInfo(passenger),
          failReason: FailReason.OVERDUE,
          failDescription: `该乘客报失已逾期 ${days} 天（超过 90 天无人认领）`,
          suggestion: '建议转入逾期物品专用仓库，登记造册后统一处理',
          source: RecordSource.PASSENGER
        });
        this.matchedIds.add(passenger.id);
      }
    }

    for (const warehouse of this.warehouses) {
      if (this.matchedIds.has(warehouse.id)) continue;
      
      if (isOverdue(warehouse.date, 180)) {
        const days = getOverdueDays(warehouse.date);
        this.failedRecords.push({
          originalData: hideSensitiveInfo(warehouse),
          failReason: FailReason.OVERDUE,
          failDescription: `该物品入库已逾期 ${days} 天（超过 180 天无人认领）`,
          suggestion: '超过保管期限，建议按规定进行拍卖或捐赠处理',
          source: RecordSource.WAREHOUSE
        });
        this.matchedIds.add(warehouse.id);
      }
    }
  }

  private matchPassengerToDriver(passenger: PassengerRecord): MatchResult | null {
    let bestMatch: DriverRecord | null = null;
    let highestConfidence = 0;
    const notes: string[] = [];

    for (const driver of this.drivers) {
      if (this.matchedIds.has(driver.id)) continue;

      const confidence = this.calculateMatchConfidence(passenger, driver);
      
      if (isSameNameItem(passenger.itemName, driver.itemName)) {
        notes.push(`发现同名物品：乘客描述"${passenger.itemName}" vs 司机上交"${driver.itemName}"，系统判定为同类物品需人工确认`);
      }

      if (confidence > highestConfidence) {
        highestConfidence = confidence;
        bestMatch = driver;
      }
    }

    if (!bestMatch) return null;

    let status = MatchStatus.PENDING;
    if (highestConfidence >= 80) {
      status = MatchStatus.NORMAL;
      notes.unshift('三项信息高度匹配，可直接确认');
    } else if (highestConfidence >= 50) {
      notes.unshift('信息部分匹配，需要人工确认');
    } else {
      notes.unshift('匹配度较低，建议重新核对');
    }

    this.matchedIds.add(passenger.id);
    this.matchedIds.add(bestMatch.id);

    return {
      matchId: generateMatchId(),
      passengerRecord: passenger,
      driverRecord: bestMatch,
      status,
      confidence: highestConfidence,
      notes
    };
  }

  private matchDriverToWarehouse(normalItems: MatchResult[], pendingItems: MatchResult[]) {
    for (const item of [...normalItems, ...pendingItems]) {
      if (!item.driverRecord) continue;

      let bestMatch: WarehouseRecord | null = null;
      let highestConfidence = 0;
      const additionalNotes: string[] = [];

      for (const warehouse of this.warehouses) {
        if (this.matchedIds.has(warehouse.id)) continue;

        const confidence = this.calculateMatchConfidence(item.driverRecord, warehouse);
        
        if (isSameNameItem(item.driverRecord.itemName, warehouse.itemName)) {
          additionalNotes.push(`仓库入库发现同名物品："${item.driverRecord.itemName}" vs "${warehouse.itemName}"`);
        }

        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          bestMatch = warehouse;
        }
      }

      if (bestMatch) {
        item.warehouseRecord = bestMatch;
        item.confidence = Math.round((item.confidence + highestConfidence) / 2);
        item.notes.push(...additionalNotes);
        
        if (item.confidence < 60 && item.status === MatchStatus.NORMAL) {
          item.status = MatchStatus.PENDING;
          item.notes.unshift('仓库匹配后置信度下降，转为待确认');
        }
        
        this.matchedIds.add(bestMatch.id);
      }
    }
  }

  private handleUnmatchedItems(): MatchResult[] {
    const results: MatchResult[] = [];

    for (const driver of this.drivers) {
      if (this.matchedIds.has(driver.id)) continue;

      let warehouseMatch: WarehouseRecord | null = null;
      let highestConfidence = 0;
      const notes: string[] = ['暂无乘客报失记录'];

      for (const warehouse of this.warehouses) {
        if (this.matchedIds.has(warehouse.id)) continue;

        const confidence = this.calculateMatchConfidence(driver, warehouse);
        if (confidence > highestConfidence) {
          highestConfidence = confidence;
          warehouseMatch = warehouse;
        }
      }

      if (warehouseMatch) {
        this.matchedIds.add(warehouseMatch.id);
        notes.push(`已匹配仓库入库记录，匹配度 ${highestConfidence}%`);
      }

      this.matchedIds.add(driver.id);

      results.push({
        matchId: generateMatchId(),
        driverRecord: driver,
        warehouseRecord: warehouseMatch || undefined,
        status: MatchStatus.PENDING,
        confidence: warehouseMatch ? highestConfidence : 0,
        notes
      });
    }

    for (const warehouse of this.warehouses) {
      if (this.matchedIds.has(warehouse.id)) continue;

      this.matchedIds.add(warehouse.id);
      results.push({
        matchId: generateMatchId(),
        warehouseRecord: warehouse,
        status: MatchStatus.PENDING,
        confidence: 0,
        notes: ['暂无乘客报失和司机上交记录']
      });
    }

    return results;
  }

  private calculateMatchConfidence(
    record1: PassengerRecord | DriverRecord,
    record2: DriverRecord | WarehouseRecord
  ): number {
    let confidence = 0;
    const weights = {
      itemName: 40,
      description: 25,
      date: 20,
      route: 15
    };

    const nameSimilarity = calculateStringSimilarity(record1.itemName, record2.itemName);
    confidence += (nameSimilarity / 100) * weights.itemName;

    const descSimilarity = calculateStringSimilarity(record1.description, record2.description);
    confidence += (descSimilarity / 100) * weights.description;

    if (record1.date && record2.date && record1.date === record2.date) {
      confidence += weights.date;
    }

    if (record1.routeId && record2.routeId && record1.routeId === record2.routeId) {
      confidence += weights.route;
    }

    return Math.round(confidence);
  }
}

export const matchService = new MatchService();
