package com.retry.budget.repository;

import com.retry.budget.entity.FailureHistory;
import com.retry.budget.enums.FailureType;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

@Repository
public interface FailureHistoryRepository extends JpaRepository<FailureHistory, Long> {
    
    Optional<FailureHistory> findByIdempotentKey(String idempotentKey);
    
    List<FailureHistory> findByBudgetId(Long budgetId);
    
    Page<FailureHistory> findByBudgetId(Long budgetId, Pageable pageable);
    
    List<FailureHistory> findByCallerIdAndTargetApi(String callerId, String targetApi);
    
    Page<FailureHistory> findByCallerIdAndTargetApi(String callerId, String targetApi, Pageable pageable);
    
    List<FailureHistory> findByFailureType(FailureType failureType);
    
    List<FailureHistory> findByBudgetIdAndCreatedAtBetween(Long budgetId, LocalDateTime start, LocalDateTime end);
    
    boolean existsByIdempotentKey(String idempotentKey);
}
