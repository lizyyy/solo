package com.metadata.repair.repository;

import com.metadata.repair.entity.RepairBatch;
import com.metadata.repair.enums.RepairStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;
import java.util.Optional;

@Repository
public interface RepairBatchRepository extends JpaRepository<RepairBatch, Long> {
    Optional<RepairBatch> findByBatchNo(String batchNo);
    List<RepairBatch> findByStatus(RepairStatus status);
    List<RepairBatch> findByOperator(String operator);
    boolean existsByBatchNo(String batchNo);
}
