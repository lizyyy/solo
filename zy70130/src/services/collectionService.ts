import { v4 as uuidv4 } from 'uuid';
import { getDatabase } from '../database';
import { Collection, CollectionStatus } from '../types';

export class CollectionService {
  createCollection(name: string, ownerId: string): Collection {
    const db = getDatabase();
    const now = Date.now();
    const collection: Collection = {
      id: uuidv4(),
      name,
      ownerId,
      status: CollectionStatus.NORMAL,
      lastTransferTime: null,
      createdAt: now,
      updatedAt: now,
    };

    db.collections.set(collection.id, collection);
    return collection;
  }

  getCollection(id: string): Collection | null {
    const db = getDatabase();
    return db.collections.get(id) || null;
  }

  updateOwner(collectionId: string, newOwnerId: string, transferTime: number): Collection {
    const db = getDatabase();
    const collection = db.collections.get(collectionId);
    if (!collection) {
      throw new Error('藏品不存在');
    }

    const updated: Collection = {
      ...collection,
      ownerId: newOwnerId,
      lastTransferTime: transferTime,
      updatedAt: Date.now(),
    };
    db.collections.set(collectionId, updated);
    return updated;
  }

  updateStatus(collectionId: string, status: CollectionStatus): Collection {
    const db = getDatabase();
    const collection = db.collections.get(collectionId);
    if (!collection) {
      throw new Error('藏品不存在');
    }

    const updated: Collection = {
      ...collection,
      status,
      updatedAt: Date.now(),
    };
    db.collections.set(collectionId, updated);
    return updated;
  }

  freezeCollection(collectionId: string): Collection {
    return this.updateStatus(collectionId, CollectionStatus.FROZEN);
  }

  unfreezeCollection(collectionId: string): Collection {
    return this.updateStatus(collectionId, CollectionStatus.NORMAL);
  }

  getCollectionsByOwner(ownerId: string): Collection[] {
    const db = getDatabase();
    return Array.from(db.collections.values())
      .filter((c) => c.ownerId === ownerId)
      .sort((a, b) => b.createdAt - a.createdAt);
  }
}

export const collectionService = new CollectionService();
