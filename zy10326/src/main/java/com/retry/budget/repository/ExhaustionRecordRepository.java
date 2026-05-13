package com.retry.budget.repository;

import com.retry.budget.entity.ExhaustionRecord;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.util.List;

@Repository
public interface ExhaustionRecordRepository extends JpaRepository<ExhaustionRecord, Long> {
    
    List<ExhaustionRecord> findByBudgetId(Long budgetId);
    
    List<ExhaustionRecord> findByCallerIdAndTargetApi(String callerId, String targetApi);
    
    List<ExhaustionRecord> findByIsRecovered(Boolean isRecovered);
}
