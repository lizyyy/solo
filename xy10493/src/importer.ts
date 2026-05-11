import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';
import { BookInventory, ActualCount, LocationOwner, ValidationError } from './types';
import { dataStore } from './data-store';

export interface ImportResult {
  success: boolean;
  importedCount: number;
  errors: ValidationError[];
}

export class DataImporter {
  private validateFileExists(filePath: string): void {
    if (!fs.existsSync(filePath)) {
      throw new Error(`文件不存在: ${filePath}`);
    }
  }

  private readCSV<T>(filePath: string, columns: string[]): T[] {
    this.validateFileExists(filePath);
    const content = fs.readFileSync(filePath, 'utf-8');
    const records = parse(content, {
      columns: true,
      skip_empty_lines: true,
      trim: true
    });
    
    for (const col of columns) {
      if (!records[0] || !(col in records[0])) {
        throw new Error(`CSV 文件缺少必要列: ${col}`);
      }
    }
    
    return records as T[];
  }

  importBookInventory(filePath: string, auditId: string): ImportResult {
    const records = this.readCSV<{ location: string; sku: string; quantity: string }>(
      filePath,
      ['location', 'sku', 'quantity']
    );

    const errors: ValidationError[] = [];
    const inventories: BookInventory[] = [];
    const seen = new Set<string>();

    for (const record of records) {
      const key = `${record.location}-${record.sku}`;
      if (seen.has(key)) {
        errors.push({
          type: 'sku_missing',
          message: `重复的库位 + SKU 组合: ${key}`,
          details: record
        });
        continue;
      }
      seen.add(key);

      const quantity = parseInt(record.quantity, 10);
      if (isNaN(quantity)) {
        errors.push({
          type: 'sku_missing',
          message: `无效的数量: ${record.quantity} (SKU: ${record.sku})`,
          details: record
        });
        continue;
      }

      inventories.push({
        auditId,
        location: record.location.trim(),
        sku: record.sku.trim(),
        quantity
      });
    }

    dataStore.saveBookInventory(auditId, inventories);

    return {
      success: errors.length === 0,
      importedCount: inventories.length,
      errors
    };
  }

  importActualCount(filePath: string, auditId: string): ImportResult {
    const records = this.readCSV<{ location: string; sku: string; quantity: string; countedAt?: string }>(
      filePath,
      ['location', 'sku', 'quantity']
    );

    const errors: ValidationError[] = [];
    const counts: ActualCount[] = [];
    const seen = new Set<string>();

    for (const record of records) {
      const key = `${record.location}-${record.sku}`;
      if (seen.has(key)) {
        errors.push({
          type: 'sku_missing',
          message: `重复的库位 + SKU 组合: ${key}`,
          details: record
        });
        continue;
      }
      seen.add(key);

      const quantity = parseInt(record.quantity, 10);
      if (isNaN(quantity)) {
        errors.push({
          type: 'sku_missing',
          message: `无效的数量: ${record.quantity} (SKU: ${record.sku})`,
          details: record
        });
        continue;
      }

      counts.push({
        auditId,
        location: record.location.trim(),
        sku: record.sku.trim(),
        quantity,
        countedAt: record.countedAt || new Date().toISOString()
      });
    }

    dataStore.saveActualCount(auditId, counts);

    return {
      success: errors.length === 0,
      importedCount: counts.length,
      errors
    };
  }

  importLocationOwners(filePath: string): ImportResult {
    const records = this.readCSV<{ location: string; owner: string }>(
      filePath,
      ['location', 'owner']
    );

    const errors: ValidationError[] = [];
    const owners: LocationOwner[] = [];
    const seen = new Set<string>();

    for (const record of records) {
      const location = record.location.trim();
      if (seen.has(location)) {
        errors.push({
          type: 'location_mismatch',
          message: `重复的库位: ${location}`,
          details: record
        });
        continue;
      }
      seen.add(location);

      owners.push({
        location,
        owner: record.owner.trim()
      });
    }

    dataStore.saveLocationOwners(owners);

    return {
      success: errors.length === 0,
      importedCount: owners.length,
      errors
    };
  }
}

export const dataImporter = new DataImporter();
