package com.approval.coordinator.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ApprovalItemRequest {

    @NotBlank(message = "单据ID不能为空")
    private String itemId;

    @NotBlank(message = "幂等键不能为空")
    private String idempotentKey;

    private String businessData;

    private String callbackPayload;
}
