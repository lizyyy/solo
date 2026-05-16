package com.diagnostic.dto;

import com.diagnostic.enums.DiagnosticStatus;
import lombok.Data;

import javax.validation.constraints.NotNull;

@Data
public class StatusUpdateRequest {
    @NotNull(message = "诊断记录ID不能为空")
    private Long id;

    @NotNull(message = "目标状态不能为空")
    private DiagnosticStatus targetStatus;

    private String processingBasis;
    private String finalConclusion;
    private String reviewer;
    private String reviewComment;
}