package com.pottery.kilnqueue.dto;

import jakarta.validation.constraints.NotBlank;

public class DecisionRequestDTO {
    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    private Boolean approved;

    private String reason;

    private String operator;

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public Boolean getApproved() { return approved; }
    public void setApproved(Boolean approved) { this.approved = approved; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
