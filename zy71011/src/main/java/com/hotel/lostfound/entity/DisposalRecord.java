package com.hotel.lostfound.entity;

import com.hotel.lostfound.entity.enums.DisposalType;
import jakarta.persistence.*;
import org.hibernate.annotations.CreationTimestamp;

import java.time.LocalDateTime;

@Entity
@Table(name = "disposal_records")
public class DisposalRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @OneToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "lost_item_id", nullable = false, unique = true)
    private LostItem lostItem;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false)
    private DisposalType disposalType;

    @Column(nullable = false, length = 50)
    private String appliedBy;

    @Column(nullable = false)
    private LocalDateTime appliedAt;

    @Column(length = 1000)
    private String applyReason;

    private boolean managerApproved;

    @Column(length = 50)
    private String approvedBy;

    private LocalDateTime approvedAt;

    @Column(length = 500)
    private String approveRemark;

    @Column(length = 500)
    private String evidenceImageUrls;

    @Column(nullable = false, length = 50)
    private String handledBy;

    @Column(nullable = false)
    private LocalDateTime disposedAt;

    @Column(length = 1000)
    private String disposalDetail;

    @CreationTimestamp
    @Column(updatable = false)
    private LocalDateTime createdAt;

    @Column(nullable = false)
    private String requestId;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public LostItem getLostItem() {
        return lostItem;
    }

    public void setLostItem(LostItem lostItem) {
        this.lostItem = lostItem;
    }

    public DisposalType getDisposalType() {
        return disposalType;
    }

    public void setDisposalType(DisposalType disposalType) {
        this.disposalType = disposalType;
    }

    public String getAppliedBy() {
        return appliedBy;
    }

    public void setAppliedBy(String appliedBy) {
        this.appliedBy = appliedBy;
    }

    public LocalDateTime getAppliedAt() {
        return appliedAt;
    }

    public void setAppliedAt(LocalDateTime appliedAt) {
        this.appliedAt = appliedAt;
    }

    public String getApplyReason() {
        return applyReason;
    }

    public void setApplyReason(String applyReason) {
        this.applyReason = applyReason;
    }

    public boolean isManagerApproved() {
        return managerApproved;
    }

    public void setManagerApproved(boolean managerApproved) {
        this.managerApproved = managerApproved;
    }

    public String getApprovedBy() {
        return approvedBy;
    }

    public void setApprovedBy(String approvedBy) {
        this.approvedBy = approvedBy;
    }

    public LocalDateTime getApprovedAt() {
        return approvedAt;
    }

    public void setApprovedAt(LocalDateTime approvedAt) {
        this.approvedAt = approvedAt;
    }

    public String getApproveRemark() {
        return approveRemark;
    }

    public void setApproveRemark(String approveRemark) {
        this.approveRemark = approveRemark;
    }

    public String getEvidenceImageUrls() {
        return evidenceImageUrls;
    }

    public void setEvidenceImageUrls(String evidenceImageUrls) {
        this.evidenceImageUrls = evidenceImageUrls;
    }

    public String getHandledBy() {
        return handledBy;
    }

    public void setHandledBy(String handledBy) {
        this.handledBy = handledBy;
    }

    public LocalDateTime getDisposedAt() {
        return disposedAt;
    }

    public void setDisposedAt(LocalDateTime disposedAt) {
        this.disposedAt = disposedAt;
    }

    public String getDisposalDetail() {
        return disposalDetail;
    }

    public void setDisposalDetail(String disposalDetail) {
        this.disposalDetail = disposalDetail;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }
}
