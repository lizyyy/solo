package com.lineage.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class CalculationRuleDto {

    @NotBlank(message = "规则名称不能为空")
    private String ruleName;

    @NotBlank(message = "规则类型不能为空")
    private String ruleType;

    private String ruleExpression;

    private String description;
}
