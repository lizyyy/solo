package com.degrade.drill.repository;

import com.degrade.drill.enums.DrillStatus;
import com.degrade.drill.model.DrillPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface DrillPlanRepository extends JpaRepository<DrillPlan, Long> {
    Optional<DrillPlan> findByRequestId(String requestId);
    boolean existsByRequestId(String requestId);
    List<DrillPlan> findByStatus(DrillStatus status);
    List<DrillPlan> findByStatusIn(List<DrillStatus> statuses);
}