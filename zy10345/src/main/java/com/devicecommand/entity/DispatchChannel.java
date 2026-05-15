package com.devicecommand.entity;

import javax.persistence.*;
import java.time.LocalDateTime;

@Entity
@Table(name = "t_dispatch_channel")
public class DispatchChannel {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "channel_code", unique = true, nullable = false, length = 32)
    private String channelCode;

    @Column(name = "channel_name", nullable = false, length = 128)
    private String channelName;

    @Column(name = "channel_type", length = 32)
    private String channelType;

    @Column(name = "endpoint", length = 256)
    private String endpoint;

    @Column(name = "auth_info", length = 1024)
    private String authInfo;

    @Column(name = "timeout_seconds")
    private Integer timeoutSeconds;

    @Column(name = "status", length = 16)
    private String status;

    @Column(name = "create_time", nullable = false)
    private LocalDateTime createTime;

    @Column(name = "update_time")
    private LocalDateTime updateTime;

    @PrePersist
    protected void onCreate() {
        createTime = LocalDateTime.now();
        updateTime = LocalDateTime.now();
    }

    @PreUpdate
    protected void onUpdate() {
        updateTime = LocalDateTime.now();
    }

    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }
    public String getChannelCode() { return channelCode; }
    public void setChannelCode(String channelCode) { this.channelCode = channelCode; }
    public String getChannelName() { return channelName; }
    public void setChannelName(String channelName) { this.channelName = channelName; }
    public String getChannelType() { return channelType; }
    public void setChannelType(String channelType) { this.channelType = channelType; }
    public String getEndpoint() { return endpoint; }
    public void setEndpoint(String endpoint) { this.endpoint = endpoint; }
    public String getAuthInfo() { return authInfo; }
    public void setAuthInfo(String authInfo) { this.authInfo = authInfo; }
    public Integer getTimeoutSeconds() { return timeoutSeconds; }
    public void setTimeoutSeconds(Integer timeoutSeconds) { this.timeoutSeconds = timeoutSeconds; }
    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }
    public LocalDateTime getCreateTime() { return createTime; }
    public void setCreateTime(LocalDateTime createTime) { this.createTime = createTime; }
    public LocalDateTime getUpdateTime() { return updateTime; }
    public void setUpdateTime(LocalDateTime updateTime) { this.updateTime = updateTime; }
}
