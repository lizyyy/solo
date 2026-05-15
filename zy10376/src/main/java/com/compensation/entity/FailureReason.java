package com.compensation.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "failure_reason")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FailureReason {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false, length = 64)
    private String failureId;
    
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "action_id")
    private ExecutedAction executedAction;
    
    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "task_id")
    private CompensationTask compensationTask;
    
    @Column(nullable = false, length = 128)
    private String errorCode;
    
    @Column(nullable = false, length = 512)
    private String errorMessage;
    
    @Column(length = 4096)
    private String errorDetail;
    
    @Column(length = 1024)
    private String stackTrace;
    
    @Column(length = 128)
    private String failedStep;
    
    @Column(length = 512)
    private String recoverySuggestion;
    
    private Boolean recoverable;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (recoverable == null) recoverable = true;
    }
}
