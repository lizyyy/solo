package com.edge.config.ack.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class EffectiveCheckReq {
    @NotBlank(message = "下发单号不能为空")
    private String deliveryNo;

    @NotNull(message = "校验结果不能为空")
    private Integer checkResult;

    private String checkDetail;

    private String checkBy;

    private String failureCode;

    private String failureMsg;

    private String failureDetail;
}
