import { v4 as uuidv4 } from 'uuid';
import { Bill, Participant } from '../types';
import { getDatabase } from '../database';
import { eventStore, VersionConflictError } from '../event-store';
import { conflictService } from './conflict-service';

class BillService {
  async createBill(
    billData: Omit<Bill, 'id' | 'createdAt' | 'updatedAt' | 'version' | 'deleted'>,
    userId: string,
    clientId: string,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<Bill> {
    if (metadata?.correlationId) {
      const existingBill = this.findBillByCorrelationId(metadata.correlationId);
      if (existingBill) {
        return existingBill;
      }
    }

    const now = Date.now();
    const bill: Bill = {
      ...billData,
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      version: 1,
      deleted: false,
    };

    this.validateBillAmounts(bill);

    await eventStore.appendEvent(
      bill.id,
      'bill',
      'BILL_CREATED',
      { bill },
      userId,
      clientId,
      0,
      metadata
    );

    this.persistBill(bill);
    return bill;
  }

  private findBillByCorrelationId(correlationId: string): Bill | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT events.aggregate_id as bill_id
      FROM events 
      WHERE correlation_id = ? 
        AND event_type = 'BILL_CREATED'
    `).get(correlationId) as { bill_id: string } | undefined;

    if (row?.bill_id) {
      return this.getBillById(row.bill_id);
    }
    return null;
  }

  async updateBill(
    billId: string,
    updates: Partial<Bill>,
    userId: string,
    clientId: string,
    expectedVersion: number,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<Bill> {
    if (metadata?.correlationId) {
      const existingUpdate = this.findUpdateByCorrelationId(metadata.correlationId);
      if (existingUpdate) {
        const bill = this.getBillById(billId);
        if (bill) return bill;
      }
    }

    const existingBill = this.getBillById(billId);
    if (!existingBill) {
      throw new Error(`Bill ${billId} not found`);
    }

    const events = eventStore.getEventsByAggregate(billId);
    const currentVersion = events.length > 0 
      ? events[events.length - 1].newVersion 
      : 0;

    if (currentVersion !== expectedVersion) {
      const incomingEvent = {
        id: uuidv4(),
        eventType: 'BILL_UPDATED' as const,
        aggregateId: billId,
        aggregateType: 'bill' as const,
        payload: updates,
        previousVersion: expectedVersion,
        newVersion: expectedVersion + 1,
        userId,
        timestamp: Date.now(),
        clientId,
        sequence: events.length + 1,
      };

      const conflicts = await conflictService.detectAllConflicts(billId, incomingEvent, events);
      
      if (conflicts.length > 0) {
        throw new VersionConflictError(
          billId,
          expectedVersion,
          currentVersion
        );
      }
    }

    const updatedBill: Bill = {
      ...existingBill,
      ...updates,
      updatedAt: Date.now(),
      version: currentVersion + 1,
    };

    this.validateBillAmounts(updatedBill);

    await eventStore.appendEvent(
      billId,
      'bill',
      'BILL_UPDATED',
      { updates },
      userId,
      clientId,
      expectedVersion,
      metadata
    );

    this.updatePersistedBill(updatedBill);
    return updatedBill;
  }

  private findUpdateByCorrelationId(correlationId: string): { billId: string } | null {
    const db = getDatabase();
    const row = db.prepare(`
      SELECT aggregate_id as bill_id
      FROM events 
      WHERE correlation_id = ? 
        AND event_type = 'BILL_UPDATED'
    `).get(correlationId) as { bill_id: string } | undefined;

    if (row?.bill_id) {
      return { billId: row.bill_id };
    }
    return null;
  }

  async deleteBill(
    billId: string,
    userId: string,
    clientId: string,
    expectedVersion: number,
    metadata?: { ipAddress?: string; userAgent?: string; correlationId?: string }
  ): Promise<void> {
    const existingBill = this.getBillById(billId);
    if (!existingBill) {
      throw new Error(`Bill ${billId} not found`);
    }

    if (existingBill.deleted) {
      return;
    }

    const events = eventStore.getEventsByAggregate(billId);
    const currentVersion = events.length > 0 
      ? events[events.length - 1].newVersion 
      : 0;

    if (currentVersion !== expectedVersion) {
      throw new VersionConflictError(billId, expectedVersion, currentVersion);
    }

    await eventStore.appendEvent(
      billId,
      'bill',
      'BILL_DELETED',
      { deletedAt: Date.now() },
      userId,
      clientId,
      expectedVersion,
      metadata
    );

    const db = getDatabase();
    db.prepare(`
      UPDATE bills SET deleted = 1, updated_at = ? WHERE id = ?
    `).run(Date.now(), billId);
  }

  getBillById(billId: string): Bill | null {
    const db = getDatabase();
    const row = db.prepare(`SELECT * FROM bills WHERE id = ?`).get(billId) as any | undefined;
    return row ? this.deserializeBill(row) : null;
  }

  getBillsByGroup(groupId: string): Bill[] {
    const db = getDatabase();
    const rows = db.prepare(`
      SELECT * FROM bills 
      WHERE group_id = ? AND deleted = 0 
      ORDER BY created_at DESC
    `).all(groupId) as any[];
    return rows.map(this.deserializeBill);
  }

  calculateBalances(groupId: string): Map<string, number> {
    const bills = this.getBillsByGroup(groupId);
    const balances = new Map<string, number>();

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

  calculateSettlementSuggestions(balances: Map<string, number>): Array<{ from: string; to: string; amount: number }> {
    const debtors: Array<{ userId: string; amount: number }> = [];
    const creditors: Array<{ userId: string; amount: number }> = [];

    balances.forEach((amount, userId) => {
      if (amount < 0) {
        debtors.push({ userId, amount: -amount });
      } else if (amount > 0) {
        creditors.push({ userId, amount });
      }
    });

    debtors.sort((a, b) => b.amount - a.amount);
    creditors.sort((a, b) => b.amount - a.amount);

    const suggestions: Array<{ from: string; to: string; amount: number }> = [];
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

      if (debtor.amount < 0.01) i++;
      if (creditor.amount < 0.01) j++;
    }

    return suggestions;
  }

  private validateBillAmounts(bill: Bill): void {
    const totalShare = bill.participants.reduce(
      (sum, p) => sum + (p.adjustedShare !== undefined ? p.adjustedShare : p.share),
      0
    );

    const totalPaid = bill.participants.reduce((sum, p) => sum + p.paid, 0);

    if (Math.abs(totalShare - bill.amount) > 0.01) {
      throw new Error(`Total share (${totalShare}) does not match bill amount (${bill.amount})`);
    }

    if (Math.abs(totalPaid - bill.amount) > 0.01) {
      throw new Error(`Total paid (${totalPaid}) does not match bill amount (${bill.amount})`);
    }
  }

  private persistBill(bill: Bill): void {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO bills (
        id, group_id, title, description, amount, currency,
        created_by, created_at, updated_at, version, participants, tags, deleted
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      bill.id,
      bill.groupId,
      bill.title,
      bill.description || null,
      bill.amount,
      bill.currency,
      bill.createdBy,
      bill.createdAt,
      bill.updatedAt,
      bill.version,
      JSON.stringify(bill.participants),
      bill.tags ? JSON.stringify(bill.tags) : null,
      bill.deleted ? 1 : 0
    );
  }

  private updatePersistedBill(bill: Bill): void {
    const db = getDatabase();
    db.prepare(`
      UPDATE bills SET
        title = ?, description = ?, amount = ?, currency = ?,
        updated_at = ?, version = ?, participants = ?, tags = ?, deleted = ?
      WHERE id = ?
    `).run(
      bill.title,
      bill.description || null,
      bill.amount,
      bill.currency,
      bill.updatedAt,
      bill.version,
      JSON.stringify(bill.participants),
      bill.tags ? JSON.stringify(bill.tags) : null,
      bill.deleted ? 1 : 0,
      bill.id
    );
  }

  private deserializeBill(row: any): Bill {
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

export const billService = new BillService();
