package com.aerialsurvey.dto;

import com.aerialsurvey.enums.InspectionStatus;
import jakarta.validation.constraints.NotNull;

public class ManagerReviewDTO {
    @NotNull(message = "告警记录ID不能为空")
    private Long alertId;

    private String reviewRemark;

    @NotNull(message = "处理状态不能为空")
    private InspectionStatus resolvedStatus;

    @NotNull(message = "复核人不能为空")
    private String reviewedBy;

    public Long getAlertId() {
        return alertId;
    }

    public void setAlertId(Long alertId) {
        this.alertId = alertId;
    }

    public String getReviewRemark() {
        return reviewRemark;
    }

    public void setReviewRemark(String reviewRemark) {
        this.reviewRemark = reviewRemark;
    }

    public InspectionStatus getResolvedStatus() {
        return resolvedStatus;
    }

    public void setResolvedStatus(InspectionStatus resolvedStatus) {
        this.resolvedStatus = resolvedStatus;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    @Override
    public String toString() {
        return "ManagerReviewDTO{" +
                "alertId=" + alertId +
                ", reviewRemark='" + reviewRemark + '\'' +
                ", resolvedStatus=" + resolvedStatus +
                ", reviewedBy='" + reviewedBy + '\'' +
                '}';
    }
}
