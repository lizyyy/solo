import Fuse from 'fuse.js';
import { v4 as uuidv4 } from 'uuid';
import {
  PassengerLostItem,
  DriverTurnedInItem,
  WarehouseItem,
  MatchCandidate,
  MatchRecord,
  DifferenceType,
  ItemStatus,
  RouteSchedule
} from '../types';

export class MatchingEngine {
  private readonly OVERDUE_DAYS = 90;
  private readonly MATCH_THRESHOLD = 0.6;
  private readonly SENSITIVE_KEYWORDS = ['身份证', '护照', '银行卡', '钱包', '手机', '密码', '卡号'];

  private fuseOptions: Fuse.IFuseOptions<any> = {
    keys: [
      { name: 'itemName', weight: 0.3 },
      { name: 'itemDescription', weight: 0.2 },
      { name: 'itemCategory', weight: 0.15 },
      { name: 'itemColor', weight: 0.1 },
      { name: 'itemBrand', weight: 0.1 },
      { name: 'routeNumber', weight: 0.1 },
      { name: 'lostLocation', weight: 0.05 }
    ],
    threshold: 0.4,
    includeScore: true,
    ignoreLocation: true
  };

  matchPassengerToDriver(
    passengerItems: PassengerLostItem[],
    driverItems: DriverTurnedInItem[],
    routeSchedules: RouteSchedule[]
  ): MatchRecord[] {
    const matchRecords: MatchRecord[] = [];
    const matchedPassengerIds = new Set<string>();
    const matchedDriverIds = new Set<string>();

    const driverFuse = new Fuse(driverItems, this.fuseOptions);

    for (const passenger of passengerItems) {
      if (matchedPassengerIds.has(passenger.id)) continue;

      const candidates = this.findDriverCandidates(passenger, driverFuse, driverItems, routeSchedules);

      for (const candidate of candidates) {
        if (candidate.driverItem && !matchedDriverIds.has(candidate.driverItem.id)) {
          if (candidate.matchScore >= this.MATCH_THRESHOLD) {
            const matchRecord = this.createMatchRecord(
              passenger.id,
              candidate.driverItem.id,
              undefined,
              candidate
            );
            matchRecords.push(matchRecord);
            matchedPassengerIds.add(passenger.id);
            matchedDriverIds.add(candidate.driverItem.id);
            break;
          }
        }
      }
    }

    const unmatchedPassengers = passengerItems.filter(p => !matchedPassengerIds.has(p.id));
    for (const passenger of unmatchedPassengers) {
      matchRecords.push(this.createUnmatchedRecord(passenger.id, undefined, undefined, 'passenger'));
    }

    const unmatchedDrivers = driverItems.filter(d => !matchedDriverIds.has(d.id));
    for (const driver of unmatchedDrivers) {
      matchRecords.push(this.createUnmatchedRecord(undefined, driver.id, undefined, 'driver'));
    }

    return matchRecords;
  }

  matchDriverToWarehouse(
    driverItems: DriverTurnedInItem[],
    warehouseItems: WarehouseItem[],
    existingMatches: MatchRecord[]
  ): MatchRecord[] {
    const updatedMatches: MatchRecord[] = [...existingMatches];
    const matchedWarehouseIds = new Set<string>(
      existingMatches.filter(m => m.warehouseItemId).map(m => m.warehouseItemId!)
    );

    const warehouseFuse = new Fuse(warehouseItems, this.fuseOptions);

    for (const driver of driverItems) {
      const existingMatch = updatedMatches.find(
        m => m.driverItemId === driver.id && m.status !== ItemStatus.UNMATCHED
      );

      if (!existingMatch) continue;

      const candidates = this.findWarehouseCandidates(driver, warehouseFuse, warehouseItems);

      for (const candidate of candidates) {
        if (candidate.warehouseItem && !matchedWarehouseIds.has(candidate.warehouseItem.id)) {
          if (candidate.matchScore >= this.MATCH_THRESHOLD) {
            existingMatch.warehouseItemId = candidate.warehouseItem.id;
            existingMatch.matchScore = Math.min(existingMatch.matchScore, candidate.matchScore);
            existingMatch.matchedFields = [...new Set([...existingMatch.matchedFields, ...candidate.matchedFields])];
            existingMatch.differences = [...new Set([...existingMatch.differences, ...candidate.differences])];
            existingMatch.differenceExplanations = [...existingMatch.differenceExplanations, ...candidate.differenceExplanations];
            existingMatch.isSameName = existingMatch.isSameName || candidate.isSameName;
            existingMatch.hasSensitiveInfo = existingMatch.hasSensitiveInfo || candidate.hasSensitiveInfo;
            existingMatch.updatedAt = new Date().toISOString();

            matchedWarehouseIds.add(candidate.warehouseItem.id);
            break;
          }
        }
      }
    }

    const unmatchedWarehouse = warehouseItems.filter(w => !matchedWarehouseIds.has(w.id));
    for (const warehouse of unmatchedWarehouse) {
      updatedMatches.push(this.createUnmatchedRecord(undefined, undefined, warehouse.id, 'warehouse'));
    }

    return updatedMatches;
  }

