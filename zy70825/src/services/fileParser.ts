import * as fs from 'fs';
import * as csv from 'csv-parser';
import { v4 as uuidv4 } from 'uuid';
import { ShipmentItem, Influencer } from '../types';

export class FileParserService {
  async parseShipmentCSV(filePath: string, batchId: string): Promise<ShipmentItem[]> {
    const results: ShipmentItem[] = [];
    const now = new Date().toISOString();

    return new Promise((resolve, reject) => {
      fs.createReadStream(filePath)
        .pipe(csv())
        .on('data', (data: any) => {
          const item: ShipmentItem = {
            id: uuidv4(),
            batchId,
            sampleId: data.sampleId || data['样品ID'] || '',
            sampleName: data.sampleName || data['样品名称'] || '',
            sampleBrand: data.sampleBrand || data['品牌'] || '',
            sampleValue: parseFloat(data.sampleValue || data['样品价值'] || '0'),
            influencerId: data.influencerId || data['达人ID'] || '',
            influencerName: data.influencerName || data['达人姓名'] || '',
            shipDate: data.shipDate || data['寄送日期'] || '',
            expectedReturnDate: data.expectedReturnDate || data['预计归还日期'] || '',
            actualReturnDate: data.actualReturnDate || data['实际归还日期'] || undefined,
            status: this.parseStatus(data.status || data['状态'] || 'shipped'),
            returnPhotos: data.returnPhotos ? data.returnPhotos.split(',') : undefined,
            damageDescription: data.damageDescription || data['损坏描述'] || undefined,
            createdAt: now,
            updatedAt: now
          };
          results.push(item);
        })
        .on('end', () => resolve(results))
        .on('error', reject);
    });
  }

  async parseInfluencerJSON(filePath: string): Promise<Map<string, Influencer>> {
    const content = await fs.promises.readFile(filePath, 'utf-8');
    const influencers: Influencer[] = JSON.parse(content);
    const map = new Map<string, Influencer>();
    
    influencers.forEach(inf => {
      map.set(inf.id, inf);
    });
    
    return map;
  }

  private parseStatus(status: string): ShipmentItem['status'] {
    const statusMap: Record<string, ShipmentItem['status']> = {
      'shipped': 'shipped',
      '已寄送': 'shipped',
      'returned': 'returned',
      '已归还': 'returned',
      'damaged': 'damaged',
      '损坏': 'damaged',
      'overdue': 'overdue',
      '超期': 'overdue'
    };
    return statusMap[status.toLowerCase()] || 'shipped';
  }
}
