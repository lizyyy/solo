package com.approval.coordinator.model.entity;

import com.approval.coordinator.model.enums.ItemStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "approval_items", indexes = {
    @Index(name = "idx_item_batch_id", columnList = "batch_id"),
    @Index(name = "idx_item_idempotent_key", columnList = "idempotent_key", unique = true)
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApprovalItem {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private ApprovalBatch batch;

    @Column(name = "item_id", length = 128, nullable = false)
    private String itemId;

    @Column(name = "idempotent_key", length = 256, nullable = false)
    private String idempotentKey;

    @Column(name = "chunk_number")
    private Integer chunkNumber;

    @Column(name = "sequence_number")
    private Integer sequenceNumber;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 32, nullable = false)
    private ItemStatus status;

    @Column(name = "business_data", columnDefinition = "TEXT")
    private String businessData;

    @Column(name = "callback_payload", columnDefinition = "TEXT")
    private String callbackPayload;

    @Column(name = "response_data", columnDefinition = "TEXT")
    private String responseData;

    @Column(name = "error_code", length = 64)
    private String errorCode;

    @Column(name = "error_message", length = 1024)
    private String errorMessage;

    @Column(name = "retry_count")
    private Integer retryCount;

    @Enumerated(EnumType.STRING)
    @Column(name = "previous_status", length = 32)
    private ItemStatus previousStatus;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Version
    private Long version;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = ItemStatus.PENDING;
        if (retryCount == null) retryCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
