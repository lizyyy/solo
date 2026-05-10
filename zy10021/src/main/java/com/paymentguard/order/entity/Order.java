package com.paymentguard.order.entity;

import com.paymentguard.common.enums.OrderStatus;
import com.paymentguard.common.util.IdGenerator;
import javax.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "orders", indexes = {
        @Index(name = "idx_orders_order_id", columnList = "order_id", unique = true),
        @Index(name = "idx_orders_status", columnList = "status"),
        @Index(name = "idx_orders_merchant_id", columnList = "merchant_id"),
        @Index(name = "idx_orders_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Order {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "order_id", unique = true, nullable = false, length = 32)
    private String orderId;

    @Column(name = "product_name", nullable = false, length = 255)
    private String productName;

    @Column(name = "amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private OrderStatus status;

    @Column(name = "merchant_id", length = 64)
    private String merchantId;

    @Column(name = "notify_url", length = 512)
    private String notifyUrl;

    @Column(name = "extra", length = 1024)
    private String extra;

    @Column(name = "paid_amount", precision = 18, scale = 2)
    private BigDecimal paidAmount;

    @Column(name = "payment_count", nullable = false)
    @Builder.Default
    private Integer paymentCount = 0;

    @Version
    @Column(name = "version", nullable = false)
    private Integer version;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (orderId == null) {
            orderId = IdGenerator.generateOrderId();
        }
        if (status == null) {
            status = OrderStatus.PENDING;
        }
        if (currency == null) {
            currency = "CNY";
        }
        if (paymentCount == null) {
            paymentCount = 0;
        }
        if (version == null) {
            version = 0;
        }
        LocalDateTime now = LocalDateTime.now();
        if (createdAt == null) {
            createdAt = now;
        }
        updatedAt = now;
    }

    @PreUpdate
    public void preUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public boolean canPay() {
        return status == OrderStatus.PENDING;
    }

    public void markPaid(BigDecimal paidAmount) {
        this.status = OrderStatus.PAID;
        this.paidAmount = paidAmount;
        this.paymentCount++;
    }

    public void incrementPaymentCount() {
        this.paymentCount++;
    }
}
