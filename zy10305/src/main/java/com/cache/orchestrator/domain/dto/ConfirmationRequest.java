package com.cache.orchestrator.domain.dto;

import com.cache.orchestrator.domain.enums.ConfirmationStatus;
import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ConfirmationRequest {

    @NotBlank(message = "receiptId 不能为空")
    private String receiptId;

    @NotBlank(message = "nodeId 不能为空")
    private String nodeId;

    @NotNull(message = "status 不能为空")
    private ConfirmationStatus status;

    private String failureReason;

    private Integer keysProcessed;
}
