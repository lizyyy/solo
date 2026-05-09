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
@Table(name = "replenishment_tasks")
@EntityListeners(AuditingEntityListener.class)
public class ReplenishmentTask {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true, length = 50)
    private String taskNo;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "order_id", nullable = false)
    private OutsourcingOrder order;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private DeliveryBatch batch;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "inspection_id", nullable = false)
    private InspectionResult inspectionResult;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "supplier_id", nullable = false)
    private Supplier supplier;

    @Column(nullable = false, precision = 18, scale = 2)
    private BigDecimal requiredQuantity;

    @Column(precision = 18, scale = 2)
    private BigDecimal receivedQuantity = BigDecimal.ZERO;

    @Column(precision = 18, scale = 2)
    private BigDecimal remainingQuantity;

    @Column
    private LocalDate requiredDate;

    @Column
    private LocalDate actualDeliveryDate;

    @Column(length = 20)
    private String taskStatus;

    @Column(length = 50)
    private String handler;

    @Column(columnDefinition = "TEXT")
    private String taskDescription;

    @Column(columnDefinition = "TEXT")
    private String supplierResponse;

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

    public static final String STATUS_CREATED = "已创建";
    public static final String STATUS_NOTIFIED = "已通知供应商";
    public static final String STATUS_CONFIRMED = "供应商已确认";
    public static final String STATUS_IN_PROGRESS = "补货中";
    public static final String STATUS_PARTIAL = "部分补货";
    public static final String STATUS_COMPLETED = "已完成";
    public static final String STATUS_CANCELLED = "已取消";
    public static final String STATUS_FAILED = "执行失败";
    public static final String STATUS_PENDING_RETRY = "待重试";
}
