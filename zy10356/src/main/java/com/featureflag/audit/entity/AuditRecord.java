package com.featureflag.audit.entity;

import javax.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "audit_records", indexes = {
    @Index(name = "idx_experiment_user", columnList = "experimentKey, userIdentifier"),
    @Index(name = "idx_request_id", columnList = "requestId", unique = true),
    @Index(name = "idx_created_at", columnList = "createdAt")
})
public class AuditRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String requestId;

    @Column(nullable = false)
    private String experimentKey;

    @Column(nullable = false)
    private String userIdentifier;

    private String userAttributes;

    private String matchedRules;

    private String bucketKey;

    private String bucketValue;

    private String overrideReason;

    private String overrideType;

    @Enumerated(EnumType.STRING)
    private HitResult hitResult;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AuditStatus status;

    @Column(length = 2000)
    private String errorMessage;

    private Integer retryCount = 0;

    private LocalDateTime compensatedAt;

    private String compensatedBy;

    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt = LocalDateTime.now();

    @Column(nullable = false)
    private LocalDateTime updatedAt = LocalDateTime.now();

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public enum HitResult {
        HIT, MISS, OVERRIDDEN, ERROR, NOT_IN_TRAFFIC
    }

    public enum AuditStatus {
        PENDING, SUCCESS, FAILED, COMPENSATED, EXPORTED
    }
}
