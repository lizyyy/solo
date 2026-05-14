package com.featureflag.audit.dto;

import lombok.Data;

@Data
public class EvaluateResponse {
    private String requestId;
    private String experimentKey;
    private String userIdentifier;
    private String bucketKey;
    private String bucketValue;
    private String hitResult;
    private String overrideReason;
    private String overrideType;
    private boolean success;
    private String message;
}
