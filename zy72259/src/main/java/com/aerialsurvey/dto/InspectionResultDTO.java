package com.aerialsurvey.dto;

import com.aerialsurvey.enums.InspectionStatus;
import java.time.LocalDateTime;
import java.util.List;

public class InspectionResultDTO {
    private Long id;
    private String parkingLotCode;
    private String parkingSpaceNo;
    private Double slopeValue;
    private Double maxAllowedSlope;
    private Double actualSafeDistance;
    private Double calculatedSafeDistance;
    private String coordinateX;
    private String coordinateY;
    private InspectionStatus status;
    private String remark;
    private String screenshotPath;
    private Boolean isScreenshotBlocked;
    private String reviewedBy;
    private LocalDateTime reviewedAt;
    private String supplementedBy;
    private LocalDateTime supplementedAt;
    private String createdBy;
    private LocalDateTime createdAt;
    private List<String> alertMessages;
    private Boolean requiresManagerReview;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

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

    public Double getCalculatedSafeDistance() {
        return calculatedSafeDistance;
    }

    public void setCalculatedSafeDistance(Double calculatedSafeDistance) {
        this.calculatedSafeDistance = calculatedSafeDistance;
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

    public InspectionStatus getStatus() {
        return status;
    }

    public void setStatus(InspectionStatus status) {
        this.status = status;
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

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
    }

    public String getSupplementedBy() {
        return supplementedBy;
    }

    public void setSupplementedBy(String supplementedBy) {
        this.supplementedBy = supplementedBy;
    }

    public LocalDateTime getSupplementedAt() {
        return supplementedAt;
    }

    public void setSupplementedAt(LocalDateTime supplementedAt) {
        this.supplementedAt = supplementedAt;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public List<String> getAlertMessages() {
        return alertMessages;
    }

    public void setAlertMessages(List<String> alertMessages) {
        this.alertMessages = alertMessages;
    }

    public Boolean getRequiresManagerReview() {
        return requiresManagerReview;
    }

    public void setRequiresManagerReview(Boolean requiresManagerReview) {
        this.requiresManagerReview = requiresManagerReview;
    }

    @Override
    public String toString() {
        return "InspectionResultDTO{" +
                "id=" + id +
                ", parkingLotCode='" + parkingLotCode + '\'' +
                ", parkingSpaceNo='" + parkingSpaceNo + '\'' +
                ", slopeValue=" + slopeValue +
                ", maxAllowedSlope=" + maxAllowedSlope +
                ", actualSafeDistance=" + actualSafeDistance +
                ", calculatedSafeDistance=" + calculatedSafeDistance +
                ", coordinateX='" + coordinateX + '\'' +
                ", coordinateY='" + coordinateY + '\'' +
                ", status=" + status +
                ", remark='" + remark + '\'' +
                ", screenshotPath='" + screenshotPath + '\'' +
                ", isScreenshotBlocked=" + isScreenshotBlocked +
                ", reviewedBy='" + reviewedBy + '\'' +
                ", reviewedAt=" + reviewedAt +
                ", supplementedBy='" + supplementedBy + '\'' +
                ", supplementedAt=" + supplementedAt +
                ", createdBy='" + createdBy + '\'' +
                ", createdAt=" + createdAt +
                ", alertMessages=" + alertMessages +
                ", requiresManagerReview=" + requiresManagerReview +
                '}';
    }
}
