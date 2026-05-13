package com.evidence.dto;

import com.evidence.enums.ActionType;
import io.swagger.annotations.ApiModel;
import io.swagger.annotations.ApiModelProperty;
import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
@ApiModel("添加动作请求")
public class AddActionRequest {

    @NotBlank(message = "请求ID不能为空")
    @ApiModelProperty(value = "证据链请求ID", required = true, example = "REQ-7a1f9b2e-8c3d-4e5f-9a0b-1c2d3e4f5a6b")
    private String requestId;

    @NotNull(message = "动作类型不能为空")
    @ApiModelProperty(value = "动作类型", required = true, example = "EXTERNAL_CALL")
    private ActionType actionType;

    @ApiModelProperty(value = "动作名称", example = "调用支付接口")
    private String actionName;

    @ApiModelProperty(value = "动作详情", example = "调用第三方支付接口")
    private String actionDetail;

    @ApiModelProperty(value = "外部关联号", example = "PAY20240514001")
    private String externalRefNo;

    @ApiModelProperty(value = "回执数据", example = "{\"code\":\"0000\",\"message\":\"success\"}")
    private String receiptData;

    @ApiModelProperty(value = "操作人", example = "system")
    private String operator;

    @ApiModelProperty(value = "扩展信息")
    private String extendInfo;
}
