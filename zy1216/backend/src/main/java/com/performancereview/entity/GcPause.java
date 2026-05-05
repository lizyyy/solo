package com.performancereview.entity;

import com.performancereview.enums.BottleneckSeverity;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "gc_pauses")
@Data
@EqualsAndHashCode(callSuper = true)
public class GcPause extends BaseEntity {

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Column(name = "gc_type")
    private String gcType;

    @Column(name = "gc_cause")
    private String gcCause;

    @Column(name = "pause_duration_ms")
    private Double pauseDurationMs;

    @Column(name = "total_duration_ms")
    private Double totalDurationMs;

    @Column(name = "young_gen_before_bytes")
    private Long youngGenBeforeBytes;

    @Column(name = "young_gen_after_bytes")
    private Long youngGenAfterBytes;

    @Column(name = "old_gen_before_bytes")
    private Long oldGenBeforeBytes;

    @Column(name = "old_gen_after_bytes")
    private Long oldGenAfterBytes;

    @Column(name = "heap_before_bytes")
    private Long heapBeforeBytes;

    @Column(name = "heap_after_bytes")
    private Long heapAfterBytes;

    @Column(name = "metaspace_before_bytes")
    private Long metaspaceBeforeBytes;

    @Column(name = "metaspace_after_bytes")
    private Long metaspaceAfterBytes;

    @Column(name = "concurrent_mark_fail")
    private Boolean concurrentMarkFail;

    @Column(name = "to_space_exhausted")
    private Boolean toSpaceExhausted;

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
