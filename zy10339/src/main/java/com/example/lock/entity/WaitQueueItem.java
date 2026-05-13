package com.example.lock.entity;

import com.example.lock.enums.LockStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "wait_queue_item")
public class WaitQueueItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "resource_id", nullable = false)
    private String resourceId;

    @Column(name = "lock_holder", nullable = false)
    private String lockHolder;

    @Column(name = "request_id", unique = true)
    private String requestId;

    @Column(name = "queue_position", nullable = false)
    private Integer queuePosition;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false)
    private LockStatus status;

    @Column(name = "queued_at", nullable = false)
    private LocalDateTime queuedAt;

    @Column(name = "acquired_at")
    private LocalDateTime acquiredAt;

    @Column(name = "timeout_seconds")
    private Integer timeoutSeconds;

    @PrePersist
    protected void onCreate() {
        queuedAt = LocalDateTime.now();
    }
}
