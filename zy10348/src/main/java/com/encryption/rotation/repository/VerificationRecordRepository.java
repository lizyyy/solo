package com.encryption.rotation.repository;

import com.encryption.rotation.model.entity.VerificationRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface VerificationRecordRepository extends JpaRepository<VerificationRecord, String> {
    List<VerificationRecord> findByBatchIdOrderByCreatedAtDesc(String batchId);
    List<VerificationRecord> findByTaskIdOrderByCreatedAtDesc(String taskId);
    List<VerificationRecord> findByBatchIdAndIsSampledTrue(String batchId);
    long countByBatchId(String batchId);
}
