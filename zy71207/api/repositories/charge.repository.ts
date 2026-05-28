import { BaseRepository } from './base';
import { ChargeRecord } from '../../shared/types';
import { db } from '../db/init';

export class ChargeRepository extends BaseRepository<ChargeRecord> {
  protected tableName = 'charge_record';

  protected mapRow(row: Record<string, unknown>): ChargeRecord {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      productId: row.product_id as string,
      chargeDate: row.charge_date as string,
      shareAmount: row.share_amount as number,
      appliedRate: row.applied_rate as number,
      chargedAmount: row.charged_amount as number,
      rateVersionId: row.rate_version_id as string,
      promotionId: row.promotion_id as string | null,
    };
  }

  findByCustomerAndProduct(customerId: string, productId: string): ChargeRecord[] {
    const rows = db.prepare(`
      SELECT * FROM charge_record
      WHERE customer_id = ? AND product_id = ?
      ORDER BY charge_date DESC
    `).all(customerId, productId) as Record<string, unknown>[];
    return rows.map(row => this.mapRow(row));
  }

  findByCustomerId(customerId: string): ChargeRecord[] {
    return this.findByField('customer_id', customerId);
  }

  findByChargeDateRange(startDate: string, endDate: string): ChargeRecord[] {
    const rows = db.prepare(`
      SELECT * FROM charge_record
      WHERE charge_date >= ? AND charge_date <= ?
      ORDER BY charge_date DESC
    `).all(startDate, endDate) as Record<string, unknown>[];
    return rows.map(row => this.mapRow(row));
  }
}
