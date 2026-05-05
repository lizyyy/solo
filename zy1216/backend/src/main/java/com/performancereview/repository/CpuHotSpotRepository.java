package com.performancereview.repository;

import com.performancereview.entity.CpuHotSpot;
import com.performancereview.enums.BottleneckSeverity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface CpuHotSpotRepository extends JpaRepository<CpuHotSpot, Long> {

    List<CpuHotSpot> findByIncidentIdOrderByTimestampDesc(Long incidentId);

    List<CpuHotSpot> findByIncidentIdAndSeverityOrderByTimestampDesc(Long incidentId, BottleneckSeverity severity);

    List<CpuHotSpot> findByIncidentIdAndTimestampBetweenOrderByTimestampDesc(
            Long incidentId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT c FROM CpuHotSpot c WHERE c.incident.id = :incidentId ORDER BY c.cpuUsagePercent DESC")
    List<CpuHotSpot> findTopByIncidentIdOrderByCpuUsageDesc(@Param("incidentId") Long incidentId);

    @Query("SELECT c FROM CpuHotSpot c WHERE c.incident.id = :incidentId ORDER BY c.selfTimeMs DESC")
    List<CpuHotSpot> findTopByIncidentIdOrderBySelfTimeDesc(@Param("incidentId") Long incidentId);
}
