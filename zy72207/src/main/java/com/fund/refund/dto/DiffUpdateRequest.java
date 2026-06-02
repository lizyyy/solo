package com.fund.refund.dto;

import java.math.BigDecimal;
import java.util.List;

public class DiffUpdateRequest {

    private Long batchId;

    private String operator;

    private List<DiffItem> diffItems;

    public static class DiffItem {
        private Long detailId;
        private String bizNo;
        private String diffStatus;
        private String diffRemark;
        private BigDecimal confirmedAmount;
        private BigDecimal principal;
        private BigDecimal fee;
        private String manualChanges;

        public Long getDetailId() {
            return detailId;
        }

        public void setDetailId(Long detailId) {
            this.detailId = detailId;
        }

        public String getBizNo() {
            return bizNo;
        }

        public void setBizNo(String bizNo) {
            this.bizNo = bizNo;
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

        public String getManualChanges() {
            return manualChanges;
        }

        public void setManualChanges(String manualChanges) {
            this.manualChanges = manualChanges;
        }
    }

    public Long getBatchId() {
        return batchId;
    }

    public void setBatchId(Long batchId) {
        this.batchId = batchId;
    }

    public String getOperator() {
        return operator;
    }

    public void setOperator(String operator) {
        this.operator = operator;
    }

    public List<DiffItem> getDiffItems() {
        return diffItems;
    }

    public void setDiffItems(List<DiffItem> diffItems) {
        this.diffItems = diffItems;
    }
}
