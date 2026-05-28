import { BaseRepository } from './base';
import { PromotionPeriod } from '../../shared/types';
import { db } from '../db/init';

export class PromotionRepository extends BaseRepository<PromotionPeriod> {
  protected tableName = 'promotion_period';

  protected mapRow(row: Record<string, unknown>): PromotionPeriod {
    return {
      id: row.id as string,
      productId: row.product_id as string,
      customerId: row.customer_id as string | null,
      name: row.name as string,
      startDate: row.start_date as string,
      endDate: row.end_date as string,
      discountRate: row.discount_rate as number,
      status: row.status as 'active' | 'expired',
    };
  }

  findByProductId(productId: string): PromotionPeriod[] {
    return this.findByField('product_id', productId);
  }

  findApplicablePromotion(
    productId: string,
    customerId: string,
    date: string
  ): PromotionPeriod | null {
    const row = db.prepare(`
      SELECT * FROM promotion_period
      WHERE product_id = ?
        AND start_date <= ?
        AND end_date >= ?
        AND (customer_id IS NULL OR customer_id = ?)
      ORDER BY start_date DESC
      LIMIT 1
    `).get(productId, date, date, customerId) as Record<string, unknown> | undefined;
    return row ? this.mapRow(row) : null;
  }

  isDateInPromotion(promotion: PromotionPeriod, date: string): boolean {
    return date >= promotion.startDate && date <= promotion.endDate;
  }
}
