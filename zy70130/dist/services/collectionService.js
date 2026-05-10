"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.collectionService = exports.CollectionService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const types_1 = require("../types");
class CollectionService {
    createCollection(name, ownerId) {
        const db = (0, database_1.getDatabase)();
        const now = Date.now();
        const collection = {
            id: (0, uuid_1.v4)(),
            name,
            ownerId,
            status: types_1.CollectionStatus.NORMAL,
            lastTransferTime: null,
            createdAt: now,
            updatedAt: now,
        };
        db.collections.set(collection.id, collection);
        return collection;
    }
    getCollection(id) {
        const db = (0, database_1.getDatabase)();
        return db.collections.get(id) || null;
    }
    updateOwner(collectionId, newOwnerId, transferTime) {
        const db = (0, database_1.getDatabase)();
        const collection = db.collections.get(collectionId);
        if (!collection) {
            throw new Error('藏品不存在');
        }
        const updated = {
            ...collection,
            ownerId: newOwnerId,
            lastTransferTime: transferTime,
            updatedAt: Date.now(),
        };
        db.collections.set(collectionId, updated);
        return updated;
    }
    updateStatus(collectionId, status) {
        const db = (0, database_1.getDatabase)();
        const collection = db.collections.get(collectionId);
        if (!collection) {
            throw new Error('藏品不存在');
        }
        const updated = {
            ...collection,
            status,
            updatedAt: Date.now(),
        };
        db.collections.set(collectionId, updated);
        return updated;
    }
    freezeCollection(collectionId) {
        return this.updateStatus(collectionId, types_1.CollectionStatus.FROZEN);
    }
    unfreezeCollection(collectionId) {
        return this.updateStatus(collectionId, types_1.CollectionStatus.NORMAL);
    }
    getCollectionsByOwner(ownerId) {
        const db = (0, database_1.getDatabase)();
        return Array.from(db.collections.values())
            .filter((c) => c.ownerId === ownerId)
            .sort((a, b) => b.createdAt - a.createdAt);
    }
}
exports.CollectionService = CollectionService;
exports.collectionService = new CollectionService();
//# sourceMappingURL=collectionService.js.map