package com.featureflag.audit.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class EvaluateRequest {
    @NotBlank(message = "requestId不能为空")
    private String requestId;

    @NotBlank(message = "experimentKey不能为空")
    private String experimentKey;

    @NotBlank(message = "userIdentifier不能为空")
    private String userIdentifier;

    @NotNull(message = "userAttributes不能为空")
    private UserAttributes userAttributes;
}
