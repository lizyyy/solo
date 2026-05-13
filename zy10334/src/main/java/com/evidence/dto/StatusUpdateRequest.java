package com.evidence.dto;

import com.evidence.enums.EvidenceStatus;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
@ApiModel("状态更新请求")
public class StatusUpdateRequest {

    @NotBlank(message = "请求ID不能为空")
    @ApiModelProperty(value = "证据链请求ID", required = true, example = "REQ-7a1f9b2e-8c3d-4e5f-9a0b-1c2d3e4f5a6b")
    private String requestId;

    @NotNull(message = "目标状态不能为空")
    @ApiModelProperty(value = "目标状态", required = true, example = "SUCCESS")
    private EvidenceStatus targetStatus;

    @ApiModelProperty(value = "响应体", example = "{\"code\":\"0000\",\"message\":\"success\"}")
    private String responseBody;

    @ApiModelProperty(value = "错误信息")
    private String errorMessage;

    @ApiModelProperty(value = "操作人", example = "system")
    private String operator;
}
