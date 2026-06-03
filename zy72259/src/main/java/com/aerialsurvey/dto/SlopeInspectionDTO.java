package com.aerialsurvey.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class SlopeInspectionDTO {
    @NotBlank(message = "停车楼编号不能为空")
    private String parkingLotCode;

    @NotBlank(message = "车位编号不能为空")
    private String parkingSpaceNo;

    @NotNull(message = "坡度值不能为空")
    private Double slopeValue;

    @NotNull(message = "最大允许坡度不能为空")
    private Double maxAllowedSlope;

    private Double actualSafeDistance;
    private String coordinateX;
    private String coordinateY;
    private String remark;
    private String screenshotPath;
    private Boolean isScreenshotBlocked = false;

    @NotBlank(message = "创建人不能为空")
    private String createdBy;

    public String getParkingLotCode() {
        return parkingLotCode;
    }

    public void setParkingLotCode(String parkingLotCode) {
        this.parkingLotCode = parkingLotCode;
    }

    public String getParkingSpaceNo() {
        return parkingSpaceNo;
    }

    public void setParkingSpaceNo(String parkingSpaceNo) {
        this.parkingSpaceNo = parkingSpaceNo;
    }

    public Double getSlopeValue() {
        return slopeValue;
    }

    public void setSlopeValue(Double slopeValue) {
        this.slopeValue = slopeValue;
    }

    public Double getMaxAllowedSlope() {
        return maxAllowedSlope;
    }

    public void setMaxAllowedSlope(Double maxAllowedSlope) {
        this.maxAllowedSlope = maxAllowedSlope;
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

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    @Override
    public String toString() {
        return "SlopeInspectionDTO{" +
                "parkingLotCode='" + parkingLotCode + '\'' +
                ", parkingSpaceNo='" + parkingSpaceNo + '\'' +
                ", slopeValue=" + slopeValue +
                ", maxAllowedSlope=" + maxAllowedSlope +
                ", actualSafeDistance=" + actualSafeDistance +
                ", coordinateX='" + coordinateX + '\'' +
                ", coordinateY='" + coordinateY + '\'' +
                ", remark='" + remark + '\'' +
                ", screenshotPath='" + screenshotPath + '\'' +
                ", isScreenshotBlocked=" + isScreenshotBlocked +
                ", createdBy='" + createdBy + '\'' +
                '}';
    }
}
