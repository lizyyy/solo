import * as fs from 'fs';
import * as path from 'path';
import csvParser from 'csv-parser';
import { Influencer, Shipment, ShipmentItem, SampleStatus, generateId } from './types';

export class ImportService {
  async parseShipmentCSV(filePath: string): Promise<Shipment[]> {
    const results: any[] = [];
    const shipments: Map<string, Shipment> = new Map();

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csvParser())
        .on('data', (data) => results.push(data))
        .on('end', () => {
          try {
            results.forEach(row => {
              const shipmentId = row.shipmentId || generateId();
              
              if (!shipments.has(shipmentId)) {
                const shipment: Shipment = {
                  id: shipmentId,
                  batchCode: row.batchCode,
                  batchName: row.batchName,
                  brand: row.brand,
                  influencerId: row.influencerId,
                  influencerName: row.influencerName,
                  shipDate: row.shipDate,
                  dueDate: row.dueDate,
                  returnDate: row.returnDate || undefined,
                  status: this.parseStatus(row.status),
                  items: [],
                  totalValue: 0,
                  photoProof: row.photoProof ? row.photoProof.split(';') : undefined,
                  notes: row.notes || undefined
                };
                shipments.set(shipmentId, shipment);
              }

              const shipment = shipments.get(shipmentId)!;
              const itemValue = parseFloat(row.unitValue) * parseInt(row.quantity);
              const item: ShipmentItem = {
                id: generateId(),
                shipmentId: shipmentId,
                sampleCode: row.sampleCode,
                sampleName: row.sampleName,
                quantity: parseInt(row.quantity),
                unitValue: parseFloat(row.unitValue),
                totalValue: itemValue
              };
              shipment.items.push(item);
              shipment.totalValue += itemValue;
            });

            resolve(Array.from(shipments.values()));
          } catch (error) {
            reject(error);
          }
        })
        .on('error', reject);
    });
  }

  async parseInfluencerJSON(filePath: string): Promise<Influencer[]> {
    const content = fs.readFileSync(filePath, 'utf-8');
    const data = JSON.parse(content);
    return data.map((item: any) => ({
      id: item.id || generateId(),
      name: item.name,
      platform: item.platform,
      followers: item.followers,
      contact: item.contact,
      depositAmount: item.depositAmount || 0
    }));
  }

  private parseStatus(status: string): SampleStatus {
    const statusMap: Record<string, SampleStatus> = {
      'pending': SampleStatus.PENDING,
      'shipped': SampleStatus.SHIPPED,
      'returned': SampleStatus.RETURNED,
      'damaged': SampleStatus.DAMAGED,
      'lost': SampleStatus.LOST,
      'overdue': SampleStatus.OVERDUE
    };
    return statusMap[status?.toLowerCase()] || SampleStatus.PENDING;
  }

  async loadSampleData(): Promise<{ shipments: Shipment[], influencers: Influencer[] }> {
    const sampleDir = path.join(__dirname, '../sample-data');
    
    if (!fs.existsSync(sampleDir)) {
      fs.mkdirSync(sampleDir, { recursive: true });
    }

    const csvPath = path.join(sampleDir, 'shipments.csv');
    const jsonPath = path.join(sampleDir, 'influencers.json');

    if (!fs.existsSync(csvPath) || !fs.existsSync(jsonPath)) {
      await this.createSampleData(csvPath, jsonPath);
    }

    const shipments = await this.parseShipmentCSV(csvPath);
    const influencers = await this.parseInfluencerJSON(jsonPath);

    return { shipments, influencers };
  }

  private async createSampleData(csvPath: string, jsonPath: string): Promise<void> {
    const csvContent = `shipmentId,batchCode,batchName,brand,influencerId,influencerName,sampleCode,sampleName,quantity,unitValue,shipDate,dueDate,returnDate,status,photoProof,notes
ship001,BATCH2024Q1,2024春季新品,美妆品牌X,inf001,张美妆,SKU001,口红A,1,199,2024-03-01,2024-03-15,2024-03-14,returned,photo1.jpg,完好归还
ship001,BATCH2024Q1,2024春季新品,美妆品牌X,inf001,张美妆,SKU002,眼影盘B,1,299,2024-03-01,2024-03-15,2024-03-14,returned,photo1.jpg,完好归还
ship002,BATCH2024Q1,2024春季新品,美妆品牌X,inf002,李穿搭,SKU001,口红A,1,199,2024-03-05,2024-03-20,,shipped,,
ship003,BATCH2024Q1,2024春季新品,美妆品牌X,inf003,王护肤,SKU003,精华液C,2,399,2024-03-02,2024-03-16,2024-03-18,damaged,photo2.jpg;photo3.jpg,瓶身破损
ship004,BATCH2024Q1,2024春季新品,美妆品牌X,inf001,张美妆,SKU001,口红A,1,199,2024-03-10,2024-03-25,,shipped,,重复寄送
ship005,BATCH2024Q1,2024春季新品,美妆品牌X,inf004,赵时尚,SKU004,香水D,1,599,2024-02-20,2024-03-06,,overdue,,超期未还`;

    const jsonContent = JSON.stringify([
      {
        id: "inf001",
        name: "张美妆",
        platform: "抖音",
        followers: 1500000,
        contact: "zhang@example.com",
        depositAmount: 1000
      },
      {
        id: "inf002",
        name: "李穿搭",
        platform: "小红书",
        followers: 800000,
        contact: "li@example.com",
        depositAmount: 800
      },
      {
        id: "inf003",
        name: "王护肤",
        platform: "B站",
        followers: 2000000,
        contact: "wang@example.com",
        depositAmount: 1500
      },
      {
        id: "inf004",
        name: "赵时尚",
        platform: "微博",
        followers: 3000000,
        contact: "zhao@example.com",
        depositAmount: 2000
      }
    ], null, 2);

    fs.writeFileSync(csvPath, csvContent);
    fs.writeFileSync(jsonPath, jsonContent);
  }
}
