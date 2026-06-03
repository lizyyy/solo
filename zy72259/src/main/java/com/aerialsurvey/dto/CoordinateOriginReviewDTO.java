package com.aerialsurvey.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class CoordinateOriginReviewDTO {
    @NotBlank(message = "停车楼编号不能为空")
    private String parkingLotCode;

    @NotBlank(message = "原点位置不能为空")
    private String originPoint;

    @NotBlank(message = "坐标系不能为空")
    private String coordinateSystem;

    private Double originX;
    private Double originY;
    private Double originZ;

    private String referenceDescription;

    @NotBlank(message = "复核人不能为空")
    private String reviewedBy;

    public String getParkingLotCode() {
        return parkingLotCode;
    }

    public void setParkingLotCode(String parkingLotCode) {
        this.parkingLotCode = parkingLotCode;
    }

    public String getOriginPoint() {
        return originPoint;
    }

    public void setOriginPoint(String originPoint) {
        this.originPoint = originPoint;
    }

    public String getCoordinateSystem() {
        return coordinateSystem;
    }

    public void setCoordinateSystem(String coordinateSystem) {
        this.coordinateSystem = coordinateSystem;
    }

    public Double getOriginX() {
        return originX;
    }

    public void setOriginX(Double originX) {
        this.originX = originX;
    }

    public Double getOriginY() {
        return originY;
    }

    public void setOriginY(Double originY) {
        this.originY = originY;
    }

    public Double getOriginZ() {
        return originZ;
    }

    public void setOriginZ(Double originZ) {
        this.originZ = originZ;
    }

    public String getReferenceDescription() {
        return referenceDescription;
    }

    public void setReferenceDescription(String referenceDescription) {
        this.referenceDescription = referenceDescription;
    }

    public String getReviewedBy() {
        return reviewedBy;
    }

    public void setReviewedBy(String reviewedBy) {
        this.reviewedBy = reviewedBy;
    }

    @Override
    public String toString() {
        return "CoordinateOriginReviewDTO{" +
                "parkingLotCode='" + parkingLotCode + '\'' +
                ", originPoint='" + originPoint + '\'' +
                ", coordinateSystem='" + coordinateSystem + '\'' +
                ", originX=" + originX +
                ", originY=" + originY +
                ", originZ=" + originZ +
                ", referenceDescription='" + referenceDescription + '\'' +
                ", reviewedBy='" + reviewedBy + '\'' +
                '}';
    }
}
