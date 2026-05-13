package com.example.lock.entity;

import com.example.lock.enums.OperationSource;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "release_audit")
public class ReleaseAudit {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "resource_id", nullable = false)
    private String resourceId;

    @Column(name = "lock_holder")
    private String lockHolder;

    @Column(name = "request_id")
    private String requestId;

    @Enumerated(EnumType.STRING)
    @Column(name = "release_source", nullable = false)
    private OperationSource releaseSource;

    @Column(name = "release_reason")
    private String releaseReason;

    @Column(name = "lock_duration_seconds")
    private Long lockDurationSeconds;

    @Column(name = "released_at", nullable = false)
    private LocalDateTime releasedAt;

    @PrePersist
    protected void onCreate() {
        releasedAt = LocalDateTime.now();
    }
}
