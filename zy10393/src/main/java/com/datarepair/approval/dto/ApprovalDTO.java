package com.datarepair.approval.dto;

import com.datarepair.approval.enums.ApprovalAction;
import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class ApprovalDTO {

    @NotNull(message = "脚本ID不能为空")
    private Long scriptId;

    @NotNull(message = "审批动作不能为空")
    private ApprovalAction action;

    private String approver;

    private String approverDept;

    private String opinion;

    private Integer approvalLevel;

    @NotNull(message = "是否通过不能为空")
    private Boolean passed;

    private String remark;

    @NotNull(message = "请求ID不能为空")
    private String requestId;
}
