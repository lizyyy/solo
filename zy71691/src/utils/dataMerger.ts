import type { ContainerSlot, Crane, Truck } from '@/types';

interface DataRecord {
  id: string;
  lastUpdated: Date;
  dataSource: string;
}

class DataMerger<T extends DataRecord> {
  private records: Map<string, T> = new Map();
  private sourceTimestamps: Map<string, Date> = new Map();

  merge(newRecords: T[], sourceName: string): T[] {
    const now = new Date();
    this.sourceTimestamps.set(sourceName, now);

    for (const record of newRecords) {
      const existing = this.records.get(record.id);
      
      if (!existing) {
        this.records.set(record.id, { ...record, dataSource: sourceName });
      } else {
        const existingDate = new Date(existing.lastUpdated);
        const newDate = new Date(record.lastUpdated);
        
        if (newDate >= existingDate) {
          this.records.set(record.id, {
            ...existing,
            ...record,
            dataSource: sourceName,
          });
        }
      }
    }

    return Array.from(this.records.values());
  }

  getRecords(): T[] {
    return Array.from(this.records.values());
  }

  getRecord(id: string): T | undefined {
    return this.records.get(id);
  }

  getSourceInfo(): { name: string; lastImport: Date }[] {
    return Array.from(this.sourceTimestamps.entries()).map(([name, lastImport]) => ({
      name,
      lastImport,
    }));
  }

  clear() {
    this.records.clear();
    this.sourceTimestamps.clear();
  }
}

export const slotMerger = new DataMerger<ContainerSlot>();
export const craneMerger = new DataMerger<Crane>();
export const truckMerger = new DataMerger<Truck>();

export function mergeSlotData(newSlots: ContainerSlot[], sourceName: string): ContainerSlot[] {
  return slotMerger.merge(newSlots, sourceName);
}

export function mergeCraneData(newCranes: Crane[], sourceName: string): Crane[] {
  return craneMerger.merge(newCranes, sourceName);
}

export function mergeTruckData(newTrucks: Truck[], sourceName: string): Truck[] {
  return truckMerger.merge(newTrucks, sourceName);
}

export function getDataSourcesInfo(): { name: string; lastImport: Date; recordCount: number }[] {
  const slotSources = slotMerger.getSourceInfo();
  const craneSources = craneMerger.getSourceInfo();
  const truckSources = truckMerger.getSourceInfo();
  
  const allSources = [...slotSources, ...craneSources, ...truckSources];
  
  const uniqueSources = new Map<string, { name: string; lastImport: Date; recordCount: number }>();
  
  for (const source of allSources) {
    const existing = uniqueSources.get(source.name);
    if (!existing || source.lastImport > existing.lastImport) {
      uniqueSources.set(source.name, {
        name: source.name,
        lastImport: source.lastImport,
        recordCount: 0,
      });
    }
  }
  
  return Array.from(uniqueSources.values());
}
