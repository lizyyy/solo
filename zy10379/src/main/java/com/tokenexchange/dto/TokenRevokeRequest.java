package com.tokenexchange.dto;

import javax.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class TokenRevokeRequest {
    @NotBlank(message = "令牌不能为空")
    private String token;

    private String reason;

    private String operatorId;

    private String requestId;
}
