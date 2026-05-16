package com.promptversion.dto;

import lombok.Data;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class HitRecordRequest {
    @NotNull(message = "模板ID不能为空")
    private Long templateId;
    @NotNull(message = "版本ID不能为空")
    private Long versionId;
    @NotBlank(message = "请求ID不能为空")
    private String requestId;
    @NotBlank(message = "用户ID不能为空")
    private String userId;
    private String modelName;
    private String hitReason;
    private Long latencyMs;
}