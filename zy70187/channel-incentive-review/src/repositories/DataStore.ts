import { v4 as uuidv4 } from 'uuid';
import { BaseEntity } from '../models/types';
import { TargetSnapshot } from '../models/TargetSnapshot';
import { AchievementRecord } from '../models/AchievementRecord';
import { ProtectionPeriod } from '../models/ProtectionPeriod';
import { CrossRegionAssignment } from '../models/CrossRegionAssignment';
import { Dispute } from '../models/Dispute';
import { IncentiveDetail } from '../models/IncentiveDetail';

interface IRepository<T extends BaseEntity> {
  create(entity: Omit<T, keyof BaseEntity>): T;
  findById(id: string): T | undefined;
  findAll(): T[];
  update(id: string, updates: Partial<T>): T | undefined;
  delete(id: string): boolean;
  findByCriteria(criteria: Partial<T>): T[];
}

class MemoryRepository<T extends BaseEntity> implements IRepository<T> {
  private entities: Map<string, T> = new Map();

  create(entityData: Omit<T, keyof BaseEntity>): T {
    const now = new Date();
    const entity: T = {
      ...entityData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      version: 1
    } as unknown as T;
    this.entities.set(entity.id, entity);
    return entity;
  }

  findById(id: string): T | undefined {
    return this.entities.get(id);
  }

  findAll(): T[] {
    return Array.from(this.entities.values());
  }

  update(id: string, updates: Partial<T>): T | undefined {
    const entity = this.entities.get(id);
    if (!entity) return undefined;
    
    const updatedEntity: T = {
      ...entity,
      ...updates,
      updatedAt: new Date(),
      version: entity.version + 1
    } as T;
    
    this.entities.set(id, updatedEntity);
    return updatedEntity;
  }

  delete(id: string): boolean {
    return this.entities.delete(id);
  }

  findByCriteria(criteria: Partial<T>): T[] {
    return Array.from(this.entities.values()).filter(entity => {
      return Object.entries(criteria).every(([key, value]) => {
        return entity[key as keyof T] === value;
      });
    });
  }
}

export class DataStore {
  private static instance: DataStore;
  
  public readonly targetSnapshots: MemoryRepository<TargetSnapshot>;
  public readonly achievementRecords: MemoryRepository<AchievementRecord>;
  public readonly protectionPeriods: MemoryRepository<ProtectionPeriod>;
  public readonly crossRegionAssignments: MemoryRepository<CrossRegionAssignment>;
  public readonly disputes: MemoryRepository<Dispute>;
  public readonly incentiveDetails: MemoryRepository<IncentiveDetail>;

  private constructor() {
    this.targetSnapshots = new MemoryRepository<TargetSnapshot>();
    this.achievementRecords = new MemoryRepository<AchievementRecord>();
    this.protectionPeriods = new MemoryRepository<ProtectionPeriod>();
    this.crossRegionAssignments = new MemoryRepository<CrossRegionAssignment>();
    this.disputes = new MemoryRepository<Dispute>();
    this.incentiveDetails = new MemoryRepository<IncentiveDetail>();
  }

  public static getInstance(): DataStore {
    if (!DataStore.instance) {
      DataStore.instance = new DataStore();
    }
    return DataStore.instance;
  }

  public reset(): void {
    DataStore.instance = new DataStore();
  }
}

export const dataStore = DataStore.getInstance();
