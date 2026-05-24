package com.factory.gauge.repository;

import com.factory.gauge.entity.DeactivationRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface DeactivationRecordRepository extends JpaRepository<DeactivationRecord, Long> {
    List<DeactivationRecord> findByToolId(Long toolId);

    List<DeactivationRecord> findByToolNo(String toolNo);

    Optional<DeactivationRecord> findByToolIdAndIsActiveTrue(Long toolId);

    @Query("SELECT d FROM DeactivationRecord d WHERE d.deactivatedAt BETWEEN :startTime AND :endTime")
    List<DeactivationRecord> findByDeactivatedAtBetween(@Param("startTime") LocalDateTime startTime, @Param("endTime") LocalDateTime endTime);

    @Query("SELECT COUNT(d) FROM DeactivationRecord d WHERE d.toolId = :toolId AND d.isActive = true")
    Long countActiveDeactivationsByToolId(@Param("toolId") Long toolId);
}
