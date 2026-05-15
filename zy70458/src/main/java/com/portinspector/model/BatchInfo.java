package com.portinspector.model;

import java.time.LocalDateTime;
import java.util.List;

public class BatchInfo {
    private String batchId;
    private LocalDateTime submitTime;
    private String ruleVersionAtSubmit;
    private int totalSamples;
    private int anomalyCount;
    private String status;
    private List<String> sourceFiles;
    private String notes;

    public BatchInfo() {}

    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
    public LocalDateTime getSubmitTime() { return submitTime; }
    public void setSubmitTime(LocalDateTime submitTime) { this.submitTime = submitTime; }
    public String getRuleVersionAtSubmit() { return ruleVersionAtSubmit; }
    public void setRuleVersionAtSubmit(String ruleVersionAtSubmit) { this.ruleVersionAtSubmit = ruleVersionAtSubmit; }
    public int getTotalSamples() { return totalSamples; }
    public void setTotalSamples(int totalSamples) { this.totalSamples = totalSamples; }
    public int getAnomalyCount() { return anomalyCount; }
    public void setAnomalyCount(int anomalyCount) { this.anomalyCount = anomalyCount; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public List<String> getSourceFiles() { return sourceFiles; }
    public void setSourceFiles(List<String> sourceFiles) { this.sourceFiles = sourceFiles; }
    public String getNotes() { return notes; }
    public void setNotes(String notes) { this.notes = notes; }
}
