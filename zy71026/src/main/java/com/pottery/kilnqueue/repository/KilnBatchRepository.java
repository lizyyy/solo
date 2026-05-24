package com.pottery.kilnqueue.repository;

import com.pottery.kilnqueue.entity.KilnBatch;
import com.pottery.kilnqueue.enums.BatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface KilnBatchRepository extends JpaRepository<KilnBatch, Long> {
    Optional<KilnBatch> findByBatchNo(String batchNo);
    List<KilnBatch> findByStatus(BatchStatus status);
    List<KilnBatch> findByStatusIn(List<BatchStatus> statuses);
    boolean existsByBatchNo(String batchNo);
}
