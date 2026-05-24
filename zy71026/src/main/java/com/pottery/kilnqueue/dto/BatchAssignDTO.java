package com.pottery.kilnqueue.dto;

import jakarta.validation.constraints.NotBlank;

import java.util.List;

public class BatchAssignDTO {
    @NotBlank(message = "批次编号不能为空")
    private String batchNo;

    private List<String> requestIds;

    private String operator;

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public List<String> getRequestIds() { return requestIds; }
    public void setRequestIds(List<String> requestIds) { this.requestIds = requestIds; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
