package com.apidiff.dto;

import com.apidiff.entity.enums.ConfirmationStatus;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StatusUpdateRequest {

    @NotNull(message = "状态不能为空")
    private ConfirmationStatus status;

    private String attributionNote;

    private String operatedBy;

    private String remark;
}
