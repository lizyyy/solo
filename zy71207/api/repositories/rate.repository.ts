import { BaseRepository } from './base';
import { RateVersion } from '../../shared/types';
import { db } from '../db/init';

export class RateRepository extends BaseRepository<RateVersion> {
  protected tableName = 'rate_version';

  protected mapRow(row: Record<string, unknown>): RateVersion {
    return {
      id: row.id as string,
      productId: row.product_id as string,
      version: row.version as string,
      effectiveDate: row.effective_date as string,
      managementFeeRate: row.management_fee_rate as number,
      serviceFeeRate: row.service_fee_rate as number,
      description: row.description as string,
    };
  }

  findByProductId(productId: string): RateVersion[] {
    return this.findByField('product_id', productId);
  }

  findActiveRate(productId: string, date: string): RateVersion | null {
    const row = db.prepare(`
      SELECT * FROM rate_version
      WHERE product_id = ?
        AND effective_date <= ?
      ORDER BY effective_date DESC
      LIMIT 1
    `).get(productId, date) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  findByProductAndVersion(productId: string, version: string): RateVersion | null {
    const row = db.prepare(`
      SELECT * FROM rate_version
      WHERE product_id = ? AND version = ?
      LIMIT 1
    `).get(productId, version) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }
}
