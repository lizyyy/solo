package com.degrade.drill.repository;

import com.degrade.drill.model.DrillReport;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DrillReportRepository extends JpaRepository<DrillReport, Long> {
    Optional<DrillReport> findByDrillPlanId(Long drillPlanId);
    List<DrillReport> findAllByOrderByArchivedAtDesc();
}