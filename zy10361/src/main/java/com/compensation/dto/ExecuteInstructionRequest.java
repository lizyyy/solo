package com.compensation.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class ExecuteInstructionRequest {

    @NotBlank(message = "执行ID不能为空")
    private String executionId;

    private String executor;

    private String resultDetail;

    private Boolean forceFail = false;
}
