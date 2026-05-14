package com.quota.arbitration.entity;

import javax.persistence.*;
import lombok.Data;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "shared_pool")
public class SharedPool {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String poolCode;

    @Column(nullable = false)
    private String poolName;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal totalCapacity;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal allocatedAmount;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal availableAmount;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal maxBorrowPerApplication;

    @Column(nullable = false)
    private Boolean isActive;

    private String description;

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
        if (allocatedAmount == null) allocatedAmount = BigDecimal.ZERO;
        if (availableAmount == null) availableAmount = totalCapacity;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
