package com.floodrelief.dto;

import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class AllocationRequest {
    @NotNull(message = "安置点ID不能为空")
    private Long shelterId;

    @NotNull(message = "物资批次ID不能为空")
    private Long materialBatchId;

    @NotNull(message = "数量不能为空")
    private Integer quantity;

    private String applicant;

    private String remark;
}
