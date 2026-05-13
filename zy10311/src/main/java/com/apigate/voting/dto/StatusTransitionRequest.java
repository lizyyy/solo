package com.apigate.voting.dto;

import com.apigate.voting.model.ProposalStatus;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class StatusTransitionRequest {
    @NotNull(message = "目标状态不能为空")
    private ProposalStatus targetStatus;

    @NotBlank(message = "操作人ID不能为空")
    private String operatorId;

    private String remark;
}
