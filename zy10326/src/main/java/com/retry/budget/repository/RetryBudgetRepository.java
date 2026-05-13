package com.retry.budget.repository;

import com.retry.budget.entity.RetryBudget;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

@Repository
public interface RetryBudgetRepository extends JpaRepository<RetryBudget, Long> {
    
    Optional<RetryBudget> findByCallerIdAndTargetApi(String callerId, String targetApi);
    
    boolean existsByCallerIdAndTargetApi(String callerId, String targetApi);
    
    List<RetryBudget> findByCallerId(String callerId);
    
    List<RetryBudget> findByIsExhausted(Boolean isExhausted);
    
    @Query("SELECT rb FROM RetryBudget rb WHERE rb.isExhausted = true AND rb.nextRecoveryAt <= :now")
    List<RetryBudget> findRecoverableBudgets(@Param("now") java.time.LocalDateTime now);
}
