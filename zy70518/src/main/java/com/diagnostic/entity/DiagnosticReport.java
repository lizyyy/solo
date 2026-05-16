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
@Table(name = "diagnostic_report")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DiagnosticReport {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "report_no", nullable = false, unique = true, length = 64)
    private String reportNo;

    @Column(name = "instance_id", nullable = false, length = 128)
    private String instanceId;

    @Column(name = "pool_name", nullable = false, length = 64)
    private String poolName;

    @Column(name = "start_time", nullable = false)
    private LocalDateTime startTime;

    @Column(name = "end_time")
    private LocalDateTime endTime;

    @Column(name = "sample_count")
    private Integer sampleCount;

    @Column(name = "leak_sample_count")
    private Integer leakSampleCount;

    @Column(name = "max_active_connections")
    private Integer maxActiveConnections;

    @Column(name = "max_waiting_threads")
    private Integer maxWaitingThreads;

    @Column(name = "avg_connection_usage_time")
    private Long avgConnectionUsageTime;

    @Column(name = "stack_analysis", columnDefinition = "TEXT")
    private String stackAnalysis;

    @Column(name = "leak_probability")
    private Integer leakProbability;

    @Column(name = "recommendations", columnDefinition = "TEXT")
    private String recommendations;

    @Enumerated(EnumType.STRING)
    @Column(name = "final_status", length = 32)
    private DiagnosticStatus finalStatus;

    @Column(name = "generated_at", nullable = false)
    private LocalDateTime generatedAt;

    @Column(name = "generated_by", length = 64)
    private String generatedBy;

    @Column(name = "exported_at")
    private LocalDateTime exportedAt;

    @Column(name = "export_format", length = 16)
    private String exportFormat;

    @PrePersist
    protected void onCreate() {
        generatedAt = LocalDateTime.now();
    }
}