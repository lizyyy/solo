package com.manufacture.outsourcing.entity;

import jakarta.persistence.*;
import lombok.Data;
import org.springframework.data.annotation.CreatedDate;
import org.springframework.data.annotation.LastModifiedDate;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "delivery_batches")
@EntityListeners(AuditingEntityListener.class)
public class DeliveryBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String batchNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private OutsourcingOrder order;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal deliveryQuantity;

    @Column(nullable = false)
    private LocalDate deliveryDate;

    @Column(length = 100)
    private String deliveryPerson;

    @Column(length = 50)
    private String waybillNo;

    @Column(length = 20)
    private String batchStatus;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(precision = 18, scale = 2)
    private BigDecimal qualifiedQuantity = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal unqualifiedQuantity = BigDecimal.ZERO;

    @Column(precision = 20, scale = 2)
    private BigDecimal deductionAmount = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal replenishmentQuantity = BigDecimal.ZERO;

    @Column(length = 500)
    private String processDescription;

    public static final String STATUS_PENDING = "待验收";
    public static final String STATUS_INSPECTION = "验收中";
    public static final String STATUS_INSPECTION_FAILED = "验收失败";
    public static final String STATUS_PARTIAL_PASS = "部分合格";
    public static final String STATUS_QUALIFIED = "全部合格";
    public static final String STATUS_UNQUALIFIED = "全部不合格";
    public static final String STATUS_CLOSED = "已结案";
}
