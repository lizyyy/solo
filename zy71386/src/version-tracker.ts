import * as fs from 'fs';
import * as path from 'path';
import { ApiContract, ContractDiffResult, VersionRecord } from './types';
import { ContractComparator } from './contract-comparator';

export class VersionTracker {
  private storagePath: string;
  private versions: Map<string, VersionRecord> = new Map();
  private headVersion: string | null = null;

  constructor(storagePath: string = './.sentinel/versions') {
    this.storagePath = storagePath;
    this.ensureStorage();
    this.loadVersions();
  }

  track(contract: ApiContract, changes: string[], parentVersion?: string): VersionRecord {
    const record: VersionRecord = {
      version: contract.version,
      contract,
      timestamp: new Date().toISOString(),
      changes,
      parentVersion: parentVersion || this.headVersion || undefined
    };

    this.versions.set(contract.version, record);
    this.headVersion = contract.version;
    this.saveVersion(record);

    return record;
  }

  compareWithVersion(contract: ApiContract, targetVersion: string): ContractDiffResult | null {
    const target = this.versions.get(targetVersion);
    if (!target) {
      return null;
    }

    const comparator = new ContractComparator();
    return comparator.compare(target.contract, contract);
  }

  compareWithHead(contract: ApiContract): ContractDiffResult | null {
    if (!this.headVersion) {
      return null;
    }
    return this.compareWithVersion(contract, this.headVersion);
  }

  getVersion(version: string): VersionRecord | undefined {
    return this.versions.get(version);
  }

  getAllVersions(): VersionRecord[] {
    return Array.from(this.versions.values()).sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );
  }

  getVersionChain(version: string): VersionRecord[] {
    const chain: VersionRecord[] = [];
    let current: VersionRecord | undefined = this.versions.get(version);

    while (current) {
      chain.push(current);
      current = current.parentVersion ? this.versions.get(current.parentVersion) : undefined;
    }

    return chain;
  }

  detectChanges(diff: ContractDiffResult): string[] {
    const changes: string[] = [];

    for (const endpoint of diff.missingEndpoints) {
      changes.push(`移除了端点: ${endpoint.method} ${endpoint.path}`);
    }

    for (const endpoint of diff.newEndpoints) {
      changes.push(`新增了端点: ${endpoint.method} ${endpoint.path}`);
    }

    for (const endpointDiff of diff.endpointDiffs) {
      for (const fieldDiff of endpointDiff.fieldDiffs) {
        const changeMsg = this.formatChangeMessage(fieldDiff, endpointDiff);
        if (!changes.includes(changeMsg)) {
          changes.push(changeMsg);
        }
      }
    }

    return changes;
  }

  private formatChangeMessage(diff: any, endpoint: any): string {
    const location = `${endpoint.method} ${endpoint.path} -> ${diff.field}`;
    
    switch (diff.type) {
      case 'type_changed':
        return `类型变更: ${location} (${diff.expected} -> ${diff.actual})`;
      case 'field_added':
        return `新增字段: ${location}`;
      case 'field_removed':
        return `移除字段: ${location}`;
      case 'nullable_changed':
        return `可空性变更: ${location} (${diff.expected} -> ${diff.actual})`;
      case 'required_changed':
        return `必填性变更: ${location} (${diff.expected} -> ${diff.actual})`;
      case 'enum_added':
        return `新增枚举值: ${location} = ${diff.actual}`;
      case 'enum_removed':
        return `移除枚举值: ${location} = ${diff.expected}`;
      default:
        return `变更: ${location} (${diff.type})`;
    }
  }

  private ensureStorage(): void {
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
  }

  private saveVersion(record: VersionRecord): void {
    const filePath = path.join(this.storagePath, `${record.version}.json`);
    fs.writeFileSync(filePath, JSON.stringify(record, null, 2));
  }

  private loadVersions(): void {
    if (!fs.existsSync(this.storagePath)) {
      return;
    }

    const files = fs.readdirSync(this.storagePath).filter(f => f.endsWith('.json'));
    
    for (const file of files) {
      try {
        const content = fs.readFileSync(path.join(this.storagePath, file), 'utf-8');
        const record: VersionRecord = JSON.parse(content);
        this.versions.set(record.version, record);
      } catch {
        continue;
      }
    }

    const sorted = this.getAllVersions();
    if (sorted.length > 0) {
      this.headVersion = sorted[0].version;
    }
  }
}
