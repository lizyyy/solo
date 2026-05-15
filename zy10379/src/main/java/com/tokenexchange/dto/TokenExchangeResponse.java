package com.tokenexchange.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TokenExchangeResponse {
    private String shortToken;
    private String userId;
    private String sourceServiceId;
    private String targetServiceId;
    private String scenarioCode;
    private String grantedScopes;
    private LocalDateTime issuedAt;
    private LocalDateTime expiresAt;
    private Integer maxUseCount;
    private String requestId;
    private boolean fromCache;
}
