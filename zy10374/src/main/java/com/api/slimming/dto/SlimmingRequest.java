package com.api.slimming.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class SlimmingRequest {

    @NotBlank(message = "API路径不能为空")
    private String apiPath;

    private String sceneCode;

    @NotBlank(message = "原始响应不能为空")
    private String originalResponse;

    private String requestId;

    private String clientIp;
}
