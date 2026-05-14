package com.featureflag.audit.repository;

import com.featureflag.audit.entity.AuditRecord;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface AuditRecordRepository extends JpaRepository<AuditRecord, Long> {
    Optional<AuditRecord> findByRequestId(String requestId);
    boolean existsByRequestId(String requestId);

    Page<AuditRecord> findByExperimentKey(String experimentKey, Pageable pageable);
    Page<AuditRecord> findByUserIdentifier(String userIdentifier, Pageable pageable);
    Page<AuditRecord> findByStatus(AuditRecord.AuditStatus status, Pageable pageable);

    List<AuditRecord> findByStatusAndCreatedAtBefore(AuditRecord.AuditStatus status, LocalDateTime beforeTime);

    @Query("SELECT a FROM AuditRecord a WHERE a.experimentKey = :experimentKey " +
           "AND a.userIdentifier = :userIdentifier ORDER BY a.createdAt DESC")
    List<AuditRecord> findRecentByExperimentAndUser(
            @Param("experimentKey") String experimentKey,
            @Param("userIdentifier") String userIdentifier,
            Pageable pageable);

    @Query("SELECT a FROM AuditRecord a WHERE a.createdAt BETWEEN :startTime AND :endTime")
    Page<AuditRecord> findByTimeRange(
            @Param("startTime") LocalDateTime startTime,
            @Param("endTime") LocalDateTime endTime,
            Pageable pageable);
}
