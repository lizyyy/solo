package com.aerialsurvey.entity;

import com.aerialsurvey.enums.ConflictStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;
import java.util.List;

@Entity
@Table(name = "conflict_record")
public class ConflictRecord {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false)
    private String parkingLotCode;

    private Long safetyRadiusTableId;

    private Long coordinateOriginSpecId;

    @Column(columnDefinition = "TEXT")
    private String conflictDescription;

    @ElementCollection
    @Column(columnDefinition = "TEXT")
    private List<String> conflictEvidences;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private ConflictStatus status;

    private String handledBy;

    private LocalDateTime handledAt;

    private String handlingRemark;

    @Column(nullable = false)
    private String detectedBy;

    @Column(nullable = false)
    private LocalDateTime detectedAt;

    @PrePersist
    protected void onCreate() {
        detectedAt = LocalDateTime.now();
        status = ConflictStatus.PENDING_CONFIRM;
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

    public Long getSafetyRadiusTableId() {
        return safetyRadiusTableId;
    }

    public void setSafetyRadiusTableId(Long safetyRadiusTableId) {
        this.safetyRadiusTableId = safetyRadiusTableId;
    }

    public Long getCoordinateOriginSpecId() {
        return coordinateOriginSpecId;
    }

    public void setCoordinateOriginSpecId(Long coordinateOriginSpecId) {
        this.coordinateOriginSpecId = coordinateOriginSpecId;
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

    public String getHandledBy() {
        return handledBy;
    }

    public void setHandledBy(String handledBy) {
        this.handledBy = handledBy;
    }

    public LocalDateTime getHandledAt() {
        return handledAt;
    }

    public void setHandledAt(LocalDateTime handledAt) {
        this.handledAt = handledAt;
    }

    public String getHandlingRemark() {
        return handlingRemark;
    }

    public void setHandlingRemark(String handlingRemark) {
        this.handlingRemark = handlingRemark;
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
        return "ConflictRecord{" +
                "id=" + id +
                ", parkingLotCode='" + parkingLotCode + '\'' +
                ", safetyRadiusTableId=" + safetyRadiusTableId +
                ", coordinateOriginSpecId=" + coordinateOriginSpecId +
                ", conflictDescription='" + conflictDescription + '\'' +
                ", conflictEvidences=" + conflictEvidences +
                ", status=" + status +
                ", handledBy='" + handledBy + '\'' +
                ", handledAt=" + handledAt +
                ", handlingRemark='" + handlingRemark + '\'' +
                ", detectedBy='" + detectedBy + '\'' +
                ", detectedAt=" + detectedAt +
                '}';
    }
}
