package com.performancereview.repository;

import com.performancereview.entity.EvidenceFragment;
import com.performancereview.enums.PerformanceMetricType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;

@Repository
public interface EvidenceFragmentRepository extends JpaRepository<EvidenceFragment, Long> {

    List<EvidenceFragment> findByIncidentIdOrderByTimestampDesc(Long incidentId);

    List<EvidenceFragment> findByIncidentIdAndMetricTypeOrderByTimestampDesc(
            Long incidentId, PerformanceMetricType metricType);

    List<EvidenceFragment> findByIncidentIdAndIsKeyEvidenceOrderByTimestampDesc(
            Long incidentId, Boolean isKeyEvidence);

    List<EvidenceFragment> findByIncidentIdAndTimestampBetweenOrderByTimestampDesc(
            Long incidentId, LocalDateTime start, LocalDateTime end);

    @Query("SELECT e FROM EvidenceFragment e WHERE e.incident.id = :incidentId AND e.metricType = :metricType AND e.metricId = :metricId")
    List<EvidenceFragment> findByIncidentIdAndMetricTypeAndMetricId(
            @Param("incidentId") Long incidentId,
            @Param("metricType") PerformanceMetricType metricType,
            @Param("metricId") Long metricId);

    List<EvidenceFragment> findByIncidentIdAndSourceFileOrderByLineStartAsc(
            Long incidentId, String sourceFile);
}
