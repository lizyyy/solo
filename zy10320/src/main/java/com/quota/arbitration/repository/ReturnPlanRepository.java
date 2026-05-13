package com.quota.arbitration.repository;

import com.quota.arbitration.entity.ReturnPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ReturnPlanRepository extends JpaRepository<ReturnPlan, Long> {
    List<ReturnPlan> findByApplicationId(Long applicationId);
    List<ReturnPlan> findByApplicationNo(String applicationNo);
    List<ReturnPlan> findByIsCompletedFalse();
}
