package com.compensation.dto;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class FailureReasonDTO {

    private Long id;
    private String failureId;
    private String errorCode;
    private String errorMessage;
    private String errorDetail;
    private String stackTrace;
    private String failedStep;
    private String recoverySuggestion;
    private Boolean recoverable;
    private LocalDateTime createdAt;
}
