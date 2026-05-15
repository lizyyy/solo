package com.object.lifecycle.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class CreateArchiveTaskRequest {

    @NotBlank(message = "任务ID不能为空")
    private String taskId;

    @NotNull(message = "规则ID不能为空")
    private Long ruleId;

    @NotBlank(message = "对象key不能为空")
    private String objectKey;

    @NotBlank(message = "桶名不能为空")
    private String bucketName;

    private Long objectSize;

    private String sourceStorageClass;

    private String targetStorageClass;
}
