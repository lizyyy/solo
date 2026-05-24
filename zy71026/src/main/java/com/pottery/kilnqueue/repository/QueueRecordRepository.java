package com.pottery.kilnqueue.repository;

import com.pottery.kilnqueue.entity.QueueRecord;
import com.pottery.kilnqueue.enums.QueueStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface QueueRecordRepository extends JpaRepository<QueueRecord, Long> {
    Optional<QueueRecord> findByRequestId(String requestId);
    Optional<QueueRecord> findByIdempotencyKey(String idempotencyKey);
    List<QueueRecord> findByStatus(QueueStatus status);
    List<QueueRecord> findByBatchId(Long batchId);
    List<QueueRecord> findByWorkId(Long workId);
    List<QueueRecord> findByStatusIn(List<QueueStatus> statuses);

    @Query("SELECT q FROM QueueRecord q WHERE q.status = :status ORDER BY q.queueOrder ASC, q.createdAt ASC")
    List<QueueRecord> findPendingQueueOrdered(@Param("status") QueueStatus status);

    @Query("SELECT MAX(q.queueOrder) FROM QueueRecord q WHERE q.status = :status")
    Integer findMaxQueueOrder(@Param("status") QueueStatus status);

    @Query("SELECT q FROM QueueRecord q WHERE q.batch.id = :batchId ORDER BY q.queueOrder ASC")
    List<QueueRecord> findByBatchIdOrdered(@Param("batchId") Long batchId);

    boolean existsByRequestId(String requestId);
    boolean existsByIdempotencyKey(String idempotencyKey);
}
