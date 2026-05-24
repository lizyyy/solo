package com.pottery.kilnqueue.dto;

import jakarta.validation.constraints.NotBlank;

public class RescheduleRequestDTO {
    @NotBlank(message = "原请求ID不能为空")
    private String originalRequestId;

    @NotBlank(message = "新幂等键不能为空")
    private String newIdempotencyKey;

    @NotBlank(message = "新请求ID不能为空")
    private String newRequestId;

    private String reason;

    private Boolean insertToFront = false;

    private Integer targetPosition;

    private String operator;

    public String getOriginalRequestId() { return originalRequestId; }
    public void setOriginalRequestId(String originalRequestId) { this.originalRequestId = originalRequestId; }
    public String getNewIdempotencyKey() { return newIdempotencyKey; }
    public void setNewIdempotencyKey(String newIdempotencyKey) { this.newIdempotencyKey = newIdempotencyKey; }
    public String getNewRequestId() { return newRequestId; }
    public void setNewRequestId(String newRequestId) { this.newRequestId = newRequestId; }
    public String getReason() { return reason; }
    public void setReason(String reason) { this.reason = reason; }
    public Boolean getInsertToFront() { return insertToFront; }
    public void setInsertToFront(Boolean insertToFront) { this.insertToFront = insertToFront; }
    public Integer getTargetPosition() { return targetPosition; }
    public void setTargetPosition(Integer targetPosition) { this.targetPosition = targetPosition; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
