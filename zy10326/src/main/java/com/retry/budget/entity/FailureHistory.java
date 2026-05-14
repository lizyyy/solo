package com.retry.budget.entity;

import com.retry.budget.enums.FailureType;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "failure_history", indexes = {
    @Index(name = "idx_budget_id", columnList = "budgetId"),
    @Index(name = "idx_caller_api", columnList = {"callerId", "targetApi"}),
    @Index(name = "idx_failure_type", columnList = "failureType"),
    @Index(name = "idx_idempotent_key", columnList = "idempotentKey", unique = true)
})
public class FailureHistory {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long budgetId;
    
    @Column(nullable = false, length = 100)
    private String callerId;
    
    @Column(nullable = false, length = 200)
    private String targetApi;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private FailureType failureType;
    
    @Column(length = 1000)
    private String failureReason;
    
    @Column(nullable = false)
    private Integer attemptNumber;
    
    @Column(nullable = false)
    private Long backoffMs;
    
    @Column(nullable = false)
    private Boolean budgetExhausted;
    
    @Column(nullable = false)
    private Boolean budgetConsumed;
    
    @Column(length = 64, unique = true)
    private String idempotentKey;
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
