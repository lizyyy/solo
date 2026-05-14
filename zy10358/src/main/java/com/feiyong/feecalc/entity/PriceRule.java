package com.feiyong.feecalc.entity;

import lombok.Data;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "price_rule")
public class PriceRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String ruleCode;

    @Column(nullable = false, length = 128)
    private String ruleName;

    @Column(length = 512)
    private String description;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal basePrice;

    @Column(precision = 18, scale = 2)
    private BigDecimal unitPrice;

    @Column(length = 32)
    private String unit;

    @Column(length = 1024)
    private String formula;

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
