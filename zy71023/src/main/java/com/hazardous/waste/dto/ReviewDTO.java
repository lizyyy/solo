package com.hazardous.waste.dto;

import jakarta.validation.constraints.NotBlank;

public class ReviewDTO {
    @NotBlank(message = "记录编号不能为空")
    private String recordNo;

    @NotBlank(message = "审核人不能为空")
    private String reviewer;

    private Boolean passed;

    private String comment;

    private String returnReason;

    public String getRecordNo() { return recordNo; }
    public void setRecordNo(String recordNo) { this.recordNo = recordNo; }
    public String getReviewer() { return reviewer; }
    public void setReviewer(String reviewer) { this.reviewer = reviewer; }
    public Boolean getPassed() { return passed; }
    public void setPassed(Boolean passed) { this.passed = passed; }
    public String getComment() { return comment; }
    public void setComment(String comment) { this.comment = comment; }
    public String getReturnReason() { return returnReason; }
    public void setReturnReason(String returnReason) { this.returnReason = returnReason; }
}
