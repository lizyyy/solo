import { BaseRepository } from './base';
import { CustomerShare } from '../../shared/types';
import { db } from '../db/init';

export class ShareRepository extends BaseRepository<CustomerShare> {
  protected tableName = 'customer_share';

  protected mapRow(row: Record<string, unknown>): CustomerShare {
    return {
      id: row.id as string,
      customerId: row.customer_id as string,
      customerName: row.customer_name as string,
      productId: row.product_id as string,
      shareAmount: row.share_amount as number,
      purchaseDate: row.purchase_date as string,
      contractId: row.contract_id as string,
    };
  }

  findByCustomerAndProduct(customerId: string, productId: string): CustomerShare | null {
    const row = db.prepare(`
      SELECT * FROM customer_share
      WHERE customer_id = ? AND product_id = ?
      LIMIT 1
    `).get(customerId, productId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByCustomerId(customerId: string): CustomerShare[] {
    return this.findByField('customer_id', customerId);
  }
}
