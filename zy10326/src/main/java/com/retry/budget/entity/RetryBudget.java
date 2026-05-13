package com.retry.budget.entity;

import com.retry.budget.enums.BackoffStrategy;
import jakarta.persistence.*;
import lombok.Data;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "retry_budget", uniqueConstraints = {
    @UniqueConstraint(columnNames = {"callerId", "targetApi"})
})
public class RetryBudget {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false, length = 100)
    private String callerId;
    
    @Column(nullable = false, length = 200)
    private String targetApi;
    
    @Column(nullable = false)
    private Integer totalBudget;
    
    @Column(nullable = false)
    private Integer remainingBudget;
    
    @Column(nullable = false)
    private Integer usedBudget;
    
    @Column(nullable = false)
    private Integer failedCount;
    
    @Column(nullable = false)
    private Integer consecutiveFailures;
    
    @Column(nullable = false)
    private Integer successCount;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private BackoffStrategy backoffStrategy;
    
    @Column(nullable = false)
    private Long initialBackoffMs;
    
    @Column(nullable = false)
    private Long maxBackoffMs;
    
    @Column(nullable = false)
    private Double backoffMultiplier;
    
    @Column(nullable = false)
    private Boolean isExhausted;
    
    private LocalDateTime exhaustedAt;
    
    private LocalDateTime lastFailureAt;
    
    private LocalDateTime lastSuccessAt;
    
    @Column(nullable = false)
    private Long recoveryIntervalMs;
    
    private LocalDateTime nextRecoveryAt;
    
    @CreationTimestamp
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @UpdateTimestamp
    @Column(nullable = false)
    private LocalDateTime updatedAt;
    
    @Version
    private Integer version;
}
