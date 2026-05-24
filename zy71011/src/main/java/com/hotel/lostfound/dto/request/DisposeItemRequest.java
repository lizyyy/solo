package com.hotel.lostfound.dto.request;

import com.hotel.lostfound.entity.enums.DisposalType;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class DisposeItemRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotNull(message = "物品ID不能为空")
    private Long itemId;

    @NotNull(message = "处置类型不能为空")
    private DisposalType disposalType;

    @NotBlank(message = "申请人不能为空")
    private String appliedBy;

    @NotNull(message = "申请时间不能为空")
    private LocalDateTime appliedAt;

    private String applyReason;

    private boolean managerApproved;

    private String approvedBy;

    private LocalDateTime approvedAt;

    private String approveRemark;

    private String evidenceImageUrls;

    @NotBlank(message = "处理人不能为空")
    private String handledBy;

    @NotNull(message = "处置时间不能为空")
    private LocalDateTime disposedAt;

    private String disposalDetail;

    public String getRequestId() {
        return requestId;
    }

    public void setRequestId(String requestId) {
        this.requestId = requestId;
    }

    public Long getItemId() {
        return itemId;
    }

    public void setItemId(Long itemId) {
        this.itemId = itemId;
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
