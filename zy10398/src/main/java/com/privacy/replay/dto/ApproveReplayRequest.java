package com.privacy.replay.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class ApproveReplayRequest {

    @NotBlank(message = "申请ID不能为空")
    private String requestId;

    @NotBlank(message = "审批人ID不能为空")
    private String approverId;

    @NotNull(message = "是否批准不能为空")
    private Boolean approved;

    private String comment;
}
