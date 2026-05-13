package com.quota.arbitration.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "deduction_detail")
public class DeductionDetail {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String transactionNo;

    @Column(nullable = false)
    private Long applicationId;

    @Column(nullable = false)
    private String applicationNo;

    @Column(nullable = false)
    private String customerId;

    @Column(nullable = false)
    private String poolCode;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(nullable = false)
    private String deductionType;

    @Column(length = 1000)
    private String remarks;

    @Column(nullable = false)
    private String operator;

    @Column(nullable = false)
    private LocalDateTime transactionTime;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        if (transactionTime == null) transactionTime = LocalDateTime.now();
    }
}
