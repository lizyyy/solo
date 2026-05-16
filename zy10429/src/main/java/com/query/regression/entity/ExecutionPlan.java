package com.query.regression.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "execution_plans")
public class ExecutionPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long regressionRecordId;

    @Column(nullable = false, length = 50)
    private String planType;

    @Column(columnDefinition = "TEXT", nullable = false)
    private String rawPlan;

    @Column(columnDefinition = "TEXT")
    private String planSummary;

    @Column
    private Double estimatedCost;

    @Column
    private Long estimatedRows;

    @Column
    private Integer joinCount;

    @Column
    private Integer fullScanCount;

    @Column(length = 1000)
    private String indexesUsed;

    @Column
    private LocalDateTime capturedAt;

    @Column
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
