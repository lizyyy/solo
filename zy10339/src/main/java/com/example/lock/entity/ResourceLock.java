package com.example.lock.entity;

import com.example.lock.enums.LockStatus;
import com.example.lock.enums.OperationSource;
import com.example.lock.enums.TimeoutStrategy;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "resource_lock")
public class ResourceLock {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "resource_id", nullable = false, unique = true)
    private String resourceId;

    @Column(name = "lock_holder")
    private String lockHolder;

    @Column(name = "request_id", unique = true)
    private String requestId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private LockStatus status;

    @Enumerated(EnumType.STRING)
    @Column(name = "operation_source")
    private OperationSource operationSource;

    @Enumerated(EnumType.STRING)
    @Column(name = "timeout_strategy")
    private TimeoutStrategy timeoutStrategy;

    @Column(name = "timeout_seconds")
    private Integer timeoutSeconds;

    @Column(name = "lock_time")
    private LocalDateTime lockTime;

    @Column(name = "expire_time")
    private LocalDateTime expireTime;

    @Column(name = "release_time")
    private LocalDateTime releaseTime;

    @Column(name = "wait_queue_position")
    private Integer waitQueuePosition;

    @Column(name = "conflict_reason")
    private String conflictReason;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
