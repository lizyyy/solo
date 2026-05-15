package com.business.recalculate.model;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "comparison_result")
public class ComparisonResult {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long batchId;

    @Column(nullable = false)
    private String batchNo;

    private Integer totalComparedCount;

    private Integer identicalCount;

    private Integer differentCount;

    private Integer newCount;

    private Integer missingCount;

    private BigDecimal differenceAmount;

    private BigDecimal differenceRate;

    @Column(length = 4000)
    private String differenceSummary;

    @Lob
    @Column(columnDefinition = "CLOB")
    private String differenceDetailJson;

    private Boolean passed;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
