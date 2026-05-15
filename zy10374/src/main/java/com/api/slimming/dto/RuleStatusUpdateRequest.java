package com.api.slimming.dto;

import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class RuleStatusUpdateRequest {

    @NotNull(message = "规则ID不能为空")
    private Long ruleId;

    private String operator;

    private String remark;
}
