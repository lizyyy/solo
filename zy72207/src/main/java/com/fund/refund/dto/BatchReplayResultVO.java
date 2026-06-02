package com.fund.refund.dto;

import java.math.BigDecimal;
import java.time.LocalDateTime;
import java.util.List;

public class BatchReplayResultVO {

    private Long batchId;
    private String batchNo;
    private String batchName;
    private LocalDateTime batchDate;
    private String fundCode;
    private String fundName;
    private String custodian;
    private Integer totalCount;
    private BigDecimal totalAmount;
    private String processStatus;
    private String processStatusDesc;
    private String currentStep;
    private String operator;
    private String supervisor;
    private String remark;
    private LocalDateTime createdAt;

    private List<RefundDetailVO> details;
    private List<SelfCheckResultVO> selfCheckResults;
    private List<String> pendingSupervisorBizNos;

    public Long getBatchId() {
        return batchId;
    }

    public void setBatchId(Long batchId) {
        this.batchId = batchId;
    }

    public String getBatchNo() {
        return batchNo;
    }

    public void setBatchNo(String batchNo) {
        this.batchNo = batchNo;
    }

    public String getBatchName() {
        return batchName;
    }

    public void setBatchName(String batchName) {
        this.batchName = batchName;
    }

    public LocalDateTime getBatchDate() {
        return batchDate;
    }

    public void setBatchDate(LocalDateTime batchDate) {
        this.batchDate = batchDate;
    }

    public String getFundCode() {
        return fundCode;
    }

    public void setFundCode(String fundCode) {
        this.fundCode = fundCode;
    }

    public String getFundName() {
        return fundName;
    }

    public void setFundName(String fundName) {
        this.fundName = fundName;
    }

    public String getCustodian() {
        return custodian;
    }

    public void setCustodian(String custodian) {
        this.custodian = custodian;
    }

    public Integer getTotalCount() {
        return totalCount;
    }

    public void setTotalCount(Integer totalCount) {
        this.totalCount = totalCount;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getProcessStatus() {
        return processStatus;
    }

    public void setProcessStatus(String processStatus) {
        this.processStatus = processStatus;
    }

    public String getProcessStatusDesc() {
        return processStatusDesc;
    }

    public void setProcessStatusDesc(String processStatusDesc) {
        this.processStatusDesc = processStatusDesc;
    }

    public String getCurrentStep() {
        return currentStep;
    }

    public void setCurrentStep(String currentStep) {
        this.currentStep = currentStep;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public String getSupervisor() {
        return supervisor;
    }

    public void setSupervisor(String supervisor) {
        this.supervisor = supervisor;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<RefundDetailVO> getDetails() {
        return details;
    }

    public void setDetails(List<RefundDetailVO> details) {
        this.details = details;
    }

    public List<SelfCheckResultVO> getSelfCheckResults() {
        return selfCheckResults;
    }

    public void setSelfCheckResults(List<SelfCheckResultVO> selfCheckResults) {
        this.selfCheckResults = selfCheckResults;
    }

    public List<String> getPendingSupervisorBizNos() {
        return pendingSupervisorBizNos;
    }

    public void setPendingSupervisorBizNos(List<String> pendingSupervisorBizNos) {
        this.pendingSupervisorBizNos = pendingSupervisorBizNos;
    }
}