  private findDriverCandidates(
    passenger: PassengerLostItem,
    driverFuse: Fuse<DriverTurnedInItem>,
    driverItems: DriverTurnedInItem[],
    routeSchedules: RouteSchedule[]
  ): MatchCandidate[] {
    const candidates: MatchCandidate[] = [];
    const searchResult = driverFuse.search(passenger.itemName + ' ' + passenger.itemDescription);

    for (const result of searchResult) {
      const driver = result.item;
      const matchedFields: string[] = [];
      const differences: DifferenceType[] = [];
      const explanations: string[] = [];
      let score = 1 - (result.score || 0);

      if (passenger.routeNumber === driver.routeNumber) {
        matchedFields.push('routeNumber');
        score += 0.1;
      } else {
        differences.push(DifferenceType.LOCATION_MISMATCH);
        explanations.push(`线路不匹配: 乘客报失线路 ${passenger.routeNumber}, 司机上交线路 ${driver.routeNumber}`);
      }

      if (this.isDateMatch(passenger.lostDate, driver.foundDate)) {
        matchedFields.push('date');
        score += 0.1;
      } else {
        differences.push(DifferenceType.TIME_MISMATCH);
        explanations.push(`日期不匹配: 乘客报失日期 ${passenger.lostDate}, 司机上交日期 ${driver.foundDate}`);
      }

      if (passenger.busNumber && driver.busNumber && passenger.busNumber === driver.busNumber) {
        matchedFields.push('busNumber');
        score += 0.05;
      }

      if (passenger.itemName === driver.itemName) {
        matchedFields.push('itemName');
      }

      const isSameName = this.isSameNameMatch(passenger, driver);
      if (isSameName) {
        differences.push(DifferenceType.SAME_NAME);
        explanations.push(`同名物品警告: 存在多个同名 "${passenger.itemName}" 物品,请核对详细描述`);
      }

      const isOverdue = this.checkOverdue(driver.foundDate);
      if (isOverdue) {
        differences.push(DifferenceType.OVERDUE);
        explanations.push(`逾期警告: 该物品自 ${driver.foundDate} 起已超过 ${this.OVERDUE_DAYS} 天无人认领`);
      }

      const hasSensitiveInfo = this.checkSensitiveInfo(passenger.itemDescription + ' ' + driver.itemDescription);
      if (hasSensitiveInfo) {
        differences.push(DifferenceType.SENSITIVE_INFO);
        explanations.push(`敏感信息提醒: 该物品描述包含敏感信息,处理时请注意隐私保护`);
      }

      candidates.push({
        passengerItem: passenger,
        driverItem: driver,
        matchScore: Math.min(score, 1),
        matchedFields,
        differences,
        differenceExplanations: explanations,
        isSameName,
        isOverdue,
        hasSensitiveInfo
      });
    }

    return candidates.sort((a, b) => b.matchScore - a.matchScore);
  }

