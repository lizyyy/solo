package com.diagnostic.entity;

import com.diagnostic.enums.DiagnosticStatus;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "connection_pool_diagnostic", indexes = {
    @Index(name = "idx_instance_pool", columnList = "instance_id, pool_name"),
    @Index(name = "idx_sample_time", columnList = "sample_time"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_suspected_leak", columnList = "suspected_leak")
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConnectionPoolDiagnostic {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "instance_id", nullable = false, length = 128)
    private String instanceId;

    @Column(name = "pool_name", nullable = false, length = 64)
    private String poolName;

    @Column(name = "sample_time", nullable = false)
    private LocalDateTime sampleTime;

    @Column(name = "total_connections")
    private Integer totalConnections;

    @Column(name = "active_connections")
    private Integer activeConnections;

    @Column(name = "idle_connections")
    private Integer idleConnections;

    @Column(name = "waiting_threads")
    private Integer waitingThreads;

    @Column(name = "max_pool_size")
    private Integer maxPoolSize;

    @Column(name = "connection_usage_avg_time")
    private Long connectionUsageAvgTime;

    @Column(name = "connection_usage_max_time")
    private Long connectionUsageMaxTime;

    @Column(name = "stack_summary", columnDefinition = "TEXT")
    private String stackSummary;

    @Column(name = "stack_details", columnDefinition = "CLOB")
    private String stackDetails;

    @Column(name = "suspected_leak", nullable = false)
    private Boolean suspectedLeak;

    @Column(name = "leak_confidence")
    private Integer leakConfidence;

    @Column(name = "consecutive_leak_samples")
    private Integer consecutiveLeakSamples;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private DiagnosticStatus status;

    @Column(name = "raw_input", columnDefinition = "CLOB")
    private String rawInput;

    @Column(name = "processing_basis", columnDefinition = "TEXT")
    private String processingBasis;

    @Column(name = "final_conclusion", columnDefinition = "TEXT")
    private String finalConclusion;

    @Column(name = "reviewer", length = 64)
    private String reviewer;

    @Column(name = "review_time")
    private LocalDateTime reviewTime;

    @Column(name = "review_comment", columnDefinition = "TEXT")
    private String reviewComment;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = DiagnosticStatus.PENDING;
        }
        if (suspectedLeak == null) {
            suspectedLeak = false;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}