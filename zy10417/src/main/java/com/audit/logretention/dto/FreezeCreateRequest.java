package com.audit.logretention.dto;

import com.audit.logretention.enums.FreezeReason;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import java.time.LocalDateTime;

@Data
public class FreezeCreateRequest {

    @NotBlank(message = "请求ID不能为空")
    private String requestId;

    @NotBlank(message = "日志主题不能为空")
    private String logTopic;

    @NotNull(message = "开始时间不能为空")
    private LocalDateTime startTime;

    @NotNull(message = "结束时间不能为空")
    private LocalDateTime endTime;

    @NotNull(message = "冻结原因不能为空")
    private FreezeReason freezeReason;

    private String freezeReasonDetail;

    @NotBlank(message = "申请人不能为空")
    private String applicant;

    private String releaseCondition;
}