package com.diagnostic.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class ManualCorrectionRequest {
    @NotNull(message = "诊断记录ID不能为空")
    private Long id;

    private Boolean suspectedLeak;

    private Integer leakConfidence;

    @NotBlank(message = "复核人不能为空")
    private String reviewer;

    private String reviewComment;

    @NotBlank(message = "处理依据不能为空")
    private String processingBasis;

    private String finalConclusion;
}