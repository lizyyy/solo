package com.privacy.replay.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class ExecuteReplayRequest {

    @NotBlank(message = "申请ID不能为空")
    private String requestId;
}
