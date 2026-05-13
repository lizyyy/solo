package com.degrade.drill.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateDrillRequest {
    @NotBlank(message = "requestId不能为空")
    private String requestId;

    @NotBlank(message = "演练名称不能为空")
    private String planName;

    private String description;

    private String createdBy;

    @Valid
    @NotNull(message = "目标接口配置不能为空")
    private TargetApiDto targetApi;

    @Valid
    @NotNull(message = "兜底响应配置不能为空")
    private FallbackResponseDto fallbackResponse;

    @Valid
    @NotNull(message = "停止条件不能为空")
    private StopConditionDto stopCondition;
}