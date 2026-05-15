package com.encryption.rotation.repository;

import com.encryption.rotation.model.entity.RotationBatch;
import com.encryption.rotation.model.enums.RotationStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;
import java.util.Set;

@Repository
public interface RotationBatchRepository extends JpaRepository<RotationBatch, String> {
    Optional<RotationBatch> findByBatchNumber(String batchNumber);
    List<RotationBatch> findByTenantIdOrderByCreatedAtDesc(String tenantId);
    List<RotationBatch> findByTenantIdAndStatusOrderByCreatedAtDesc(String tenantId, RotationStatus status);
    boolean existsByBatchNumber(String batchNumber);
    
    Optional<RotationBatch> findByTenantIdAndSourceKeyIdAndTargetKeyIdAndDataSignatureAndStatusIn(
            String tenantId, String sourceKeyId, String targetKeyId, String dataSignature, Set<RotationStatus> statuses);
}
