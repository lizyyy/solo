package com.ci.cache.dto;

import java.util.List;

public class ManualCorrectionRequest {
    private String projectName;
    private List<String> cacheKeys;
    private Long estimatedFreedBytes;
    private Integer affectedBuildCount;
    private String impactAnalysis;
    private String correctedBy;
    private String correctionReason;

    public ManualCorrectionRequest() {}

    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public List<String> getCacheKeys() { return cacheKeys; }
    public void setCacheKeys(List<String> cacheKeys) { this.cacheKeys = cacheKeys; }
    public Long getEstimatedFreedBytes() { return estimatedFreedBytes; }
    public void setEstimatedFreedBytes(Long estimatedFreedBytes) { this.estimatedFreedBytes = estimatedFreedBytes; }
    public Integer getAffectedBuildCount() { return affectedBuildCount; }
    public void setAffectedBuildCount(Integer affectedBuildCount) { this.affectedBuildCount = affectedBuildCount; }
    public String getImpactAnalysis() { return impactAnalysis; }
    public void setImpactAnalysis(String impactAnalysis) { this.impactAnalysis = impactAnalysis; }
    public String getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(String correctedBy) { this.correctedBy = correctedBy; }
    public String getCorrectionReason() { return correctionReason; }
    public void setCorrectionReason(String correctionReason) { this.correctionReason = correctionReason; }
}
