package com.devicecommand.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "t_timeout_reason")
public class TimeoutReason {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "batch_no", nullable = false, length = 64)
    private String batchNo;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "device_code", nullable = false, length = 64)
    private String deviceCode;

    @Column(name = "timeout_type", length = 32)
    private String timeoutType;

    @Column(name = "reason_code", length = 32)
    private String reasonCode;

    @Column(name = "reason_description", length = 512)
    private String reasonDescription;

    @Column(name = "detail_info", length = 2048)
    private String detailInfo;

    @Column(name = "detect_time", nullable = false)
    private LocalDateTime detectTime;

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
    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getTimeoutType() { return timeoutType; }
    public void setTimeoutType(String timeoutType) { this.timeoutType = timeoutType; }
    public String getReasonCode() { return reasonCode; }
    public void setReasonCode(String reasonCode) { this.reasonCode = reasonCode; }
    public String getReasonDescription() { return reasonDescription; }
    public void setReasonDescription(String reasonDescription) { this.reasonDescription = reasonDescription; }
    public String getDetailInfo() { return detailInfo; }
    public void setDetailInfo(String detailInfo) { this.detailInfo = detailInfo; }
    public LocalDateTime getDetectTime() { return detectTime; }
    public void setDetectTime(LocalDateTime detectTime) { this.detectTime = detectTime; }
    public String getHandler() { return handler; }
    public void setHandler(String handler) { this.handler = handler; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
