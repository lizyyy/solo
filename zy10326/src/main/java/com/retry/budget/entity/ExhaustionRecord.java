package com.retry.budget.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "exhaustion_record", indexes = {
    @Index(name = "idx_exhaust_budget_id", columnList = "budgetId"),
    @Index(name = "idx_exhaust_caller_api", columnList = {"callerId", "targetApi"})
})
public class ExhaustionRecord {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private Long budgetId;
    
    @Column(nullable = false, length = 100)
    private String callerId;
    
    @Column(nullable = false, length = 200)
    private String targetApi;
    
    @Column(nullable = false)
    private Integer totalBudgetUsed;
    
    @Column(nullable = false)
    private Integer consecutiveFailuresAtExhaust;
    
    @Column(length = 1000)
    private String triggeringFailureReason;
    
    @Column(nullable = false)
    private Boolean isRecovered;
    
    private LocalDateTime recoveredAt;
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
}
