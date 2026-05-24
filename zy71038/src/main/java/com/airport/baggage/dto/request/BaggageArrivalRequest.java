package com.airport.baggage.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class BaggageArrivalRequest {
    @NotBlank(message = "行李牌号不能为空")
    private String tagNumber;

    @NotNull(message = "到达时间不能为空")
    private LocalDateTime arrivalTime;

    private String arrivalLocation;
    private String transportFlight;
    private String remark;
    private String operator;

    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }
    public LocalDateTime getArrivalTime() { return arrivalTime; }
    public void setArrivalTime(LocalDateTime arrivalTime) { this.arrivalTime = arrivalTime; }
    public String getArrivalLocation() { return arrivalLocation; }
    public void setArrivalLocation(String arrivalLocation) { this.arrivalLocation = arrivalLocation; }
    public String getTransportFlight() { return transportFlight; }
    public void setTransportFlight(String transportFlight) { this.transportFlight = transportFlight; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
