package com.devicecommand.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_dispatch_channel")
@NoArgsConstructor
@AllArgsConstructor
@Builder
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
}
