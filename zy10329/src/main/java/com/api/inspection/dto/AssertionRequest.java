package com.api.inspection.dto;

import com.api.inspection.enums.AssertionType;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class AssertionRequest {
    @NotNull(message = "断言类型不能为空")
    private AssertionType assertionType;

    @NotBlank(message = "期望值不能为空")
    private String expectedValue;

    private String expression;
    private Boolean enabled = true;
}
