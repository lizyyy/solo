import { StoredResult, LakehousePartition, BatchItem, SchemaDiff } from './types';
import fs from 'fs-extra';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import isEqual from 'lodash/isEqual';

export class ResultStore {
  private dataDir: string;
  private resultsFile: string;
  private partitionsFile: string;
  private failuresFile: string;

  constructor(dataDir: string = './data') {
    this.dataDir = dataDir;
    this.resultsFile = path.join(dataDir, 'results.json');
    this.partitionsFile = path.join(dataDir, 'partitions.json');
    this.failuresFile = path.join(dataDir, 'failures.json');
    this.ensureDataDir();
  }

  private ensureDataDir(): void {
    fs.ensureDirSync(this.dataDir);
    if (!fs.existsSync(this.resultsFile)) {
      fs.writeJsonSync(this.resultsFile, []);
    }
    if (!fs.existsSync(this.partitionsFile)) {
      fs.writeJsonSync(this.partitionsFile, []);
    }
    if (!fs.existsSync(this.failuresFile)) {
      fs.writeJsonSync(this.failuresFile, []);
    }
  }

  findPreviousResult(orderId: string): StoredResult | null {
    const results = this.loadResults();
    const matching = results.filter(r => r.orderId === orderId);
    if (matching.length === 0) return null;
    return matching.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0];
  }

  detectConflict(orderId: string, schemaDiffs: SchemaDiff[]): {
    conflict: boolean;
    previousResult?: StoredResult;
    reason?: string;
    canReuse?: boolean;
  } {
    const previous = this.findPreviousResult(orderId);
    if (previous) {
      const schemaUnchanged = isEqual(previous.schemaDiffs, schemaDiffs);
      
      if (schemaUnchanged) {
        return {
          conflict: false,
          previousResult: previous,
          canReuse: true
        };
      } else if (previous.humanRemarks) {
        return {
          conflict: true,
          previousResult: previous,
          reason: 'Schema已变更，但有人工备注未处理，请重新审核',
          canReuse: false
        };
      } else {
        return {
          conflict: false,
          previousResult: previous,
          canReuse: false
        };
      }
    }
    return { conflict: false, canReuse: false };
  }

  storeResult(result: Omit<StoredResult, 'id' | 'createdAt' | 'updatedAt'>): StoredResult {
    const results = this.loadResults();
    const now = new Date().toISOString();
    const stored: StoredResult = {
      ...result,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    results.push(stored);
    this.saveResults(results);

    if (result.status === 'failed') {
      this.storeFailure(stored);
    }

    return stored;
  }

  addHumanRemark(resultId: string, remark: string, operator: string): StoredResult | null {
    const results = this.loadResults();
    const index = results.findIndex(r => r.id === resultId);
    if (index === -1) return null;

    results[index] = {
      ...results[index],
      humanRemarks: results[index].humanRemarks 
        ? `${results[index].humanRemarks}\n${remark}` 
        : remark,
      updatedAt: new Date().toISOString()
    };

    this.saveResults(results);
    return results[index];
  }

  confirmResult(resultId: string, confirmed: boolean, operator: string): StoredResult | null {
    const results = this.loadResults();
    const index = results.findIndex(r => r.id === resultId);
    if (index === -1) return null;

    results[index] = {
      ...results[index],
      humanConfirmed: confirmed,
      confirmedAt: new Date().toISOString(),
      confirmedBy: operator,
      updatedAt: new Date().toISOString()
    };

    this.saveResults(results);
    return results[index];
  }

  private loadResults(): StoredResult[] {
    return fs.readJsonSync(this.resultsFile, { throws: false }) || [];
  }

  private saveResults(results: StoredResult[]): void {
    fs.writeJsonSync(this.resultsFile, results, { spaces: 2 });
  }

  private storeFailure(result: StoredResult): void {
    const failures = this.loadFailures();
    failures.push(result);
    fs.writeJsonSync(this.failuresFile, failures, { spaces: 2 });
  }

  loadFailures(): StoredResult[] {
    return fs.readJsonSync(this.failuresFile, { throws: false }) || [];
  }

  getFailuresByGroup(group: string): StoredResult[] {
    return this.loadFailures().filter(f => f.failureGroup === group);
  }

  getFailureGroups(): string[] {
    const failures = this.loadFailures();
    return [...new Set(failures.map(f => f.failureGroup).filter(Boolean) as string[])];
  }

  getPartitions(): LakehousePartition[] {
    return fs.readJsonSync(this.partitionsFile, { throws: false }) || [];
  }

  confirmPartition(partitionName: string, operator: string): LakehousePartition | null {
    const partitions = this.getPartitions();
    const index = partitions.findIndex(p => p.name === partitionName);
    if (index === -1) return null;

    partitions[index] = {
      ...partitions[index],
      humanConfirmed: true,
      confirmedAt: new Date().toISOString(),
      confirmedBy: operator
    };

    fs.writeJsonSync(this.partitionsFile, partitions, { spaces: 2 });
    return partitions[index];
  }

  addPartitions(partitions: Omit<LakehousePartition, 'humanConfirmed'>[]): void {
    const existing = this.getPartitions();
    const newPartitions = partitions.map(p => ({
      ...p,
      humanConfirmed: false
    }));
    
    const merged = [...existing, ...newPartitions];
    fs.writeJsonSync(this.partitionsFile, merged, { spaces: 2 });
  }

  addOrUpdatePartitions(partitions: Omit<LakehousePartition, 'humanConfirmed'>[]): void {
    const existing = this.getPartitions();
    const existingMap = new Map(existing.map(p => [p.name, p]));
    
    for (const p of partitions) {
      if (existingMap.has(p.name)) {
        const existing = existingMap.get(p.name)!;
        existingMap.set(p.name, {
          ...existing,
          recordCount: existing.recordCount + p.recordCount
        });
      } else {
        existingMap.set(p.name, {
          ...p,
          humanConfirmed: false
        });
      }
    }
    
    const merged = Array.from(existingMap.values());
    fs.writeJsonSync(this.partitionsFile, merged, { spaces: 2 });
  }

  getUnconfirmedPartitions(): LakehousePartition[] {
    return this.getPartitions().filter(p => !p.humanConfirmed);
  }

  filterByFailure(items: BatchItem[], failureGroup: string): BatchItem[] {
    return items.filter(item => item.failureGroup === failureGroup);
  }

  getAllResults(): StoredResult[] {
    return this.loadResults();
  }
}
