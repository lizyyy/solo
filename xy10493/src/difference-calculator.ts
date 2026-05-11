import { v4 as uuidv4 } from 'uuid';
import { dataStore } from './data-store';
import {
  Difference,
  DifferenceType,
  BookInventory,
  ActualCount,
  LocationOwner,
  ValidationError
} from './types';

export interface CalculationResult {
  success: boolean;
  totalItems: number;
  matchedItems: number;
  profitItems: number;
  lossItems: number;
  notCountedItems: number;
  overCountedItems: number;
  errors: ValidationError[];
}

export class DifferenceCalculator {
  private determineDifferenceType(
    bookQty: number,
    actualQty: number,
    hasBook: boolean,
    hasActual: boolean
  ): DifferenceType {
    if (!hasBook && hasActual) return 'over_counted';
    if (hasBook && !hasActual) return 'not_counted';
    if (actualQty > bookQty) return 'profit';
    if (actualQty < bookQty) return 'loss';
    return 'matched';
  }

  private getOwnerForLocation(location: string, owners: LocationOwner[]): string {
    const owner = owners.find(o => o.location === location);
    return owner ? owner.owner : '未分配';
  }

  calculateDifferences(auditId: string): CalculationResult {
    const errors: ValidationError[] = [];
    const bookInventory = dataStore.getBookInventory(auditId);
    const actualCount = dataStore.getActualCount(auditId);
    const locationOwners = dataStore.getLocationOwners();

    if (bookInventory.length === 0) {
      errors.push({
        type: 'sku_missing',
        message: '账面库存数据为空，请先导入账面库存'
      });
      return {
        success: false,
        totalItems: 0,
        matchedItems: 0,
        profitItems: 0,
        lossItems: 0,
        notCountedItems: 0,
        overCountedItems: 0,
        errors
      };
    }

    const bookMap = new Map<string, BookInventory>();
    for (const item of bookInventory) {
      const key = `${item.location}-${item.sku}`;
      bookMap.set(key, item);
    }

    const actualMap = new Map<string, ActualCount>();
    for (const item of actualCount) {
      const key = `${item.location}-${item.sku}`;
      actualMap.set(key, item);
    }

    const allKeys = new Set<string>();
    bookMap.forEach((_, key) => allKeys.add(key));
    actualMap.forEach((_, key) => allKeys.add(key));

    const differences: Difference[] = [];
    const now = new Date().toISOString();

    let matched = 0;
    let profit = 0;
    let loss = 0;
    let notCounted = 0;
    let overCounted = 0;

    for (const key of allKeys) {
      const [location, sku] = key.split('-');
      const hasBook = bookMap.has(key);
      const hasActual = actualMap.has(key);
      
      const bookItem = bookMap.get(key);
      const actualItem = actualMap.get(key);

      if (!hasBook && !hasActual) continue;

      const bookQty = bookItem ? bookItem.quantity : 0;
      const actualQty = actualItem ? actualItem.quantity : 0;
      const diffQty = actualQty - bookQty;

      const diffType = this.determineDifferenceType(
        bookQty,
        actualQty,
        hasBook,
        hasActual
      );

      switch (diffType) {
        case 'matched': matched++; break;
        case 'profit': profit++; break;
        case 'loss': loss++; break;
        case 'not_counted': notCounted++; break;
        case 'over_counted': overCounted++; break;
      }

      const locationOwnersMap = new Map<string, string>();
      for (const owner of locationOwners) {
        locationOwnersMap.set(owner.location, owner.owner);
      }

      differences.push({
        id: uuidv4(),
        auditId,
        location,
        sku,
        bookQuantity: bookQty,
        actualQuantity: actualQty,
        differenceQuantity: diffQty,
        differenceType: diffType,
        owner: locationOwnersMap.get(location) || '未分配',
        approvalStatus: 'pending',
        createdAt: now,
        updatedAt: now
      });
    }

    dataStore.saveDifferences(auditId, differences);

    const session = dataStore.getAuditSession(auditId);
    if (session) {
      session.status = 'calculated';
      session.updatedAt = now;
      dataStore.saveAuditSession(session);
    }

    return {
      success: true,
      totalItems: differences.length,
      matchedItems: matched,
      profitItems: profit,
      lossItems: loss,
      notCountedItems: notCounted,
      overCountedItems: overCounted,
      errors
    };
  }

  getDifferencesByLocation(auditId: string, location?: string): Difference[] {
    const differences = dataStore.getDifferences(auditId);
    if (location) {
      return differences.filter(d => d.location === location);
    }
    return differences;
  }

  getDifferencesByOwner(auditId: string, owner: string): Difference[] {
    const differences = dataStore.getDifferences(auditId);
    return differences.filter(d => d.owner === owner);
  }

  getDifferencesByType(auditId: string, type: DifferenceType): Difference[] {
    const differences = dataStore.getDifferences(auditId);
    return differences.filter(d => d.differenceType === type);
  }

  getUnmatchedDifferences(auditId: string): Difference[] {
    const differences = dataStore.getDifferences(auditId);
    return differences.filter(d => d.differenceType !== 'matched');
  }

  validateAuditNotCalculated(auditId: string): boolean {
    const differences = dataStore.getDifferences(auditId);
    return differences.length === 0;
  }
}

export const differenceCalculator = new DifferenceCalculator();
