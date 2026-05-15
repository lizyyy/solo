package com.compensation.entity;

import com.compensation.enums.CompensationStatus;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "compensation_task")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CompensationTask {
    
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    @Column(unique = true, nullable = false, length = 64)
    private String taskId;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "request_id", nullable = false)
    private UndoRequest undoRequest;
    
    @Column(nullable = false, length = 128)
    private String taskName;
    
    @Column(nullable = false)
    private Integer taskOrder;
    
    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CompensationStatus status;
    
    @Column(length = 2048)
    private String taskData;
    
    @Column(length = 2048)
    private String taskResult;
    
    private Integer retryCount;
    
    private Integer maxRetry;
    
    private LocalDateTime nextRetryTime;
    
    @Column(length = 512)
    private String dependOnTaskIds;
    
    @Column(length = 128)
    private String executedBy;
    
    private LocalDateTime startedAt;
    
    private LocalDateTime completedAt;
    
    @OneToOne(mappedBy = "compensationTask", cascade = CascadeType.ALL)
    private FailureReason failureReason;
    
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;
    
    private LocalDateTime updatedAt;
    
    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = CompensationStatus.PENDING;
        if (retryCount == null) retryCount = 0;
        if (maxRetry == null) maxRetry = 3;
    }
    
    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
