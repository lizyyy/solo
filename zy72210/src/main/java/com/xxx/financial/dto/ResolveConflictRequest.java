package com.xxx.financial.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class ResolveConflictRequest {

    @NotBlank(message = "复核单号不能为空")
    private String reviewNo;
    @NotBlank(message = "调整单号不能为空")
    private String adjustmentNo;
    @NotNull(message = "请选择确认或驳回")
    private Boolean confirm;
    private String decisionRemark;

    public String getReviewNo() {
        return reviewNo;
    }

    public void setReviewNo(String reviewNo) {
        this.reviewNo = reviewNo;
    }

    public String getAdjustmentNo() {
        return adjustmentNo;
    }

    public void setAdjustmentNo(String adjustmentNo) {
        this.adjustmentNo = adjustmentNo;
    }

    public Boolean getConfirm() {
        return confirm;
    }

    public void setConfirm(Boolean confirm) {
        this.confirm = confirm;
    }

    public String getDecisionRemark() {
        return decisionRemark;
    }

    public void setDecisionRemark(String decisionRemark) {
        this.decisionRemark = decisionRemark;
    }
}
