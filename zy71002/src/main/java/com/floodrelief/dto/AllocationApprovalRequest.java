package com.floodrelief.dto;

public class AllocationApprovalRequest {
    private String approver;
    private String rejectReason;

    public String getApprover() { return approver; }
    public void setApprover(String approver) { this.approver = approver; }
    public String getRejectReason() { return rejectReason; }
    public void setRejectReason(String rejectReason) { this.rejectReason = rejectReason; }
}
