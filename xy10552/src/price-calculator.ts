import { getDb } from './database';
import { Promotion, Product } from './types';
import crypto from 'crypto';

export function generateHash(data: string): string {
  return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
}

export function getEffectivePromotions(
  sku: string, 
  checkTime: string
): Promotion[] {
  const db = getDb();
  
  const promotions = db.prepare(`
    SELECT * FROM promotions 
    WHERE sku = ? 
    AND datetime(effective_from) <= datetime(?)
    AND datetime(effective_to) >= datetime(?)
    ORDER BY priority DESC, effective_from ASC
  `).all(sku, checkTime, checkTime) as Promotion[];
  
  return promotions;
}

export function getStorePrice(
  storeId: string,
  sku: string,
  checkTime: string
): number | null {
  const db = getDb();
  
  const result = db.prepare(`
    SELECT price FROM store_prices 
    WHERE store_id = ? 
    AND sku = ?
    AND (effective_from IS NULL OR datetime(effective_from) <= datetime(?))
    AND (effective_to IS NULL OR datetime(effective_to) >= datetime(?))
    ORDER BY effective_from DESC
    LIMIT 1
  `).get(storeId, sku, checkTime, checkTime) as { price: number } | undefined;
  
  return result ? result.price : null;
}

export function getBasePrice(sku: string): number {
  const db = getDb();
  
  const product = db.prepare(`
    SELECT base_price FROM products WHERE sku = ?
  `).get(sku) as { base_price: number } | undefined;
  
  if (!product) {
    throw new Error(`商品 ${sku} 不存在`);
  }
  
  return product.base_price;
}

export function calculateSystemPrice(
  sku: string,
  storeId: string,
  checkTime: string
): {
  price: number;
  basePrice: number;
  storePrice?: number;
  effectivePromotion?: Promotion;
  allPromotions: Promotion[];
} {
  const basePrice = getBasePrice(sku);
  const storePrice = getStorePrice(storeId, sku, checkTime);
  const allPromotions = getEffectivePromotions(sku, checkTime);
  
  let price = storePrice !== null ? storePrice : basePrice;
  let effectivePromotion: Promotion | undefined;
  
  if (allPromotions.length > 0) {
    effectivePromotion = allPromotions[0];
    
    switch (effectivePromotion.promotion_type) {
      case 'FIXED_PRICE':
        price = effectivePromotion.discount_value;
        break;
      case 'DISCOUNT_AMOUNT':
        price = Math.max(0, price - effectivePromotion.discount_value);
        break;
      case 'DISCOUNT_PERCENT':
        price = price * (1 - effectivePromotion.discount_value / 100);
        price = Math.round(price * 100) / 100;
        break;
      default:
        break;
    }
  }
  
  return {
    price,
    basePrice,
    storePrice: storePrice !== null ? storePrice : undefined,
    effectivePromotion,
    allPromotions
  };
}

export function isPromotionExpired(
  promotion: Promotion,
  checkTime: string
): boolean {
  return new Date(promotion.effective_to) < new Date(checkTime);
}

export function isPromotionActive(
  promotion: Promotion,
  checkTime: string
): boolean {
  const startTime = new Date(promotion.effective_from);
  const endTime = new Date(promotion.effective_to);
  const check = new Date(checkTime);
  return startTime <= check && check <= endTime;
}
