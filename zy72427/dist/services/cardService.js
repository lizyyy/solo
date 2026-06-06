"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CardService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
class CardService {
    createCard(playlistName, createdBy) {
        const now = new Date().toISOString();
        const card = {
            id: (0, uuid_1.v4)(),
            playlistName,
            createdBy,
            createdAt: now,
            updatedAt: now,
            status: 'DRAFT',
            currentVersion: 1,
            selfCheckResults: [],
        };
        (0, database_1.insertOne)('cards', card);
        this.createSnapshot(card, createdBy);
        return card;
    }
    getCard(cardId) {
        const row = (0, database_1.findOne)('cards', (c) => c.id === cardId);
        if (!row)
            return null;
        return row;
    }
    listCards() {
        return (0, database_1.findMany)('cards').sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    }
    updateCardStatus(cardId, status, updatedBy) {
        const card = this.getCard(cardId);
        if (!card)
            return null;
        const now = new Date().toISOString();
        const updated = (0, database_1.updateOne)('cards', (c) => c.id === cardId, { status, updatedAt: now, currentVersion: card.currentVersion + 1 });
        if (updated) {
            this.createSnapshot(updated, updatedBy);
        }
        return updated;
    }
    updateCardFields(cardId, fields) {
        const now = new Date().toISOString();
        const updated = (0, database_1.updateOne)('cards', (c) => c.id === cardId, { ...fields, updatedAt: now });
        return updated;
    }
    updateSelfCheckResults(cardId, results) {
        return this.updateCardFields(cardId, { selfCheckResults: results });
    }
    createSnapshot(card, createdBy) {
        const now = new Date().toISOString();
        const snapshot = {
            id: (0, uuid_1.v4)(),
            cardId: card.id,
            version: card.currentVersion,
            status: card.status,
            attendanceBatchId: card.attendanceBatchId,
            ticketBatchId: card.ticketBatchId,
            revenueVersion: card.revenueVersion,
            snapshotData: JSON.parse(JSON.stringify(card)),
            createdAt: now,
            createdBy,
        };
        (0, database_1.insertOne)('snapshots', snapshot);
        return snapshot;
    }
    getLatestSnapshot(cardId) {
        const snapshots = (0, database_1.findMany)('snapshots', (s) => s.cardId === cardId)
            .sort((a, b) => b.version - a.version);
        return snapshots[0] || null;
    }
    getSnapshotByVersion(cardId, version) {
        const snapshot = (0, database_1.findOne)('snapshots', (s) => s.cardId === cardId && s.version === version);
        return snapshot || null;
    }
}
exports.CardService = CardService;
