package com.performancereview.repository;

import com.performancereview.entity.GcPause;
import com.performancereview.enums.BottleneckSeverity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface GcPauseRepository extends JpaRepository<GcPause, Long> {

    List<GcPause> findByIncidentIdOrderByTimestampDesc(Long incidentId);

    List<GcPause> findByIncidentIdAndSeverityOrderByTimestampDesc(Long incidentId, BottleneckSeverity severity);

    List<GcPause> findByIncidentIdAndGcTypeOrderByTimestampDesc(Long incidentId, String gcType);

    List<GcPause> findByIncidentIdAndTimestampBetweenOrderByTimestampDesc(
            Long incidentId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT g FROM GcPause g WHERE g.incident.id = :incidentId ORDER BY g.pauseDurationMs DESC")
    List<GcPause> findTopByIncidentIdOrderByPauseDurationDesc(@Param("incidentId") Long incidentId);

    @Query("SELECT g FROM GcPause g WHERE g.incident.id = :incidentId AND g.concurrentMarkFail = true ORDER BY g.timestamp DESC")
    List<GcPause> findConcurrentMarkFailByIncidentId(@Param("incidentId") Long incidentId);

    @Query("SELECT g FROM GcPause g WHERE g.incident.id = :incidentId AND g.toSpaceExhausted = true ORDER BY g.timestamp DESC")
    List<GcPause> findToSpaceExhaustedByIncidentId(@Param("incidentId") Long incidentId);
}
