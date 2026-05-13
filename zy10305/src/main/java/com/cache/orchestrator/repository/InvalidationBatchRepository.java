package com.cache.orchestrator.repository;

import com.cache.orchestrator.domain.entity.InvalidationBatch;
import com.cache.orchestrator.domain.enums.BatchStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface InvalidationBatchRepository extends JpaRepository<InvalidationBatch, Long> {

    Optional<InvalidationBatch> findByRequestId(String requestId);

    boolean existsByRequestId(String requestId);

    List<InvalidationBatch> findByStatus(BatchStatus status);

    @Query("SELECT b FROM InvalidationBatch b WHERE b.createdAt BETWEEN :startTime AND :endTime ORDER BY b.createdAt DESC")
    List<InvalidationBatch> findByTimeRange(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    @Query("SELECT b FROM InvalidationBatch b WHERE b.status IN :statuses ORDER BY b.createdAt DESC")
    List<InvalidationBatch> findByStatusIn(@Param("statuses") List<BatchStatus> statuses);
}
