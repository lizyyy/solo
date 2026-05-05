package com.performancereview.entity;

import com.performancereview.enums.BottleneckSeverity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "lock_wait_chains")
@Data
@EqualsAndHashCode(callSuper = true)
public class LockWaitChain extends BaseEntity {

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "lock_name")
    private String lockName;

    @Column(name = "lock_type")
    private String lockType;

    @Column(name = "lock_owner_thread_name")
    private String lockOwnerThreadName;

    @Column(name = "lock_owner_thread_id")
    private Long lockOwnerThreadId;

    @Column(name = "lock_owner_state")
    private String lockOwnerState;

    @Column(name = "lock_owner_stack_trace", columnDefinition = "TEXT")
    private String lockOwnerStackTrace;

    @Column(name = "waiting_thread_name")
    private String waitingThreadName;

    @Column(name = "waiting_thread_id")
    private Long waitingThreadId;

    @Column(name = "waiting_thread_state")
    private String waitingThreadState;

    @Column(name = "waiting_stack_trace", columnDefinition = "TEXT")
    private String waitingStackTrace;

    @Column(name = "wait_duration_ms")
    private Long waitDurationMs;

    @Column(name = "chain_level")
    private Integer chainLevel;

    @Column(name = "parent_chain_id")
    private Long parentChainId;

    @Column(name = "deadlock_detected")
    private Boolean deadlockDetected;

    @Enumerated(EnumType.STRING)
    @Column(name = "severity")
    private BottleneckSeverity severity;

    @Column(name = "evidence_snippet", columnDefinition = "TEXT")
    private String evidenceSnippet;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id")
    private Incident incident;
}
