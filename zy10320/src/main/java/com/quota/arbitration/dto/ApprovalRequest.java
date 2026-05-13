package com.quota.arbitration.dto;

import com.quota.arbitration.enums.ApprovalResult;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ApprovalRequest {
    @NotNull(message = "申请ID不能为空")
    private Long applicationId;

    @NotNull(message = "审批结果不能为空")
    private ApprovalResult result;

    private String opinion;

    @NotBlank(message = "审批人不能为空")
    private String approver;

    private BigDecimal approvedAmount;
}
