package com.query.regression.entity;

import com.query.regression.enums.ConclusionType;
import com.query.regression.enums.RegressionStatus;
import com.query.regression.enums.RiskLevel;
import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "regression_records")
public class RegressionRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 255)
    private String queryName;

    @Column(nullable = false)
    private Long templateId;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String rawInput;

    @Column(columnDefinition = "TEXT")
    private String errorMessage;

    @Column(columnDefinition = "TEXT")
    private String stackTrace;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 50)
    private RegressionStatus status;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private RiskLevel riskLevel;

    @Enumerated(EnumType.STRING)
    @Column(length = 50)
    private ConclusionType conclusion;

    @Column(columnDefinition = "TEXT")
    private String conclusionNotes;

    @Column(length = 255)
    private String confirmedBy;

    @Column
    private LocalDateTime confirmedAt;

    @Column
    private Double costDiffPercentage;

    @Column
    private Integer planDiffCount;

    @Column(length = 255)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = RegressionStatus.CREATED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
