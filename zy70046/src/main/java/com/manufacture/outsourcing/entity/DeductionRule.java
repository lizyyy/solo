package com.manufacture.outsourcing.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "deduction_rules")
@EntityListeners(AuditingEntityListener.class)
public class DeductionRule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 50)
    private String ruleCode;

    @Column(nullable = false, length = 200)
    private String ruleName;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id")
    private Supplier supplier;

    @Column(length = 20)
    private String defectType;

    @Column(length = 20)
    private String calculationMethod;

    @Column(precision = 18, scale = 4)
    private BigDecimal minRate;

    @Column(precision = 18, scale = 4)
    private BigDecimal maxRate;

    @Column(precision = 20, scale = 2)
    private BigDecimal fixedAmount;

    @Column(precision = 18, scale = 2)
    private BigDecimal thresholdQuantity;

    @Column(columnDefinition = "TEXT")
    private String description;

    @Column(nullable = false)
    private Boolean isActive;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    public static final String METHOD_PERCENTAGE = "按比例扣款";
    public static final String METHOD_FIXED = "固定金额扣款";
    public static final String METHOD_MULTIPLE = "倍数扣款";

    public static final String DEFECT_APPEARANCE = "外观不良";
    public static final String DEFECT_DIMENSION = "尺寸超差";
    public static final String DEFECT_FUNCTION = "功能缺陷";
    public static final String DEFECT_OTHER = "其他问题";
}
