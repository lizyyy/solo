package com.identity.verification.dto;

import lombok.Data;
import java.time.LocalDateTime;

@Data
public class VerificationHistory {
    private LocalDateTime timestamp;
    private String operator;
    private String action;
    private String fieldName;
    private String finalValue;
    private String comments;
}
