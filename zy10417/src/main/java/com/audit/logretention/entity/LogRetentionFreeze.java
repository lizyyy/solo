package com.audit.logretention.entity;

import com.audit.logretention.enums.FreezeReason;
import com.audit.logretention.enums.FreezeStatus;
import lombok.Data;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "log_retention_freeze")
public class LogRetentionFreeze {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String requestId;

    @Column(nullable = false, length = 128)
    private String logTopic;

    @Column(nullable = false)
    private LocalDateTime startTime;

    @Column(nullable = false)
    private LocalDateTime endTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FreezeReason freezeReason;

    @Column(length = 512)
    private String freezeReasonDetail;

    @Column(nullable = false, length = 64)
    private String applicant;

    @Column(length = 512)
    private String releaseCondition;

    @Column(length = 64)
    private String reviewer;

    @Column(length = 512)
    private String reviewComment;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private FreezeStatus status;

    @Column(columnDefinition = "TEXT")
    private String retentionReport;

    @Column(length = 256)
    private String originalInput;

    @Column(length = 512)
    private String processingConclusion;

    @Column
    private LocalDateTime reviewedAt;

    @Column
    private LocalDateTime releasedAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}