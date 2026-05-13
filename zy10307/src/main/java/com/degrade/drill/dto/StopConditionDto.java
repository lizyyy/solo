package com.degrade.drill.dto;

import com.degrade.drill.enums.StopConditionType;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class StopConditionDto {
    @NotNull(message = "停止条件类型不能为空")
    private StopConditionType conditionType;

    private Double threshold;

    private String metricName;

    private Long durationSeconds;
}