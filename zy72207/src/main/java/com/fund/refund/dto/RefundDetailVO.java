package com.fund.refund.dto;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

public class RefundDetailVO {

    private Long id;
    private String batchNo;
    private String bizNo;
    private String sameBizNoGroup;
    private String detailType;
    private String detailTypeDesc;
    private Integer custodianRowNo;
    private String merchantNo;
    private String merchantName;
    private LocalDate tradeDate;
    private LocalDate settlementDate;
    private BigDecimal originalAmount;
    private BigDecimal confirmedAmount;
    private BigDecimal principal;
    private BigDecimal fee;
    private String currency;
    private String processStatus;
    private String processStatusDesc;
    private String manualChanges;
    private String manualOperator;
    private LocalDateTime manualOperateAt;
    private String evidenceStatus;
    private String diffStatus;
    private String diffRemark;
    private String supervisorRemark;
    private String supervisor;
    private LocalDateTime supervisorReviewedAt;
    private String remark;

    private String originalEvidenceContent;
    private String exDividendEvidenceContent;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getBatchNo() {
        return batchNo;
    }

    public void setBatchNo(String batchNo) {
        this.batchNo = batchNo;
    }

    public String getBizNo() {
        return bizNo;
    }

    public void setBizNo(String bizNo) {
        this.bizNo = bizNo;
    }

    public String getSameBizNoGroup() {
        return sameBizNoGroup;
    }

    public void setSameBizNoGroup(String sameBizNoGroup) {
        this.sameBizNoGroup = sameBizNoGroup;
    }

    public String getDetailType() {
        return detailType;
    }

    public void setDetailType(String detailType) {
        this.detailType = detailType;
    }

    public String getDetailTypeDesc() {
        return detailTypeDesc;
    }

    public void setDetailTypeDesc(String detailTypeDesc) {
        this.detailTypeDesc = detailTypeDesc;
    }

    public Integer getCustodianRowNo() {
        return custodianRowNo;
    }

    public void setCustodianRowNo(Integer custodianRowNo) {
        this.custodianRowNo = custodianRowNo;
    }

    public String getMerchantNo() {
        return merchantNo;
    }

    public void setMerchantNo(String merchantNo) {
        this.merchantNo = merchantNo;
    }

    public String getMerchantName() {
        return merchantName;
    }

    public void setMerchantName(String merchantName) {
        this.merchantName = merchantName;
    }

    public LocalDate getTradeDate() {
        return tradeDate;
    }

    public void setTradeDate(LocalDate tradeDate) {
        this.tradeDate = tradeDate;
    }

    public LocalDate getSettlementDate() {
        return settlementDate;
    }

    public void setSettlementDate(LocalDate settlementDate) {
        this.settlementDate = settlementDate;
    }

    public BigDecimal getOriginalAmount() {
        return originalAmount;
    }

    public void setOriginalAmount(BigDecimal originalAmount) {
        this.originalAmount = originalAmount;
    }

    public BigDecimal getConfirmedAmount() {
        return confirmedAmount;
    }

    public void setConfirmedAmount(BigDecimal confirmedAmount) {
        this.confirmedAmount = confirmedAmount;
    }

    public BigDecimal getPrincipal() {
        return principal;
    }

    public void setPrincipal(BigDecimal principal) {
        this.principal = principal;
    }

    public BigDecimal getFee() {
        return fee;
    }

    public void setFee(BigDecimal fee) {
        this.fee = fee;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
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

    public String getManualChanges() {
        return manualChanges;
    }

    public void setManualChanges(String manualChanges) {
        this.manualChanges = manualChanges;
    }

    public String getManualOperator() {
        return manualOperator;
    }

    public void setManualOperator(String manualOperator) {
        this.manualOperator = manualOperator;
    }

    public LocalDateTime getManualOperateAt() {
        return manualOperateAt;
    }

    public void setManualOperateAt(LocalDateTime manualOperateAt) {
        this.manualOperateAt = manualOperateAt;
    }

    public String getEvidenceStatus() {
        return evidenceStatus;
    }

    public void setEvidenceStatus(String evidenceStatus) {
        this.evidenceStatus = evidenceStatus;
    }

    public String getDiffStatus() {
        return diffStatus;
    }

    public void setDiffStatus(String diffStatus) {
        this.diffStatus = diffStatus;
    }

    public String getDiffRemark() {
        return diffRemark;
    }

    public void setDiffRemark(String diffRemark) {
        this.diffRemark = diffRemark;
    }

    public String getSupervisorRemark() {
        return supervisorRemark;
    }

    public void setSupervisorRemark(String supervisorRemark) {
        this.supervisorRemark = supervisorRemark;
    }

    public String getSupervisor() {
        return supervisor;
    }

    public void setSupervisor(String supervisor) {
        this.supervisor = supervisor;
    }

    public LocalDateTime getSupervisorReviewedAt() {
        return supervisorReviewedAt;
    }

    public void setSupervisorReviewedAt(LocalDateTime supervisorReviewedAt) {
        this.supervisorReviewedAt = supervisorReviewedAt;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public String getOriginalEvidenceContent() {
        return originalEvidenceContent;
    }

    public void setOriginalEvidenceContent(String originalEvidenceContent) {
        this.originalEvidenceContent = originalEvidenceContent;
    }

    public String getExDividendEvidenceContent() {
        return exDividendEvidenceContent;
    }

    public void setExDividendEvidenceContent(String exDividendEvidenceContent) {
        this.exDividendEvidenceContent = exDividendEvidenceContent;
    }
}
