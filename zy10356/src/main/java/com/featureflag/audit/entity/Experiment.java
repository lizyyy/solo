package com.featureflag.audit.entity;

import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "experiments")
public class Experiment {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String experimentKey;

    @Column(nullable = false)
    private String name;

    @Column(length = 1000)
    private String description;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(nullable = false)
    private Integer trafficPercentage = 100;

    @Column(nullable = false)
    private String salt;

    @OneToMany(mappedBy = "experiment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<HitRule> rules = new ArrayList<>();

    @OneToMany(mappedBy = "experiment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<BucketValue> buckets = new ArrayList<>();

    @OneToMany(mappedBy = "experiment", cascade = CascadeType.ALL, orphanRemoval = true)
    private List<OverrideReason> overrides = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ExperimentStatus status = ExperimentStatus.DRAFT;

    private LocalDateTime startTime;
    private LocalDateTime endTime;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum ExperimentStatus {
        DRAFT, RUNNING, PAUSED, COMPLETED, ARCHIVED
    }
}
