import { BaseRepository } from './base';
import { ProductContract } from '../../shared/types';
import { db } from '../db/init';

export class ContractRepository extends BaseRepository<ProductContract> {
  protected tableName = 'product_contract';

  protected mapRow(row: Record<string, unknown>): ProductContract {
    return {
      id: row.id as string,
      productId: row.product_id as string,
      productName: row.product_name as string,
      version: row.version as string,
      effectiveDate: row.effective_date as string,
      expireDate: row.expire_date as string | null,
      baseRate: row.base_rate as number,
      createdAt: row.created_at as string,
    };
  }

  findByProductId(productId: string): ProductContract[] {
    return this.findByField('product_id', productId);
  }

  findActiveContract(productId: string, date: string): ProductContract | null {
    const row = db.prepare(`
      SELECT * FROM product_contract
      WHERE product_id = ?
        AND effective_date <= ?
        AND (expire_date IS NULL OR expire_date >= ?)
      ORDER BY effective_date DESC
      LIMIT 1
    `).get(productId, date, date) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }
}
