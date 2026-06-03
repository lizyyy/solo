package com.aerialsurvey.dto;

import com.aerialsurvey.enums.ConflictStatus;
import java.time.LocalDateTime;
import java.util.List;

public class ConflictDetectionDTO {
    private Long id;
    private String parkingLotCode;
    private Long safetyRadiusTableId;
    private Double safetyRadiusValue;
    private String radiusCoordinateReference;
    private Long coordinateOriginSpecId;
    private String originPoint;
    private String originCoordinateSystem;
    private String conflictDescription;
    private List<String> conflictEvidences;
    private ConflictStatus status;
    private String detectedBy;
    private LocalDateTime detectedAt;

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

    public Long getSafetyRadiusTableId() {
        return safetyRadiusTableId;
    }

    public void setSafetyRadiusTableId(Long safetyRadiusTableId) {
        this.safetyRadiusTableId = safetyRadiusTableId;
    }

    public Double getSafetyRadiusValue() {
        return safetyRadiusValue;
    }

    public void setSafetyRadiusValue(Double safetyRadiusValue) {
        this.safetyRadiusValue = safetyRadiusValue;
    }

    public String getRadiusCoordinateReference() {
        return radiusCoordinateReference;
    }

    public void setRadiusCoordinateReference(String radiusCoordinateReference) {
        this.radiusCoordinateReference = radiusCoordinateReference;
    }

    public Long getCoordinateOriginSpecId() {
        return coordinateOriginSpecId;
    }

    public void setCoordinateOriginSpecId(Long coordinateOriginSpecId) {
        this.coordinateOriginSpecId = coordinateOriginSpecId;
    }

    public String getOriginPoint() {
        return originPoint;
    }

    public void setOriginPoint(String originPoint) {
        this.originPoint = originPoint;
    }

    public String getOriginCoordinateSystem() {
        return originCoordinateSystem;
    }

    public void setOriginCoordinateSystem(String originCoordinateSystem) {
        this.originCoordinateSystem = originCoordinateSystem;
    }

    public String getConflictDescription() {
        return conflictDescription;
    }

    public void setConflictDescription(String conflictDescription) {
        this.conflictDescription = conflictDescription;
    }

    public List<String> getConflictEvidences() {
        return conflictEvidences;
    }

    public void setConflictEvidences(List<String> conflictEvidences) {
        this.conflictEvidences = conflictEvidences;
    }

    public ConflictStatus getStatus() {
        return status;
    }

    public void setStatus(ConflictStatus status) {
        this.status = status;
    }

    public String getDetectedBy() {
        return detectedBy;
    }

    public void setDetectedBy(String detectedBy) {
        this.detectedBy = detectedBy;
    }

    public LocalDateTime getDetectedAt() {
        return detectedAt;
    }

    public void setDetectedAt(LocalDateTime detectedAt) {
        this.detectedAt = detectedAt;
    }

    @Override
    public String toString() {
        return "ConflictDetectionDTO{" +
                "id=" + id +
                ", parkingLotCode='" + parkingLotCode + '\'' +
                ", safetyRadiusTableId=" + safetyRadiusTableId +
                ", safetyRadiusValue=" + safetyRadiusValue +
                ", radiusCoordinateReference='" + radiusCoordinateReference + '\'' +
                ", coordinateOriginSpecId=" + coordinateOriginSpecId +
                ", originPoint='" + originPoint + '\'' +
                ", originCoordinateSystem='" + originCoordinateSystem + '\'' +
                ", conflictDescription='" + conflictDescription + '\'' +
                ", conflictEvidences=" + conflictEvidences +
                ", status=" + status +
                ", detectedBy='" + detectedBy + '\'' +
                ", detectedAt=" + detectedAt +
                '}';
    }
}
