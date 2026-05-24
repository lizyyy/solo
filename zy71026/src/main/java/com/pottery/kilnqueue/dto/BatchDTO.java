package com.pottery.kilnqueue.dto;

import com.pottery.kilnqueue.enums.BatchStatus;
import com.pottery.kilnqueue.enums.FiringType;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class BatchDTO {
    private String batchNo;
    private String name;
    private FiringType firingType;
    private BatchStatus status;
    private Integer targetTemp;
    private LocalDateTime scheduledTime;
    private LocalDateTime actualStartTime;
    private LocalDateTime actualEndTime;
    private BigDecimal maxWidth;
    private BigDecimal maxHeight;
    private BigDecimal maxDepth;
    private Integer maxWorks;
    private String notes;
    private List<QueueResponseDTO> works;
    private LocalDateTime createdAt;

    public BatchDTO() {}

    private BatchDTO(Builder builder) {
        this.batchNo = builder.batchNo;
        this.name = builder.name;
        this.firingType = builder.firingType;
        this.status = builder.status;
        this.targetTemp = builder.targetTemp;
        this.scheduledTime = builder.scheduledTime;
        this.actualStartTime = builder.actualStartTime;
        this.actualEndTime = builder.actualEndTime;
        this.maxWidth = builder.maxWidth;
        this.maxHeight = builder.maxHeight;
        this.maxDepth = builder.maxDepth;
        this.maxWorks = builder.maxWorks;
        this.notes = builder.notes;
        this.works = builder.works;
        this.createdAt = builder.createdAt;
    }

    public static Builder builder() { return new Builder(); }

    public static class Builder {
        private String batchNo;
        private String name;
        private FiringType firingType;
        private BatchStatus status;
        private Integer targetTemp;
        private LocalDateTime scheduledTime;
        private LocalDateTime actualStartTime;
        private LocalDateTime actualEndTime;
        private BigDecimal maxWidth;
        private BigDecimal maxHeight;
        private BigDecimal maxDepth;
        private Integer maxWorks;
        private String notes;
        private List<QueueResponseDTO> works;
        private LocalDateTime createdAt;

        public Builder batchNo(String batchNo) { this.batchNo = batchNo; return this; }
        public Builder name(String name) { this.name = name; return this; }
        public Builder firingType(FiringType firingType) { this.firingType = firingType; return this; }
        public Builder status(BatchStatus status) { this.status = status; return this; }
        public Builder targetTemp(Integer targetTemp) { this.targetTemp = targetTemp; return this; }
        public Builder scheduledTime(LocalDateTime scheduledTime) { this.scheduledTime = scheduledTime; return this; }
        public Builder actualStartTime(LocalDateTime actualStartTime) { this.actualStartTime = actualStartTime; return this; }
        public Builder actualEndTime(LocalDateTime actualEndTime) { this.actualEndTime = actualEndTime; return this; }
        public Builder maxWidth(BigDecimal maxWidth) { this.maxWidth = maxWidth; return this; }
        public Builder maxHeight(BigDecimal maxHeight) { this.maxHeight = maxHeight; return this; }
        public Builder maxDepth(BigDecimal maxDepth) { this.maxDepth = maxDepth; return this; }
        public Builder maxWorks(Integer maxWorks) { this.maxWorks = maxWorks; return this; }
        public Builder notes(String notes) { this.notes = notes; return this; }
        public Builder works(List<QueueResponseDTO> works) { this.works = works; return this; }
        public Builder createdAt(LocalDateTime createdAt) { this.createdAt = createdAt; return this; }

        public BatchDTO build() { return new BatchDTO(this); }
    }

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getName() { return name; }
    public void setName(String name) { this.name = name; }
    public FiringType getFiringType() { return firingType; }
    public void setFiringType(FiringType firingType) { this.firingType = firingType; }
    public BatchStatus getStatus() { return status; }
    public void setStatus(BatchStatus status) { this.status = status; }
    public Integer getTargetTemp() { return targetTemp; }
    public void setTargetTemp(Integer targetTemp) { this.targetTemp = targetTemp; }
    public LocalDateTime getScheduledTime() { return scheduledTime; }
    public void setScheduledTime(LocalDateTime scheduledTime) { this.scheduledTime = scheduledTime; }
    public LocalDateTime getActualStartTime() { return actualStartTime; }
    public void setActualStartTime(LocalDateTime actualStartTime) { this.actualStartTime = actualStartTime; }
    public LocalDateTime getActualEndTime() { return actualEndTime; }
    public void setActualEndTime(LocalDateTime actualEndTime) { this.actualEndTime = actualEndTime; }
    public BigDecimal getMaxWidth() { return maxWidth; }
    public void setMaxWidth(BigDecimal maxWidth) { this.maxWidth = maxWidth; }
    public BigDecimal getMaxHeight() { return maxHeight; }
    public void setMaxHeight(BigDecimal maxHeight) { this.maxHeight = maxHeight; }
    public BigDecimal getMaxDepth() { return maxDepth; }
    public void setMaxDepth(BigDecimal maxDepth) { this.maxDepth = maxDepth; }
    public Integer getMaxWorks() { return maxWorks; }
    public void setMaxWorks(Integer maxWorks) { this.maxWorks = maxWorks; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
    public List<QueueResponseDTO> getWorks() { return works; }
    public void setWorks(List<QueueResponseDTO> works) { this.works = works; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
}
