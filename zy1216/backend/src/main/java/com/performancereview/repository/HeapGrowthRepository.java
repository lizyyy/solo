package com.performancereview.repository;

import com.performancereview.entity.HeapGrowth;
import com.performancereview.enums.BottleneckSeverity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface HeapGrowthRepository extends JpaRepository<HeapGrowth, Long> {

    List<HeapGrowth> findByIncidentIdOrderByTimestampDesc(Long incidentId);

    List<HeapGrowth> findByIncidentIdAndSeverityOrderByTimestampDesc(Long incidentId, BottleneckSeverity severity);

    List<HeapGrowth> findByIncidentIdAndTimestampBetweenOrderByTimestampDesc(
            Long incidentId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT h FROM HeapGrowth h WHERE h.incident.id = :incidentId ORDER BY h.heapPercent DESC")
    List<HeapGrowth> findTopByIncidentIdOrderByHeapPercentDesc(@Param("incidentId") Long incidentId);

    @Query("SELECT h FROM HeapGrowth h WHERE h.incident.id = :incidentId ORDER BY h.growthRateBytesPerSecond DESC")
    List<HeapGrowth> findTopByIncidentIdOrderByGrowthRateDesc(@Param("incidentId") Long incidentId);

    @Query("SELECT h FROM HeapGrowth h WHERE h.incident.id = :incidentId ORDER BY h.retainedSizeBytes DESC")
    List<HeapGrowth> findTopByIncidentIdOrderByRetainedSizeDesc(@Param("incidentId") Long incidentId);
}
