package com.api.inspection.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class VariableExtractRequest {
    @NotBlank(message = "变量名不能为空")
    private String variableName;

    @NotBlank(message = "提取表达式不能为空")
    private String extractExpression;

    @NotBlank(message = "来源类型不能为空")
    private String sourceType;
}
