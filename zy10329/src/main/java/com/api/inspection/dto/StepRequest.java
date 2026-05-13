package com.api.inspection.dto;

import lombok.Data;

import javax.validation.Valid;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.util.List;

@Data
public class StepRequest {
    @NotNull(message = "步骤序号不能为空")
    private Integer stepOrder;

    @NotBlank(message = "步骤名称不能为空")
    private String stepName;

    @NotBlank(message = "HTTP方法不能为空")
    private String httpMethod;

    @NotBlank(message = "URL不能为空")
    private String url;

    private String headers;
    private String body;
    private Integer timeout = 30000;

    @Valid
    private List<VariableExtractRequest> variableExtracts;

    @Valid
    private List<AssertionRequest> assertions;
}
