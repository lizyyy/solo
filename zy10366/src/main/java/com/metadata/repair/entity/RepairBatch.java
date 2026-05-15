package com.metadata.repair.entity;

import com.metadata.repair.enums.RepairStatus;

import javax.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "repair_batches")
public class RepairBatch {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String batchNo;

    private String batchName;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private RepairStatus status;

    private String operator;

    private String description;

    private Integer totalCount = 0;

    private Integer successCount = 0;

    private Integer failedCount = 0;

    private Integer skippedCount = 0;

    @ElementCollection
    @CollectionTable(name = "batch_attachments", joinColumns = @JoinColumn(name = "batch_id"))
    @Column(name = "file_id")
    private List<String> attachmentFileIds = new ArrayList<>();

    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    private LocalDateTime completedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getBatchName() { return batchName; }
    public void setBatchName(String batchName) { this.batchName = batchName; }
    public RepairStatus getStatus() { return status; }
    public void setStatus(RepairStatus status) { this.status = status; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public Integer getTotalCount() { return totalCount; }
    public void setTotalCount(Integer totalCount) { this.totalCount = totalCount; }
    public Integer getSuccessCount() { return successCount; }
    public void setSuccessCount(Integer successCount) { this.successCount = successCount; }
    public Integer getFailedCount() { return failedCount; }
    public void setFailedCount(Integer failedCount) { this.failedCount = failedCount; }
    public Integer getSkippedCount() { return skippedCount; }
    public void setSkippedCount(Integer skippedCount) { this.skippedCount = skippedCount; }
    public List<String> getAttachmentFileIds() { return attachmentFileIds; }
    public void setAttachmentFileIds(List<String> attachmentFileIds) { this.attachmentFileIds = attachmentFileIds; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
}
