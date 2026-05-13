package com.api.inspection.repository;

import com.api.inspection.entity.ExecutionBatch;
import com.api.inspection.enums.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface ExecutionBatchRepository extends JpaRepository<ExecutionBatch, Long> {
    Optional<ExecutionBatch> findByBatchNo(String batchNo);
    boolean existsByBatchNo(String batchNo);
    List<ExecutionBatch> findByTemplateId(Long templateId);
    List<ExecutionBatch> findByStatus(TransactionStatus status);
    List<ExecutionBatch> findByTemplateIdOrderByCreatedAtDesc(Long templateId);
}
