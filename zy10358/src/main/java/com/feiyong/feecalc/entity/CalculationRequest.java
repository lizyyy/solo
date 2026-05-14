package com.feiyong.feecalc.entity;

import com.feiyong.feecalc.enums.CalculationStatus;
import lombok.Data;

import javax.persistence.*;
import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "calculation_request")
public class CalculationRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 64)
    private String requestNo;

    @Column(nullable = false, length = 64)
    private String bizType;

    @Column(nullable = false, length = 64)
    private String bizNo;

    @Column(length = 64)
    private String userId;

    @Column(nullable = false, length = 64)
    private String ruleCode;

    @Column(precision = 18, scale = 4)
    private BigDecimal quantity;

    @Column(length = 2048)
    private String discountCodes;

    @Column(length = 2048)
    private String extraParams;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private CalculationStatus status;

    @Column(precision = 18, scale = 2)
    private BigDecimal originalAmount;

    @Column(precision = 18, scale = 2)
    private BigDecimal discountAmount;

    @Column(precision = 18, scale = 2)
    private BigDecimal finalAmount;

    @Column(length = 1024)
    private String errorMessage;

    @Column
    private LocalDateTime expiredAt;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime updatedAt;

    @Version
    private Integer version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) {
            status = CalculationStatus.CREATED;
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
