package com.version.adapter.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AdaptRequest {

    @NotBlank(message = "客户端版本号不能为空")
    private String clientVersion;

    @NotBlank(message = "API端点不能为空")
    private String apiEndpoint;

    @NotBlank(message = "HTTP方法不能为空")
    private String httpMethod;

    @NotNull(message = "原始响应不能为空")
    private Object originalResponse;

    private String requestId;

    private String invokedBy;
}
