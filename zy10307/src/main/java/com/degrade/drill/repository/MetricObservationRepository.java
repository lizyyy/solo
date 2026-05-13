package com.degrade.drill.repository;

import com.degrade.drill.model.MetricObservation;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface MetricObservationRepository extends JpaRepository<MetricObservation, Long> {
    List<MetricObservation> findByDrillPlanIdOrderByObservedAtDesc(Long drillPlanId);
    List<MetricObservation> findByDrillPlanIdAndMetricName(Long drillPlanId, String metricName);
}