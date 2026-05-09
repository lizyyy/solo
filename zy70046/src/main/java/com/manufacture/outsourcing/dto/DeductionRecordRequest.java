package com.manufacture.outsourcing.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class DeductionRecordRequest {

    @NotNull(message = "验收记录ID不能为空")
    private Long inspectionResultId;

    private Long ruleId;

    @NotNull(message = "扣款金额不能为空")
    @DecimalMin(value = "0.01", message = "扣款金额必须大于0")
    private BigDecimal deductionAmount;

    private String deductionMethod;

    private String defectType;

    private BigDecimal defectiveQuantity;

    private String deductionReason;
}
