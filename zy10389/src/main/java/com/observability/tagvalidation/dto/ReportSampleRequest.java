package com.observability.tagvalidation.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import lombok.Data;

import java.util.Map;

@Data
public class ReportSampleRequest {
    @NotBlank(message = "requestId 不能为空")
    @Size(max = 64, message = "requestId 长度不能超过64")
    private String requestId;

    @NotBlank(message = "sampleId 不能为空")
    @Size(max = 64, message = "sampleId 长度不能超过64")
    private String sampleId;

    @Size(max = 128, message = "source 长度不能超过128")
    private String source;

    @NotNull(message = "tags 不能为空")
    private Map<String, String> tags;
}
