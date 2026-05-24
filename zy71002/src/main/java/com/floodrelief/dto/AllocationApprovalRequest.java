package com.floodrelief.dto;

import lombok.Data;

@Data
public class AllocationApprovalRequest {
    private String approver;
    private String rejectReason;
}
