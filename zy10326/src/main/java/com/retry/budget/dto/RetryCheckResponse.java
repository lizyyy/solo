package com.retry.budget.dto;

import com.retry.budget.enums.FailureType;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class RetryCheckResponse {
    
    private Boolean allowed;
    
    private Long budgetId;
    
    private String callerId;
    
    private String targetApi;
    
    private Integer remainingBudget;
    
    private Integer usedBudget;
    
    private Integer consecutiveFailures;
    
    private Long backoffMs;
    
    private LocalDateTime nextRetryAt;
    
    private FailureType failureType;
    
    private Boolean isExhausted;
    
    private String message;
    
    private Boolean isIdempotentHit;
}
