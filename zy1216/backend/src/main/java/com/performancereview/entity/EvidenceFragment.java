package com.performancereview.entity;

import com.performancereview.enums.PerformanceMetricType;
import jakarta.persistence.*;
import lombok.Data;
import lombok.EqualsAndHashCode;

import java.time.LocalDateTime;

@Entity
@Table(name = "evidence_fragments")
@Data
@EqualsAndHashCode(callSuper = true)
public class EvidenceFragment extends BaseEntity {

    @Column(name = "timestamp")
    private LocalDateTime timestamp;

    @Enumerated(EnumType.STRING)
    @Column(name = "metric_type")
    private PerformanceMetricType metricType;

    @Column(name = "metric_id")
    private Long metricId;

    @Column(name = "fragment_title")
    private String fragmentTitle;

    @Column(name = "fragment_content", columnDefinition = "TEXT")
    private String fragmentContent;

    @Column(name = "fragment_type")
    private String fragmentType;

    @Column(name = "source_file")
    private String sourceFile;

    @Column(name = "line_start")
    private Integer lineStart;

    @Column(name = "line_end")
    private Integer lineEnd;

    @Column(name = "is_key_evidence")
    private Boolean isKeyEvidence;

    @Column(name = "notes", columnDefinition = "TEXT")
    private String notes;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "incident_id")
    private Incident incident;
}
