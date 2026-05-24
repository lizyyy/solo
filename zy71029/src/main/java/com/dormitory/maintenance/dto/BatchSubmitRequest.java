package com.dormitory.maintenance.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotEmpty;

import java.util.List;

public class BatchSubmitRequest {
    private String batchNo;

    @NotEmpty(message = "批次不能为空")
    @Valid
    private List<MaintenanceOrderRequest> orders;

    private String operator;

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public List<MaintenanceOrderRequest> getOrders() { return orders; }
    public void setOrders(List<MaintenanceOrderRequest> orders) { this.orders = orders; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
