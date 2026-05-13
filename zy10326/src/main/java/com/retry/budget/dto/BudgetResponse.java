package com.retry.budget.dto;

import com.retry.budget.enums.BackoffStrategy;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class BudgetResponse {
    
    private Long id;
    
    private String callerId;
    
    private String targetApi;
    
    private Integer totalBudget;
    
    private Integer remainingBudget;
    
    private Integer usedBudget;
    
    private Integer failedCount;
    
    private Integer consecutiveFailures;
    
    private Integer successCount;
    
    private BackoffStrategy backoffStrategy;
    
    private Long initialBackoffMs;
    
    private Long maxBackoffMs;
    
    private Double backoffMultiplier;
    
    private Boolean isExhausted;
    
    private LocalDateTime exhaustedAt;
    
    private LocalDateTime lastFailureAt;
    
    private LocalDateTime lastSuccessAt;
    
    private Long recoveryIntervalMs;
    
    private LocalDateTime nextRecoveryAt;
    
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
}
