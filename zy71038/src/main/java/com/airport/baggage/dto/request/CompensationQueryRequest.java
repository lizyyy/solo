package com.airport.baggage.dto.request;

import com.airport.baggage.common.enums.CompensationStatus;
import com.airport.baggage.common.enums.SourceType;

import java.time.LocalDateTime;
import java.util.List;

public class CompensationQueryRequest {
    private String orderNo;
    private String passengerId;
    private String passengerName;
    private String flightNo;
    private String tagNumber;
    private List<CompensationStatus> statuses;
    private List<SourceType> sourceTypes;
    private LocalDateTime startTime;
    private LocalDateTime endTime;
    private Boolean baggageArrived;
    private Boolean pickedUp;
    private int page = 0;
    private int size = 20;

    public String getOrderNo() { return orderNo; }
    public void setOrderNo(String orderNo) { this.orderNo = orderNo; }
    public String getPassengerId() { return passengerId; }
    public void setPassengerId(String passengerId) { this.passengerId = passengerId; }
    public String getPassengerName() { return passengerName; }
    public void setPassengerName(String passengerName) { this.passengerName = passengerName; }
    public String getFlightNo() { return flightNo; }
    public void setFlightNo(String flightNo) { this.flightNo = flightNo; }
    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }
    public List<CompensationStatus> getStatuses() { return statuses; }
    public void setStatuses(List<CompensationStatus> statuses) { this.statuses = statuses; }
    public List<SourceType> getSourceTypes() { return sourceTypes; }
    public void setSourceTypes(List<SourceType> sourceTypes) { this.sourceTypes = sourceTypes; }
    public LocalDateTime getStartTime() { return startTime; }
    public void setStartTime(LocalDateTime startTime) { this.startTime = startTime; }
    public LocalDateTime getEndTime() { return endTime; }
    public void setEndTime(LocalDateTime endTime) { this.endTime = endTime; }
    public Boolean getBaggageArrived() { return baggageArrived; }
    public void setBaggageArrived(Boolean baggageArrived) { this.baggageArrived = baggageArrived; }
    public Boolean getPickedUp() { return pickedUp; }
    public void setPickedUp(Boolean pickedUp) { this.pickedUp = pickedUp; }
    public int getPage() { return page; }
    public void setPage(int page) { this.page = page; }
    public int getSize() { return size; }
    public void setSize(int size) { this.size = size; }
}
