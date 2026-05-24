package com.port.reefer.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import java.math.BigDecimal;
import java.time.LocalDateTime;

public class TemperatureSampleRequest {
    @NotBlank(message = "箱号不能为空")
    private String containerNumber;

    private String socketCode;

    @NotBlank(message = "巡检人工号不能为空")
    private String inspectorBadge;

    @NotNull(message = "温度值不能为空")
    private BigDecimal temperature;

    private BigDecimal setPoint;

    private BigDecimal ambientTemperature;

    private LocalDateTime sampleTime;

    private String remarks;

    public String getContainerNumber() { return containerNumber; }
    public void setContainerNumber(String containerNumber) { this.containerNumber = containerNumber; }
    public String getSocketCode() { return socketCode; }
    public void setSocketCode(String socketCode) { this.socketCode = socketCode; }
    public String getInspectorBadge() { return inspectorBadge; }
    public void setInspectorBadge(String inspectorBadge) { this.inspectorBadge = inspectorBadge; }
    public BigDecimal getTemperature() { return temperature; }
    public void setTemperature(BigDecimal temperature) { this.temperature = temperature; }
    public BigDecimal getSetPoint() { return setPoint; }
    public void setSetPoint(BigDecimal setPoint) { this.setPoint = setPoint; }
    public BigDecimal getAmbientTemperature() { return ambientTemperature; }
    public void setAmbientTemperature(BigDecimal ambientTemperature) { this.ambientTemperature = ambientTemperature; }
    public LocalDateTime getSampleTime() { return sampleTime; }
    public void setSampleTime(LocalDateTime sampleTime) { this.sampleTime = sampleTime; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
