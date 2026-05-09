package com.paymentguard.payment.entity;

import com.paymentguard.common.enums.PaymentStatus;
import com.paymentguard.common.util.IdGenerator;
import jakarta.persistence.*;
import lombok.*;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(name = "payment_transactions", indexes = {
        @Index(name = "idx_transactions_transaction_id", columnList = "transaction_id", unique = true),
        @Index(name = "idx_transactions_order_id", columnList = "order_id"),
        @Index(name = "idx_transactions_status", columnList = "status"),
        @Index(name = "idx_transactions_channel_order_id", columnList = "channel_order_id"),
        @Index(name = "idx_transactions_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PaymentTransaction {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "transaction_id", unique = true, nullable = false, length = 32)
    private String transactionId;

    @Column(name = "order_id", nullable = false, length = 32)
    private String orderId;

    @Column(name = "amount", nullable = false, precision = 18, scale = 2)
    private BigDecimal amount;

    @Column(name = "currency", nullable = false, length = 10)
    private String currency;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private PaymentStatus status;

    @Column(name = "payment_method", length = 32)
    private String paymentMethod;

    @Column(name = "channel_order_id", length = 128)
    private String channelOrderId;

    @Column(name = "bank_order_no", length = 128)
    private String bankOrderNo;

    @Column(name = "merchant_id", length = 64)
    private String merchantId;

    @Column(name = "success_time")
    private LocalDateTime successTime;

    @Column(name = "raw_data", length = 4000)
    private String rawData;

    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (transactionId == null) {
            transactionId = IdGenerator.generateTransactionId();
        }
        if (currency == null) {
            currency = "CNY";
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
}
