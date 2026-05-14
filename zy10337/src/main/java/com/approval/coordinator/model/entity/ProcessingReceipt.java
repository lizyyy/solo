package com.approval.coordinator.model.entity;

import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "processing_receipts", indexes = {
    @Index(name = "idx_receipt_batch_id", columnList = "batch_id"),
    @Index(name = "idx_receipt_receipt_id", columnList = "receipt_id", unique = true)
})
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ProcessingReceipt {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id", nullable = false)
    private ApprovalBatch batch;

    @Column(name = "receipt_id", length = 128, nullable = false)
    private String receiptId;

    @Column(name = "chunk_number")
    private Integer chunkNumber;

    @Column(name = "total_items")
    private Integer totalItems;

    @Column(name = "success_count")
    private Integer successCount;

    @Column(name = "failed_count")
    private Integer failedCount;

    @Column(name = "summary", columnDefinition = "TEXT")
    private String summary;

    @Column(name = "detail_data", columnDefinition = "TEXT")
    private String detailData;

    @Column(name = "exported_at")
    private LocalDateTime exportedAt;

    @Column(name = "exported_by", length = 128)
    private String exportedBy;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
    }
}
