package com.grayscale.rollback.repository;

import com.grayscale.rollback.entity.OperationLog;
import com.grayscale.rollback.enums.OperationType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {
    
    List<OperationLog> findByReleaseIdOrderByCreatedAtAsc(String releaseId);
    
    List<OperationLog> findByReleaseIdAndSuccessIsFalseOrderByCreatedAtDesc(String releaseId);
    
    List<OperationLog> findByOperationTypeInAndCreatedAtBetween(
            List<OperationType> types, LocalDateTime start, LocalDateTime end);
    
    Optional<OperationLog> findByOperationId(String operationId);
    
    @Query("SELECT ol FROM OperationLog ol WHERE ol.releaseId = :releaseId AND ol.success = false ORDER BY ol.createdAt DESC")
    List<OperationLog> findFailedOperations(@Param("releaseId") String releaseId);
    
    @Query("SELECT ol FROM OperationLog ol WHERE ol.releaseId = :releaseId ORDER BY ol.createdAt DESC LIMIT 1")
    Optional<OperationLog> findLatestLogByReleaseId(@Param("releaseId") String releaseId);
}
