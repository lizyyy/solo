package com.business.recalculate.repository;

import com.business.recalculate.model.ComparisonResult;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface ComparisonResultRepository extends JpaRepository<ComparisonResult, Long> {
    
    Optional<ComparisonResult> findByBatchId(Long batchId);
    
    Optional<ComparisonResult> findByBatchNo(String batchNo);
}
