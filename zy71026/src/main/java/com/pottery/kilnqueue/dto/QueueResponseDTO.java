package com.pottery.kilnqueue.dto;

import com.pottery.kilnqueue.enums.QueueStatus;

import java.time.LocalDateTime;
import java.util.List;

public class QueueResponseDTO {
    private String requestId;
    private String workNo;
    private String workName;
    private QueueStatus status;
    private Integer queueOrder;
    private String batchNo;
    private LocalDateTime estimatedFiringDate;
    private String conflictInfo;
    private Boolean isRescheduled;
    private Integer rescheduleCount;
    private LocalDateTime createdAt;
    private List<ProcessingLogDTO> processingLogs;

    public QueueResponseDTO() {}

    private QueueResponseDTO(Builder builder) {
        this.requestId = builder.requestId;
        this.workNo = builder.workNo;
        this.workName = builder.workName;
        this.status = builder.status;
        this.queueOrder = builder.queueOrder;
        this.batchNo = builder.batchNo;
        this.estimatedFiringDate = builder.estimatedFiringDate;
        this.conflictInfo = builder.conflictInfo;
        this.isRescheduled = builder.isRescheduled;
        this.rescheduleCount = builder.rescheduleCount;
        this.createdAt = builder.createdAt;
        this.processingLogs = builder.processingLogs;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String requestId;
        private String workNo;
        private String workName;
        private QueueStatus status;
        private Integer queueOrder;
        private String batchNo;
        private LocalDateTime estimatedFiringDate;
        private String conflictInfo;
        private Boolean isRescheduled;
        private Integer rescheduleCount;
        private LocalDateTime createdAt;
        private List<ProcessingLogDTO> processingLogs;

        public Builder requestId(String requestId) { this.requestId = requestId; return this; }
        public Builder workNo(String workNo) { this.workNo = workNo; return this; }
        public Builder workName(String workName) { this.workName = workName; return this; }
        public Builder status(QueueStatus status) { this.status = status; return this; }
        public Builder queueOrder(Integer queueOrder) { this.queueOrder = queueOrder; return this; }
        public Builder batchNo(String batchNo) { this.batchNo = batchNo; return this; }
        public Builder estimatedFiringDate(LocalDateTime estimatedFiringDate) { this.estimatedFiringDate = estimatedFiringDate; return this; }
        public Builder conflictInfo(String conflictInfo) { this.conflictInfo = conflictInfo; return this; }
        public Builder isRescheduled(Boolean isRescheduled) { this.isRescheduled = isRescheduled; return this; }
        public Builder rescheduleCount(Integer rescheduleCount) { this.rescheduleCount = rescheduleCount; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }
        public Builder processingLogs(List<ProcessingLogDTO> processingLogs) { this.processingLogs = processingLogs; return this; }

        public QueueResponseDTO build() { return new QueueResponseDTO(this); }
    }

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getWorkNo() { return workNo; }
    public void setWorkNo(String workNo) { this.workNo = workNo; }
    public String getWorkName() { return workName; }
    public void setWorkName(String workName) { this.workName = workName; }
    public QueueStatus getStatus() { return status; }
    public void setStatus(QueueStatus status) { this.status = status; }
    public Integer getQueueOrder() { return queueOrder; }
    public void setQueueOrder(Integer queueOrder) { this.queueOrder = queueOrder; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public LocalDateTime getEstimatedFiringDate() { return estimatedFiringDate; }
    public void setEstimatedFiringDate(LocalDateTime estimatedFiringDate) { this.estimatedFiringDate = estimatedFiringDate; }
    public String getConflictInfo() { return conflictInfo; }
    public void setConflictInfo(String conflictInfo) { this.conflictInfo = conflictInfo; }
    public Boolean getIsRescheduled() { return isRescheduled; }
    public void setIsRescheduled(Boolean isRescheduled) { this.isRescheduled = isRescheduled; }
    public Integer getRescheduleCount() { return rescheduleCount; }
    public void setRescheduleCount(Integer rescheduleCount) { this.rescheduleCount = rescheduleCount; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public List<ProcessingLogDTO> getProcessingLogs() { return processingLogs; }
    public void setProcessingLogs(List<ProcessingLogDTO> processingLogs) { this.processingLogs = processingLogs; }
}
