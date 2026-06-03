package com.aerialsurvey.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "safety_radius_table")
public class SafetyRadiusTable {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String parkingLotCode;

    @Column(nullable = false)
    private Double safetyRadius;

    @Column(nullable = false)
    private String coordinateReference;

    private String radiusUnit;

    private String description;

    @Column(nullable = false)
    private String importedBy;

    @Column(nullable = false)
    private LocalDateTime importedAt;

    private Integer version = 1;

    private Boolean isActive = true;

    @PrePersist
    protected void onCreate() {
        importedAt = LocalDateTime.now();
    }

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

    public LocalDateTime getImportedAt() {
        return importedAt;
    }

    public void setImportedAt(LocalDateTime importedAt) {
        this.importedAt = importedAt;
    }

    public Integer getVersion() {
        return version;
    }

    public void setVersion(Integer version) {
        this.version = version;
    }

    public Boolean getActive() {
        return isActive;
    }

    public void setActive(Boolean active) {
        isActive = active;
    }

    @Override
    public String toString() {
        return "SafetyRadiusTable{" +
                "id=" + id +
                ", parkingLotCode='" + parkingLotCode + '\'' +
                ", safetyRadius=" + safetyRadius +
                ", coordinateReference='" + coordinateReference + '\'' +
                ", radiusUnit='" + radiusUnit + '\'' +
                ", description='" + description + '\'' +
                ", importedBy='" + importedBy + '\'' +
                ", importedAt=" + importedAt +
                ", version=" + version +
                ", isActive=" + isActive +
                '}';
    }
}
