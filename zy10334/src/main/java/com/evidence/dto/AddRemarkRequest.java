package com.evidence.dto;

import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
@ApiModel("添加备注请求")
public class AddRemarkRequest {

    @NotBlank(message = "请求ID不能为空")
    @ApiModelProperty(value = "证据链请求ID", required = true, example = "REQ-7a1f9b2e-8c3d-4e5f-9a0b-1c2d3e4f5a6b")
    private String requestId;

    @NotBlank(message = "备注内容不能为空")
    @ApiModelProperty(value = "备注内容", required = true, example = "已与客户确认，因网络超时导致重试")
    private String remarkContent;

    @NotBlank(message = "操作人不能为空")
    @ApiModelProperty(value = "操作人", required = true, example = "support01")
    private String operator;
}
