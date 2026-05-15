package com.apidiff.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Map;

@Data
public class ApiDiffRequest {

    @NotBlank(message = "API路径不能为空")
    private String apiPath;

    @NotBlank(message = "HTTP方法不能为空")
    private String httpMethod;

    private Map<String, String> requestHeaders;

    private String requestBody;

    private String queryParams;

    @NotBlank(message = "版本A不能为空")
    private String versionA;

    @NotNull(message = "响应A不能为空")
    private Object responseA;

    private Integer statusCodeA;

    private Long responseTimeA;

    @NotBlank(message = "版本B不能为空")
    private String versionB;

    @NotNull(message = "响应B不能为空")
    private Object responseB;

    private Integer statusCodeB;

    private Long responseTimeB;

    private String createdBy;

    private String tags;
}
