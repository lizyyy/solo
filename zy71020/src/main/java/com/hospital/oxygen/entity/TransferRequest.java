package com.hospital.oxygen.entity;

import com.hospital.oxygen.enums.TransferStatus;
import jakarta.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "transfer_requests")
public class TransferRequest {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(unique = true, nullable = false)
    private String transferNumber;

    @Column(nullable = false)
    private String patientId;

    @Column(nullable = false)
    private String fromWard;

    @Column(nullable = false)
    private String toWard;

    private String fromBed;
    private String toBed;

    private String oxygenPortCode;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private TransferStatus status = TransferStatus.PENDING;

    private LocalDateTime requestTime;
    private LocalDateTime approveTime;
    private LocalDateTime transferTime;
    private LocalDateTime completeTime;

    private Boolean resourcesReleased = false;
    private LocalDateTime releaseTime;

    private String remarks;
    private String operator;

    private Boolean isOverridden = false;
    private String overrideReason;
    private String overrideOperator;

    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;

    @PrePersist
    protected void onCreate() {
        createdAt = LocalDateTime.now();
        updatedAt = LocalDateTime.now();
        if (requestTime == null) {
            requestTime = LocalDateTime.now();
        }
    }

    @PreUpdate
    protected void onUpdate() {
        updatedAt = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getTransferNumber() { return transferNumber; }
    public void setTransferNumber(String transferNumber) { this.transferNumber = transferNumber; }
    public String getPatientId() { return patientId; }
    public void setPatientId(String patientId) { this.patientId = patientId; }
    public String getFromWard() { return fromWard; }
    public void setFromWard(String fromWard) { this.fromWard = fromWard; }
    public String getToWard() { return toWard; }
    public void setToWard(String toWard) { this.toWard = toWard; }
    public String getFromBed() { return fromBed; }
    public void setFromBed(String fromBed) { this.fromBed = fromBed; }
    public String getToBed() { return toBed; }
    public void setToBed(String toBed) { this.toBed = toBed; }
    public String getOxygenPortCode() { return oxygenPortCode; }
    public void setOxygenPortCode(String oxygenPortCode) { this.oxygenPortCode = oxygenPortCode; }
    public TransferStatus getStatus() { return status; }
    public void setStatus(TransferStatus status) { this.status = status; }
    public LocalDateTime getRequestTime() { return requestTime; }
    public void setRequestTime(LocalDateTime requestTime) { this.requestTime = requestTime; }
    public LocalDateTime getApproveTime() { return approveTime; }
    public void setApproveTime(LocalDateTime approveTime) { this.approveTime = approveTime; }
    public LocalDateTime getTransferTime() { return transferTime; }
    public void setTransferTime(LocalDateTime transferTime) { this.transferTime = transferTime; }
    public LocalDateTime getCompleteTime() { return completeTime; }
    public void setCompleteTime(LocalDateTime completeTime) { this.completeTime = completeTime; }
    public Boolean getResourcesReleased() { return resourcesReleased; }
    public void setResourcesReleased(Boolean resourcesReleased) { this.resourcesReleased = resourcesReleased; }
    public LocalDateTime getReleaseTime() { return releaseTime; }
    public void setReleaseTime(LocalDateTime releaseTime) { this.releaseTime = releaseTime; }
    public String getRemarks() { return remarks; }
    public void setRemarks(String remarks) { this.remarks = remarks; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
    public Boolean getIsOverridden() { return isOverridden; }
    public void setIsOverridden(Boolean isOverridden) { this.isOverridden = isOverridden; }
    public String getOverrideReason() { return overrideReason; }
    public void setOverrideReason(String overrideReason) { this.overrideReason = overrideReason; }
    public String getOverrideOperator() { return overrideOperator; }
    public void setOverrideOperator(String overrideOperator) { this.overrideOperator = overrideOperator; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
