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
@Table(name = "deduction_records")
@EntityListeners(AuditingEntityListener.class)
public class DeductionRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String recordNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_id", nullable = false)
    private InspectionResult inspectionResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "rule_id")
    private DeductionRule deductionRule;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private OutsourcingOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private DeliveryBatch batch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(length = 20)
    private String defectType;

    @Column(precision = 18, scale = 2)
    private BigDecimal defectiveQuantity;

    @Column(nullable = false, precision = 20, scale = 2)
    private BigDecimal deductionAmount;

    @Column(length = 20)
    private String deductionMethod;

    @Column(columnDefinition = "TEXT")
    private String deductionReason;

    @Column(length = 20)
    private String recordStatus;

    @Column(columnDefinition = "TEXT")
    private String approvalRemark;

    @Column(length = 50)
    private String approver;

    @Column
    private LocalDateTime approvedAt;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(columnDefinition = "TEXT")
    private String failureReason;

    @Column(columnDefinition = "TEXT")
    private String retryDescription;

    @Column
    private Integer retryCount = 0;

    public static final String STATUS_PENDING = "待审批";
    public static final String STATUS_APPROVED = "已审批";
    public static final String STATUS_REJECTED = "已驳回";
    public static final String STATUS_FAILED = "执行失败";
    public static final String STATUS_COMPLETED = "已完成";
}
