package com.hotel.lostfound.dto.response;

import com.hotel.lostfound.entity.enums.DisposalType;

import java.time.LocalDateTime;

public class DisposalRecordVO {

    private Long id;

    private DisposalType disposalType;

    private String appliedBy;

    private LocalDateTime appliedAt;

    private String applyReason;

    private boolean managerApproved;

    private String approvedBy;

    private LocalDateTime approvedAt;

    private String approveRemark;

    private String evidenceImageUrls;

    private String handledBy;

    private LocalDateTime disposedAt;

    private String disposalDetail;

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
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
}
