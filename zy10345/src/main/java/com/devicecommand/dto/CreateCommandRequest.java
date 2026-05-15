package com.devicecommand.dto;

import javax.validation.constraints.NotBlank;
import javax.validation.constraints.NotNull;

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

    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getCommandCode() { return commandCode; }
    public void setCommandCode(String commandCode) { this.commandCode = commandCode; }
    public String getCommandName() { return commandName; }
    public void setCommandName(String commandName) { this.commandName = commandName; }
    public String getCommandParams() { return commandParams; }
    public void setCommandParams(String commandParams) { this.commandParams = commandParams; }
    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public Long getChannelId() { return channelId; }
    public void setChannelId(Long channelId) { this.channelId = channelId; }
    public String getChannelCode() { return channelCode; }
    public void setChannelCode(String channelCode) { this.channelCode = channelCode; }
    public Integer getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(Integer timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
    public Integer getMaxRetryCount() { return maxRetryCount; }
    public void setMaxRetryCount(Integer maxRetryCount) { this.maxRetryCount = maxRetryCount; }
    public String getHandler() { return handler; }
    public void setHandler(String handler) { this.handler = handler; }
}
