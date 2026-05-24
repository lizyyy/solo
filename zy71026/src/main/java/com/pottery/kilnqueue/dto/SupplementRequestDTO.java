package com.pottery.kilnqueue.dto;

import jakarta.validation.constraints.NotBlank;

public class SupplementRequestDTO {
    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    private String glazeCodes;

    private String supplementInfo;

    private String operator;

    public String getRequestId() { return requestId; }
    public void setRequestId(String requestId) { this.requestId = requestId; }
    public String getGlazeCodes() { return glazeCodes; }
    public void setGlazeCodes(String glazeCodes) { this.glazeCodes = glazeCodes; }
    public String getSupplementInfo() { return supplementInfo; }
    public void setSupplementInfo(String supplementInfo) { this.supplementInfo = supplementInfo; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
