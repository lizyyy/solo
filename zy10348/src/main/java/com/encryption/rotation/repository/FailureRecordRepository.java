package com.encryption.rotation.repository;

import com.encryption.rotation.model.entity.FailureRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface FailureRecordRepository extends JpaRepository<FailureRecord, String> {
    List<FailureRecord> findByBatchIdOrderByCreatedAtDesc(String batchId);
    List<FailureRecord> findByTaskIdOrderByCreatedAtDesc(String taskId);
    List<FailureRecord> findByTenantIdOrderByCreatedAtDesc(String tenantId);
}
