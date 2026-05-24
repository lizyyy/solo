package com.airport.baggage.dto.request;

import com.airport.baggage.common.enums.SourceType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.math.BigDecimal;
import java.time.LocalDateTime;

public class CreateCompensationRequest {
    @NotBlank(message = "旅客ID不能为空")
    private String passengerId;

    @NotBlank(message = "旅客姓名不能为空")
    private String passengerName;

    private String passengerPhone;
    private String idCard;

    @NotBlank(message = "航班号不能为空")
    private String flightNo;

    private LocalDateTime scheduledDeparture;
    private String departureAirport;
    private String arrivalAirport;

    @NotBlank(message = "行李牌号不能为空")
    private String tagNumber;

    private Integer baggageWeight;
    private String baggageDesc;

    @NotNull(message = "来源类型不能为空")
    private SourceType sourceType;

    private String sourceDetail;

    @NotNull(message = "补偿金额不能为空")
    private BigDecimal amount;

    private String reason;
    private String remark;
    private String operator;

    public String getPassengerId() { return passengerId; }
    public void setPassengerId(String passengerId) { this.passengerId = passengerId; }
    public String getPassengerName() { return passengerName; }
    public void setPassengerName(String passengerName) { this.passengerName = passengerName; }
    public String getPassengerPhone() { return passengerPhone; }
    public void setPassengerPhone(String passengerPhone) { this.passengerPhone = passengerPhone; }
    public String getIdCard() { return idCard; }
    public void setIdCard(String idCard) { this.idCard = idCard; }
    public String getFlightNo() { return flightNo; }
    public void setFlightNo(String flightNo) { this.flightNo = flightNo; }
    public LocalDateTime getScheduledDeparture() { return scheduledDeparture; }
    public void setScheduledDeparture(LocalDateTime scheduledDeparture) { this.scheduledDeparture = scheduledDeparture; }
    public String getDepartureAirport() { return departureAirport; }
    public void setDepartureAirport(String departureAirport) { this.departureAirport = departureAirport; }
    public String getArrivalAirport() { return arrivalAirport; }
    public void setArrivalAirport(String arrivalAirport) { this.arrivalAirport = arrivalAirport; }
    public String getTagNumber() { return tagNumber; }
    public void setTagNumber(String tagNumber) { this.tagNumber = tagNumber; }
    public Integer getBaggageWeight() { return baggageWeight; }
    public void setBaggageWeight(Integer baggageWeight) { this.baggageWeight = baggageWeight; }
    public String getBaggageDesc() { return baggageDesc; }
    public void setBaggageDesc(String baggageDesc) { this.baggageDesc = baggageDesc; }
    public SourceType getSourceType() { return sourceType; }
    public void setSourceType(SourceType sourceType) { this.sourceType = sourceType; }
    public String getSourceDetail() { return sourceDetail; }
    public void setSourceDetail(String sourceDetail) { this.sourceDetail = sourceDetail; }
    public BigDecimal getAmount() { return amount; }
    public void setAmount(BigDecimal amount) { this.amount = amount; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
