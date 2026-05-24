package com.factory.gauge.repository;

import com.factory.gauge.entity.ReinspectionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ReinspectionRecordRepository extends JpaRepository<ReinspectionRecord, Long> {
    List<ReinspectionRecord> findByBatchId(Long batchId);

    List<ReinspectionRecord> findByBatchNo(String batchNo);

    List<ReinspectionRecord> findByToolId(Long toolId);

    List<ReinspectionRecord> findByToolNo(String toolNo);

    Optional<ReinspectionRecord> findTopByBatchIdOrderByCreatedAtDesc(Long batchId);

    @Query("SELECT r FROM ReinspectionRecord r WHERE r.createdAt BETWEEN :startTime AND :endTime")
    List<ReinspectionRecord> findByCreatedAtBetween(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    @Query("SELECT COUNT(r) FROM ReinspectionRecord r WHERE r.batchId = :batchId AND r.isCorrected = true")
    Long countCorrectedRecordsByBatchId(@Param("batchId") Long batchId);
}
