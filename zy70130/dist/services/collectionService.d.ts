import { Collection, CollectionStatus } from '../types';
export declare class CollectionService {
    createCollection(name: string, ownerId: string): Collection;
    getCollection(id: string): Collection | null;
    updateOwner(collectionId: string, newOwnerId: string, transferTime: number): Collection;
    updateStatus(collectionId: string, status: CollectionStatus): Collection;
    freezeCollection(collectionId: string): Collection;
    unfreezeCollection(collectionId: string): Collection;
    getCollectionsByOwner(ownerId: string): Collection[];
}
export declare const collectionService: CollectionService;
