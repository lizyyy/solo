package com.query.regression.repository;

import com.query.regression.entity.ExecutionPlan;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface ExecutionPlanRepository extends JpaRepository<ExecutionPlan, Long> {
    List<ExecutionPlan> findByRegressionRecordId(Long regressionRecordId);
    List<ExecutionPlan> findByRegressionRecordIdAndPlanType(Long regressionRecordId, String planType);
}
