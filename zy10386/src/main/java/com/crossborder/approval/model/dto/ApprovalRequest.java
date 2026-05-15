package com.crossborder.approval.model.dto;

import com.crossborder.approval.model.enums.ApprovalResult;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ApprovalRequest {

    @NotBlank(message = "审批人ID不能为空")
    private String approverId;

    @NotBlank(message = "审批人姓名不能为空")
    private String approverName;

    @NotNull(message = "审批结果不能为空")
    private ApprovalResult result;

    private String comment;
}
