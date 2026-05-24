package com.floodrelief.entity;

import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "allocation_record")
public class AllocationRecord {

    public enum AllocationStatus {
        PENDING,
        APPROVED,
        DISPATCHED,
        RECEIVED,
        REJECTED,
        WITHDRAWN,
        CANCELLED
    }

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, unique = true)
    private String allocationNo;

    @Column(nullable = false)
    private Long shelterId;

    @Column(nullable = false)
    private Long materialBatchId;

    @Column(nullable = false)
    private Integer quantity;

    private String unit;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private AllocationStatus status;

    private String applicant;

    private String approver;

    private String dispatcher;

    private String receiver;

    private LocalDateTime dispatchedAt;

    private LocalDateTime receivedAt;

    @Column(length = 1000)
    private String receiptEvidence;

    @Column(length = 1000)
    private String rejectReason;

    @Column(length = 1000)
    private String withdrawReason;

    private Boolean manualCorrection = false;

    private String correctedBy;

    private String previousStatus;

    @Column(length = 1000)
    private String remark;

    @CreationTimestamp
    private LocalDateTime createdAt;

    @UpdateTimestamp
    private LocalDateTime updatedAt;

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getAllocationNo() { return allocationNo; }
    public void setAllocationNo(String allocationNo) { this.allocationNo = allocationNo; }
    public Long getShelterId() { return shelterId; }
    public void setShelterId(Long shelterId) { this.shelterId = shelterId; }
    public Long getMaterialBatchId() { return materialBatchId; }
    public void setMaterialBatchId(Long materialBatchId) { this.materialBatchId = materialBatchId; }
    public Integer getQuantity() { return quantity; }
    public void setQuantity(Integer quantity) { this.quantity = quantity; }
    public String getUnit() { return unit; }
    public void setUnit(String unit) { this.unit = unit; }
    public AllocationStatus getStatus() { return status; }
    public void setStatus(AllocationStatus status) { this.status = status; }
    public String getApplicant() { return applicant; }
    public void setApplicant(String applicant) { this.applicant = applicant; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public String getDispatcher() { return dispatcher; }
    public void setDispatcher(String dispatcher) { this.dispatcher = dispatcher; }
    public String getReceiver() { return receiver; }
    public void setReceiver(String receiver) { this.receiver = receiver; }
    public LocalDateTime getDispatchedAt() { return dispatchedAt; }
    public void setDispatchedAt(LocalDateTime dispatchedAt) { this.dispatchedAt = dispatchedAt; }
    public LocalDateTime getReceivedAt() { return receivedAt; }
    public void setReceivedAt(LocalDateTime receivedAt) { this.receivedAt = receivedAt; }
    public String getReceiptEvidence() { return receiptEvidence; }
    public void setReceiptEvidence(String receiptEvidence) { this.receiptEvidence = receiptEvidence; }
    public String getRejectReason() { return rejectReason; }
    public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }
    public String getWithdrawReason() { return withdrawReason; }
    public void setWithdrawReason(String withdrawReason) { this.withdrawReason = withdrawReason; }
    public Boolean getManualCorrection() { return manualCorrection; }
    public void setManualCorrection(Boolean manualCorrection) { this.manualCorrection = manualCorrection; }
    public String getCorrectedBy() { return correctedBy; }
    public void setCorrectedBy(String correctedBy) { this.correctedBy = correctedBy; }
    public String getPreviousStatus() { return previousStatus; }
    public void setPreviousStatus(String previousStatus) { this.previousStatus = previousStatus; }
    public LocalDateTime getCreatedAt() { return createdAt; }
    public void setCreatedAt(LocalDateTime createdAt) { this.createdAt = createdAt; }
    public LocalDateTime getUpdatedAt() { return updatedAt; }
    public void setUpdatedAt(LocalDateTime updatedAt) { this.updatedAt = updatedAt; }
}
