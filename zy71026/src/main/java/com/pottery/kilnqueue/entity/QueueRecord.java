package com.pottery.kilnqueue.entity;

import com.pottery.kilnqueue.enums.QueueStatus;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "queue_records")
public class QueueRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String requestId;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "work_id", nullable = false)
    private Work work;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "batch_id")
    private KilnBatch batch;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private QueueStatus status;

    private Integer queueOrder;

    private LocalDateTime estimatedFiringDate;

    @Column(columnDefinition = "TEXT")
    private String conflictInfo;

    @Column(columnDefinition = "TEXT")
    private String supplementInfo;

    private Boolean isRescheduled = false;

    private Long originalQueueRecordId;

    private Integer rescheduleCount = 0;

    @Column(nullable = false)
    private String idempotencyKey;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Work getWork() { return work; }
    public void setWork(Work work) { this.work = work; }
    public KilnBatch getBatch() { return batch; }
    public void setBatch(KilnBatch batch) { this.batch = batch; }
    public QueueStatus getStatus() { return status; }
    public void setStatus(QueueStatus status) { this.status = status; }
    public Integer getQueueOrder() { return queueOrder; }
    public void setQueueOrder(Integer queueOrder) { this.queueOrder = queueOrder; }
    public LocalDateTime getEstimatedFiringDate() { return estimatedFiringDate; }
    public void setEstimatedFiringDate(LocalDateTime estimatedFiringDate) { this.estimatedFiringDate = estimatedFiringDate; }
    public String getConflictInfo() { return conflictInfo; }
    public void setConflictInfo(String conflictInfo) { this.conflictInfo = conflictInfo; }
    public String getSupplementInfo() { return supplementInfo; }
    public void setSupplementInfo(String supplementInfo) { this.supplementInfo = supplementInfo; }
    public Boolean getIsRescheduled() { return isRescheduled; }
    public void setIsRescheduled(Boolean isRescheduled) { this.isRescheduled = isRescheduled; }
    public Long getOriginalQueueRecordId() { return originalQueueRecordId; }
    public void setOriginalQueueRecordId(Long originalQueueRecordId) { this.originalQueueRecordId = originalQueueRecordId; }
    public Integer getRescheduleCount() { return rescheduleCount; }
    public void setRescheduleCount(Integer rescheduleCount) { this.rescheduleCount = rescheduleCount; }
    public String getIdempotencyKey() { return idempotencyKey; }
    public void setIdempotencyKey(String idempotencyKey) { this.idempotencyKey = idempotencyKey; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
