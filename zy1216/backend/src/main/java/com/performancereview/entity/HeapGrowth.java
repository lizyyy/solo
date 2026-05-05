package com.performancereview.entity;

import com.performancereview.enums.BottleneckSeverity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "heap_growths")
@Data
@EqualsAndHashCode(callSuper = true)
public class HeapGrowth extends BaseEntity {

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "heap_used_bytes")
    private Long heapUsedBytes;

    @Column(name = "heap_max_bytes")
    private Long heapMaxBytes;

    @Column(name = "heap_percent")
    private Double heapPercent;

    @Column(name = "old_gen_used_bytes")
    private Long oldGenUsedBytes;

    @Column(name = "eden_used_bytes")
    private Long edenUsedBytes;

    @Column(name = "survivor_used_bytes")
    private Long survivorUsedBytes;

    @Column(name = "growth_rate_bytes_per_second")
    private Double growthRateBytesPerSecond;

    @Column(name = "object_class_name")
    private String objectClassName;

    @Column(name = "object_count")
    private Long objectCount;

    @Column(name = "object_size_bytes")
    private Long objectSizeBytes;

    @Column(name = "retained_size_bytes")
    private Long retainedSizeBytes;

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
