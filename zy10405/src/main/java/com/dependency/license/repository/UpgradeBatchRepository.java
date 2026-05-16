package com.dependency.license.repository;

import com.dependency.license.model.UpgradeBatch;
import com.dependency.license.model.BatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface UpgradeBatchRepository extends JpaRepository<UpgradeBatch, Long> {
    Optional<UpgradeBatch> findByBatchNo(String batchNo);
    List<UpgradeBatch> findByStatus(BatchStatus status);
    List<UpgradeBatch> findByDependencyPackageId(Long packageId);
    List<UpgradeBatch> findByCreatedBy(String createdBy);
}