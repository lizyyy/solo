-- SQL Snippets for Archive Operation
-- Generated at: 2026-05-13T10:51:09.134185
-- Report type: dry_run


-- ========================================
-- Partition: partition_COMPLETED
-- Operation: SELECT (Archive)
-- Estimated rows: 91
-- Parameters: {'value': 'COMPLETED'}
-- ========================================
SELECT * FROM orders WHERE status = :value AND (order_date < '2023-01-01')


-- ========================================
-- Partition: partition_COMPLETED
-- Operation: DELETE (Cleanup)
-- Estimated rows: 91
-- Parameters: {'value': 'COMPLETED'}
-- ========================================
DELETE FROM orders WHERE status = :value AND (order_date < '2023-01-01')


-- ========================================
-- Partition: partition_CANCELLED
-- Operation: SELECT (Archive)
-- Estimated rows: 78
-- Parameters: {'value': 'CANCELLED'}
-- ========================================
SELECT * FROM orders WHERE status = :value AND (order_date < '2023-01-01')


-- ========================================
-- Partition: partition_CANCELLED
-- Operation: DELETE (Cleanup)
-- Estimated rows: 78
-- Parameters: {'value': 'CANCELLED'}
-- ========================================
DELETE FROM orders WHERE status = :value AND (order_date < '2023-01-01')


-- ========================================
-- Partition: partition_REFUNDED
-- Operation: SELECT (Archive)
-- Estimated rows: 86
-- Parameters: {'value': 'REFUNDED'}
-- ========================================
SELECT * FROM orders WHERE status = :value AND (order_date < '2023-01-01')


-- ========================================
-- Partition: partition_REFUNDED
-- Operation: DELETE (Cleanup)
-- Estimated rows: 86
-- Parameters: {'value': 'REFUNDED'}
-- ========================================
DELETE FROM orders WHERE status = :value AND (order_date < '2023-01-01')

