package com.performancereview.entity;

import com.performancereview.enums.BottleneckSeverity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "io_blocks")
@Data
@EqualsAndHashCode(callSuper = true)
public class IoBlock extends BaseEntity {

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "thread_name")
    private String threadName;

    @Column(name = "thread_id")
    private Long threadId;

    @Column(name = "thread_state")
    private String threadState;

    @Column(name = "io_type")
    private String ioType;

    @Column(name = "resource_path")
    private String resourcePath;

    @Column(name = "resource_type")
    private String resourceType;

    @Column(name = "block_duration_ms")
    private Long blockDurationMs;

    @Column(name = "bytes_transferred")
    private Long bytesTransferred;

    @Column(name = "transfer_rate_bytes_per_second")
    private Double transferRateBytesPerSecond;

    @Column(name = "stack_trace", columnDefinition = "TEXT")
    private String stackTrace;

    @Column(name = "method_name")
    private String methodName;

    @Column(name = "class_name")
    private String className;

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
