package com.featureflag.audit.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "hit_rules")
public class HitRule {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "experiment_id", nullable = false)
    private Experiment experiment;

    @Column(nullable = false)
    private String attributeName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private Operator operator;

    @Column(nullable = false)
    private String attributeValue;

    @Column(nullable = false)
    private Integer priority = 0;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum Operator {
        EQUALS, NOT_EQUALS, CONTAINS, NOT_CONTAINS,
        GREATER_THAN, LESS_THAN, GREATER_THAN_OR_EQUAL, LESS_THAN_OR_EQUAL,
        IN, NOT_IN, REGEX
    }
}
