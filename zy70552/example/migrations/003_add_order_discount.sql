-- UP
ALTER TABLE orders ADD COLUMN discount DECIMAL(10,2) DEFAULT 0.00;
UPDATE orders SET discount = total * 0.1 WHERE total > 100;

-- ROLLBACK
ALTER TABLE orders DROP COLUMN discount;
