package com.privacy.export.dto;

import com.privacy.export.enums.ExportRequestStatus;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StatusTransitionRequest {

    @NotNull(message = "目标状态不能为空")
    private ExportRequestStatus targetStatus;

    private String reason;

    @NotBlank(message = "操作人不能为空")
    private String operator;

    private String processingConclusion;
}
