package com.encryption.rotation.repository;

import com.encryption.rotation.model.entity.ReEncryptionTask;
import com.encryption.rotation.model.enums.TaskStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReEncryptionTaskRepository extends JpaRepository<ReEncryptionTask, String> {
    List<ReEncryptionTask> findByBatchIdOrderByCreatedAt(String batchId);
    List<ReEncryptionTask> findByBatchIdAndStatusOrderByCreatedAt(String batchId, TaskStatus status);
    long countByBatchIdAndStatus(String batchId, TaskStatus status);
    boolean existsByBatchIdAndDataIdentifier(String batchId, String dataIdentifier);
}
