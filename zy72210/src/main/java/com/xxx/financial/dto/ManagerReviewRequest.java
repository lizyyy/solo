package com.xxx.financial.dto;

public class ManagerReviewRequest {
    private String reviewNo;
    private boolean approved;
    private String remark;

    public String getReviewNo() { return reviewNo; }
    public void setReviewNo(String reviewNo) { this.reviewNo = reviewNo; }
    public boolean isApproved() { return approved; }
    public void setApproved(boolean approved) { this.approved = approved; }
    public String getRemark() { return remark; }
    public void setRemark(String remark) { this.remark = remark; }
}
