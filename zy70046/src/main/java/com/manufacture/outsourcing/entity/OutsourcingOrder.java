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
@Table(name = "outsourcing_orders")
@EntityListeners(AuditingEntityListener.class)
public class OutsourcingOrder {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String orderNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(nullable = false, length = 100)
    private String productCode;

    @Column(nullable = false, length = 200)
    private String productName;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal orderQuantity;

    @Column(nullable = false, precision = 18, scale = 4)
    private BigDecimal unitPrice;

    @Column(nullable = false, precision = 20, scale = 2)
    private BigDecimal totalAmount;

    @Column(nullable = false)
    private LocalDate orderDate;

    @Column
    private LocalDate deliveryDeadline;

    @Column(length = 20)
    private String orderStatus;

    @Column(columnDefinition = "TEXT")
    private String remark;

    @CreatedDate
    @Column(nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @LastModifiedDate
    @Column(nullable = false)
    private LocalDateTime updatedAt;

    @Column(precision = 18, scale = 2)
    private BigDecimal deliveredQuantity = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal qualifiedQuantity = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal unqualifiedQuantity = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal replenishmentQuantity = BigDecimal.ZERO;

    @Column(precision = 20, scale = 2)
    private BigDecimal deductionAmount = BigDecimal.ZERO;

    public static final String STATUS_DRAFT = "草稿";
    public static final String STATUS_CONFIRMED = "已确认";
    public static final String STATUS_IN_PRODUCTION = "生产中";
    public static final String STATUS_PARTIAL_DELIVERY = "部分到货";
    public static final String STATUS_INSPECTION = "验收中";
    public static final String STATUS_COMPLETED = "已完成";
    public static final String STATUS_CLOSED = "已结案";
}
