package com.api.slimming.dto;

import lombok.Data;

@Data
public class SlimmingResult {

    private String requestId;

    private String ruleNo;

    private String apiPath;

    private String sceneCode;

    private String slimmedResponse;

    private Integer originalSize;

    private Integer slimmedSize;

    private Integer savedSize;

    private Double savedRatio;

    private Boolean success;

    private String errorMessage;
}
