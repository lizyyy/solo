package com.privacy.replay.model;

import lombok.Data;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "privacy_budgets")
public class PrivacyBudget {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String budgetId;

    @Column(nullable = false)
    private String userId;

    @Column(nullable = false)
    private BigDecimal totalBudget;

    @Column(nullable = false)
    private BigDecimal usedBudget = BigDecimal.ZERO;

    @Column(nullable = false)
    private BigDecimal remainingBudget;

    @Column(nullable = false)
    private Integer maxUsageCount;

    @Column(nullable = false)
    private Integer usedCount = 0;

    @Column(nullable = false)
    private Integer remainingCount;

    @Column(nullable = false)
    @Enumerated(EnumType.STRING)
    private MaskingLevel defaultMaskingLevel = MaskingLevel.MEDIUM;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private LocalDateTime expiredAt;

    @Column(nullable = false)
    private Boolean isActive = true;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (remainingBudget == null) {
            remainingBudget = totalBudget;
        }
        if (remainingCount == null) {
            remainingCount = maxUsageCount;
        }
    }
}
