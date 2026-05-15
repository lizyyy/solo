package com.devicecommand.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "t_retry_record")
public class RetryRecord {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "batch_no", nullable = false, length = 64)
    private String batchNo;

    @Column(name = "retry_no", unique = true, nullable = false, length = 64)
    private String retryNo;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "device_code", nullable = false, length = 64)
    private String deviceCode;

    @Column(name = "retry_count", nullable = false)
    private Integer retryCount;

    @Column(name = "channel_id")
    private Long channelId;

    @Column(name = "channel_code", length = 32)
    private String channelCode;

    @Column(name = "retry_reason", length = 512)
    private String retryReason;

    @Column(name = "retry_time", nullable = false)
    private LocalDateTime retryTime;

    @Column(name = "expected_confirm_time")
    private LocalDateTime expectedConfirmTime;

    @Column(name = "retry_result", length = 16)
    private String retryResult;

    @Column(name = "handler", length = 64)
    private String handler;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public Long getBatchId() { return batchId; }
    public void setBatchId(Long batchId) { this.batchId = batchId; }
    public String getBatchNo() { return batchNo; }
    public void setBatchNo(String batchNo) { this.batchNo = batchNo; }
    public String getRetryNo() { return retryNo; }
    public void setRetryNo(String retryNo) { this.retryNo = retryNo; }
    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public Integer getRetryCount() { return retryCount; }
    public void setRetryCount(Integer retryCount) { this.retryCount = retryCount; }
    public Long getChannelId() { return channelId; }
    public void setChannelId(Long channelId) { this.channelId = channelId; }
    public String getChannelCode() { return channelCode; }
    public void setChannelCode(String channelCode) { this.channelCode = channelCode; }
    public String getRetryReason() { return retryReason; }
    public void setRetryReason(String retryReason) { this.retryReason = retryReason; }
    public LocalDateTime getRetryTime() { return retryTime; }
    public void setRetryTime(LocalDateTime retryTime) { this.retryTime = retryTime; }
    public LocalDateTime getExpectedConfirmTime() { return expectedConfirmTime; }
    public void setExpectedConfirmTime(LocalDateTime expectedConfirmTime) { this.expectedConfirmTime = expectedConfirmTime; }
    public String getRetryResult() { return retryResult; }
    public void setRetryResult(String retryResult) { this.retryResult = retryResult; }
    public String getHandler() { return handler; }
    public void setHandler(String handler) { this.handler = handler; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
