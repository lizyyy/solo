package com.approval.coordinator.model.entity;

import com.approval.coordinator.model.enums.BatchStatus;
import javax.persistence.*;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Data
@Entity
@Table(name = "approval_batches")
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ApprovalBatch {

    @Id
    @Column(name = "batch_id", length = 64)
    private String batchId;

    @Column(name = "business_type", length = 128, nullable = false)
    private String businessType;

    @Column(name = "source_system", length = 128, nullable = false)
    private String sourceSystem;

    @Column(name = "callback_url", length = 512)
    private String callbackUrl;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", length = 32, nullable = false)
    private BatchStatus status;

    @Column(name = "total_count")
    private Integer totalCount;

    @Column(name = "success_count")
    private Integer successCount;

    @Column(name = "failed_count")
    private Integer failedCount;

    @Column(name = "chunk_size")
    private Integer chunkSize;

    @Column(name = "current_chunk")
    private Integer currentChunk;

    @Column(name = "total_chunks")
    private Integer totalChunks;

    @Column(name = "created_at", nullable = false)
    private LocalDateTime createdAt;

    @Column(name = "updated_at")
    private LocalDateTime updatedAt;

    @Column(name = "completed_at")
    private LocalDateTime completedAt;

    @Column(name = "created_by", length = 128)
    private String createdBy;

    @Column(name = "remark", length = 1024)
    private String remark;

    @Version
    private Long version;

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<ApprovalItem> items = new ArrayList<>();

    @OneToMany(mappedBy = "batch", cascade = CascadeType.ALL, orphanRemoval = true)
    @Builder.Default
    private List<TimelineEvent> timelineEvents = new ArrayList<>();

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = BatchStatus.CREATED;
        if (successCount == null) successCount = 0;
        if (failedCount == null) failedCount = 0;
        if (currentChunk == null) currentChunk = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }
}
