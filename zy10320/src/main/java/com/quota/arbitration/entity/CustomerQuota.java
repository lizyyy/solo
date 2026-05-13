package com.quota.arbitration.entity;

import jakarta.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "customer_quota")
public class CustomerQuota {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String customerId;

    @Column(nullable = false)
    private String customerName;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal totalQuota;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal usedQuota;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal availableQuota;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal lockedQuota;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal borrowedQuota;

    private LocalDateTime effectiveDate;

    private LocalDateTime expiryDate;

    @Column(nullable = false)
    private Boolean isActive;

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
        if (isActive == null) isActive = true;
        if (usedQuota == null) usedQuota = BigDecimal.ZERO;
        if (availableQuota == null) availableQuota = totalQuota;
        if (lockedQuota == null) lockedQuota = BigDecimal.ZERO;
        if (borrowedQuota == null) borrowedQuota = BigDecimal.ZERO;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
