package com.ci.cache.dto;

import com.ci.cache.model.EvictionStatus;
import jakarta.validation.constraints.NotNull;

public class StatusUpdateRequest {
    @NotNull(message = "Target status is required")
    private EvictionStatus targetStatus;

    private String approvedBy;
    private String reason;
    private boolean forceOverride = false;

    public StatusUpdateRequest() {}

    public EvictionStatus getTargetStatus() { return targetStatus; }
    public void setTargetStatus(EvictionStatus targetStatus) { this.targetStatus = targetStatus; }
    public String getApprovedBy() { return approvedBy; }
    public void setApprovedBy(String approvedBy) { this.approvedBy = approvedBy; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public boolean isForceOverride() { return forceOverride; }
    public void setForceOverride(boolean forceOverride) { this.forceOverride = forceOverride; }
}
