package com.object.lifecycle.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class CreateRetentionExceptionRequest {

    @NotBlank(message = "对象key不能为空")
    private String objectKey;

    @NotBlank(message = "桶名不能为空")
    private String bucketName;

    @NotBlank(message = "保留原因不能为空")
    private String reason;

    private String reasonCode;

    @NotNull(message = "生效开始时间不能为空")
    private LocalDateTime effectiveFrom;

    @NotNull(message = "生效结束时间不能为空")
    private LocalDateTime effectiveTo;

    private Long ruleId;
}
