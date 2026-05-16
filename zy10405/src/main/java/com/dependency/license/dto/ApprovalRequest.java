package com.dependency.license.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;
import java.time.LocalDateTime;

@Data
public class ApprovalRequest {
    @NotNull(message = "审批状态不能为空")
    private Boolean approved;

    @NotBlank(message = "审批人不能为空")
    private String approver;

    private String comment;
    private String impactAssessment;
}