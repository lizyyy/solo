package com.connector.ratelimit.model.dto;

import com.connector.ratelimit.model.enums.SleepStatus;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class ManualCorrectionRequest {
    @NotBlank(message = "连接器编码不能为空")
    private String connectorCode;

    @NotNull(message = "目标状态不能为空")
    private SleepStatus targetStatus;

    private String reason;

    private String operator;

    private String idempotentKey;
}
