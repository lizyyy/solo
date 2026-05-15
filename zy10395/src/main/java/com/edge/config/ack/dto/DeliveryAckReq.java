package com.edge.config.ack.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class DeliveryAckReq {
    @NotBlank(message = "下发单号不能为空")
    private String deliveryNo;

    @NotNull(message = "签收结果不能为空")
    private Integer ackResult;

    private String ackBy;

    private String failureCode;

    private String failureMsg;

    private String failureDetail;

    private String idempotentKey;
}
