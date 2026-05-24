package com.bus.notify.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDate;
import java.util.List;

public class RouteChangeCreateDTO {
    @NotBlank(message = "线路编号不能为空")
    private String routeNo;
    
    @NotBlank(message = "线路名称不能为空")
    private String routeName;
    
    @NotBlank(message = "改线原因不能为空")
    private String changeReason;
    
    private String changeDetail;
    
    @NotNull(message = "生效日期不能为空")
    private LocalDate effectiveDate;
    
    private LocalDate expectedEndDate;
    
    private List<StationChangeDTO> stations;
    
    private String operatorUsername;

    public String getRouteNo() { return routeNo; }
    public void setRouteNo(String routeNo) { this.routeNo = routeNo; }
    public String getRouteName() { return routeName; }
    public void setRouteName(String routeName) { this.routeName = routeName; }
    public String getChangeReason() { return changeReason; }
    public void setChangeReason(String changeReason) { this.changeReason = changeReason; }
    public String getChangeDetail() { return changeDetail; }
    public void setChangeDetail(String changeDetail) { this.changeDetail = changeDetail; }
    public LocalDate getEffectiveDate() { return effectiveDate; }
    public void setEffectiveDate(LocalDate effectiveDate) { this.effectiveDate = effectiveDate; }
    public LocalDate getExpectedEndDate() { return expectedEndDate; }
    public void setExpectedEndDate(LocalDate expectedEndDate) { this.expectedEndDate = expectedEndDate; }
    public List<StationChangeDTO> getStations() { return stations; }
    public void setStations(List<StationChangeDTO> stations) { this.stations = stations; }
    public String getOperatorUsername() { return operatorUsername; }
    public void setOperatorUsername(String operatorUsername) { this.operatorUsername = operatorUsername; }
}
