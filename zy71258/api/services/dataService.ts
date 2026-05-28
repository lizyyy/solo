import { v4 as uuidv4 } from 'uuid';
import { db, collections, type DatabaseSchema } from '../db/index.js';
import { NotFoundError, StateConstraintError } from '../middleware/validation.js';
import type { Gallery, LightSource, Artwork, SamplingData, Exhibition, Risk, ProtectionReport } from '../../src/types/index.js';

type CollectionName = typeof collections[keyof typeof collections];
type ResourceType = Gallery | LightSource | Artwork | SamplingData | Exhibition | Risk | ProtectionReport;

interface CrudOptions<T> {
  collection: CollectionName;
  resourceName: string;
  beforeCreate?: (data: T) => T | Promise<T>;
  beforeUpdate?: (existing: T, data: Partial<T>) => Partial<T> | Promise<Partial<T>>;
  beforeDelete?: (existing: T) => void | Promise<void>;
}

export class DataService {
  async getAll<T extends ResourceType>(collection: CollectionName): Promise<T[]> {
    const data = await db.getCollection(collection);
    return data as T[];
  }

  async getById<T extends ResourceType>(
    collection: CollectionName,
    id: string,
    resourceName: string
  ): Promise<T> {
    const data = await db.getCollection(collection);
    const item = (data as T[]).find(item => 'id' in item && item.id === id);
    if (!item) {
      throw new NotFoundError(`${resourceName}不存在`);
    }
    return item as T;
  }

  async create<T extends ResourceType>(
    collection: CollectionName,
    data: Omit<T, 'id' | 'createdAt'>,
    resourceName: string,
    options?: Partial<CrudOptions<T>>
  ): Promise<T> {
    const now = new Date().toISOString();
    let itemData = {
      ...data,
      id: uuidv4(),
      createdAt: now,
    } as T;

    if (options?.beforeCreate) {
      itemData = await options.beforeCreate(itemData);
    }

    await db.updateCollection(collection, (items) => {
      return [...(items as T[]), itemData] as DatabaseSchema[typeof collection];
    });

    return itemData;
  }

  async update<T extends ResourceType>(
    collection: CollectionName,
    id: string,
    data: Partial<T>,
    resourceName: string,
    options?: Partial<CrudOptions<T>>
  ): Promise<T> {
    const existing = await this.getById<T>(collection, id, resourceName);

    let updateData = { ...data } as Partial<T> & { lastModifiedAt?: string };
    if ('lastModifiedAt' in existing) {
      updateData.lastModifiedAt = new Date().toISOString();
    }

    if (options?.beforeUpdate) {
      updateData = await options.beforeUpdate(existing, updateData);
    }

    const updated = { ...existing, ...updateData } as T;

    await db.updateCollection(collection, (items) => {
      return (items as T[]).map(item =>
        'id' in item && item.id === id ? updated : item
      ) as DatabaseSchema[typeof collection];
    });

    return updated;
  }

  async delete<T extends ResourceType>(
    collection: CollectionName,
    id: string,
    resourceName: string,
    options?: Partial<CrudOptions<T>>
  ): Promise<void> {
    const existing = await this.getById<T>(collection, id, resourceName);

    if (options?.beforeDelete) {
      await options.beforeDelete(existing);
    }

    await db.updateCollection(collection, (items) => {
      return (items as T[]).filter(item =>
        !('id' in item) || item.id !== id
      ) as DatabaseSchema[typeof collection];
    });
  }

  async checkExhibitionModifiable(exhibition: Exhibition): Promise<void> {
    if (exhibition.status === 'ended') {
      throw new StateConstraintError('已结束的展期不允许修改');
    }
  }

  async checkRiskAcknowledgable(risk: Risk): Promise<void> {
    if (risk.status === 'acknowledged' || risk.status === 'resolved') {
      throw new StateConstraintError('已确认或已解决的风险不允许重复确认');
    }
  }

  async checkArtworkDeletable(artwork: Artwork): Promise<void> {
    if (artwork.exhibitionId) {
      const exhibitions = await db.getCollection('exhibitions');
      const exhibition = (exhibitions as Exhibition[]).find(e => e.id === artwork.exhibitionId);
      if (exhibition && exhibition.status === 'ongoing') {
        throw new StateConstraintError('展期中的作品不允许删除');
      }
    }
  }

  async findByField<T extends ResourceType>(
    collection: CollectionName,
    field: keyof T,
    value: T[keyof T]
  ): Promise<T[]> {
    const data = await db.getCollection(collection);
    return (data as T[]).filter(item => item[field] === value);
  }

  async exists(collection: CollectionName, id: string): Promise<boolean> {
    const data = await db.getCollection(collection);
    return (data as { id: string }[]).some(item => item.id === id);
  }

  async count(collection: CollectionName): Promise<number> {
    const data = await db.getCollection(collection);
    return (data as unknown[]).length;
  }
}

export const dataService = new DataService();
