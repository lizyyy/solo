"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.billService = void 0;
const uuid_1 = require("uuid");
const database_1 = require("../database");
const event_store_1 = require("../event-store");
const conflict_service_1 = require("./conflict-service");
class BillService {
    async createBill(billData, userId, clientId, metadata) {
        const now = Date.now();
        const bill = {
            ...billData,
            id: (0, uuid_1.v4)(),
            createdAt: now,
            updatedAt: now,
            version: 1,
            deleted: false,
        };
        this.validateBillAmounts(bill);
        await event_store_1.eventStore.appendEvent(bill.id, 'bill', 'BILL_CREATED', { bill }, userId, clientId, 0, metadata);
        this.persistBill(bill);
        return bill;
    }
    async updateBill(billId, updates, userId, clientId, expectedVersion, metadata) {
        const existingBill = this.getBillById(billId);
        if (!existingBill) {
            throw new Error(`Bill ${billId} not found`);
        }
        const events = event_store_1.eventStore.getEventsByAggregate(billId);
        const currentVersion = events.length > 0
            ? events[events.length - 1].newVersion
            : 0;
        if (currentVersion !== expectedVersion) {
            const incomingEvent = {
                id: (0, uuid_1.v4)(),
                eventType: 'BILL_UPDATED',
                aggregateId: billId,
                aggregateType: 'bill',
                payload: updates,
                previousVersion: expectedVersion,
                newVersion: expectedVersion + 1,
                userId,
                timestamp: Date.now(),
                clientId,
                sequence: events.length + 1,
            };
            const conflicts = await conflict_service_1.conflictService.detectAllConflicts(billId, incomingEvent, events);
            if (conflicts.length > 0) {
                throw new event_store_1.VersionConflictError(billId, expectedVersion, currentVersion);
            }
        }
        const updatedBill = {
            ...existingBill,
            ...updates,
            updatedAt: Date.now(),
            version: currentVersion + 1,
        };
        this.validateBillAmounts(updatedBill);
        await event_store_1.eventStore.appendEvent(billId, 'bill', 'BILL_UPDATED', { updates }, userId, clientId, expectedVersion, metadata);
        this.updatePersistedBill(updatedBill);
        return updatedBill;
    }
    async deleteBill(billId, userId, clientId, expectedVersion, metadata) {
        const existingBill = this.getBillById(billId);
        if (!existingBill) {
            throw new Error(`Bill ${billId} not found`);
        }
        const events = event_store_1.eventStore.getEventsByAggregate(billId);
        const currentVersion = events.length > 0
            ? events[events.length - 1].newVersion
            : 0;
        if (currentVersion !== expectedVersion) {
            throw new event_store_1.VersionConflictError(billId, expectedVersion, currentVersion);
        }
        await event_store_1.eventStore.appendEvent(billId, 'bill', 'BILL_DELETED', { deletedAt: Date.now() }, userId, clientId, expectedVersion, metadata);
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      UPDATE bills SET deleted = 1, updated_at = ? WHERE id = ?
    `).run(Date.now(), billId);
    }
    getBillById(billId) {
        const db = (0, database_1.getDatabase)();
        const row = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId);
        return row ? this.deserializeBill(row) : null;
    }
    getBillsByGroup(groupId) {
        const db = (0, database_1.getDatabase)();
        const rows = db.prepare(`
      SELECT * FROM bills 
      WHERE group_id = ? AND deleted = 0 
      ORDER BY created_at DESC
    `).all(groupId);
        return rows.map(this.deserializeBill);
    }
    calculateBalances(groupId) {
        const bills = this.getBillsByGroup(groupId);
        const balances = new Map();
        for (const bill of bills) {
            for (const participant of bill.participants) {
                const currentBalance = balances.get(participant.userId) || 0;
                const effectiveShare = participant.adjustedShare !== undefined
                    ? participant.adjustedShare
                    : participant.share;
                balances.set(participant.userId, currentBalance + (participant.paid - effectiveShare));
            }
        }
        return balances;
    }
    calculateSettlementSuggestions(balances) {
        const debtors = [];
        const creditors = [];
        balances.forEach((amount, userId) => {
            if (amount < 0) {
                debtors.push({ userId, amount: -amount });
            }
            else if (amount > 0) {
                creditors.push({ userId, amount });
            }
        });
        debtors.sort((a, b) => b.amount - a.amount);
        creditors.sort((a, b) => b.amount - a.amount);
        const suggestions = [];
        let i = 0;
        let j = 0;
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const amount = Math.min(debtor.amount, creditor.amount);
            if (amount > 0.01) {
                suggestions.push({
                    from: debtor.userId,
                    to: creditor.userId,
                    amount: Math.round(amount * 100) / 100,
                });
            }
            debtor.amount -= amount;
            creditor.amount -= amount;
            if (debtor.amount < 0.01)
                i++;
            if (creditor.amount < 0.01)
                j++;
        }
        return suggestions;
    }
    validateBillAmounts(bill) {
        const totalShare = bill.participants.reduce((sum, p) => sum + (p.adjustedShare !== undefined ? p.adjustedShare : p.share), 0);
        const totalPaid = bill.participants.reduce((sum, p) => sum + p.paid, 0);
        if (Math.abs(totalShare - bill.amount) > 0.01) {
            throw new Error(`Total share (${totalShare}) does not match bill amount (${bill.amount})`);
        }
        if (Math.abs(totalPaid - bill.amount) > 0.01) {
            throw new Error(`Total paid (${totalPaid}) does not match bill amount (${bill.amount})`);
        }
    }
    persistBill(bill) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      INSERT INTO bills (
        id, group_id, title, description, amount, currency,
        created_by, created_at, updated_at, version, participants, tags, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(bill.id, bill.groupId, bill.title, bill.description || null, bill.amount, bill.currency, bill.createdBy, bill.createdAt, bill.updatedAt, bill.version, JSON.stringify(bill.participants), bill.tags ? JSON.stringify(bill.tags) : null, bill.deleted ? 1 : 0);
    }
    updatePersistedBill(bill) {
        const db = (0, database_1.getDatabase)();
        db.prepare(`
      UPDATE bills SET
        title = ?, description = ?, amount = ?, currency = ?,
        updated_at = ?, version = ?, participants = ?, tags = ?, deleted = ?
      WHERE id = ?
    `).run(bill.title, bill.description || null, bill.amount, bill.currency, bill.updatedAt, bill.version, JSON.stringify(bill.participants), bill.tags ? JSON.stringify(bill.tags) : null, bill.deleted ? 1 : 0, bill.id);
    }
    deserializeBill(row) {
        return {
            id: row.id,
            groupId: row.group_id,
            title: row.title,
            description: row.description || undefined,
            amount: row.amount,
            currency: row.currency,
            createdBy: row.created_by,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            version: row.version,
            participants: JSON.parse(row.participants),
            tags: row.tags ? JSON.parse(row.tags) : undefined,
            deleted: row.deleted === 1,
        };
    }
}
exports.billService = new BillService();
