package com.edge.config.ack.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;

@Data
public class DeliveryCreateReq {
    @NotBlank(message = "节点编码不能为空")
    private String nodeCode;

    @NotBlank(message = "版本号不能为空")
    private String versionNo;

    private String idempotentKey;
}
