import * as fs from 'fs';
import * as path from 'path';
import { ReleaseData, ServiceReleasePlan, Dependency, DatabaseMigration, ConfigSwitch, RollbackContact, Waiver, CheckHistory, ManualCorrection } from './types';

const DEFAULT_DATA_DIR = path.join(process.cwd(), '.release-data');
const DATA_FILE = 'release-data.json';

export class Storage {
  private dataDir: string;
  private dataFile: string;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || DEFAULT_DATA_DIR;
    this.dataFile = path.join(this.dataDir, DATA_FILE);
  }

  ensureDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  initialize(releasePlanId: string, releaseName: string): ReleaseData {
    this.ensureDirectory();
    const data: ReleaseData = {
      releasePlanId,
      releaseName,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      services: [],
      dependencies: [],
      migrations: [],
      switches: [],
      contacts: [],
      waivers: [],
      checkHistory: [],
      corrections: []
    };
    this.save(data);
    return data;
  }

  exists(): boolean {
    return fs.existsSync(this.dataFile);
  }

  load(): ReleaseData {
    if (!this.exists()) {
      throw new Error('发版数据不存在，请先运行 init 命令初始化');
    }
    const content = fs.readFileSync(this.dataFile, 'utf-8');
    return JSON.parse(content);
  }

  save(data: ReleaseData): void {
    this.ensureDirectory();
    data.updatedAt = new Date().toISOString();
    fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf-8');
  }

  backup(): string {
    if (!this.exists()) {
      return '';
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.dataDir, `release-data-backup-${timestamp}.json`);
    fs.copyFileSync(this.dataFile, backupFile);
    return backupFile;
  }

  addServices(data: ReleaseData, services: ServiceReleasePlan[]): ReleaseData {
    const existingIds = new Set(data.services.map(s => s.id));
    const existingNames = new Set(data.services.map(s => s.name));
    for (const service of services) {
      if (!existingIds.has(service.id) && !existingNames.has(service.name)) {
        data.services.push(service);
      }
    }
    return data;
  }

  addDependencies(data: ReleaseData, dependencies: Dependency[]): ReleaseData {
    const existingKeys = new Set(data.dependencies.map(d => `${d.callerServiceId}-${d.calleeServiceId}`));
    for (const dep of dependencies) {
      const key = `${dep.callerServiceId}-${dep.calleeServiceId}`;
      if (!existingKeys.has(key)) {
        data.dependencies.push(dep);
      }
    }
    return data;
  }

  addMigrations(data: ReleaseData, migrations: DatabaseMigration[]): ReleaseData {
    const existingKeys = new Set(data.migrations.map(m => `${m.serviceId}-${m.scriptName}`));
    for (const migration of migrations) {
      const key = `${migration.serviceId}-${migration.scriptName}`;
      if (!existingKeys.has(key)) {
        data.migrations.push(migration);
      }
    }
    return data;
  }

  addSwitches(data: ReleaseData, switches: ConfigSwitch[]): ReleaseData {
    const existingKeys = new Set(data.switches.map(s => `${s.serviceId}-${s.key}`));
    for (const sw of switches) {
      const key = `${sw.serviceId}-${sw.key}`;
      if (!existingKeys.has(key)) {
        data.switches.push(sw);
      }
    }
    return data;
  }

  addContacts(data: ReleaseData, contacts: RollbackContact[]): ReleaseData {
    const existingKeys = new Set(data.contacts.map(c => `${c.serviceId}-${c.email}`));
    for (const contact of contacts) {
      const key = `${contact.serviceId}-${contact.email}`;
      if (!existingKeys.has(key)) {
        data.contacts.push(contact);
      }
    }
    return data;
  }

  addWaiver(data: ReleaseData, waiver: Waiver): ReleaseData {
    data.waivers.push(waiver);
    return data;
  }

  addCheckHistory(data: ReleaseData, history: CheckHistory): ReleaseData {
    data.checkHistory.push(history);
    return data;
  }

  addCorrection(data: ReleaseData, correction: ManualCorrection): ReleaseData {
    data.corrections.push(correction);
    return data;
  }

  getDataDir(): string {
    return this.dataDir;
  }

  getDataFile(): string {
    return this.dataFile;
  }
}
