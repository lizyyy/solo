package com.ci.cache.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public class EvictionRequest {
    @NotBlank(message = "Project name is required")
    private String projectName;

    @NotEmpty(message = "At least one cache key is required")
    private List<String> cacheKeys;

    @NotBlank(message = "Requester is required")
    private String requestedBy;

    private String reason;

    public EvictionRequest() {}

    public String getProjectName() { return projectName; }
    public void setProjectName(String projectName) { this.projectName = projectName; }
    public List<String> getCacheKeys() { return cacheKeys; }
    public void setCacheKeys(List<String> cacheKeys) { this.cacheKeys = cacheKeys; }
    public String getRequestedBy() { return requestedBy; }
    public void setRequestedBy(String requestedBy) { this.requestedBy = requestedBy; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
}
