package com.api.slimming.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class RuleValidateRequest {

    @NotNull(message = "规则ID不能为空")
    private Long ruleId;

    @NotBlank(message = "原始响应样本不能为空")
    private String originalResponse;

    private String operator;

    private String remark;
}
