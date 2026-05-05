-- Migration 0002: Add indexes
-- Mixed: some good, some missing CONCURRENTLY

-- Good: Using CONCURRENTLY for index creation
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_code_active 
ON promotions(code, is_active) 
WHERE is_active = TRUE;

-- Good: Using CONCURRENTLY
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_promotions_starts_at 
ON promotions(starts_at);

-- Bad: Missing CONCURRENTLY - will block writes
CREATE INDEX IF NOT EXISTS idx_coupon_usages_user_id 
ON coupon_usages(user_id);

-- Bad: Missing CONCURRENTLY
CREATE INDEX IF NOT EXISTS idx_orders_discount 
ON orders(total_amount);
