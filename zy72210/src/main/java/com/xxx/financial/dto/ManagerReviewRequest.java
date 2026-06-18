package com.xxx.financial.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

public class ManagerReviewRequest {

    @NotBlank(message = "复核单号不能为空")
    private String reviewNo;
    @NotNull(message = "请选择是否通过")
    private Boolean approved;
    private String remark;

    public String getReviewNo() {
        return reviewNo;
    }

    public void setReviewNo(String reviewNo) {
        this.reviewNo = reviewNo;
    }

    public Boolean getApproved() {
        return approved;
    }

    public void setApproved(Boolean approved) {
        this.approved = approved;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }
}
