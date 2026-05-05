package com.performancereview.repository;

import com.performancereview.entity.SlowRequest;
import com.performancereview.enums.BottleneckSeverity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface SlowRequestRepository extends JpaRepository<SlowRequest, Long> {

    List<SlowRequest> findByIncidentIdOrderByTimestampDesc(Long incidentId);

    List<SlowRequest> findByIncidentIdAndSeverityOrderByTimestampDesc(Long incidentId, BottleneckSeverity severity);

    List<SlowRequest> findByIncidentIdAndHttpMethodOrderByTimestampDesc(Long incidentId, String httpMethod);

    List<SlowRequest> findByIncidentIdAndUriOrderByTimestampDesc(Long incidentId, String uri);

    List<SlowRequest> findByIncidentIdAndTimestampBetweenOrderByTimestampDesc(
            Long incidentId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT s FROM SlowRequest s WHERE s.incident.id = :incidentId ORDER BY s.totalDurationMs DESC")
    List<SlowRequest> findTopByIncidentIdOrderByTotalDurationDesc(@Param("incidentId") Long incidentId);

    @Query("SELECT s FROM SlowRequest s WHERE s.incident.id = :incidentId ORDER BY s.processingDurationMs DESC")
    List<SlowRequest> findTopByIncidentIdOrderByProcessingDurationDesc(@Param("incidentId") Long incidentId);

    @Query("SELECT s FROM SlowRequest s WHERE s.incident.id = :incidentId ORDER BY s.ioDurationMs DESC")
    List<SlowRequest> findTopByIncidentIdOrderByIoDurationDesc(@Param("incidentId") Long incidentId);
}
