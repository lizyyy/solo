package com.aerialsurvey.entity;

import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "coordinate_origin_spec")
public class CoordinateOriginSpec {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String parkingLotCode;

    @Column(nullable = false)
    private String originPoint;

    @Column(nullable = false)
    private String coordinateSystem;

    private Double originX;

    private Double originY;

    private Double originZ;

    private String referenceDescription;

    @Column(nullable = false)
    private String reviewedBy;

    @Column(nullable = false)
    private LocalDateTime reviewedAt;

    private Integer version = 1;

    private Boolean isActive = true;

    @PrePersist
    protected void onCreate() {
        reviewedAt = LocalDateTime.now();
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

    public LocalDateTime getReviewedAt() {
        return reviewedAt;
    }

    public void setReviewedAt(LocalDateTime reviewedAt) {
        this.reviewedAt = reviewedAt;
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
        return "CoordinateOriginSpec{" +
                "id=" + id +
                ", parkingLotCode='" + parkingLotCode + '\'' +
                ", originPoint='" + originPoint + '\'' +
                ", coordinateSystem='" + coordinateSystem + '\'' +
                ", originX=" + originX +
                ", originY=" + originY +
                ", originZ=" + originZ +
                ", referenceDescription='" + referenceDescription + '\'' +
                ", reviewedBy='" + reviewedBy + '\'' +
                ", reviewedAt=" + reviewedAt +
                ", version=" + version +
                ", isActive=" + isActive +
                '}';
    }
}
