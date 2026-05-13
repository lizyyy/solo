package com.approval.coordinator.repository;

import com.approval.coordinator.model.entity.ApprovalBatch;
import com.approval.coordinator.model.enums.BatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ApprovalBatchRepository extends JpaRepository<ApprovalBatch, String> {

    Optional<ApprovalBatch> findByBatchId(String batchId);

    boolean existsByBatchId(String batchId);

    List<ApprovalBatch> findByStatusIn(List<BatchStatus> statuses);

    @Query("SELECT b FROM ApprovalBatch b WHERE b.createdAt BETWEEN :startTime AND :endTime ORDER BY b.createdAt DESC")
    List<ApprovalBatch> findByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    @Query("SELECT b FROM ApprovalBatch b WHERE b.sourceSystem = :sourceSystem ORDER BY b.createdAt DESC")
    List<ApprovalBatch> findBySourceSystem(@Param("sourceSystem") String sourceSystem);
}
