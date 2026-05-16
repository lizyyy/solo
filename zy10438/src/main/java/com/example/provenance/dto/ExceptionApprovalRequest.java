package com.example.provenance.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ExceptionApprovalRequest {

    @NotBlank(message = "审批人不能为空")
    private String approver;

    @NotNull(message = "审批结果不能为空")
    private Boolean approved;

    private String approvalComment;
}
