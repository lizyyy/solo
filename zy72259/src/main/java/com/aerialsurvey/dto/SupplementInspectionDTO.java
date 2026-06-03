package com.aerialsurvey.dto;

import jakarta.validation.constraints.NotNull;

public class SupplementInspectionDTO {
    @NotNull(message = "检查记录ID不能为空")
    private Long inspectionId;

    private Double actualSafeDistance;
    private String coordinateX;
    private String coordinateY;
    private String remark;
    private String screenshotPath;
    private Boolean isScreenshotBlocked;

    @NotNull(message = "补录人不能为空")
    private String supplementedBy;

    public Long getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(Long inspectionId) {
        this.inspectionId = inspectionId;
    }

    public Double getActualSafeDistance() {
        return actualSafeDistance;
    }

    public void setActualSafeDistance(Double actualSafeDistance) {
        this.actualSafeDistance = actualSafeDistance;
    }

    public String getCoordinateX() {
        return coordinateX;
    }

    public void setCoordinateX(String coordinateX) {
        this.coordinateX = coordinateX;
    }

    public String getCoordinateY() {
        return coordinateY;
    }

    public void setCoordinateY(String coordinateY) {
        this.coordinateY = coordinateY;
    }

    public String getRemark() {
        return remark;
    }

    public void setRemark(String remark) {
        this.remark = remark;
    }

    public String getScreenshotPath() {
        return screenshotPath;
    }

    public void setScreenshotPath(String screenshotPath) {
        this.screenshotPath = screenshotPath;
    }

    public Boolean getScreenshotBlocked() {
        return isScreenshotBlocked;
    }

    public void setScreenshotBlocked(Boolean screenshotBlocked) {
        isScreenshotBlocked = screenshotBlocked;
    }

    public Boolean getIsScreenshotBlocked() {
        return isScreenshotBlocked;
    }

    public void setIsScreenshotBlocked(Boolean screenshotBlocked) {
        isScreenshotBlocked = screenshotBlocked;
    }

    public String getSupplementedBy() {
        return supplementedBy;
    }

    public void setSupplementedBy(String supplementedBy) {
        this.supplementedBy = supplementedBy;
    }

    @Override
    public String toString() {
        return "SupplementInspectionDTO{" +
                "inspectionId=" + inspectionId +
                ", actualSafeDistance=" + actualSafeDistance +
                ", coordinateX='" + coordinateX + '\'' +
                ", coordinateY='" + coordinateY + '\'' +
                ", remark='" + remark + '\'' +
                ", screenshotPath='" + screenshotPath + '\'' +
                ", isScreenshotBlocked=" + isScreenshotBlocked +
                ", supplementedBy='" + supplementedBy + '\'' +
                '}';
    }
}
