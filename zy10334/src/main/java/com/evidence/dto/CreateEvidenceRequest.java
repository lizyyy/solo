package com.evidence.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
@ApiModel("创建证据链请求")
public class CreateEvidenceRequest {

    @NotBlank(message = "业务单号不能为空")
    @ApiModelProperty(value = "业务单号", required = true, example = "ORD20240514001")
    private String businessNo;

    @NotBlank(message = "请求ID不能为空")
    @ApiModelProperty(value = "幂等请求ID", required = true, example = "REQ-7a1f9b2e-8c3d-4e5f-9a0b-1c2d3e4f5a6b")
    private String requestId;

    @ApiModelProperty(value = "来源系统", example = "ORDER-SYSTEM")
    private String sourceSystem;

    @ApiModelProperty(value = "目标系统", example = "PAYMENT-SYSTEM")
    private String targetSystem;

    @ApiModelProperty(value = "API名称", example = "createPayment")
    private String apiName;

    @ApiModelProperty(value = "请求体", example = "{\"amount\":100,\"currency\":\"CNY\"}")
    private String requestBody;

    @ApiModelProperty(value = "操作人", example = "admin")
    private String operator;
}
