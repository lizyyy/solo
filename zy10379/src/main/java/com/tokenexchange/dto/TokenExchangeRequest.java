package com.tokenexchange.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TokenExchangeRequest {
    @NotBlank(message = "用户令牌不能为空")
    private String userToken;

    @NotBlank(message = "源服务ID不能为空")
    private String sourceServiceId;

    @NotBlank(message = "目标服务ID不能为空")
    private String targetServiceId;

    private String scenarioCode;

    private String requestedScopes;

    private Integer expireMinutes;

    private Integer maxUseCount = 1;

    private String requestId;
}
