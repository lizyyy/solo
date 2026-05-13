package com.quota.arbitration.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "return_plan")
public class ReturnPlan {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private Long applicationId;

    @Column(nullable = false)
    private String applicationNo;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal totalReturnAmount;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal returnedAmount;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal remainingAmount;

    @Column(nullable = false)
    private LocalDateTime planReturnDate;

    private LocalDateTime actualReturnDate;

    @Column(nullable = false)
    private Boolean isCompleted;

    @Column(length = 1000)
    private String remarks;

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
        if (isCompleted == null) isCompleted = false;
        if (returnedAmount == null) returnedAmount = BigDecimal.ZERO;
        if (remainingAmount == null) remainingAmount = totalReturnAmount;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
