import * as fs from 'fs';
import * as path from 'path';
import {
  DeliveryOrder,
  ElevatorInfo,
  InstallationRecord,
  MissingPartRecord,
  RescheduleRecord,
  DamageCompensation,
  ProcessedData
} from '../types';

export class DataStore {
  private dataDir: string;
  private data: ProcessedData;

  constructor(dataDir: string = './data') {
    this.dataDir = path.resolve(dataDir);
    this.data = {
      orders: new Map(),
      elevators: new Map(),
      installations: new Map(),
      missingParts: new Map(),
      reschedules: new Map(),
      compensations: new Map()
    };
    this.ensureDataDirectory();
    this.loadFromDisk();
  }

  private ensureDataDirectory(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
  }

  private loadFromDisk(): void {
    const files = ['orders.json', 'elevators.json', 'installations.json', 'missingParts.json', 'reschedules.json', 'compensations.json'];
    
    for (const file of files) {
      const filePath = path.join(this.dataDir, file);
      if (fs.existsSync(filePath)) {
        try {
          const content = fs.readFileSync(filePath, 'utf-8');
          const parsed = JSON.parse(content);
          this.loadFromArray(file.replace('.json', ''), parsed);
        } catch (e) {
          console.error(`Error loading ${file}:`, e);
        }
      }
    }
  }

  private loadFromArray(type: string, array: any[]): void {
    switch (type) {
      case 'orders':
        array.forEach((item: DeliveryOrder) => this.data.orders.set(item.orderId, item));
        break;
      case 'elevators':
        array.forEach((item: ElevatorInfo) => this.data.elevators.set(item.orderId, item));
        break;
      case 'installations':
        array.forEach((item: InstallationRecord) => {
          const existing = this.data.installations.get(item.orderId) || [];
          existing.push(item);
          this.data.installations.set(item.orderId, existing);
        });
        break;
      case 'missingParts':
        array.forEach((item: MissingPartRecord) => {
          const existing = this.data.missingParts.get(item.orderId) || [];
          existing.push(item);
          this.data.missingParts.set(item.orderId, existing);
        });
        break;
      case 'reschedules':
        array.forEach((item: RescheduleRecord) => {
          const existing = this.data.reschedules.get(item.orderId) || [];
          existing.push(item);
          this.data.reschedules.set(item.orderId, existing);
        });
        break;
      case 'compensations':
        array.forEach((item: DamageCompensation) => {
          const existing = this.data.compensations.get(item.orderId) || [];
          existing.push(item);
          this.data.compensations.set(item.orderId, existing);
        });
        break;
    }
  }

  private saveToDisk(): void {
    fs.writeFileSync(
      path.join(this.dataDir, 'orders.json'),
      JSON.stringify(Array.from(this.data.orders.values()), null, 2)
    );
    fs.writeFileSync(
      path.join(this.dataDir, 'elevators.json'),
      JSON.stringify(Array.from(this.data.elevators.values()), null, 2)
    );
    fs.writeFileSync(
      path.join(this.dataDir, 'installations.json'),
      JSON.stringify(this.flattenMap(this.data.installations), null, 2)
    );
    fs.writeFileSync(
      path.join(this.dataDir, 'missingParts.json'),
      JSON.stringify(this.flattenMap(this.data.missingParts), null, 2)
    );
    fs.writeFileSync(
      path.join(this.dataDir, 'reschedules.json'),
      JSON.stringify(this.flattenMap(this.data.reschedules), null, 2)
    );
    fs.writeFileSync(
      path.join(this.dataDir, 'compensations.json'),
      JSON.stringify(this.flattenMap(this.data.compensations), null, 2)
    );
  }

  private flattenMap<T>(map: Map<string, T[]>): T[] {
    const result: T[] = [];
    for (const [, value] of map) {
      result.push(...value);
    }
    return result;
  }

  importOrder(order: DeliveryOrder): void {
    if (this.data.orders.has(order.orderId)) {
      throw new Error(`订单 ${order.orderId} 已存在，不能重复导入`);
    }
    this.data.orders.set(order.orderId, order);
    this.saveToDisk();
  }

  importOrders(orders: DeliveryOrder[]): { imported: number; errors: string[] } {
    const errors: string[] = [];
    let imported = 0;

    for (const order of orders) {
      try {
        this.importOrder(order);
        imported++;
      } catch (e: any) {
        errors.push(e.message);
      }
    }

    return { imported, errors };
  }

  importElevator(elevator: ElevatorInfo): void {
    this.data.elevators.set(elevator.orderId, elevator);
    this.saveToDisk();
  }

  importInstallation(installation: InstallationRecord): void {
    const existing = this.data.installations.get(installation.orderId) || [];
    existing.push(installation);
    this.data.installations.set(installation.orderId, existing);
    this.saveToDisk();
  }

  importMissingPart(missingPart: MissingPartRecord): void {
    const existing = this.data.missingParts.get(missingPart.orderId) || [];
    existing.push(missingPart);
    this.data.missingParts.set(missingPart.orderId, existing);
    this.saveToDisk();
  }

  importReschedule(reschedule: RescheduleRecord): void {
    const existing = this.data.reschedules.get(reschedule.orderId) || [];
    existing.push(reschedule);
    this.data.reschedules.set(reschedule.orderId, existing);
    this.saveToDisk();
  }

  importCompensation(compensation: DamageCompensation): void {
    const existingCompensations = this.data.compensations.get(compensation.orderId) || [];
    
    const isDuplicate = existingCompensations.some(
      c => c.itemId === compensation.itemId && 
           c.damageType === compensation.damageType &&
           c.status !== 'rejected'
    );

    if (isDuplicate) {
      throw new Error(`订单 ${compensation.orderId} 的商品 ${compensation.itemId} 已有相同类型的赔付记录，不能重复赔付`);
    }

    existingCompensations.push(compensation);
    this.data.compensations.set(compensation.orderId, existingCompensations);
    this.saveToDisk();
  }

  getOrder(orderId: string): DeliveryOrder | undefined {
    return this.data.orders.get(orderId);
  }

  getAllOrders(): DeliveryOrder[] {
    return Array.from(this.data.orders.values());
  }

  getElevator(orderId: string): ElevatorInfo | undefined {
    return this.data.elevators.get(orderId);
  }

  getInstallations(orderId: string): InstallationRecord[] {
    return this.data.installations.get(orderId) || [];
  }

  getMissingParts(orderId: string): MissingPartRecord[] {
    return this.data.missingParts.get(orderId) || [];
  }

  getReschedules(orderId: string): RescheduleRecord[] {
    return this.data.reschedules.get(orderId) || [];
  }

  getCompensations(orderId: string): DamageCompensation[] {
    return this.data.compensations.get(orderId) || [];
  }

  getAllCompensations(): DamageCompensation[] {
    return this.flattenMap(this.data.compensations);
  }

  getData(): ProcessedData {
    return this.data;
  }

  hasCompensation(orderId: string, itemId: string, damageType: string): boolean {
    const compensations = this.getCompensations(orderId);
    return compensations.some(
      c => c.itemId === itemId && 
           c.damageType === damageType &&
           c.status !== 'rejected'
    );
  }

  updateAbnormalityResolution(orderId: string, abnormalityType: string, resolution: string): void {
    console.log(`更新订单 ${orderId} 的异常 ${abnormalityType} 的处理状态: ${resolution}`);
  }
}
