package com.port.reefer.dto;

import jakarta.validation.constraints.NotBlank;
import java.time.LocalDateTime;

public class UnplugRequest {
    @NotBlank(message = "插座编号不能为空")
    private String socketCode;

    @NotBlank(message = "巡检人工号不能为空")
    private String inspectorBadge;

    private LocalDateTime unplugTime;

    private String reason;

    private String remarks;

    public String getSocketCode() { return socketCode; }
    public void setSocketCode(String socketCode) { this.socketCode = socketCode; }
    public String getInspectorBadge() { return inspectorBadge; }
    public void setInspectorBadge(String inspectorBadge) { this.inspectorBadge = inspectorBadge; }
    public LocalDateTime getUnplugTime() { return unplugTime; }
    public void setUnplugTime(LocalDateTime unplugTime) { this.unplugTime = unplugTime; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
