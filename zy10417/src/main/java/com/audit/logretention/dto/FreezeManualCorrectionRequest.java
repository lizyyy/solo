package com.audit.logretention.dto;

import com.audit.logretention.enums.FreezeReason;
import com.audit.logretention.enums.FreezeStatus;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import java.time.LocalDateTime;

@Data
public class FreezeManualCorrectionRequest {

    @NotBlank(message = "操作人不能为空")
    private String operator;

    private String logTopic;

    private LocalDateTime startTime;

    private LocalDateTime endTime;

    private FreezeReason freezeReason;

    private String freezeReasonDetail;

    private String releaseCondition;

    private FreezeStatus status;

    private String retentionReport;

    private String processingConclusion;

    @NotBlank(message = "修正原因不能为空")
    private String correctionReason;
}