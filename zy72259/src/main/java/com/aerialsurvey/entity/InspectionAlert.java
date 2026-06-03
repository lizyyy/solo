package com.aerialsurvey.entity;

import com.aerialsurvey.enums.AlertType;
import com.aerialsurvey.enums.InspectionStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "inspection_alert")
public class InspectionAlert {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String parkingLotCode;

    private Long inspectionId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AlertType alertType;

    @Column(columnDefinition = "TEXT")
    private String alertMessage;

    private Boolean isManagerReviewed = false;

    private String managerReviewRemark;

    private String reviewedBy;

    private LocalDateTime reviewedAt;

    @Enumerated(EnumType.STRING)
    private InspectionStatus resolvedStatus;

    @Column(nullable = false)
    private String createdBy;

    @Column(nullable = false)
    private LocalDateTime createdAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
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

    public Long getInspectionId() {
        return inspectionId;
    }

    public void setInspectionId(Long inspectionId) {
        this.inspectionId = inspectionId;
    }

    public AlertType getAlertType() {
        return alertType;
    }

    public void setAlertType(AlertType alertType) {
        this.alertType = alertType;
    }

    public String getAlertMessage() {
        return alertMessage;
    }

    public void setAlertMessage(String alertMessage) {
        this.alertMessage = alertMessage;
    }

    public Boolean getManagerReviewed() {
        return isManagerReviewed;
    }

    public void setManagerReviewed(Boolean managerReviewed) {
        isManagerReviewed = managerReviewed;
    }

    public Boolean getIsManagerReviewed() {
        return isManagerReviewed;
    }

    public void setIsManagerReviewed(Boolean managerReviewed) {
        isManagerReviewed = managerReviewed;
    }

    public String getManagerReviewRemark() {
        return managerReviewRemark;
    }

    public void setManagerReviewRemark(String managerReviewRemark) {
        this.managerReviewRemark = managerReviewRemark;
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

    public InspectionStatus getResolvedStatus() {
        return resolvedStatus;
    }

    public void setResolvedStatus(InspectionStatus resolvedStatus) {
        this.resolvedStatus = resolvedStatus;
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

    @Override
    public String toString() {
        return "InspectionAlert{" +
                "id=" + id +
                ", parkingLotCode='" + parkingLotCode + '\'' +
                ", inspectionId=" + inspectionId +
                ", alertType=" + alertType +
                ", alertMessage='" + alertMessage + '\'' +
                ", isManagerReviewed=" + isManagerReviewed +
                ", managerReviewRemark='" + managerReviewRemark + '\'' +
                ", reviewedBy='" + reviewedBy + '\'' +
                ", reviewedAt=" + reviewedAt +
                ", resolvedStatus=" + resolvedStatus +
                ", createdBy='" + createdBy + '\'' +
                ", createdAt=" + createdAt +
                '}';
    }
}
