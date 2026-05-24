package com.port.reefer.dto;

import jakarta.validation.constraints.NotBlank;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public class PluginRequest {
    @NotBlank(message = "箱号不能为空")
    private String containerNumber;

    @NotBlank(message = "插座编号不能为空")
    private String socketCode;

    @NotBlank(message = "巡检人工号不能为空")
    private String inspectorBadge;

    private BigDecimal targetTemperature;

    private LocalDateTime pluginTime;

    private String remarks;

    private String vesselName;

    private String voyageNumber;

    public String getContainerNumber() { return containerNumber; }
    public void setContainerNumber(String containerNumber) { this.containerNumber = containerNumber; }
    public String getSocketCode() { return socketCode; }
    public void setSocketCode(String socketCode) { this.socketCode = socketCode; }
    public String getInspectorBadge() { return inspectorBadge; }
    public void setInspectorBadge(String inspectorBadge) { this.inspectorBadge = inspectorBadge; }
    public BigDecimal getTargetTemperature() { return targetTemperature; }
    public void setTargetTemperature(BigDecimal targetTemperature) { this.targetTemperature = targetTemperature; }
    public LocalDateTime getPluginTime() { return pluginTime; }
    public void setPluginTime(LocalDateTime pluginTime) { this.pluginTime = pluginTime; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getVesselName() { return vesselName; }
    public void setVesselName(String vesselName) { this.vesselName = vesselName; }
    public String getVoyageNumber() { return voyageNumber; }
    public void setVoyageNumber(String voyageNumber) { this.voyageNumber = voyageNumber; }
}
