package com.performancereview.entity;

import com.performancereview.enums.BottleneckSeverity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "cpu_hot_spots")
@Data
@EqualsAndHashCode(callSuper = true)
public class CpuHotSpot extends BaseEntity {

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "cpu_usage_percent")
    private Double cpuUsagePercent;

    @Column(name = "method_name")
    private String methodName;

    @Column(name = "class_name")
    private String className;

    @Column(name = "line_number")
    private Integer lineNumber;

    @Column(name = "sample_count")
    private Integer sampleCount;

    @Column(name = "self_time_ms")
    private Long selfTimeMs;

    @Column(name = "total_time_ms")
    private Long totalTimeMs;

    @Column(name = "thread_name")
    private String threadName;

    @Column(name = "thread_state")
    private String threadState;

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
