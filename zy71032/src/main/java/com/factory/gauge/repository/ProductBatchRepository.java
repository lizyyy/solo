package com.factory.gauge.repository;

import com.factory.gauge.entity.ProductBatch;
import com.factory.gauge.entity.enums.BatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface ProductBatchRepository extends JpaRepository<ProductBatch, Long> {
    Optional<ProductBatch> findByBatchNo(String batchNo);

    List<ProductBatch> findByToolId(Long toolId);

    List<ProductBatch> findByToolNo(String toolNo);

    List<ProductBatch> findByStatus(BatchStatus status);

    @Query("SELECT p FROM ProductBatch p WHERE p.toolId = :toolId AND p.status = 'LOCKED'")
    List<ProductBatch> findLockedBatchesByToolId(@Param("toolId") Long toolId);

    @Query("SELECT p FROM ProductBatch p WHERE p.createdAt BETWEEN :startTime AND :endTime")
    List<ProductBatch> findByCreatedAtBetween(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    boolean existsByBatchNo(String batchNo);
}
