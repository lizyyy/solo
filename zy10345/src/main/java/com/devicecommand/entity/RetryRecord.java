package com.devicecommand.entity;

import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;
import lombok.Builder;

import javax.persistence.*;
import java.time.LocalDateTime;

@Data
@Entity
@Table(name = "t_retry_record")
@NoArgsConstructor
@AllArgsConstructor
@Builder
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
}
