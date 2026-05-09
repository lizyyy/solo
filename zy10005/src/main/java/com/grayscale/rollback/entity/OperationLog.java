package com.grayscale.rollback.entity;

import com.grayscale.rollback.enums.OperationType;
import com.grayscale.rollback.enums.ReleaseStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "operation_logs", indexes = {
    @Index(name = "idx_log_release_id", columnList = "releaseId"),
    @Index(name = "idx_log_operation_type", columnList = "operationType"),
    @Index(name = "idx_log_created_at", columnList = "createdAt"),
    @Index(name = "idx_log_operation_id", columnList = "operationId", unique = true)
})
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OperationLog {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(nullable = false)
    private String operationId;
    
    @Column(nullable = false)
    private String releaseId;
    
    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private OperationType operationType;
    
    @Column(columnDefinition = "TEXT")
    private String beforeState;
    
    @Column(columnDefinition = "TEXT")
    private String afterState;
    
    @Enumerated(EnumType.STRING)
    private ReleaseStatus statusBefore;
    
    @Enumerated(EnumType.STRING)
    private ReleaseStatus statusAfter;
    
    @Column(nullable = false)
    private Boolean success;
    
    @Column(columnDefinition = "TEXT")
    private String errorMessage;
    
    @Column(nullable = false)
    private String operator;
    
    @Column(columnDefinition = "TEXT")
    private String requestDetails;
    
    private Long durationMs;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (success == null) {
            success = true;
        }
    }
}
