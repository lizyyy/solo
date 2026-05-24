package com.dormitory.maintenance.dto;

import com.dormitory.maintenance.enums.ApprovalResult;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;

import java.time.LocalDateTime;

public class ApprovalRequest {
    @NotNull(message = "审批结果不能为空")
    private ApprovalResult result;

    @NotBlank(message = "审批人不能为空")
    private String approver;

    private String approvalRemark;
    private String handlingInstruction;
    private LocalDateTime adjustedStartTime;
    private LocalDateTime adjustedEndTime;
    private Integer approvalLevel = 1;

    public ApprovalResult getResult() { return result; }
    public void setResult(ApprovalResult result) { this.result = result; }
    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public String getApprovalRemark() { return approvalRemark; }
    public void setApprovalRemark(String approvalRemark) { this.approvalRemark = approvalRemark; }
    public String getHandlingInstruction() { return handlingInstruction; }
    public void setHandlingInstruction(String handlingInstruction) { this.handlingInstruction = handlingInstruction; }
    public LocalDateTime getAdjustedStartTime() { return adjustedStartTime; }
    public void setAdjustedStartTime(LocalDateTime adjustedStartTime) { this.adjustedStartTime = adjustedStartTime; }
    public LocalDateTime getAdjustedEndTime() { return adjustedEndTime; }
    public void setAdjustedEndTime(LocalDateTime adjustedEndTime) { this.adjustedEndTime = adjustedEndTime; }
    public Integer getApprovalLevel() { return approvalLevel; }
    public void setApprovalLevel(Integer approvalLevel) { this.approvalLevel = approvalLevel; }
}
