package com.observability.tagvalidation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.List;

@Data
public class CreateApiRequest {
    @NotBlank(message = "requestId 不能为空")
    @Size(max = 64, message = "requestId 长度不能超过64")
    private String requestId;

    @NotBlank(message = "apiName 不能为空")
    @Size(max = 256, message = "apiName 长度不能超过256")
    private String apiName;

    @Size(max = 512, message = "apiPath 长度不能超过512")
    private String apiPath;

    @Size(max = 16, message = "apiMethod 长度不能超过16")
    private String apiMethod;

    @Size(max = 128, message = "serviceName 长度不能超过128")
    private String serviceName;

    @Size(max = 1024, message = "description 长度不能超过1024")
    private String description;

    @Size(max = 64, message = "createdBy 长度不能超过64")
    private String createdBy;

    private List<TagKeyRequest> tagKeys;

    @Data
    public static class TagKeyRequest {
        @NotBlank(message = "keyName 不能为空")
        @Size(max = 128, message = "keyName 长度不能超过128")
        private String keyName;

        @Size(max = 512, message = "description 长度不能超过512")
        private String description;

        private Boolean required = false;

        @Size(max = 256, message = "valuePattern 长度不能超过256")
        private String valuePattern;

        private List<String> allowedValues;
    }
}
