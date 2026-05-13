package com.schema.approval.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApprovalRequest {
    @NotNull(message = "Schema version ID is required")
    private Long schemaVersionId;

    @NotBlank(message = "Approver is required")
    private String approver;

    private String approvalComment;

    @NotNull(message = "Approval decision is required")
    private Boolean isApproved;

    @NotNull(message = "Approval step is required")
    private Integer approvalStep;

    @NotNull(message = "Total steps is required")
    private Integer totalSteps;
}
