package com.metadata.repair.dto;

import com.metadata.repair.entity.RepairException;
import java.time.LocalDateTime;
import java.util.List;

public class RepairReport {
    private String batchNo;
    private String batchName;
    private String status;
    private String operator;
    private Integer totalCount;
    private Integer successCount;
    private Integer failedCount;
    private Integer skippedCount;
    private Double successRate;
    private List<String> successFiles;
    private List<String> skippedFiles;
    private List<RepairException> exceptions;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Long durationSeconds;

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getBatchName() { return batchName; }
    public void setBatchName(String batchName) { this.batchName = batchName; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public Integer getTotalCount() { return totalCount; }
    public void setTotalCount(Integer totalCount) { this.totalCount = totalCount; }
    public Integer getSuccessCount() { return successCount; }
    public void setSuccessCount(Integer successCount) { this.successCount = successCount; }
    public Integer getFailedCount() { return failedCount; }
    public void setFailedCount(Integer failedCount) { this.failedCount = failedCount; }
    public Integer getSkippedCount() { return skippedCount; }
    public void setSkippedCount(Integer skippedCount) { this.skippedCount = skippedCount; }
    public Double getSuccessRate() { return successRate; }
    public void setSuccessRate(Double successRate) { this.successRate = successRate; }
    public List<String> getSuccessFiles() { return successFiles; }
    public void setSuccessFiles(List<String> successFiles) { this.successFiles = successFiles; }
    public List<String> getSkippedFiles() { return skippedFiles; }
    public void setSkippedFiles(List<String> skippedFiles) { this.skippedFiles = skippedFiles; }
    public List<RepairException> getExceptions() { return exceptions; }
    public void setExceptions(List<RepairException> exceptions) { this.exceptions = exceptions; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public Long getDurationSeconds() { return durationSeconds; }
    public void setDurationSeconds(Long durationSeconds) { this.durationSeconds = durationSeconds; }
}
