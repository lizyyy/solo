package com.query.regression.repository;

import com.query.regression.entity.PlanDifference;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;
import java.util.List;

@Repository
public interface PlanDifferenceRepository extends JpaRepository<PlanDifference, Long> {
    List<PlanDifference> findByRegressionRecordId(Long regressionRecordId);
}
