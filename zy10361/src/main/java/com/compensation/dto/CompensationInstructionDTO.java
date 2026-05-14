package com.compensation.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class CompensationInstructionDTO {

    @NotBlank(message = "指令类型不能为空")
    private String instructionType;

    @NotBlank(message = "指令内容不能为空")
    private String instructionContent;

    @NotNull(message = "执行顺序不能为空")
    private Integer executionOrder;

    private Boolean requireManualConfirm = false;

    private Integer maxRetry = 3;
}
