package com.airport.baggage.dto.request;

import com.airport.baggage.common.enums.CompensationStatus;
import jakarta.validation.constraints.NotNull;

public class StatusTransitionRequest {
    @NotNull(message = "目标状态不能为空")
    private CompensationStatus targetStatus;

    private String disposalReason;
    private String reviewComment;
    private String operator;

    public CompensationStatus getTargetStatus() { return targetStatus; }
    public void setTargetStatus(CompensationStatus targetStatus) { this.targetStatus = targetStatus; }
    public String getDisposalReason() { return disposalReason; }
    public void setDisposalReason(String disposalReason) { this.disposalReason = disposalReason; }
    public String getReviewComment() { return reviewComment; }
    public void setReviewComment(String reviewComment) { this.reviewComment = reviewComment; }
    public String getOperator() { return operator; }
    public void setOperator(String operator) { this.operator = operator; }
}
