"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateHash = generateHash;
exports.getEffectivePromotions = getEffectivePromotions;
exports.getStorePrice = getStorePrice;
exports.getBasePrice = getBasePrice;
exports.calculateSystemPrice = calculateSystemPrice;
exports.isPromotionExpired = isPromotionExpired;
exports.isPromotionActive = isPromotionActive;
const database_1 = require("./database");
const crypto_1 = __importDefault(require("crypto"));
function generateHash(data) {
    return crypto_1.default.createHash('sha256').update(data).digest('hex').substring(0, 16);
}
function getEffectivePromotions(sku, checkTime) {
    const db = (0, database_1.getDb)();
    const promotions = db.prepare(`
    SELECT * FROM promotions 
    WHERE sku = ? 
    AND datetime(effective_from) <= datetime(?)
    AND datetime(effective_to) >= datetime(?)
    ORDER BY priority DESC, effective_from ASC
  `).all(sku, checkTime, checkTime);
    return promotions;
}
function getStorePrice(storeId, sku, checkTime) {
    const db = (0, database_1.getDb)();
    const result = db.prepare(`
    SELECT price FROM store_prices 
    WHERE store_id = ? 
    AND sku = ?
    AND (effective_from IS NULL OR datetime(effective_from) <= datetime(?))
    AND (effective_to IS NULL OR datetime(effective_to) >= datetime(?))
    ORDER BY effective_from DESC
    LIMIT 1
  `).get(storeId, sku, checkTime, checkTime);
    return result ? result.price : null;
}
function getBasePrice(sku) {
    const db = (0, database_1.getDb)();
    const product = db.prepare(`
    SELECT base_price FROM products WHERE sku = ?
  `).get(sku);
    if (!product) {
        throw new Error(`商品 ${sku} 不存在`);
    }
    return product.base_price;
}
function calculateSystemPrice(sku, storeId, checkTime) {
    const basePrice = getBasePrice(sku);
    const storePrice = getStorePrice(storeId, sku, checkTime);
    const allPromotions = getEffectivePromotions(sku, checkTime);
    let price = storePrice !== null ? storePrice : basePrice;
    let effectivePromotion;
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
function isPromotionExpired(promotion, checkTime) {
    return new Date(promotion.effective_to) < new Date(checkTime);
}
function isPromotionActive(promotion, checkTime) {
    const startTime = new Date(promotion.effective_from);
    const endTime = new Date(promotion.effective_to);
    const check = new Date(checkTime);
    return startTime <= check && check <= endTime;
}
