package com.devicecommand.entity;

import com.devicecommand.enums.CommandStatus;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "t_command_batch")
public class CommandBatch {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_no", unique = true, nullable = false, length = 64)
    private String batchNo;

    @Column(name = "command_code", nullable = false, length = 32)
    private String commandCode;

    @Column(name = "command_name", length = 128)
    private String commandName;

    @Column(name = "command_params", length = 2048)
    private String commandParams;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "device_code", nullable = false, length = 64)
    private String deviceCode;

    @Column(name = "channel_id")
    private Long channelId;

    @Column(name = "channel_code", length = 32)
    private String channelCode;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 32)
    private CommandStatus status;

    @Column(name = "timeout_seconds", nullable = false)
    private Integer timeoutSeconds;

    @Column(name = "max_retry_count", nullable = false)
    private Integer maxRetryCount;

    @Column(name = "current_retry_count", nullable = false)
    private Integer currentRetryCount;

    @Column(name = "dispatch_time")
    private LocalDateTime dispatchTime;

    @Column(name = "expected_confirm_time")
    private LocalDateTime expectedConfirmTime;

    @Column(name = "confirm_time")
    private LocalDateTime confirmTime;

    @Column(name = "result_code", length = 32)
    private String resultCode;

    @Column(name = "result_message", length = 512)
    private String resultMessage;

    @Column(name = "final_conclusion", length = 1024)
    private String finalConclusion;

    @Column(name = "handler", length = 64)
    private String handler;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @Version
    private Integer version;

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
        updateTime = LocalDateTime.now();
        if (currentRetryCount == null) currentRetryCount = 0;
        if (maxRetryCount == null) maxRetryCount = 3;
        if (timeoutSeconds == null) timeoutSeconds = 300;
        if (status == null) status = CommandStatus.CREATED;
    }

    @PreUpdate
    protected void onUpdate() {
        updateTime = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
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
    public CommandStatus getStatus() { return status; }
    public void setStatus(CommandStatus status) { this.status = status; }
    public Integer getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(Integer timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
    public Integer getMaxRetryCount() { return maxRetryCount; }
    public void setMaxRetryCount(Integer maxRetryCount) { this.maxRetryCount = maxRetryCount; }
    public Integer getCurrentRetryCount() { return currentRetryCount; }
    public void setCurrentRetryCount(Integer currentRetryCount) { this.currentRetryCount = currentRetryCount; }
    public LocalDateTime getDispatchTime() { return dispatchTime; }
    public void setDispatchTime(LocalDateTime dispatchTime) { this.dispatchTime = dispatchTime; }
    public LocalDateTime getExpectedConfirmTime() { return expectedConfirmTime; }
    public void setExpectedConfirmTime(LocalDateTime expectedConfirmTime) { this.expectedConfirmTime = expectedConfirmTime; }
    public LocalDateTime getConfirmTime() { return confirmTime; }
    public void setConfirmTime(LocalDateTime confirmTime) { this.confirmTime = confirmTime; }
    public String getResultCode() { return resultCode; }
    public void setResultCode(String resultCode) { this.resultCode = resultCode; }
    public String getResultMessage() { return resultMessage; }
    public void setResultMessage(String resultMessage) { this.resultMessage = resultMessage; }
    public String getFinalConclusion() { return finalConclusion; }
    public void setFinalConclusion(String finalConclusion) { this.finalConclusion = finalConclusion; }
    public String getHandler() { return handler; }
    public void setHandler(String handler) { this.handler = handler; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
    public Integer getVersion() { return version; }
    public void setVersion(Integer version) { this.version = version; }
}
