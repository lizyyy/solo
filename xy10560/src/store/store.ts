import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import { 
  Store, 
  Certificate, 
  Domain, 
  ServiceDependency, 
  MaintenanceWindow, 
  ExecutionRecord,
  ActionType
} from '../types';

const DEFAULT_STORE_PATH = path.join(process.cwd(), '.cert-rotator', 'store.json');
const STORE_VERSION = '1.0.0';

export class DataStore {
  private storePath: string;
  private cache: Store | null = null;

  constructor(storePath?: string) {
    this.storePath = storePath || DEFAULT_STORE_PATH;
  }

  getStorePath(): string {
    return this.storePath;
  }

  private getStoreDir(): string {
    return path.dirname(this.storePath);
  }

  exists(): boolean {
    return fs.existsSync(this.storePath);
  }

  initialize(): Store {
    const dir = this.getStoreDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    const store: Store = {
      certificates: [],
      domains: [],
      dependencies: [],
      windows: [],
      executionRecords: [],
      version: STORE_VERSION,
      lastUpdated: new Date().toISOString()
    };

    this.save(store);
    this.cache = store;
    return store;
  }

  load(): Store {
    if (this.cache) {
      return this.cache;
    }

    if (!this.exists()) {
      throw new Error(`Store not found at ${this.storePath}. Please run 'init' first.`);
    }

    const content = fs.readFileSync(this.storePath, 'utf-8');
    const store = JSON.parse(content) as Store;
    this.cache = store;
    return store;
  }

  save(store: Store): void {
    store.lastUpdated = new Date().toISOString();
    const dir = this.getStoreDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(this.storePath, JSON.stringify(store, null, 2), 'utf-8');
    this.cache = store;
  }

  addCertificate(cert: Omit<Certificate, 'id' | 'createdAt' | 'updatedAt'>): Certificate {
    const store = this.load();
    const now = new Date().toISOString();
    const newCert: Certificate = {
      ...cert,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    store.certificates.push(newCert);
    this.save(store);
    return newCert;
  }

  updateCertificate(id: string, updates: Partial<Certificate>): Certificate | null {
    const store = this.load();
    const index = store.certificates.findIndex(c => c.id === id);
    if (index === -1) return null;

    store.certificates[index] = {
      ...store.certificates[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save(store);
    return store.certificates[index];
  }

  getCertificate(id: string): Certificate | undefined {
    const store = this.load();
    return store.certificates.find(c => c.id === id);
  }

  getCertificateBySerial(serial: string): Certificate | undefined {
    const store = this.load();
    return store.certificates.find(c => c.serialNumber === serial);
  }

  getCertificates(): Certificate[] {
    const store = this.load();
    return [...store.certificates];
  }

  addDomain(domain: Omit<Domain, 'id' | 'createdAt'>): Domain {
    const store = this.load();
    const newDomain: Domain = {
      ...domain,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    store.domains.push(newDomain);
    this.save(store);
    return newDomain;
  }

  getDomains(): Domain[] {
    const store = this.load();
    return [...store.domains];
  }

  getDomainsByCertificate(certId: string): Domain[] {
    const store = this.load();
    return store.domains.filter(d => d.certificateId === certId);
  }

  addDependency(dep: Omit<ServiceDependency, 'id' | 'createdAt' | 'updatedAt'>): ServiceDependency {
    const store = this.load();
    const now = new Date().toISOString();
    const newDep: ServiceDependency = {
      ...dep,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    store.dependencies.push(newDep);
    this.save(store);
    return newDep;
  }

  updateDependency(id: string, updates: Partial<ServiceDependency>): ServiceDependency | null {
    const store = this.load();
    const index = store.dependencies.findIndex(d => d.id === id);
    if (index === -1) return null;

    store.dependencies[index] = {
      ...store.dependencies[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    this.save(store);
    return store.dependencies[index];
  }

  getDependencies(): ServiceDependency[] {
    const store = this.load();
    return [...store.dependencies];
  }

  getDependenciesByService(serviceName: string, env?: string): ServiceDependency[] {
    const store = this.load();
    return store.dependencies.filter(d => 
      d.serviceName === serviceName && (!env || d.environment === env)
    );
  }

  getDependenciesByServiceNames(serviceNames: string[], env?: string): ServiceDependency[] {
    const store = this.load();
    return store.dependencies.filter(d => 
      serviceNames.some(s => d.serviceName === s || d.dependsOn.includes(s)) &&
      (!env || d.environment === env)
    );
  }

  addWindow(window: Omit<MaintenanceWindow, 'id' | 'createdAt' | 'status'>): MaintenanceWindow {
    const store = this.load();
    const newWindow: MaintenanceWindow = {
      ...window,
      id: uuidv4(),
      status: 'scheduled',
      createdAt: new Date().toISOString()
    };
    store.windows.push(newWindow);
    this.save(store);
    return newWindow;
  }

  getWindows(): MaintenanceWindow[] {
    const store = this.load();
    return [...store.windows];
  }

  getWindowsByCertificate(certId: string): MaintenanceWindow[] {
    const store = this.load();
    return store.windows.filter(w => w.affectedCertificates.includes(certId));
  }

  addExecutionRecord(record: Omit<ExecutionRecord, 'id'>): ExecutionRecord {
    const store = this.load();
    const newRecord: ExecutionRecord = {
      ...record,
      id: uuidv4()
    };
    store.executionRecords.push(newRecord);
    this.save(store);
    return newRecord;
  }

  getExecutionRecords(limit?: number, action?: ActionType): ExecutionRecord[] {
    const store = this.load();
    let records = [...store.executionRecords].sort(
      (a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()
    );

    if (action) {
      records = records.filter(r => r.action === action);
    }

    if (limit) {
      records = records.slice(0, limit);
    }

    return records;
  }

  getExecutionRecordsByIdempotencyKey(key: string): ExecutionRecord | undefined {
    const store = this.load();
    return store.executionRecords.find(r => r.idempotencyKey === key);
  }

  getExecutionRecordsByTarget(targetId: string): ExecutionRecord[] {
    const store = this.load();
    return store.executionRecords
      .filter(r => r.targetId === targetId)
      .sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime());
  }
}
