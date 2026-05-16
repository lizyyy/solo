package com.connector.ratelimit.model.dto;

import com.connector.ratelimit.model.enums.FailureReason;
import com.connector.ratelimit.model.enums.RateLimitType;
import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class RateLimitDetectRequest {
    @NotBlank(message = "连接器编码不能为空")
    private String connectorCode;

    private RateLimitType limitType;

    private FailureReason failureReason;

    private String rawResponse;

    private String requestId;

    private String idempotentKey;
}
