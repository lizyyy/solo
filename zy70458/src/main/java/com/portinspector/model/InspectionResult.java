package com.portinspector.model;

import java.time.LocalDateTime;
import java.util.Map;

public class InspectionResult {
    private String sampleId;
    private String batchId;
    private String ruleVersion;
    private RiskLevel riskLevel;
    private boolean isAnomaly;
    private String conclusion;
    private String portStatus;
    private Map<String, Object> details;
    private boolean reviewed;
    private String reviewer;
    private LocalDateTime reviewTime;
    private String reviewNotes;
    private boolean isReused;
    private String originalSampleId;
    private String originalBatchId;
    private Map<String, Object> conflictInfo;

    public InspectionResult() {}

    public String getSampleId() { return sampleId; }
    public void setSampleId(String sampleId) { this.sampleId = sampleId; }
    public String getBatchId() { return batchId; }
    public void setBatchId(String batchId) { this.batchId = batchId; }
    public String getRuleVersion() { return ruleVersion; }
    public void setRuleVersion(String ruleVersion) { this.ruleVersion = ruleVersion; }
    public RiskLevel getRiskLevel() { return riskLevel; }
    public void setRiskLevel(RiskLevel riskLevel) { this.riskLevel = riskLevel; }
    public boolean isAnomaly() { return isAnomaly; }
    public void setAnomaly(boolean anomaly) { isAnomaly = anomaly; }
    public String getConclusion() { return conclusion; }
    public void setConclusion(String conclusion) { this.conclusion = conclusion; }
    public String getPortStatus() { return portStatus; }
    public void setPortStatus(String portStatus) { this.portStatus = portStatus; }
    public Map<String, Object> getDetails() { return details; }
    public void setDetails(Map<String, Object> details) { this.details = details; }
    public boolean isReviewed() { return reviewed; }
    public void setReviewed(boolean reviewed) { this.reviewed = reviewed; }
    public String getReviewer() { return reviewer; }
    public void setReviewer(String reviewer) { this.reviewer = reviewer; }
    public LocalDateTime getReviewTime() { return reviewTime; }
    public void setReviewTime(LocalDateTime reviewTime) { this.reviewTime = reviewTime; }
    public String getReviewNotes() { return reviewNotes; }
    public void setReviewNotes(String reviewNotes) { this.reviewNotes = reviewNotes; }
    public boolean isReused() { return isReused; }
    public void setReused(boolean reused) { isReused = reused; }
    public String getOriginalSampleId() { return originalSampleId; }
    public void setOriginalSampleId(String originalSampleId) { this.originalSampleId = originalSampleId; }
    public String getOriginalBatchId() { return originalBatchId; }
    public void setOriginalBatchId(String originalBatchId) { this.originalBatchId = originalBatchId; }
    public Map<String, Object> getConflictInfo() { return conflictInfo; }
    public void setConflictInfo(Map<String, Object> conflictInfo) { this.conflictInfo = conflictInfo; }
}
