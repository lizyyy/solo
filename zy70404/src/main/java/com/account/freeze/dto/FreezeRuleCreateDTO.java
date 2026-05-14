package com.account.freeze.dto;

import lombok.Data;

import jakarta.validation.constraints.NotBlank;

@Data
public class FreezeRuleCreateDTO {

    @NotBlank(message = "规则名称不能为空")
    private String ruleName;

    private String ruleContent;

    private String ruleDesc;

    @NotBlank(message = "操作人不能为空")
    private String operator;
}