  private findWarehouseCandidates(
    driver: DriverTurnedInItem,
    warehouseFuse: Fuse<WarehouseItem>,
    warehouseItems: WarehouseItem[]
  ): MatchCandidate[] {
    const candidates: MatchCandidate[] = [];
    const searchResult = warehouseFuse.search(driver.itemName + ' ' + driver.itemDescription);

    for (const result of searchResult) {
      const warehouse = result.item;
      const matchedFields: string[] = [];
      const differences: DifferenceType[] = [];
      const explanations: string[] = [];
      let score = 1 - (result.score || 0);

      if (driver.bagNumber && warehouse.bagNumber && driver.bagNumber === warehouse.bagNumber) {
        matchedFields.push('bagNumber');
        score += 0.2;
      }

      if (driver.id === warehouse.driverTurnInId) {
        matchedFields.push('driverTurnInId');
        score += 0.2;
      }

      if (driver.itemName === warehouse.itemName) {
        matchedFields.push('itemName');
      }

      if (driver.itemCategory === warehouse.itemCategory) {
        matchedFields.push('itemCategory');
        score += 0.05;
      }

      const isSameName = driver.itemName === warehouse.itemName;
      if (isSameName && driver.itemDescription !== warehouse.itemDescription) {
        differences.push(DifferenceType.SAME_NAME);
        explanations.push(`同名物品警告: 仓库存在同名 "${driver.itemName}" 物品,请核对编号`);
      }

      const isOverdue = this.checkOverdue(warehouse.receiptDate);
      if (isOverdue) {
        differences.push(DifferenceType.OVERDUE);
        explanations.push(`逾期警告: 该物品自 ${warehouse.receiptDate} 起已超过 ${this.OVERDUE_DAYS} 天无人认领`);
      }

      const hasSensitiveInfo = this.checkSensitiveInfo(driver.itemDescription + ' ' + warehouse.itemDescription);
      if (hasSensitiveInfo) {
        differences.push(DifferenceType.SENSITIVE_INFO);
        explanations.push(`敏感信息提醒: 该物品描述包含敏感信息,处理时请注意隐私保护`);
      }

      candidates.push({
        driverItem: driver,
        warehouseItem: warehouse,
        matchScore: Math.min(score, 1),
        matchedFields,
        differences,
        differenceExplanations: explanations,
        isSameName,
        isOverdue,
        hasSensitiveInfo
      });
    }

    return candidates.sort((a, b) => b.matchScore - a.matchScore);
  }

  private createMatchRecord(
    passengerItemId: string | undefined,
    driverItemId: string | undefined,
    warehouseItemId: string | undefined,
    candidate: MatchCandidate
  ): MatchRecord {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      matchId: `MATCH-${Date.now()}`,
      batchId: '',
      passengerItemId,
      driverItemId,
      warehouseItemId,
      matchScore: candidate.matchScore,
      status: ItemStatus.MATCHED,
      matchedFields: candidate.matchedFields,
      differences: candidate.differences,
      differenceExplanations: candidate.differenceExplanations,
      isSameName: candidate.isSameName,
      isOverdue: candidate.isOverdue,
      hasSensitiveInfo: candidate.hasSensitiveInfo,
      createdAt: now,
      updatedAt: now
    };
  }

  private createUnmatchedRecord(
    passengerItemId: string | undefined,
    driverItemId: string | undefined,
    warehouseItemId: string | undefined,
    source: string
  ): MatchRecord {
    const now = new Date().toISOString();
    return {
      id: uuidv4(),
      matchId: `UNMATCH-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      batchId: '',
      passengerItemId,
      driverItemId,
      warehouseItemId,
      matchScore: 0,
      status: ItemStatus.UNMATCHED,
      matchedFields: [],
      differences: [],
      differenceExplanations: [`${source}来源记录未找到匹配项`],
      isSameName: false,
      isOverdue: false,
      hasSensitiveInfo: false,
      createdAt: now,
      updatedAt: now
    };
  }

  private isDateMatch(date1: string, date2: string): boolean {
    if (!date1 || !date2) return false;
    const d1 = new Date(date1);
    const d2 = new Date(date2);
    const diffDays = Math.abs((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
    return diffDays <= 2;
  }

  private isSameNameMatch(
    passenger: PassengerLostItem,
    driver: DriverTurnedInItem
  ): boolean {
    return passenger.itemName === driver.itemName &&
      passenger.itemDescription !== driver.itemDescription;
  }

  private checkOverdue(dateStr: string): boolean {
    if (!dateStr) return false;
    const date = new Date(dateStr);
    const now = new Date();
    const diffDays = (now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24);
    return diffDays > this.OVERDUE_DAYS;
  }

  private checkSensitiveInfo(text: string): boolean {
    return this.SENSITIVE_KEYWORDS.some(keyword => text.includes(keyword));
  }

  updateOverdueStatus(matches: MatchRecord[], allItems: any[]): MatchRecord[] {
    return matches.map(match => {
      let isOverdue = false;
      const relevantDate = this.getRelevantDate(match, allItems);
      if (relevantDate) {
        isOverdue = this.checkOverdue(relevantDate);
      }
      return {
        ...match,
        isOverdue,
        updatedAt: new Date().toISOString()
      };
    });
  }

  private getRelevantDate(match: MatchRecord, allItems: any[]): string | null {
    if (match.passengerItemId) {
      const item = allItems.find(i => i.id === match.passengerItemId);
      if (item) return item.lostDate || item.reportDate;
    }
    if (match.driverItemId) {
      const item = allItems.find(i => i.id === match.driverItemId);
      if (item) return item.foundDate || item.turnInDate;
    }
    if (match.warehouseItemId) {
      const item = allItems.find(i => i.id === match.warehouseItemId);
      if (item) return item.receiptDate;
    }
    return null;
  }
}
