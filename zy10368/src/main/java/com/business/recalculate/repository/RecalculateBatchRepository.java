package com.business.recalculate.repository;

import com.business.recalculate.model.RecalculateBatch;
import com.business.recalculate.model.RecalculateStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RecalculateBatchRepository extends JpaRepository<RecalculateBatch, Long> {
    
    Optional<RecalculateBatch> findByBatchNo(String batchNo);
    
    Optional<RecalculateBatch> findByIdempotencyKey(String idempotencyKey);
    
    boolean existsByBatchNo(String batchNo);
    
    boolean existsByIdempotencyKey(String idempotencyKey);
    
    List<RecalculateBatch> findByStatus(RecalculateStatus status);
    
    List<RecalculateBatch> findByCreatedByOrderByCreatedAtDesc(String createdBy);
    
    List<RecalculateBatch> findAllByOrderByCreatedAtDesc();
}
