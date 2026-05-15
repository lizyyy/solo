package com.tokenexchange.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TokenValidationRequest {
    @NotBlank(message = "令牌不能为空")
    private String token;

    private String serviceId;

    private String requiredScope;

    private String requestId;
}
