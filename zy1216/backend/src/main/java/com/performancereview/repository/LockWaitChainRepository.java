package com.performancereview.repository;

import com.performancereview.entity.LockWaitChain;
import com.performancereview.enums.BottleneckSeverity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface LockWaitChainRepository extends JpaRepository<LockWaitChain, Long> {

    List<LockWaitChain> findByIncidentIdOrderByTimestampDesc(Long incidentId);

    List<LockWaitChain> findByIncidentIdAndSeverityOrderByTimestampDesc(Long incidentId, BottleneckSeverity severity);

    List<LockWaitChain> findByIncidentIdAndTimestampBetweenOrderByTimestampDesc(
            Long incidentId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT l FROM LockWaitChain l WHERE l.incident.id = :incidentId AND l.deadlockDetected = true ORDER BY l.timestamp DESC")
    List<LockWaitChain> findDeadlocksByIncidentId(@Param("incidentId") Long incidentId);

    @Query("SELECT l FROM LockWaitChain l WHERE l.incident.id = :incidentId ORDER BY l.waitDurationMs DESC")
    List<LockWaitChain> findTopByIncidentIdOrderByWaitDurationDesc(@Param("incidentId") Long incidentId);

    List<LockWaitChain> findByIncidentIdAndLockNameOrderByTimestampDesc(Long incidentId, String lockName);
}
