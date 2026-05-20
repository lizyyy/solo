import * as fs from 'fs-extra';
import * as path from 'path';
import { ShipmentItem, Influencer, ProcessingResult, UploadBatch, ReportDetail } from '../types';

export class DataStoreService {
  private dataDir: string;
  private shipmentsDir: string;
  private influencersDir: string;
  private resultsDir: string;
  private batchesDir: string;
  private photosDir: string;

  constructor() {
    this.dataDir = path.join(process.cwd(), 'data');
    this.shipmentsDir = path.join(this.dataDir, 'shipments');
    this.influencersDir = path.join(this.dataDir, 'influencers');
    this.resultsDir = path.join(this.dataDir, 'results');
    this.batchesDir = path.join(this.dataDir, 'batches');
    this.photosDir = path.join(this.dataDir, 'photos');
    
    this.initializeDirectories();
  }

  private async initializeDirectories(): Promise<void> {
    await fs.ensureDir(this.dataDir);
    await fs.ensureDir(this.shipmentsDir);
    await fs.ensureDir(this.influencersDir);
    await fs.ensureDir(this.resultsDir);
    await fs.ensureDir(this.batchesDir);
    await fs.ensureDir(this.photosDir);
  }

  generateItemHash(item: Partial<ShipmentItem>): string {
    const key = `${item.sampleId}-${item.influencerId}-${item.shipDate}`;
    return Buffer.from(key).toString('base64');
  }

  async isBatchProcessed(fileName: string): Promise<boolean> {
    const batchFile = path.join(this.batchesDir, `${fileName}.json`);
    return await fs.pathExists(batchFile);
  }

  async saveBatch(batch: UploadBatch): Promise<void> {
    const batchFile = path.join(this.batchesDir, `${batch.fileName}.json`);
    await fs.writeJson(batchFile, batch);
  }

  async getBatches(): Promise<UploadBatch[]> {
    const files = await fs.readdir(this.batchesDir);
    const batches: UploadBatch[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const batch = await fs.readJson(path.join(this.batchesDir, file));
        batches.push(batch);
      }
    }
    
    return batches.sort((a, b) => new Date(b.uploadTime).getTime() - new Date(a.uploadTime).getTime());
  }

  async saveShipments(items: ShipmentItem[]): Promise<void> {
    for (const item of items) {
      const shipmentFile = path.join(this.shipmentsDir, `${item.id}.json`);
      await fs.writeJson(shipmentFile, item);
    }
  }

  async getAllShipments(): Promise<ShipmentItem[]> {
    const files = await fs.readdir(this.shipmentsDir);
    const shipments: ShipmentItem[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const shipment = await fs.readJson(path.join(this.shipmentsDir, file));
        shipments.push(shipment);
      }
    }
    
    return shipments;
  }

  async getShipmentById(id: string): Promise<ShipmentItem | null> {
    const shipmentFile = path.join(this.shipmentsDir, `${id}.json`);
    if (await fs.pathExists(shipmentFile)) {
      return await fs.readJson(shipmentFile);
    }
    return null;
  }

  async saveInfluencers(influencers: Map<string, Influencer>): Promise<void> {
    for (const [id, influencer] of influencers) {
      const influencerFile = path.join(this.influencersDir, `${id}.json`);
      await fs.writeJson(influencerFile, influencer);
    }
  }

  async getInfluencers(): Promise<Map<string, Influencer>> {
    const files = await fs.readdir(this.influencersDir);
    const influencers = new Map<string, Influencer>();
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const influencer = await fs.readJson(path.join(this.influencersDir, file));
        influencers.set(influencer.id, influencer);
      }
    }
    
    return influencers;
  }

  async getInfluencerById(id: string): Promise<Influencer | null> {
    const influencerFile = path.join(this.influencersDir, `${id}.json`);
    if (await fs.pathExists(influencerFile)) {
      return await fs.readJson(influencerFile);
    }
    return null;
  }

  async saveProcessingResult(result: ProcessingResult): Promise<void> {
    const resultFile = path.join(this.resultsDir, `${result.batchId}.json`);
    await fs.writeJson(resultFile, result);
  }

  async getProcessingResults(): Promise<ProcessingResult[]> {
    const files = await fs.readdir(this.resultsDir);
    const results: ProcessingResult[] = [];
    
    for (const file of files) {
      if (file.endsWith('.json')) {
        const result = await fs.readJson(path.join(this.resultsDir, file));
        results.push(result);
      }
    }
    
    return results;
  }

  async getProcessingResultById(batchId: string): Promise<ProcessingResult | null> {
    const resultFile = path.join(this.resultsDir, `${batchId}.json`);
    if (await fs.pathExists(resultFile)) {
      return await fs.readJson(resultFile);
    }
    return null;
  }

  async getReportDetail(shipmentId: string): Promise<ReportDetail | null> {
    const shipment = await this.getShipmentById(shipmentId);
    if (!shipment) {
      return null;
    }

    const influencer = await this.getInfluencerById(shipment.influencerId);
    const results = await this.getProcessingResults();
    
    let issues: string[] = [];
    let suggestions: string[] = [];
    let finalStatus: any = 'normal';

    for (const result of results) {
      const allItems = [...result.normalItems, ...result.pendingItems, ...result.failedItems];
      const processed = allItems.find(p => p.original.id === shipmentId);
      if (processed) {
        issues = processed.issues;
        suggestions = processed.suggestions;
        finalStatus = processed.status;
        break;
      }
    }

    return {
      shipmentId: shipment.id,
      batchId: shipment.batchId,
      sampleInfo: {
        id: shipment.sampleId,
        name: shipment.sampleName,
        brand: shipment.sampleBrand,
        value: shipment.sampleValue
      },
      influencerInfo: {
        id: shipment.influencerId,
        name: shipment.influencerName,
        platform: influencer?.platform || '未知'
      },
      timeline: {
        shipDate: shipment.shipDate,
        expectedReturnDate: shipment.expectedReturnDate,
        actualReturnDate: shipment.actualReturnDate
      },
      issues,
      suggestions,
      finalStatus,
      photos: shipment.returnPhotos
    };
  }

  async savePhoto(fileName: string, buffer: Buffer): Promise<string> {
    const photoPath = path.join(this.photosDir, fileName);
    await fs.writeFile(photoPath, buffer);
    return `/photos/${fileName}`;
  }
}
