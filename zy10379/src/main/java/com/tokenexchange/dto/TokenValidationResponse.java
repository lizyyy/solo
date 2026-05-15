package com.tokenexchange.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class TokenValidationResponse {
    private boolean valid;
    private String tokenType;
    private String userId;
    private String serviceId;
    private String scopes;
    private LocalDateTime issuedAt;
    private LocalDateTime expiresAt;
    private Integer useCount;
    private Integer maxUseCount;
    private String message;
    private String requestId;
}
