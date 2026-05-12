import * as fs from 'fs';
import * as path from 'path';
import {
  Asset,
  AcquisitionRecord,
  TransferRecord,
  RepairRecord,
  ScrapRecord,
  Store,
  DepreciationPeriod,
  DepreciationDetail,
  AssetHistory,
  CorrectionRecord,
  SystemState,
  ImportData
} from '../types';

export class FileStorage {
  private dataDir: string;
  private initialized = false;

  private assetsFile: string;
  private acquisitionsFile: string;
  private transfersFile: string;
  private repairsFile: string;
  private scrapsFile: string;
  private storesFile: string;
  private periodsFile: string;
  private depreciationDetailsFile: string;
  private historyFile: string;
  private correctionsFile: string;
  private stateFile: string;

  constructor(dataDir: string) {
    this.dataDir = dataDir;
    this.assetsFile = path.join(dataDir, 'assets.json');
    this.acquisitionsFile = path.join(dataDir, 'acquisitions.json');
    this.transfersFile = path.join(dataDir, 'transfers.json');
    this.repairsFile = path.join(dataDir, 'repairs.json');
    this.scrapsFile = path.join(dataDir, 'scraps.json');
    this.storesFile = path.join(dataDir, 'stores.json');
    this.periodsFile = path.join(dataDir, 'periods.json');
    this.depreciationDetailsFile = path.join(dataDir, 'depreciation-details.json');
    this.historyFile = path.join(dataDir, 'history.json');
    this.correctionsFile = path.join(dataDir, 'corrections.json');
    this.stateFile = path.join(dataDir, 'state.json');
  }

  async initialize(): Promise<void> {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }

    if (!fs.existsSync(this.stateFile)) {
      const state: SystemState = {
        initialized: true,
        initializedAt: new Date().toISOString(),
        lastCheckAt: null,
        dataDirectory: this.dataDir,
        importVersion: 0
      };
      await this.saveState(state);
    }

    const initFiles = [
      { file: this.assetsFile, data: [] as Asset[] },
      { file: this.acquisitionsFile, data: [] as AcquisitionRecord[] },
      { file: this.transfersFile, data: [] as TransferRecord[] },
      { file: this.repairsFile, data: [] as RepairRecord[] },
      { file: this.scrapsFile, data: [] as ScrapRecord[] },
      { file: this.storesFile, data: [] as Store[] },
      { file: this.periodsFile, data: [] as DepreciationPeriod[] },
      { file: this.depreciationDetailsFile, data: [] as DepreciationDetail[] },
      { file: this.historyFile, data: [] as AssetHistory[] },
      { file: this.correctionsFile, data: [] as CorrectionRecord[] },
    ];

    for (const item of initFiles) {
      if (!fs.existsSync(item.file)) {
        await this.writeFile(item.file, item.data);
      }
    }

    this.initialized = true;
  }

  isInitialized(): boolean {
    return this.initialized && fs.existsSync(this.stateFile);
  }

  getDataDir(): string {
    return this.dataDir;
  }

  private async readFile<T>(filePath: string): Promise<T> {
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content) as T;
  }

  private async writeFile<T>(filePath: string, data: T): Promise<void> {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf-8');
  }

  async getState(): Promise<SystemState> {
    if (!fs.existsSync(this.stateFile)) {
      return {
        initialized: false,
        initializedAt: null,
        lastCheckAt: null,
        dataDirectory: this.dataDir,
        importVersion: 0
      };
    }
    return this.readFile<SystemState>(this.stateFile);
  }

  async saveState(state: SystemState): Promise<void> {
    await this.writeFile(this.stateFile, state);
  }

  async getStores(): Promise<Store[]> {
    return this.readFile<Store[]>(this.storesFile);
  }

  async saveStores(stores: Store[]): Promise<void> {
    await this.writeFile(this.storesFile, stores);
  }

  async getAssets(): Promise<Asset[]> {
    return this.readFile<Asset[]>(this.assetsFile);
  }

  async saveAssets(assets: Asset[]): Promise<void> {
    await this.writeFile(this.assetsFile, assets);
  }

  async getAcquisitions(): Promise<AcquisitionRecord[]> {
    return this.readFile<AcquisitionRecord[]>(this.acquisitionsFile);
  }

  async saveAcquisitions(records: AcquisitionRecord[]): Promise<void> {
    await this.writeFile(this.acquisitionsFile, records);
  }

  async getTransfers(): Promise<TransferRecord[]> {
    return this.readFile<TransferRecord[]>(this.transfersFile);
  }

  async saveTransfers(records: TransferRecord[]): Promise<void> {
    await this.writeFile(this.transfersFile, records);
  }

  async getRepairs(): Promise<RepairRecord[]> {
    return this.readFile<RepairRecord[]>(this.repairsFile);
  }

  async saveRepairs(records: RepairRecord[]): Promise<void> {
    await this.writeFile(this.repairsFile, records);
  }

  async getScraps(): Promise<ScrapRecord[]> {
    return this.readFile<ScrapRecord[]>(this.scrapsFile);
  }

  async saveScraps(records: ScrapRecord[]): Promise<void> {
    await this.writeFile(this.scrapsFile, records);
  }

  async getPeriods(): Promise<DepreciationPeriod[]> {
    return this.readFile<DepreciationPeriod[]>(this.periodsFile);
  }

  async savePeriods(periods: DepreciationPeriod[]): Promise<void> {
    await this.writeFile(this.periodsFile, periods);
  }

  async getDepreciationDetails(): Promise<DepreciationDetail[]> {
    return this.readFile<DepreciationDetail[]>(this.depreciationDetailsFile);
  }

  async saveDepreciationDetails(details: DepreciationDetail[]): Promise<void> {
    await this.writeFile(this.depreciationDetailsFile, details);
  }

  async getHistory(): Promise<AssetHistory[]> {
    return this.readFile<AssetHistory[]>(this.historyFile);
  }

  async saveHistory(history: AssetHistory[]): Promise<void> {
    await this.writeFile(this.historyFile, history);
  }

  async getCorrections(): Promise<CorrectionRecord[]> {
    return this.readFile<CorrectionRecord[]>(this.correctionsFile);
  }

  async saveCorrections(corrections: CorrectionRecord[]): Promise<void> {
    await this.writeFile(this.correctionsFile, corrections);
  }

  async importAll(data: ImportData, importVersion: number): Promise<void> {
    await this.saveStores(data.stores);
    await this.saveAssets(data.assets);
    await this.saveAcquisitions(data.acquisitions);
    await this.saveTransfers(data.transfers);
    await this.saveRepairs(data.repairs);
    await this.saveScraps(data.scraps);

    const state = await this.getState();
    state.importVersion = importVersion;
    await this.saveState(state);
  }

  async clearAll(): Promise<void> {
    await this.initialize();
    const state = await this.getState();
    state.importVersion = 0;
    state.lastCheckAt = null;
    await this.saveState(state);
  }
}
