package com.approval.coordinator.model.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.Data;

@Data
public class ItemCallbackResult {

    @NotBlank(message = "单据ID不能为空")
    private String itemId;

    private boolean success;

    private String responseData;

    private String errorCode;

    private String errorMessage;
}
