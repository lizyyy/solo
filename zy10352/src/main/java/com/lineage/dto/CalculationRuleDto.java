package com.lineage.dto;

import lombok.Data;

@Data
public class CalculationRuleDto {

    private String ruleName;

    private String ruleType;

    private String ruleExpression;

    private String description;
}
