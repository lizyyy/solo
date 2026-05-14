package com.feiyong.feecalc.entity;

import com.feiyong.feecalc.enums.DiscountType;
import lombok.Data;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "discount_item")
public class DiscountItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 64)
    private String discountCode;

    @Column(nullable = false, length = 128)
    private String discountName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DiscountType discountType;

    @Column(precision = 10, scale = 2)
    private BigDecimal percentage;

    @Column(precision = 18, scale = 2)
    private BigDecimal fixedAmount;

    @Column(precision = 18, scale = 2)
    private BigDecimal minAmount;

    @Column(precision = 18, scale = 2)
    private BigDecimal maxDiscount;

    @Column(length = 1024)
    private String applyCondition;

    @Column(nullable = false)
    private Integer priority = 0;

    @Column(nullable = false)
    private Boolean enabled = true;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;

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
