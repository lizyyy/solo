package com.aerialsurvey.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

public class SafetyRadiusImportDTO {
    @NotBlank(message = "停车楼编号不能为空")
    private String parkingLotCode;

    @NotNull(message = "安全半径不能为空")
    private Double safetyRadius;

    @NotBlank(message = "坐标参考不能为空")
    private String coordinateReference;

    private String radiusUnit;

    private String description;

    @NotBlank(message = "导入人不能为空")
    private String importedBy;

    public String getParkingLotCode() {
        return parkingLotCode;
    }

    public void setParkingLotCode(String parkingLotCode) {
        this.parkingLotCode = parkingLotCode;
    }

    public Double getSafetyRadius() {
        return safetyRadius;
    }

    public void setSafetyRadius(Double safetyRadius) {
        this.safetyRadius = safetyRadius;
    }

    public String getCoordinateReference() {
        return coordinateReference;
    }

    public void setCoordinateReference(String coordinateReference) {
        this.coordinateReference = coordinateReference;
    }

    public String getRadiusUnit() {
        return radiusUnit;
    }

    public void setRadiusUnit(String radiusUnit) {
        this.radiusUnit = radiusUnit;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public String getImportedBy() {
        return importedBy;
    }

    public void setImportedBy(String importedBy) {
        this.importedBy = importedBy;
    }

    @Override
    public String toString() {
        return "SafetyRadiusImportDTO{" +
                "parkingLotCode='" + parkingLotCode + '\'' +
                ", safetyRadius=" + safetyRadius +
                ", coordinateReference='" + coordinateReference + '\'' +
                ", radiusUnit='" + radiusUnit + '\'' +
                ", description='" + description + '\'' +
                ", importedBy='" + importedBy + '\'' +
                '}';
    }
}
