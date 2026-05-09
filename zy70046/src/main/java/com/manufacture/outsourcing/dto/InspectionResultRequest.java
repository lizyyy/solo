package com.manufacture.outsourcing.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.math.BigDecimal;

@Data
public class InspectionResultRequest {

    @NotNull(message = "到货批次ID不能为空")
    private Long batchId;

    private BigDecimal sampleQuantity;

    private BigDecimal qualifiedSample;

    @NotNull(message = "合格数量不能为空")
    private BigDecimal qualifiedQuantity;

    @NotNull(message = "不合格数量不能为空")
    private BigDecimal unqualifiedQuantity;

    @NotBlank(message = "验收结论不能为空")
    private String inspectionConclusion;

    private String defectDescription;

    private String inspectionRemark;

    @NotBlank(message = "处理建议不能为空")
    private String processingSuggestion;
}
