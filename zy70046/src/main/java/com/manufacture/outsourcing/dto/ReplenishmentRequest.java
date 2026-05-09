package com.manufacture.outsourcing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;

@Data
public class ReplenishmentRequest {

    @NotNull(message = "验收记录ID不能为空")
    private Long inspectionResultId;

    @NotNull(message = "补货数量不能为空")
    @DecimalMin(value = "0.01", message = "补货数量必须大于0")
    private BigDecimal requiredQuantity;

    private LocalDate requiredDate;

    private String taskDescription;
}
