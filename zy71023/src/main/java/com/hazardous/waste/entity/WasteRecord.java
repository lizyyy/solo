package com.hazardous.waste.entity;

import com.hazardous.waste.enums.WasteStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "waste_record")
public class WasteRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String recordNo;

    @Column(nullable = false)
    private String category;

    @Column(nullable = false)
    private String wasteName;

    @Column(nullable = false)
    private Double weight;

    private String component;

    private String hazardCharacteristics;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "bucket_id")
    private StorageBucket bucket;

    @Column(nullable = false)
    private LocalDateTime inTime;

    private LocalDateTime outTime;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private WasteStatus status;

    private String transferFormNo;

    private String receiver;

    private LocalDateTime receiveTime;

    @Column(length = 2000)
    private String disposalReason;

    @Column(length = 2000)
    private String checkResult;

    private Boolean isOverdue;

    private Integer storageDays;

    private String submitter;

    private String reviewer;

    private LocalDateTime reviewTime;

    @Column(length = 2000)
    private String reviewComment;

    private String returnReason;

    private Integer resubmitCount;

    @ElementCollection
    @CollectionTable(name = "waste_operation_log", joinColumns = @JoinColumn(name = "record_id"))
    private List<OperationLog> operationLogs = new ArrayList<>();

    @Column(nullable = false)
    private LocalDateTime createdAt;

    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (status == null) status = WasteStatus.PENDING_SUBMIT;
        if (isOverdue == null) isOverdue = false;
        if (resubmitCount == null) resubmitCount = 0;
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    @Embeddable
    public static class OperationLog {
        private String operation;
        private String operator;
        private LocalDateTime operateTime;
        private String remark;

        public OperationLog() {}

        public OperationLog(String operation, String operator, String remark) {
            this.operation = operation;
            this.operator = operator;
            this.operateTime = LocalDateTime.now();
            this.remark = remark;
        }

        public String getOperation() { return operation; }
        public void setOperation(String operation) { this.operation = operation; }
        public String getOperator() { return operator; }
        public void setOperator(String operator) { this.operator = operator; }
        public LocalDateTime getOperateTime() { return operateTime; }
        public void setOperateTime(LocalDateTime operateTime) { this.operateTime = operateTime; }
        public String getRemark() { return remark; }
        public void setRemark(String remark) { this.remark = remark; }
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getRecordNo() { return recordNo; }
    public void setRecordNo(String recordNo) { this.recordNo = recordNo; }
    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }
    public String getWasteName() { return wasteName; }
    public void setWasteName(String wasteName) { this.wasteName = wasteName; }
    public Double getWeight() { return weight; }
    public void setWeight(Double weight) { this.weight = weight; }
    public String getComponent() { return component; }
    public void setComponent(String component) { this.component = component; }
    public String getHazardCharacteristics() { return hazardCharacteristics; }
    public void setHazardCharacteristics(String hazardCharacteristics) { this.hazardCharacteristics = hazardCharacteristics; }
    public StorageBucket getBucket() { return bucket; }
    public void setBucket(StorageBucket bucket) { this.bucket = bucket; }
    public LocalDateTime getInTime() { return inTime; }
    public void setInTime(LocalDateTime inTime) { this.inTime = inTime; }
    public LocalDateTime getOutTime() { return outTime; }
    public void setOutTime(LocalDateTime outTime) { this.outTime = outTime; }
    public WasteStatus getStatus() { return status; }
    public void setStatus(WasteStatus status) { this.status = status; }
    public String getTransferFormNo() { return transferFormNo; }
    public void setTransferFormNo(String transferFormNo) { this.transferFormNo = transferFormNo; }
    public String getReceiver() { return receiver; }
    public void setReceiver(String receiver) { this.receiver = receiver; }
    public LocalDateTime getReceiveTime() { return receiveTime; }
    public void setReceiveTime(LocalDateTime receiveTime) { this.receiveTime = receiveTime; }
    public String getDisposalReason() { return disposalReason; }
    public void setDisposalReason(String disposalReason) { this.disposalReason = disposalReason; }
    public String getCheckResult() { return checkResult; }
    public void setCheckResult(String checkResult) { this.checkResult = checkResult; }
    public Boolean getIsOverdue() { return isOverdue; }
    public void setIsOverdue(Boolean isOverdue) { this.isOverdue = isOverdue; }
    public Integer getStorageDays() { return storageDays; }
    public void setStorageDays(Integer storageDays) { this.storageDays = storageDays; }
    public String getSubmitter() { return submitter; }
    public void setSubmitter(String submitter) { this.submitter = submitter; }
    public String getReviewer() { return reviewer; }
    public void setReviewer(String reviewer) { this.reviewer = reviewer; }
    public LocalDateTime getReviewTime() { return reviewTime; }
    public void setReviewTime(LocalDateTime reviewTime) { this.reviewTime = reviewTime; }
    public String getReviewComment() { return reviewComment; }
    public void setReviewComment(String reviewComment) { this.reviewComment = reviewComment; }
    public String getReturnReason() { return returnReason; }
    public void setReturnReason(String returnReason) { this.returnReason = returnReason; }
    public Integer getResubmitCount() { return resubmitCount; }
    public void setResubmitCount(Integer resubmitCount) { this.resubmitCount = resubmitCount; }
    public List<OperationLog> getOperationLogs() { return operationLogs; }
    public void setOperationLogs(List<OperationLog> operationLogs) { this.operationLogs = operationLogs; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
