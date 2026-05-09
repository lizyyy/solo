-- SQL Snippets for Archive Operation
-- Generated at: 2026-05-09T22:15:20.263204
-- Report type: dry_run


-- ========================================
-- Partition: partition_20220101_20220131
-- Operation: SELECT (Archive)
-- Estimated rows: 9
-- Parameters: {'start_date': datetime.datetime(2022, 1, 1, 0, 0), 'end_date': datetime.datetime(2022, 1, 31, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220101_20220131
-- Operation: DELETE (Cleanup)
-- Estimated rows: 9
-- Parameters: {'start_date': datetime.datetime(2022, 1, 1, 0, 0), 'end_date': datetime.datetime(2022, 1, 31, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220131_20220302
-- Operation: SELECT (Archive)
-- Estimated rows: 5
-- Parameters: {'start_date': datetime.datetime(2022, 1, 31, 0, 0), 'end_date': datetime.datetime(2022, 3, 2, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220131_20220302
-- Operation: DELETE (Cleanup)
-- Estimated rows: 5
-- Parameters: {'start_date': datetime.datetime(2022, 1, 31, 0, 0), 'end_date': datetime.datetime(2022, 3, 2, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220302_20220401
-- Operation: SELECT (Archive)
-- Estimated rows: 7
-- Parameters: {'start_date': datetime.datetime(2022, 3, 2, 0, 0), 'end_date': datetime.datetime(2022, 4, 1, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220302_20220401
-- Operation: DELETE (Cleanup)
-- Estimated rows: 7
-- Parameters: {'start_date': datetime.datetime(2022, 3, 2, 0, 0), 'end_date': datetime.datetime(2022, 4, 1, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220401_20220501
-- Operation: SELECT (Archive)
-- Estimated rows: 11
-- Parameters: {'start_date': datetime.datetime(2022, 4, 1, 0, 0), 'end_date': datetime.datetime(2022, 5, 1, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220401_20220501
-- Operation: DELETE (Cleanup)
-- Estimated rows: 11
-- Parameters: {'start_date': datetime.datetime(2022, 4, 1, 0, 0), 'end_date': datetime.datetime(2022, 5, 1, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220501_20220531
-- Operation: SELECT (Archive)
-- Estimated rows: 10
-- Parameters: {'start_date': datetime.datetime(2022, 5, 1, 0, 0), 'end_date': datetime.datetime(2022, 5, 31, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220501_20220531
-- Operation: DELETE (Cleanup)
-- Estimated rows: 10
-- Parameters: {'start_date': datetime.datetime(2022, 5, 1, 0, 0), 'end_date': datetime.datetime(2022, 5, 31, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220531_20220630
-- Operation: SELECT (Archive)
-- Estimated rows: 8
-- Parameters: {'start_date': datetime.datetime(2022, 5, 31, 0, 0), 'end_date': datetime.datetime(2022, 6, 30, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220531_20220630
-- Operation: DELETE (Cleanup)
-- Estimated rows: 8
-- Parameters: {'start_date': datetime.datetime(2022, 5, 31, 0, 0), 'end_date': datetime.datetime(2022, 6, 30, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220630_20220730
-- Operation: SELECT (Archive)
-- Estimated rows: 14
-- Parameters: {'start_date': datetime.datetime(2022, 6, 30, 0, 0), 'end_date': datetime.datetime(2022, 7, 30, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220630_20220730
-- Operation: DELETE (Cleanup)
-- Estimated rows: 14
-- Parameters: {'start_date': datetime.datetime(2022, 6, 30, 0, 0), 'end_date': datetime.datetime(2022, 7, 30, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220730_20220829
-- Operation: SELECT (Archive)
-- Estimated rows: 4
-- Parameters: {'start_date': datetime.datetime(2022, 7, 30, 0, 0), 'end_date': datetime.datetime(2022, 8, 29, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220730_20220829
-- Operation: DELETE (Cleanup)
-- Estimated rows: 4
-- Parameters: {'start_date': datetime.datetime(2022, 7, 30, 0, 0), 'end_date': datetime.datetime(2022, 8, 29, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220829_20220928
-- Operation: SELECT (Archive)
-- Estimated rows: 13
-- Parameters: {'start_date': datetime.datetime(2022, 8, 29, 0, 0), 'end_date': datetime.datetime(2022, 9, 28, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220829_20220928
-- Operation: DELETE (Cleanup)
-- Estimated rows: 13
-- Parameters: {'start_date': datetime.datetime(2022, 8, 29, 0, 0), 'end_date': datetime.datetime(2022, 9, 28, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220928_20221028
-- Operation: SELECT (Archive)
-- Estimated rows: 6
-- Parameters: {'start_date': datetime.datetime(2022, 9, 28, 0, 0), 'end_date': datetime.datetime(2022, 10, 28, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20220928_20221028
-- Operation: DELETE (Cleanup)
-- Estimated rows: 6
-- Parameters: {'start_date': datetime.datetime(2022, 9, 28, 0, 0), 'end_date': datetime.datetime(2022, 10, 28, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20221028_20221127
-- Operation: SELECT (Archive)
-- Estimated rows: 4
-- Parameters: {'start_date': datetime.datetime(2022, 10, 28, 0, 0), 'end_date': datetime.datetime(2022, 11, 27, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20221028_20221127
-- Operation: DELETE (Cleanup)
-- Estimated rows: 4
-- Parameters: {'start_date': datetime.datetime(2022, 10, 28, 0, 0), 'end_date': datetime.datetime(2022, 11, 27, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20221127_20221227
-- Operation: SELECT (Archive)
-- Estimated rows: 9
-- Parameters: {'start_date': datetime.datetime(2022, 11, 27, 0, 0), 'end_date': datetime.datetime(2022, 12, 27, 0, 0)}
-- ========================================
SELECT * FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')


-- ========================================
-- Partition: partition_20221127_20221227
-- Operation: DELETE (Cleanup)
-- Estimated rows: 9
-- Parameters: {'start_date': datetime.datetime(2022, 11, 27, 0, 0), 'end_date': datetime.datetime(2022, 12, 27, 0, 0)}
-- ========================================
DELETE FROM transactions WHERE txn_date >= :start_date AND txn_date < :end_date AND (status = 'SETTLED')

