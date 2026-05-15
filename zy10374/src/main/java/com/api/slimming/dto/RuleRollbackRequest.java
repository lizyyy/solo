package com.api.slimming.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class RuleRollbackRequest {

    @NotNull(message = "规则ID不能为空")
    private Long ruleId;

    @NotBlank(message = "回滚目标版本不能为空")
    private String targetVersion;

    private String operator;

    private String remark;
}
