package com.apidiff.repository;

import com.apidiff.entity.OperationLog;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface OperationLogRepository extends JpaRepository<OperationLog, Long> {

    List<OperationLog> findByDiffRecordIdOrderByOperatedAtDesc(Long diffRecordId);

    Page<OperationLog> findByDiffRecordId(Long diffRecordId, Pageable pageable);

    @Query("SELECT l FROM OperationLog l WHERE " +
           "(:diffRecordId IS NULL OR l.diffRecordId = :diffRecordId) AND " +
           "(:operationType IS NULL OR l.operationType = :operationType) AND " +
           "(:startTime IS NULL OR l.operatedAt >= :startTime) AND " +
           "(:endTime IS NULL OR l.operatedAt <= :endTime)")
    Page<OperationLog> findByConditions(
            @Param("diffRecordId") Long diffRecordId,
            @Param("operationType") String operationType,
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);
}
