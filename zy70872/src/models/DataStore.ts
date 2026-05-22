import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Showtime, BoxOffice, Contract, ProcessingRecord, Batch, RecordStatus } from '../types';

interface PersistedData {
  showtimes: Showtime[];
  boxOffices: BoxOffice[];
  contracts: Contract[];
  records: ProcessingRecord[];
  batches: Batch[];
}

export class DataStore {
  private static instance: DataStore;
  
  private showtimes: Map<string, Showtime> = new Map();
  private boxOffices: Map<string, BoxOffice> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private records: Map<string, ProcessingRecord> = new Map();
  private batches: Map<string, Batch> = new Map();

  private readonly dataDir: string;
  private readonly dataFile: string;
  private autoSave: boolean = true;

  private constructor() {
    this.dataDir = path.resolve(process.cwd(), 'data');
    this.dataFile = path.join(this.dataDir, 'cinema-data.json');
    this.ensureDataDirectory();
    this.loadFromDisk();
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadFromDisk(): void {
    try {
      if (fs.existsSync(this.dataFile)) {
        const data = fs.readFileSync(this.dataFile, 'utf8');
        const persisted: PersistedData = JSON.parse(data);
        
        this.showtimes = new Map(persisted.showtimes?.map(s => [s.id, s]) || []);
        this.boxOffices = new Map(persisted.boxOffices?.map(b => [b.id, b]) || []);
        this.contracts = new Map(persisted.contracts?.map(c => [c.id, c]) || []);
        this.records = new Map(persisted.records?.map(r => [r.id, r]) || []);
        this.batches = new Map(persisted.batches?.map(b => [b.id, b]) || []);
        
        console.log(`[DataStore] 已从磁盘加载数据: ${this.batches.size} 个批次, ${this.records.size} 条记录`);
      }
    } catch (error) {
      console.error('[DataStore] 加载数据失败:', error);
    }
  }

  private saveToDisk(): void {
    if (!this.autoSave) return;
    
    try {
      const data: PersistedData = {
        showtimes: Array.from(this.showtimes.values()),
        boxOffices: Array.from(this.boxOffices.values()),
        contracts: Array.from(this.contracts.values()),
        records: Array.from(this.records.values()),
        batches: Array.from(this.batches.values())
      };
      
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('[DataStore] 保存数据失败:', error);
    }
  }

  public setAutoSave(enabled: boolean): void {
    this.autoSave = enabled;
  }

  public forceSave(): void {
    this.saveToDisk();
  }

  public createBatch(name: string, createdBy: string, settlementPeriod?: string): Batch {
    const batch: Batch = {
      id: uuidv4(),
      name,
      status: RecordStatus.PENDING,
      showtimeCount: 0,
      boxOfficeCount: 0,
      recordCount: 0,
      createdAt: new Date().toISOString(),
      createdBy,
      settlementPeriod
    };
    this.batches.set(batch.id, batch);
    this.saveToDisk();
    return batch;
  }

  public getBatch(id: string): Batch | undefined {
    return this.batches.get(id);
  }

  public updateBatch(id: string, updates: Partial<Batch>): Batch | undefined {
    const batch = this.batches.get(id);
    if (!batch) return undefined;
    const updated = { ...batch, ...updates };
    this.batches.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  public listBatches(): Batch[] {
    return Array.from(this.batches.values());
  }

  public addShowtime(showtime: Omit<Showtime, 'id'>): Showtime {
    const id = uuidv4();
    const st: Showtime = { ...showtime, id };
    this.showtimes.set(id, st);
    this.saveToDisk();
    return st;
  }

  public getShowtime(id: string): Showtime | undefined {
    return this.showtimes.get(id);
  }

  public getShowtimesByBatch(batchId: string): Showtime[] {
    return Array.from(this.showtimes.values()).filter(s => s.batchId === batchId);
  }

  public addBoxOffice(boxOffice: Omit<BoxOffice, 'id'>): BoxOffice {
    const id = uuidv4();
    const bo: BoxOffice = { ...boxOffice, id };
    this.boxOffices.set(id, bo);
    this.saveToDisk();
    return bo;
  }

  public getBoxOffice(id: string): BoxOffice | undefined {
    return this.boxOffices.get(id);
  }

  public getBoxOfficesByBatch(batchId: string): BoxOffice[] {
    return Array.from(this.boxOffices.values()).filter(b => b.batchId === batchId);
  }

  public addContract(contract: Omit<Contract, 'id' | 'createdAt'>): Contract {
    const c: Contract = {
      ...contract,
      id: uuidv4(),
      createdAt: new Date().toISOString()
    };
    this.contracts.set(c.id, c);
    this.saveToDisk();
    return c;
  }

  public getContract(id: string): Contract | undefined {
    return this.contracts.get(id);
  }

  public getContractByFilm(filmName: string, date: string): Contract | undefined {
    return Array.from(this.contracts.values()).find(
      c => c.filmName === filmName && 
           c.effectiveStartDate <= date && 
           c.effectiveEndDate >= date
    );
  }

  public listContracts(): Contract[] {
    return Array.from(this.contracts.values());
  }

  public createRecord(record: Omit<ProcessingRecord, 'id' | 'createdAt' | 'updatedAt'>): ProcessingRecord {
    const now = new Date().toISOString();
    const r: ProcessingRecord = {
      ...record,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now
    };
    this.records.set(r.id, r);
    this.saveToDisk();
    return r;
  }

  public updateRecord(id: string, updates: Partial<ProcessingRecord>): ProcessingRecord | undefined {
    const record = this.records.get(id);
    if (!record) return undefined;
    const updated = { 
      ...record, 
      ...updates, 
      updatedAt: new Date().toISOString() 
    };
    this.records.set(id, updated);
    this.saveToDisk();
    return updated;
  }

  public getRecord(id: string): ProcessingRecord | undefined {
    return this.records.get(id);
  }

  public getRecordsByBatch(batchId: string): ProcessingRecord[] {
    return Array.from(this.records.values()).filter(r => r.batchId === batchId);
  }

  public queryRecords(params: {
    filmName?: string;
    hallName?: string;
    settlementPeriod?: string;
    startDate?: string;
    endDate?: string;
    status?: RecordStatus;
    contractId?: string;
    minSeats?: number;
    maxSeats?: number;
  }): ProcessingRecord[] {
    let results = Array.from(this.records.values());

    if (params.filmName) {
      results = results.filter(r => r.filmName.includes(params.filmName!));
    }
    if (params.hallName) {
      results = results.filter(r => r.hallName === params.hallName);
    }
    if (params.status) {
      results = results.filter(r => r.status === params.status);
    }
    if (params.contractId) {
      results = results.filter(r => r.contractId === params.contractId);
    }
    if (params.startDate) {
      results = results.filter(r => r.date >= params.startDate!);
    }
    if (params.endDate) {
      results = results.filter(r => r.date <= params.endDate!);
    }
    if (params.settlementPeriod) {
      results = results.filter(r => {
        const batch = this.batches.get(r.batchId);
        return batch?.settlementPeriod === params.settlementPeriod;
      });
    }
    if (params.minSeats !== undefined || params.maxSeats !== undefined) {
      results = results.filter(r => {
        const showtime = this.showtimes.get(r.showtimeId);
        if (!showtime) return false;
        if (params.minSeats !== undefined && showtime.seats < params.minSeats) return false;
        if (params.maxSeats !== undefined && showtime.seats > params.maxSeats) return false;
        return true;
      });
    }

    return results;
  }

  public clearAll(): void {
    this.showtimes.clear();
    this.boxOffices.clear();
    this.contracts.clear();
    this.records.clear();
    this.batches.clear();
    this.saveToDisk();
  }

  public getDataFilePath(): string {
    return this.dataFile;
  }
}
