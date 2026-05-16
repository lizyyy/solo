package com.ci.cache.model;

import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "eviction_applications")
public class EvictionApplication {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String applicationId;

    @Column(nullable = false)
    private String projectName;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "eviction_cache_keys", joinColumns = @JoinColumn(name = "application_id"))
    @Column(name = "cache_key")
    private List<String> cacheKeys = new ArrayList<>();

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private EvictionStatus status;

    @Column(length = 2000)
    private String impactAnalysis;

    @Column(length = 1000)
    private String rejectionReason;

    @Column
    private Long estimatedFreedBytes;

    @Column
    private Integer affectedBuildCount;

    @Column(nullable = false)
    private String requestedBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @Column
    private LocalDateTime executedAt;

    @Column
    private LocalDateTime completedAt;

    @Column
    private String approvedBy;

    @Column
    private Boolean hasActiveBuilds = false;

    @Column(length = 2000)
    private String activeBuildDetails;

    @Column
    private Long actualFreedBytes;

    @Column(length = 2000)
    private String cleanupReport;

    public EvictionApplication() {}

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getApplicationId() { return applicationId; }
    public void setApplicationId(String applicationId) { this.applicationId = applicationId; }
    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public List<String> getCacheKeys() { return cacheKeys; }
    public void setCacheKeys(List<String> cacheKeys) { this.cacheKeys = cacheKeys; }
    public EvictionStatus getStatus() { return status; }
    public void setStatus(EvictionStatus status) { this.status = status; }
    public String getImpactAnalysis() { return impactAnalysis; }
    public void setImpactAnalysis(String impactAnalysis) { this.impactAnalysis = impactAnalysis; }
    public String getRejectionReason() { return rejectionReason; }
    public void setRejectionReason(String rejectionReason) { this.rejectionReason = rejectionReason; }
    public Long getEstimatedFreedBytes() { return estimatedFreedBytes; }
    public void setEstimatedFreedBytes(Long estimatedFreedBytes) { this.estimatedFreedBytes = estimatedFreedBytes; }
    public Integer getAffectedBuildCount() { return affectedBuildCount; }
    public void setAffectedBuildCount(Integer affectedBuildCount) { this.affectedBuildCount = affectedBuildCount; }
    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getExecutedAt() { return executedAt; }
    public void setExecutedAt(LocalDateTime executedAt) { this.executedAt = executedAt; }
    public LocalDateTime getCompletedAt() { return completedAt; }
    public void setCompletedAt(LocalDateTime completedAt) { this.completedAt = completedAt; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public Boolean getHasActiveBuilds() { return hasActiveBuilds; }
    public void setHasActiveBuilds(Boolean hasActiveBuilds) { this.hasActiveBuilds = hasActiveBuilds; }
    public String getActiveBuildDetails() { return activeBuildDetails; }
    public void setActiveBuildDetails(String activeBuildDetails) { this.activeBuildDetails = activeBuildDetails; }
    public Long getActualFreedBytes() { return actualFreedBytes; }
    public void setActualFreedBytes(Long actualFreedBytes) { this.actualFreedBytes = actualFreedBytes; }
    public String getCleanupReport() { return cleanupReport; }
    public void setCleanupReport(String cleanupReport) { this.cleanupReport = cleanupReport; }
}
