package com.paymentguard.payment.entity;

import com.paymentguard.common.enums.CallbackStatus;
import com.paymentguard.common.util.IdGenerator;
import javax.persistence.*;
import lombok.*;

import java.time.LocalDateTime;

@Entity
@Table(name = "callback_records", indexes = {
        @Index(name = "idx_callback_order_id", columnList = "order_id"),
        @Index(name = "idx_callback_transaction_id", columnList = "transaction_id"),
        @Index(name = "idx_callback_trace_id", columnList = "trace_id"),
        @Index(name = "idx_callback_status", columnList = "status"),
        @Index(name = "idx_callback_created_at", columnList = "created_at")
})
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CallbackRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "callback_id", unique = true, nullable = false, length = 32)
    private String callbackId;

    @Column(name = "order_id", nullable = false, length = 32)
    private String orderId;

    @Column(name = "transaction_id", nullable = false, length = 32)
    private String transactionId;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private CallbackStatus status;

    @Column(name = "request_body", length = 4000)
    private String requestBody;

    @Column(name = "response_body", length = 4000)
    private String responseBody;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(name = "processing_time_ms")
    private Long processingTimeMs;

    @Column(name = "is_duplicate", nullable = false)
    @Builder.Default
    private Boolean isDuplicate = false;

    @Column(name = "source", length = 32)
    private String source;

    @Column(name = "trace_id", length = 64)
    private String traceId;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    @PrePersist
    public void prePersist() {
        if (callbackId == null) {
            callbackId = IdGenerator.generateCallbackId();
        }
        if (isDuplicate == null) {
            isDuplicate = false;
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
