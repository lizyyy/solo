import { v4 as uuidv4 } from 'uuid';
import { Showtime, BoxOffice, Contract, ProcessingRecord, Batch, RecordStatus } from '../types';

export class DataStore {
  private static instance: DataStore;
  
  private showtimes: Map<string, Showtime> = new Map();
  private boxOffices: Map<string, BoxOffice> = new Map();
  private contracts: Map<string, Contract> = new Map();
  private records: Map<string, ProcessingRecord> = new Map();
  private batches: Map<string, Batch> = new Map();

  private constructor() {}

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
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
    return updated;
  }

  public listBatches(): Batch[] {
    return Array.from(this.batches.values());
  }

  public addShowtime(showtime: Omit<Showtime, 'id'>): Showtime {
    const id = uuidv4();
    const st: Showtime = { ...showtime, id };
    this.showtimes.set(id, st);
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

    return results;
  }

  public clearAll(): void {
    this.showtimes.clear();
    this.boxOffices.clear();
    this.contracts.clear();
    this.records.clear();
    this.batches.clear();
  }
}
