package com.bus.notify.dto;

import jakarta.validation.constraints.NotBlank;

public class StationChangeDTO {
    @NotBlank(message = "站点名称不能为空")
    private String stationName;
    
    private String stationCode;
    
    @NotBlank(message = "站点状态不能为空")
    private String status;
    
    private String statusReason;
    
    private Boolean isTemporary = false;
    
    private String alternativeRoute;

    public String getStationName() { return stationName; }
    public void setStationName(String stationName) { this.stationName = stationName; }
    public String getStationCode() { return stationCode; }
    public void setStationCode(String stationCode) { this.stationCode = stationCode; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public String getStatusReason() { return statusReason; }
    public void setStatusReason(String statusReason) { this.statusReason = statusReason; }
    public Boolean getIsTemporary() { return isTemporary; }
    public void setIsTemporary(Boolean isTemporary) { this.isTemporary = isTemporary; }
    public String getAlternativeRoute() { return alternativeRoute; }
    public void setAlternativeRoute(String alternativeRoute) { this.alternativeRoute = alternativeRoute; }
}
