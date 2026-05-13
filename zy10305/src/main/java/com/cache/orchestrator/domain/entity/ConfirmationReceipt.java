package com.cache.orchestrator.domain.entity;

import com.cache.orchestrator.domain.enums.ConfirmationStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "confirmation_receipts")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ConfirmationReceipt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String nodeId;

    @Column(nullable = false)
    private String receiptId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConfirmationStatus status;

    @Column(length = 1000)
    private String failureReason;

    private Integer keysProcessed;

    private LocalDateTime confirmedAt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private InvalidationBatch batch;

    @PrePersist
    protected void onCreate() {
        confirmedAt = LocalDateTime.now();
    }
}
