package com.audit.logretention.dto;

import com.audit.logretention.enums.FreezeStatus;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class FreezeStatusUpdateRequest {

    @NotBlank(message = "操作人不能为空")
    private String operator;

    @NotNull(message = "目标状态不能为空")
    private FreezeStatus targetStatus;

    private String reviewComment;

    private String operationRemark;

    private String retentionReport;
}