import fs from 'fs';
import path from 'path';
import { Invoice, HistoryRecord, ValidationResult, ImportResult } from '../types/invoice';
import { generateId, formatDate } from '../utils/helpers';

interface DatabaseSchema {
  version: string;
  createdAt: string;
  lastUpdatedAt: string;
  history: HistoryRecord[];
  invoices: Invoice[];
}

const DB_VERSION = '1.0.0';
const DEFAULT_DATA_DIR = path.join(process.cwd(), 'data');
const DB_FILE_NAME = 'invoice-db.json';

function getDefaultDataDir(): string {
  return DEFAULT_DATA_DIR;
}

function ensureDataDir(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function initializeDatabase(): DatabaseSchema {
  return {
    version: DB_VERSION,
    createdAt: new Date().toISOString(),
    lastUpdatedAt: new Date().toISOString(),
    history: [],
    invoices: []
  };
}

export class StorageService {
  private dataDir: string;
  private dbPath: string;
  private db: DatabaseSchema;
  private isLoaded: boolean;

  constructor(dataDir?: string) {
    this.dataDir = dataDir || getDefaultDataDir();
    this.dbPath = path.join(this.dataDir, DB_FILE_NAME);
    this.db = initializeDatabase();
    this.isLoaded = false;
  }

  async init(): Promise<void> {
    if (this.isLoaded) return;
    
    ensureDataDir(this.dataDir);
    
    if (fs.existsSync(this.dbPath)) {
      try {
        const fileContent = fs.readFileSync(this.dbPath, 'utf8');
        this.db = JSON.parse(fileContent);
        this.migrateIfNeeded();
      } catch (error) {
        console.warn(`数据库文件损坏，将重新初始化: ${error}`);
        this.db = initializeDatabase();
      }
    } else {
      this.db = initializeDatabase();
      this.save();
    }
    
    this.isLoaded = true;
  }

  private migrateIfNeeded(): void {
    if (!this.db.version) {
      this.db.version = '1.0.0';
    }
    
    if (!this.db.history) {
      this.db.history = [];
    }
    
    if (!this.db.invoices) {
      this.db.invoices = [];
    }
    
    this.db.lastUpdatedAt = new Date().toISOString();
  }

  private save(): void {
    this.db.lastUpdatedAt = new Date().toISOString();
    const content = JSON.stringify(this.db, null, 2);
    fs.writeFileSync(this.dbPath, content, 'utf8');
  }

  async addHistory(
    importResult: ImportResult,
    validationResult: ValidationResult,
    fileName: string
  ): Promise<HistoryRecord> {
    await this.init();
    
    const record: HistoryRecord = {
      id: generateId(),
      batchId: importResult.batchId,
      importTime: new Date(),
      fileName,
      totalRecords: importResult.totalRecords,
      validRecords: validationResult.validInvoices,
      invalidRecords: validationResult.invalidInvoices,
      validationResult,
      invoices: importResult.invoices
    };

    this.db.history.push(record);
    
    for (const invoice of importResult.invoices) {
      const existingIndex = this.db.invoices.findIndex(
        inv => inv.invoiceCode === invoice.invoiceCode && 
               inv.invoiceNumber === invoice.invoiceNumber
      );
      
      if (existingIndex !== -1) {
        this.db.invoices[existingIndex] = invoice;
      } else {
        this.db.invoices.push(invoice);
      }
    }

    this.save();
    return record;
  }

  async getHistory(batchId?: string): Promise<HistoryRecord[]> {
    await this.init();
    
    if (batchId) {
      return this.db.history.filter(h => h.batchId === batchId);
    }
    
    return this.db.history;
  }

  async getHistoryById(id: string): Promise<HistoryRecord | undefined> {
    await this.init();
    return this.db.history.find(h => h.id === id);
  }

  async getHistoryByBatchId(batchId: string): Promise<HistoryRecord | undefined> {
    await this.init();
    return this.db.history.find(h => h.batchId === batchId);
  }

  async getAllInvoices(): Promise<Invoice[]> {
    await this.init();
    return this.db.invoices;
  }

  async getInvoiceByCodeAndNumber(
    invoiceCode: string,
    invoiceNumber: string
  ): Promise<Invoice | undefined> {
    await this.init();
    return this.db.invoices.find(
      inv => inv.invoiceCode === invoiceCode && 
             inv.invoiceNumber === invoiceNumber
    );
  }

  async getInvoicesByBatchId(batchId: string): Promise<Invoice[]> {
    await this.init();
    return this.db.invoices.filter(inv => inv.importBatchId === batchId);
  }

  async deleteHistory(batchId: string): Promise<boolean> {
    await this.init();
    
    const historyIndex = this.db.history.findIndex(h => h.batchId === batchId);
    if (historyIndex === -1) {
      return false;
    }

    this.db.history.splice(historyIndex, 1);
    
    this.db.invoices = this.db.invoices.filter(
      inv => inv.importBatchId !== batchId
    );
    
    this.save();
    return true;
  }

  async clearAllData(): Promise<void> {
    await this.init();
    this.db = initializeDatabase();
    this.save();
  }

  async getStats(): Promise<{
    totalHistoryRecords: number;
    totalInvoices: number;
    databaseSize: number;
    lastUpdatedAt: string;
  }> {
    await this.init();
    
    let databaseSize = 0;
    if (fs.existsSync(this.dbPath)) {
      const stats = fs.statSync(this.dbPath);
      databaseSize = stats.size;
    }

    return {
      totalHistoryRecords: this.db.history.length,
      totalInvoices: this.db.invoices.length,
      databaseSize,
      lastUpdatedAt: formatDate(this.db.lastUpdatedAt)
    };
  }

  getDatabasePath(): string {
    return this.dbPath;
  }

  getDataDir(): string {
    return this.dataDir;
  }
}

let storageServiceInstance: StorageService | null = null;

export function getStorageService(dataDir?: string): StorageService {
  if (!storageServiceInstance) {
    storageServiceInstance = new StorageService(dataDir);
  }
  return storageServiceInstance;
}
