package com.devicecommand.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "t_execution_confirm")
public class ExecutionConfirm {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "batch_id", nullable = false)
    private Long batchId;

    @Column(name = "batch_no", nullable = false, length = 64)
    private String batchNo;

    @Column(name = "confirm_no", unique = true, nullable = false, length = 64)
    private String confirmNo;

    @Column(name = "device_id", nullable = false)
    private Long deviceId;

    @Column(name = "device_code", nullable = false, length = 64)
    private String deviceCode;

    @Column(name = "confirm_source", length = 32)
    private String confirmSource;

    @Column(name = "confirm_result", length = 16)
    private String confirmResult;

    @Column(name = "result_code", length = 32)
    private String resultCode;

    @Column(name = "result_message", length = 512)
    private String resultMessage;

    @Column(name = "result_detail", length = 2048)
    private String resultDetail;

    @Column(name = "confirm_time", nullable = false)
    private LocalDateTime confirmTime;

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
    public String getConfirmNo() { return confirmNo; }
    public void setConfirmNo(String confirmNo) { this.confirmNo = confirmNo; }
    public Long getDeviceId() { return deviceId; }
    public void setDeviceId(Long deviceId) { this.deviceId = deviceId; }
    public String getDeviceCode() { return deviceCode; }
    public void setDeviceCode(String deviceCode) { this.deviceCode = deviceCode; }
    public String getConfirmSource() { return confirmSource; }
    public void setConfirmSource(String confirmSource) { this.confirmSource = confirmSource; }
    public String getConfirmResult() { return confirmResult; }
    public void setConfirmResult(String confirmResult) { this.confirmResult = confirmResult; }
    public String getResultCode() { return resultCode; }
    public void setResultCode(String resultCode) { this.resultCode = resultCode; }
    public String getResultMessage() { return resultMessage; }
    public void setResultMessage(String resultMessage) { this.resultMessage = resultMessage; }
    public String getResultDetail() { return resultDetail; }
    public void setResultDetail(String resultDetail) { this.resultDetail = resultDetail; }
    public LocalDateTime getConfirmTime() { return confirmTime; }
    public void setConfirmTime(LocalDateTime confirmTime) { this.confirmTime = confirmTime; }
    public String getHandler() { return handler; }
    public void setHandler(String handler) { this.handler = handler; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
}
