package com.factory.gauge.dto.request;

import jakarta.validation.constraints.NotBlank;

public class DeactivationRequest {
    @NotBlank(message = "量具编号不能为空")
    private String toolNo;

    @NotBlank(message = "停用原因不能为空")
    private String reason;

    private String description;

    @NotBlank(message = "操作人不能为空")
    private String operator;

    private String remarks;

    public String getToolNo() { return toolNo; }
    public void setToolNo(String toolNo) { this.toolNo = toolNo; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
}
