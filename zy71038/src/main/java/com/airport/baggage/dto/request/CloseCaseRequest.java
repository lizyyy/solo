package com.airport.baggage.dto.request;

import jakarta.validation.constraints.NotBlank;

import java.math.BigDecimal;

public class CloseCaseRequest {
    @NotBlank(message = "案件摘要不能为空")
    private String caseSummary;

    private String disposalMeasure;
    private String passengerFeedback;
    private BigDecimal totalAmount;
    private String remark;
    private String operator;

    public String getCaseSummary() { return caseSummary; }
    public void setCaseSummary(String caseSummary) { this.caseSummary = caseSummary; }
    public String getDisposalMeasure() { return disposalMeasure; }
    public void setDisposalMeasure(String disposalMeasure) { this.disposalMeasure = disposalMeasure; }
    public String getPassengerFeedback() { return passengerFeedback; }
    public void setPassengerFeedback(String passengerFeedback) { this.passengerFeedback = passengerFeedback; }
    public BigDecimal getTotalAmount() { return totalAmount; }
    public void setTotalAmount(BigDecimal totalAmount) { this.totalAmount = totalAmount; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
