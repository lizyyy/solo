package com.audit.logretention.dto;

import com.audit.logretention.enums.FreezeReason;
import com.audit.logretention.enums.FreezeStatus;
import lombok.Data;

import java.time.LocalDateTime;

@Data
public class FreezeQueryRequest {

    private String requestId;

    private String logTopic;

    private FreezeStatus status;

    private FreezeReason freezeReason;

    private String applicant;

    private LocalDateTime startTimeFrom;

    private LocalDateTime startTimeTo;

    private Integer pageNum = 0;

    private Integer pageSize = 20;
}