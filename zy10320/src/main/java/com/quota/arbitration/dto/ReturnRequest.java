package com.quota.arbitration.dto;

import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class ReturnRequest {
    @NotNull(message = "归还计划ID不能为空")
    private Long planId;

    @NotNull(message = "归还金额不能为空")
    @Positive(message = "归还金额必须大于0")
    private BigDecimal returnAmount;

    private String remarks;

    private String operator;
}
