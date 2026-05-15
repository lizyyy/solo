package com.sensitive.operation.dto;

import com.sensitive.operation.enums.RiskLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class CreateOperationRequest {

    @NotBlank(message = "操作ID不能为空")
    private String requestId;

    @NotBlank(message = "操作类型不能为空")
    private String operationType;

    @NotBlank(message = "申请人ID不能为空")
    private String requesterId;

    @NotBlank(message = "申请人姓名不能为空")
    private String requesterName;

    @NotNull(message = "风险等级不能为空")
    private RiskLevel riskLevel;

    private String operationData;

    private Integer expireMinutes;
}
