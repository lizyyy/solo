package com.resource.tag.repository;

import com.resource.tag.model.CalculationResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface CalculationResultRepository extends JpaRepository<CalculationResult, Long> {
    List<CalculationResult> findByTaskId(String taskId);
    List<CalculationResult> findByNodeId(String nodeId);
    void deleteByTaskId(String taskId);
}
