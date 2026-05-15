package com.object.lifecycle.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateDeletionCandidateRequest {

    @NotBlank(message = "对象key不能为空")
    private String objectKey;

    @NotBlank(message = "桶名不能为空")
    private String bucketName;

    private Long objectSize;

    @NotNull(message = "规则ID不能为空")
    private Long ruleId;

    private LocalDateTime lastModifiedDate;

    private LocalDateTime scheduledDeletionDate;
}
