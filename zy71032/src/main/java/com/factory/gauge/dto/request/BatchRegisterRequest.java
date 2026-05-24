package com.factory.gauge.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class BatchRegisterRequest {
    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    @NotBlank(message = "产品名称不能为空")
    private String productName;

    @NotBlank(message = "量具编号不能为空")
    private String toolNo;

    @NotNull(message = "数量不能为空")
    private Integer quantity;

    private String productionLine;

    private String remarks;

    private String operator;

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getProductName() { return productName; }
    public void setProductName(String productName) { this.productName = productName; }
    public String getToolNo() { return toolNo; }
    public void setToolNo(String toolNo) { this.toolNo = toolNo; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getProductionLine() { return productionLine; }
    public void setProductionLine(String productionLine) { this.productionLine = productionLine; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
