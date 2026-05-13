package com.devicecommand.dto;

import lombok.Data;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

@Data
public class CreateCommandRequest {

    @NotBlank(message = "批次号不能为空")
    private String batchNo;

    @NotBlank(message = "命令编码不能为空")
    private String commandCode;

    private String commandName;

    private String commandParams;

    @NotNull(message = "设备ID不能为空")
    private Long deviceId;

    @NotBlank(message = "设备编码不能为空")
    private String deviceCode;

    private Long channelId;

    private String channelCode;

    private Integer timeoutSeconds;

    private Integer maxRetryCount;

    private String handler;
}
